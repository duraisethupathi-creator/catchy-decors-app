import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button, Card, Field, SectionTitle } from '../../src/components/common';
import { toast } from '../../src/components/common/ui';
import { colors } from '../../src/constants/colors';
import { PRODUCTS, quantityColumnLabel, getProduct, type ProductKey } from '../../src/constants/products';
import { getCustomer } from '../../src/services/customerService';
import {
  loadDraftMeasurements,
  loadDraftAccessories,
  saveChargesDraft,
  loadChargesDraft,
  type MeasurementInput,
  buildMeasurement,
} from '../../src/services/measurementService';
import {
  buildCharges,
  computeGrandTotal,
  otherChargesTotalFrom,
  bundleFromChargesWithExtras,
  saveQuotation,
  emptyChargesBundle,
  newExtraRow,
  stitchingQuantity,
  type ChargesBundle,
  type ExtraChargeRow,
} from '../../src/services/quotationService';
import { nextQuotationNumber, peekQuotationNumber } from '../../src/utils/quotationNumber';
import { formatINR } from '../../src/utils/currency';
import { numericInput } from '../../src/utils/validation';
import { round2, calculateAccessories, calculateCurtainQty, calculateSquareFeet, calculateSquareFeetMm, calculateWallpaperQty, calculateTotal } from '../../src/utils/calculations';
import type { Customer } from '../../src/types/customer';
import type { Measurement, Accessory, OtherCharge } from '../../src/types/measurement';
import type { MaterialReferencePhoto, Quotation } from '../../src/types/quotation';

const uid = () => Math.random().toString(36).slice(2);

interface AccRow {
  id: string;
  area: string;
  trackType: string;
  width: string;
  price: string;
}

export default function EditQuotation() {
  const params = useLocalSearchParams<{ id?: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [items, setItems] = useState<Measurement[]>([]);
  const [accRows, setAccRows] = useState<AccRow[]>([]);
  const [qNumber, setQNumber] = useState('');
  const [charges, setCharges] = useState<ChargesBundle>(emptyChargesBundle);
  const [saving, setSaving] = useState(false);
  const [fabricCommonRates, setFabricCommonRates] = useState<Record<string, string>>({});
  const [commonLiningRate, setCommonLiningRate] = useState('');
  const [referencePhotos, setReferencePhotos] = useState<MaterialReferencePhoto[]>([]);
  const [showAddCurtain, setShowAddCurtain] = useState(false);
  const [editingItem, setEditingItem] = useState<Measurement | null>(null);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [addProductForm, setAddProductForm] = useState({ product: 'blinds' as ProductKey, area: '', type: 'Roller', width: '', height: '', quantity: '', price: '', fabric: '', part: '', unit: 'inch' as 'inch' | 'mm', manualFabricMtr: '', additionalSqft: '', description: '', frameColor: '', openMethod: 'Bottom Open' as 'Bottom Open' | 'Left Open' | 'Right Open', leftOpenCount: '', rightOpenCount: '', doorSplitCount: '', liningType: '', liningFabric: '', gst: '0' });
  const [itemForm, setItemForm] = useState({ area: '', type: '', width: '', height: '', quantity: '', price: '', fabric: '', fabricArea: '', part: '', liningType: '', liningFabric: '', liningQuantity: '', liningPrice: '' });
  const [newCurtain, setNewCurtain] = useState({ area: '', part: '', width: '', height: '', fabric: '', lining: '', liningFabric: '', price: '' });
  const draftReady = useRef(false);
  const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const { getQuotation } = await import('../../src/services/quotationService');
        const existing = params.id ? await getQuotation(String(params.id)) : null;
        const cid = existing?.customer_id ?? (await AsyncStorage.getItem('cd_current_customer'));
        if (!cid) {
          router.replace('/customer/new?mode=quotation');
          return;
        }
        const c = await getCustomer(cid);
        setCustomer(c);
        setItems(existing?.items ?? await loadDraftMeasurements(cid));
        const draftAcc = existing?.accessories ?? await loadDraftAccessories(cid);
        setAccRows(
          draftAcc.map((a) => ({
            id: a.id,
            area: a.area_name,
            trackType: a.track_type,
            width: String(a.width || ''),
            price: String(a.price || ''),
          }))
        );
        const draftCharges = existing?.charges ?? await loadChargesDraft(cid);
        if (draftCharges.length > 0) setCharges(bundleFromChargesWithExtras(draftCharges));
        if(existing?.reference_photos) setReferencePhotos(existing.reference_photos);
        setQNumber(existing?.quotation_number ?? await peekQuotationNumber());
        draftReady.current = true;
      })();
    }, [params.id])
  );

  // Keep Accessories + Other Charges safe even when the user presses Android Back
  // or navigates to another screen without tapping Save Draft.
  useEffect(() => {
    if (!draftReady.current || !customer) return;
    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    draftSaveTimer.current = setTimeout(async () => {
      const accDraft: Accessory[] = accRows.map((r) => ({
        id: r.id,
        customer_id: customer.id,
        area_name: r.area,
        track_type: r.trackType,
        width: Number(r.width) || 0,
        quantity: calculateAccessories(r.width),
        price: Number(r.price) || 0,
        total: calculateTotal(calculateAccessories(r.width), r.price),
      }));
      await saveAccessories(customer.id, accDraft);
      await saveChargesDraft(customer.id, buildCharges({ ...charges, stitchingQty: String(curtainParts || '') }).charges);
    }, 250);
    return () => { if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current); };
  }, [accRows, charges, customer, curtainParts]);

  function accQty(r: AccRow): number { return calculateAccessories(r.width); }
  function accTotal(r: AccRow): number { return calculateTotal(accQty(r), r.price); }

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.total, 0), [items]);
  const accessoriesTotal = useMemo(() => accRows.reduce((s, r) => s + accTotal(r), 0), [accRows]);
  const curtainParts = useMemo(() => round2(items.filter((i) => i.product_type === 'curtains').reduce((s, i) => s + (i.part || 0), 0)), [items]);
  const liningItems = useMemo(() => items.filter(i => i.product_type === 'curtains' && i.type !== 'Sheer' && !!i.lining_type), [items]);
  const effectiveCharges = useMemo(() => ({ ...charges, stitchingQty: String(curtainParts || ''), extras: [
    ...liningItems.filter(i => Number(i.lining_price) > 0 && Number(i.lining_quantity ?? i.quantity) > 0).map(i => ({ id: `lining-${i.id}`, description: `${i.lining_type} - ${i.area_name}`, quantity: String(i.lining_quantity ?? i.quantity), amount: String(i.lining_price) })),
    ...charges.extras.filter(r => !String(r.id).startsWith('lining-') && !/^(Blackout Lining|Semi Lining)\s*-/i.test(r.description)),
  ] }), [charges, curtainParts, liningItems]);
  const bundle = useMemo(() => buildCharges(effectiveCharges), [effectiveCharges]);
  const grandTotal = computeGrandTotal(subtotal, accessoriesTotal, bundle.totals);
  const fabricNote = (() => {
    const mtr = round2(items.filter((i) => i.product_type === 'curtains').reduce((s, i) => s + (i.quantity || 0), 0));
    const sqft = round2(items.reduce((s, i) => s + (i.fabric_area || 0), 0));
    const parts: string[] = [];
    if (mtr) parts.push(`curtains ${mtr} mtr`);
    if (sqft) parts.push(`fabric area ${sqft} sq.ft`);
    return parts.length ? `Fabric total: ${parts.join(' · ')}` : '';
  })();

  function getNewProductQuantity() {
    const f = addProductForm, product = f.product, type = f.type.toLowerCase();
    const w = Number(f.width) || 0, h = Number(f.height) || 0;
    if (product === 'curtains') return calculateCurtainQty(f.part, h);
    if (product === 'accessories') return calculateAccessories(w);
    if (product === 'cushion') return Math.max(0, w);
    if (product === 'wallpaper') return calculateWallpaperQty(w, h, false, f.type === 'Normal Wallpaper' ? 'Normal Wallpaper' : 'Customize').qty;
    if (product === 'blinds' && type === 'roman') return Math.max(0, Number(f.manualFabricMtr) || 0);
    if (product === 'mosquito_net' && type === 'velcro net') {
      const factor = f.unit === 'mm' ? 25.4 : 1;
      const cutW = w / factor + 2, cutH = h / factor + 2;
      return Math.ceil((cutW * cutH) / 144) + Math.max(0, Number(f.additionalSqft) || 0);
    }
    if ((product === 'blinds' || product === 'mosquito_net') && f.unit === 'mm') return calculateSquareFeetMm(w, h);
    if (getProduct(product).usesHeight) return calculateSquareFeet(w, h);
    return Math.max(0, w);
  }
  const newProductQuantity = getNewProductQuantity();
  const newProductTotal = calculateTotal(newProductQuantity, addProductForm.price);

  function addProductItem() {
    if (!customer) return;
    const f = addProductForm, def = getProduct(f.product), quantity = newProductQuantity;
    if (!f.area.trim()) { toast('Enter Area / Room Name'); return; }
    if (quantity <= 0) { toast('Enter valid measurements / fabric quantity'); return; }
    if (f.product === 'curtains' && Number(f.part) <= 0) { toast('Enter Curtain Part'); return; }
    if (f.product === 'mosquito_net' && (!Number(f.width) || !Number(f.height))) { toast('Enter mosquito net width and height'); return; }
    if (f.product === 'mosquito_net' && f.type.toUpperCase() === 'DOOR NET') {
      if (!f.frameColor.trim() || Number(f.doorSplitCount) <= 0) { toast('Enter Door Net frame colour and split count'); return; }
      if (f.openMethod === 'Left Open' && Number(f.leftOpenCount) <= 0) { toast('Enter Left Open Count'); return; }
      if (f.openMethod === 'Right Open' && Number(f.rightOpenCount) <= 0) { toast('Enter Right Open Count'); return; }
    }
    const price = Math.max(0, Number(f.price) || 0);
    const mosquitoMeta = f.product === 'mosquito_net' ? JSON.stringify({ __mosquitoMeta: 1, description: f.description.trim(), additionalSqft: Number(f.additionalSqft) || 0, frameColor: f.frameColor.trim(), openMethod: f.openMethod, leftOpenCount: Number(f.leftOpenCount) || 0, rightOpenCount: Number(f.rightOpenCount) || 0, doorSplitCount: Number(f.doorSplitCount) || 0 }) : undefined;
    const item: Measurement = {
      id: uid(), customer_id: customer.id, product_type: f.product,
      area_name: f.area.trim(), type: f.type.trim(),
      width: Math.max(0, Number(f.width) || 0),
      height: def.usesHeight ? Math.max(0, Number(f.height) || 0) : 0,
      quantity, price, total: calculateTotal(quantity, price),
      fabric_type: mosquitoMeta ?? f.fabric.trim(),
      part: f.product === 'curtains' ? Number(f.part) || 0 : undefined,
      measurement_unit: f.unit,
      fabric_quantity_mtr: f.product === 'headboard' ? Number(f.manualFabricMtr) || 0 : undefined,
      lining_type: f.product === 'curtains' && f.liningType ? f.liningType as Measurement['lining_type'] : undefined,
      lining_fabric: f.liningFabric.trim(),
      lining_quantity: f.product === 'curtains' && f.liningType ? quantity : 0,
      lining_price: 0, lining_total: 0,
      gst_percent: Math.max(0, Number(f.gst) || 0),
    };
    setItems(current => [...current, item]);
    setAddProductForm({ product: 'blinds', area: '', type: 'Roller', width: '', height: '', quantity: '', price: '', fabric: '', part: '', unit: 'inch', manualFabricMtr: '', additionalSqft: '', description: '', frameColor: '', openMethod: 'Bottom Open', leftOpenCount: '', rightOpenCount: '', doorSplitCount: '', liningType: '', liningFabric: '', gst: '0' });
    setShowAddProduct(false);
    toast(def.name + ' added · formula calculated');
  }

  function removeQuotationItem(item: Measurement) {
    Alert.alert('Remove item?', 'This product will be removed from this quotation.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => {
        setItems(current => current.filter(row => row.id !== item.id));
        toast('Item removed from quotation');
      }},
    ]);
  }

  function openItemEditor(item: Measurement) {
    setEditingItem(item);
    setItemForm({
      area: item.area_name ?? '', type: item.type ?? '', width: String(item.width ?? ''),
      height: String(item.height ?? ''), quantity: String(item.quantity ?? ''),
      price: String(item.price ?? ''), fabric: item.fabric_type ?? '',
      fabricArea: String(item.fabric_area ?? ''), part: String(item.part ?? ''),
      liningType: item.lining_type ?? '', liningFabric: item.lining_fabric ?? '',
      liningQuantity: String(item.lining_quantity ?? ''), liningPrice: String(item.lining_price ?? ''),
    });
  }

  function saveItemEdit() {
    if (!editingItem) return;
    const quantity = Math.max(0, Number(itemForm.quantity) || 0);
    const price = Math.max(0, Number(itemForm.price) || 0);
    const updated: Measurement = {
      ...editingItem,
      area_name: itemForm.area.trim() || editingItem.area_name,
      type: itemForm.type.trim(),
      width: Math.max(0, Number(itemForm.width) || 0),
      height: Math.max(0, Number(itemForm.height) || 0),
      quantity,
      price,
      total: calculateTotal(quantity, price),
      fabric_type: itemForm.fabric.trim(),
      fabric_area: Math.max(0, Number(itemForm.fabricArea) || 0),
      part: itemForm.part.trim() ? Math.max(0, Number(itemForm.part) || 0) : undefined,
      lining_type: itemForm.liningType === 'Blackout Lining' || itemForm.liningType === 'Semi Lining' ? itemForm.liningType : undefined,
      lining_fabric: itemForm.liningFabric.trim(),
      lining_quantity: Math.max(0, Number(itemForm.liningQuantity) || 0),
      lining_price: Math.max(0, Number(itemForm.liningPrice) || 0),
      lining_total: calculateTotal(itemForm.liningQuantity, itemForm.liningPrice),
    };
    setItems(rows => rows.map(row => row.id === editingItem.id ? updated : row));
    setEditingItem(null);
    toast('Item updated. Quotation total recalculated.');
  }

  function addCurtainToQuotation() {
    if (!customer) return;
    if (!newCurtain.area.trim() || Number(newCurtain.part) <= 0 || Number(newCurtain.width) <= 0 || Number(newCurtain.height) <= 0) {
      toast('Enter Area, Part, Width and Height');
      return;
    }
    const quantity = calculateCurtainQty(newCurtain.part, newCurtain.height);
    const price = Number(newCurtain.price) || 0;
    const item: Measurement = {
      id: uid(), customer_id: customer.id, product_type: 'curtains',
      area_name: newCurtain.area.trim(), type: 'Main',
      fabric_type: newCurtain.fabric.trim(),
      lining_type: (newCurtain.lining || undefined) as Measurement['lining_type'],
      lining_fabric: newCurtain.liningFabric.trim(), part: Number(newCurtain.part),
      width: Number(newCurtain.width), height: Number(newCurtain.height),
      quantity, price, total: calculateTotal(quantity, price),
    };
    setItems(current => [...current, item]);
    setNewCurtain({ area: '', part: '', width: '', height: '', fabric: '', lining: '', liningFabric: '', price: '' });
    setShowAddCurtain(false);
    toast('Curtain added to quotation');
  }

  function applyFabricGroupRate(name: string, layer: 'Main' | 'Sheer', value: string) {
    const rate = Number(numericInput(value)) || 0;
    const key = name.trim().toLocaleLowerCase();
    setFabricCommonRates(current => ({ ...current, [layer + '|' + key]: value }));
    setItems(current => current.map(item => {
      const matchesLayer = layer === 'Sheer' ? item.type === 'Sheer' : item.type !== 'Sheer';
      const matches = item.product_type === 'curtains' && matchesLayer && (item.fabric_type ?? '').trim().toLocaleLowerCase() === key;
      return matches ? { ...item, price: rate, total: calculateTotal(item.quantity, rate) } : item;
    }));
  }
  function updateFabricItemRate(id: string, value: string) {
    const rate = Number(numericInput(value)) || 0;
    setItems(current => current.map(item => item.id === id ? { ...item, price: rate, total: calculateTotal(item.quantity, rate) } : item));
  }
  function applyCommonLiningRate(value: string) {
    setCommonLiningRate(value);
    const rate = Number(numericInput(value)) || 0;
    setItems(current => current.map(item => item.product_type === 'curtains' && item.type !== 'Sheer' && !!item.lining_type
      ? { ...item, lining_price: rate, lining_total: calculateTotal(Number(item.lining_quantity ?? item.quantity) || 0, rate) }
      : item));
  }
  function updateLiningItemRate(id: string, value: string) {
    const rate = Number(numericInput(value)) || 0;
    setItems(current => current.map(item => item.id === id
      ? { ...item, lining_price: rate, lining_total: calculateTotal(Number(item.lining_quantity ?? item.quantity) || 0, rate) }
      : item));
  }

  function updExtra(id: string, patch: Partial<ExtraChargeRow>) {
    setCharges((c) => ({ ...c, extras: c.extras.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
  }
  function addExtra() {
    setCharges((c) => ({ ...c, extras: [...c.extras, newExtraRow()] }));
  }
  function removeExtra(id: string) {
    setCharges((c) => ({ ...c, extras: c.extras.filter((r) => r.id !== id) }));
  }

  function addAccRow() {
    setAccRows((r) => [...r, { id: uid(), area: '', trackType: 'Aluminium Track', width: '', price: '' }]);
  }
  function updateAcc(id: string, patch: Partial<AccRow>) {
    setAccRows((r) => r.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }
  function addSheerTrack() {
    const main=[...accRows].reverse().find(r=>r.trackType.toLowerCase()!=='sheer track' && Number(r.width)>0);
    if(!main){toast('Add Main Track width first');return;}
    setAccRows(r=>[...r,{id:uid(),area:main.area,trackType:'Sheer Track',width:main.width,price:''}]);
    toast('Sheer Track size copied from Main Track');
  }

  async function addReferencePhoto(source: 'camera' | 'gallery') {
    const permission = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert('Permission required', source === 'camera' ? 'Camera permission is required.' : 'Photo permission is required.'); return; }
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 0.5, base64: true })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 0.5, base64: true });
    if (result.canceled || !result.assets[0]?.base64) return;
    const asset=result.assets[0];
    const firstArea=items[0]?.area_name || accRows[0]?.area || '';
    setReferencePhotos(rows=>[...rows,{id:uid(),area_name:firstArea,label:'Material / Track',data_uri:`data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`}]);
  }
  function updateReference(id:string, patch:Partial<MaterialReferencePhoto>){ setReferencePhotos(rows=>rows.map(r=>r.id===id?{...r,...patch}:r)); }

  async function persistDrafts() {
    if (!customer) return;
    const accDraft: Accessory[] = accRows.map((r) => ({
      id: r.id,
      customer_id: customer.id,
      area_name: r.area,
      track_type: r.trackType,
      width: Number(r.width) || 0,
      quantity: accQty(r),
      price: Number(r.price) || 0,
      total: accTotal(r),
    }));
    const { saveAccessories } = await import('../../src/services/measurementService');
    await saveAccessories(customer.id, accDraft);
    await saveChargesDraft(customer.id, bundle.charges);
  }

  async function save(status: 'draft' | 'sent'): Promise<Quotation | null> {
    if (!customer) {
      toast('No customer selected');
      return null;
    }
    if (items.length === 0 && accRows.length === 0) {
      toast('Add measurements or accessories first');
      return null;
    }
    setSaving(true);
    try {
      const { getQuotation, updateQuotation } = await import('../../src/services/quotationService');
      const existing = params.id ? await getQuotation(String(params.id)) : null;
      const num = existing?.quotation_number ?? await nextQuotationNumber();
      const accessories: Accessory[] = accRows.map((r) => ({
        id: r.id,
        customer_id: customer.id,
        area_name: r.area,
        track_type: r.trackType,
        width: Number(r.width) || 0,
        quantity: accQty(r),
        price: Number(r.price) || 0,
        total: accTotal(r),
      }));
      const otherChargesTotal = otherChargesTotalFrom(bundle.totals);
      const quotationData = {
        id: existing?.id,
        quotation_number: num,
        customer,
        items,
        accessories,
        charges: bundle.charges,
        subtotal: round2(subtotal),
        accessories_total: round2(accessoriesTotal),
        other_charges: otherChargesTotal,
        discount: bundle.totals.discount,
        grand_total: grandTotal,
        status: existing?.status ?? status,
        reference_photos: referencePhotos,
      };
      let q: Quotation;
      if (existing) {
        // Update in place: retain the original quotation ID, number, date,
        // creation timestamp, and invoice settings.
        q = await updateQuotation({
          ...existing,
          customer_id: customer.id,
          customer_name: customer.name,
          customer_phone: customer.phone,
          site_location: (customer as { site_location?: string }).site_location ?? existing.site_location,
          items,
          accessories,
          charges: bundle.charges,
          subtotal: round2(subtotal),
          accessories_total: round2(accessoriesTotal),
          other_charges: otherChargesTotal,
          discount: bundle.totals.discount,
          grand_total: grandTotal,
          status: existing.status,
          reference_photos: referencePhotos,
        });
      } else {
        q = await saveQuotation({ ...quotationData, quotation_number: num });
        const { commitQuotation } = await import('../../src/services/quotationService');
        await commitQuotation(q, customer.id);
      }
      return q;
    } finally {
      setSaving(false);
    }
  }

  async function onSaveDraft() {
    await persistDrafts();
    const q = await save('draft');
    if (q) {
      toast(`Quotation ${q.quotation_number} saved as draft`);
      router.replace(`/quotation/${q.id}`);
    }
  }

  async function onFinalize() {
    await persistDrafts();
    const q = await save('sent');
    if (q) {
      toast(`Quotation ${q.quotation_number} created`);
      router.replace(`/quotation/${q.id}`);
    }
  }

  async function onSavePreview() {
    await persistDrafts();
    if (!customer) return;
    // Use the shared save path so editing an existing quotation updates its
    // original ID/quotation number instead of allocating a new quotation.
    const q = await save('draft');
    if (q) {
      toast(params.id ? `Quotation ${q.quotation_number} updated` : `Quotation ${q.quotation_number} created`);
      router.replace(`/quotation/preview?id=${q.id}`);
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Edit Quotation</Text>
      <Text style={styles.sub}>{customer ? `${customer.name} · ${customer.phone}` : 'Loading…'}</Text>

      <Card style={{ marginTop: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View>
            <Text style={styles.qLabel}>Quotation Number</Text>
            <Text style={styles.qNumber}>{qNumber || 'CD-…'}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.qLabel}>Grand Total</Text>
            <Text style={styles.grandPreview}>{formatINR(grandTotal)}</Text>
          </View>
        </View>
      </Card>

      <SectionTitle>
        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>Products ({items.length})</Text>
      </SectionTitle>
      {items.length === 0 ? (
        <Card>
          <Text style={styles.note}>No measurements yet. Add them from the measurement screen.</Text>
          <Button title="Go to Measurements" icon="resize" variant="accent" onPress={() => router.push(`/measurement/new?customerId=${customer?.id ?? ''}`)} />
        </Card>
      ) : (
        items.map((it, i) => {
          const def = getProduct(it.product_type);
          const colLabel = quantityColumnLabel(it.product_type);
          const unitLabel = colLabel === 'Qty' ? `Qty (${def.qtyUnit})` : colLabel;
          return (
            <View key={it.id} style={styles.lineRow}>
              <TouchableOpacity style={{ flex: 1, marginRight: 8 }} activeOpacity={0.75} onPress={() => openItemEditor(it)}>
                <Text style={styles.lineText}>{i + 1}. {it.area_name} — {def.name}{it.type ? ` · ${it.type}` : ''}{it.product_type==='curtains'&&it.fabric_type ? ` · Fabric: ${it.fabric_type}` : ''}{it.product_type==='curtains'&&it.lining_type ? ` · ${it.lining_type}${it.lining_fabric ? `: ${it.lining_fabric}` : ''}` : ''} · {unitLabel} {it.quantity}</Text>
                <Text style={{ color: colors.orange, fontSize: 11, fontWeight: '800', marginTop: 4 }}>✎ Tap to edit item</Text>
              </TouchableOpacity>
              <View style={{ alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <Text style={styles.lineTotal}>{formatINR(it.total, false)}</Text>
                <TouchableOpacity onPress={() => removeQuotationItem(it)} style={{ padding: 6, marginTop: 6 }}>
                  <Ionicons name="trash-outline" size={19} color={colors.danger} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}


      <Button title={showAddProduct ? 'Close Add Product' : '+ Add New Product'} icon="add-circle-outline" variant="accent" onPress={() => setShowAddProduct(v => !v)} style={{ marginTop: 8 }} />
      {showAddProduct ? (
        <Card style={{ marginTop: 10 }}>
          <Text style={styles.rowTitle}>Add Product · Same Measurement Formula</Text>
          <Text style={styles.formulaNote}>Choose product and enter its normal measurement details. Quantity and total calculate automatically.</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 10 }}>
            {PRODUCTS.map(p => <TouchableOpacity key={p.key} onPress={() => setAddProductForm(v => ({ ...v, product: p.key, type: p.key === 'curtains' ? 'Main' : (p.typeOptions[0] ?? ''), unit: 'inch', part: '', manualFabricMtr: '', additionalSqft: '', liningType: '' }))} style={{ paddingHorizontal: 11, paddingVertical: 8, borderRadius: 9, backgroundColor: addProductForm.product === p.key ? colors.navy : colors.chipBg }}><Text style={{ color: addProductForm.product === p.key ? '#fff' : colors.textDark, fontWeight: '700', fontSize: 12 }}>{p.name}</Text></TouchableOpacity>)}
          </View>
          <Field label="Area / Room Name" value={addProductForm.area} onChangeText={v => setAddProductForm(s => ({ ...s, area: v }))} placeholder="e.g. Hall Window" />
          {(addProductForm.product === 'curtains' || getProduct(addProductForm.product).typeOptions.length > 0) ? <>
            <Text style={styles.miniLabel}>{addProductForm.product === 'curtains' ? 'Curtain Layer' : getProduct(addProductForm.product).typeLabel}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 10 }}>
              {(addProductForm.product === 'curtains' ? ['Main','Sheer'] : getProduct(addProductForm.product).typeOptions).map(t => <TouchableOpacity key={t} onPress={() => setAddProductForm(v => ({ ...v, type: t }))} style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, backgroundColor: addProductForm.type === t ? colors.navy : colors.chipBg }}><Text style={{ color: addProductForm.type === t ? '#fff' : colors.textDark, fontSize: 11, fontWeight: '700' }}>{t}</Text></TouchableOpacity>)}
            </View>
          </> : null}
          {addProductForm.product === 'curtains' ? <>
            <Field label="Part (number of curtain parts)" value={addProductForm.part} onChangeText={v => setAddProductForm(s => ({ ...s, part: numericInput(v) }))} keyboardType="decimal-pad" />
            <Field label="Height (inch)" value={addProductForm.height} onChangeText={v => setAddProductForm(s => ({ ...s, height: numericInput(v) }))} keyboardType="decimal-pad" />
            <Field label="Fabric Name / Details" value={addProductForm.fabric} onChangeText={v => setAddProductForm(s => ({ ...s, fabric: v }))} />
            {addProductForm.type !== 'Sheer' ? <>
              <Text style={styles.miniLabel}>Lining Type</Text>
              <View style={{ flexDirection: 'row', gap: 7 }}>
                {(['No Lining','Semi Lining','Blackout Lining'] as const).map(t => <TouchableOpacity key={t} onPress={() => setAddProductForm(v => ({ ...v, liningType: t === 'No Lining' ? '' : t }))} style={{ flex: 1, padding: 8, borderRadius: 8, backgroundColor: (addProductForm.liningType || 'No Lining') === t ? colors.navy : colors.chipBg }}><Text style={{ color: (addProductForm.liningType || 'No Lining') === t ? '#fff' : colors.textDark, fontSize: 10, textAlign: 'center' }}>{t}</Text></TouchableOpacity>)}
              </View>
              {addProductForm.liningType ? <Field label="Lining Fabric" value={addProductForm.liningFabric} onChangeText={v => setAddProductForm(s => ({ ...s, liningFabric: v }))} /> : null}
            </> : null}
          </> : addProductForm.product === 'blinds' || addProductForm.product === 'mosquito_net' ? <>
            <Text style={styles.miniLabel}>Measurement Unit</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              {(['inch','mm'] as const).map(u => <TouchableOpacity key={u} onPress={() => setAddProductForm(v => ({ ...v, unit: u }))} style={{ flex: 1, padding: 9, borderRadius: 8, backgroundColor: addProductForm.unit === u ? colors.navy : colors.chipBg }}><Text style={{ color: addProductForm.unit === u ? '#fff' : colors.textDark, textAlign: 'center', fontWeight: '700' }}>{u}</Text></TouchableOpacity>)}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Field label={`Width (${addProductForm.unit})`} value={addProductForm.width} onChangeText={v => setAddProductForm(s => ({ ...s, width: numericInput(v) }))} keyboardType="decimal-pad" /></View>
              <View style={{ flex: 1 }}><Field label={`Height (${addProductForm.unit})`} value={addProductForm.height} onChangeText={v => setAddProductForm(s => ({ ...s, height: numericInput(v) }))} keyboardType="decimal-pad" /></View>
            </View>
            {addProductForm.product === 'blinds' && addProductForm.type.toLowerCase() === 'roman' ? <><Field label="Fabric Required (mtr) — Manual" value={addProductForm.manualFabricMtr} onChangeText={v => setAddProductForm(s => ({ ...s, manualFabricMtr: numericInput(v) }))} keyboardType="decimal-pad" /><Field label="Fabric Details" value={addProductForm.fabric} onChangeText={v => setAddProductForm(s => ({ ...s, fabric: v }))} /></> : <Field label="Fabric / Colour Details" value={addProductForm.fabric} onChangeText={v => setAddProductForm(s => ({ ...s, fabric: v }))} />}
            {addProductForm.product === 'mosquito_net' ? <>
              <Field label="Net Description / Colour" value={addProductForm.description} onChangeText={v => setAddProductForm(s => ({ ...s, description: v }))} />
              <Field label="Additional Area (sq.ft)" value={addProductForm.additionalSqft} onChangeText={v => setAddProductForm(s => ({ ...s, additionalSqft: numericInput(v) }))} keyboardType="decimal-pad" />
              {addProductForm.type.toUpperCase() === 'DOOR NET' ? <>
                <Field label="Frame Colour" value={addProductForm.frameColor} onChangeText={v => setAddProductForm(s => ({ ...s, frameColor: v }))} />
                <Text style={styles.miniLabel}>Open Method</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>{(['Bottom Open','Left Open','Right Open'] as const).map(t => <TouchableOpacity key={t} onPress={() => setAddProductForm(v => ({ ...v, openMethod: t }))} style={{ flex: 1, padding: 7, borderRadius: 8, backgroundColor: addProductForm.openMethod === t ? colors.navy : colors.chipBg }}><Text style={{ color: addProductForm.openMethod === t ? '#fff' : colors.textDark, textAlign: 'center', fontSize: 10 }}>{t}</Text></TouchableOpacity>)}</View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}><Field label="Left Open Count" value={addProductForm.leftOpenCount} onChangeText={v => setAddProductForm(s => ({ ...s, leftOpenCount: numericInput(v,false) }))} keyboardType="numeric" /></View>
                  <View style={{ flex: 1 }}><Field label="Right Open Count" value={addProductForm.rightOpenCount} onChangeText={v => setAddProductForm(s => ({ ...s, rightOpenCount: numericInput(v,false) }))} keyboardType="numeric" /></View>
                </View>
                <Field label="Door Split Count" value={addProductForm.doorSplitCount} onChangeText={v => setAddProductForm(s => ({ ...s, doorSplitCount: numericInput(v,false) }))} keyboardType="numeric" />
              </> : null}
              {addProductForm.type.toLowerCase() === 'velcro net' ? <Text style={styles.formulaNote}>Cutting allowance +2 inch on width and height. Stock usage: 3 ft = {newProductQuantity > 0 ? (newProductQuantity / 3).toFixed(2) : '0.00'} running ft · 5 ft = {newProductQuantity > 0 ? (newProductQuantity / 5).toFixed(2) : '0.00'} running ft.</Text> : null}
            </> : null}
          </> : addProductForm.product === 'wallpaper' ? <>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Field label="Width (inch)" value={addProductForm.width} onChangeText={v => setAddProductForm(s => ({ ...s, width: numericInput(v) }))} keyboardType="decimal-pad" /></View>
              <View style={{ flex: 1 }}><Field label="Height (inch)" value={addProductForm.height} onChangeText={v => setAddProductForm(s => ({ ...s, height: numericInput(v) }))} keyboardType="decimal-pad" /></View>
            </View>
          </> : addProductForm.product === 'headboard' || addProductForm.product === 'flooring' ? <>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}><Field label="Width (inch)" value={addProductForm.width} onChangeText={v => setAddProductForm(s => ({ ...s, width: numericInput(v) }))} keyboardType="decimal-pad" /></View>
              <View style={{ flex: 1 }}><Field label="Height (inch)" value={addProductForm.height} onChangeText={v => setAddProductForm(s => ({ ...s, height: numericInput(v) }))} keyboardType="decimal-pad" /></View>
            </View>
            <Field label={addProductForm.product === 'headboard' ? 'Fabric Details' : 'Material / Colour'} value={addProductForm.fabric} onChangeText={v => setAddProductForm(s => ({ ...s, fabric: v }))} />
            {addProductForm.product === 'headboard' ? <Field label="Fabric Required (metres) — Optional" value={addProductForm.manualFabricMtr} onChangeText={v => setAddProductForm(s => ({ ...s, manualFabricMtr: numericInput(v) }))} keyboardType="decimal-pad" /> : null}
          </> : addProductForm.product === 'cushion' ? <>
            <Field label="Material Required (mtr)" value={addProductForm.width} onChangeText={v => setAddProductForm(s => ({ ...s, width: numericInput(v) }))} keyboardType="decimal-pad" />
            <Field label="Fabric / Description" value={addProductForm.fabric} onChangeText={v => setAddProductForm(s => ({ ...s, fabric: v }))} />
          </> : addProductForm.product === 'accessories' ? <>
            <Field label="Track / Rod Length (inch)" value={addProductForm.width} onChangeText={v => setAddProductForm(s => ({ ...s, width: numericInput(v) }))} keyboardType="decimal-pad" />
          </> : null}
          <Field label={`Rate (₹ / ${addProductForm.product === 'curtains' || (addProductForm.product === 'blinds' && addProductForm.type.toLowerCase() === 'roman') ? 'mtr' : getProduct(addProductForm.product).qtyUnit})`} value={addProductForm.price} onChangeText={v => setAddProductForm(s => ({ ...s, price: numericInput(v) }))} keyboardType="decimal-pad" />
          <Field label="GST (%)" value={addProductForm.gst} onChangeText={v => setAddProductForm(s => ({ ...s, gst: numericInput(v) }))} keyboardType="decimal-pad" />
          <View style={{ backgroundColor: '#FFF7EC', borderRadius: 12, padding: 12, marginVertical: 8 }}>
            <Text style={styles.previewLabel}>AUTOMATIC QUANTITY</Text>
            <Text style={styles.previewVal}>{newProductQuantity.toFixed(2)} {addProductForm.product === 'curtains' || (addProductForm.product === 'blinds' && addProductForm.type.toLowerCase() === 'roman') ? 'mtr' : getProduct(addProductForm.product).qtyUnit}</Text>
            <Text style={styles.formulaNote}>Amount: {formatINR(newProductTotal)}</Text>
            {addProductForm.product === 'wallpaper' ? <Text style={styles.formulaNote}>Normal Wallpaper: 50 sq.ft per roll (rounded up). Customize: square feet.</Text> : null}
          </View>
          <Button title="Add Product Item" icon="checkmark" variant="accent" onPress={addProductItem} />
        </Card>
      ) : null}
      <Button title={showAddCurtain ? 'Close Add Curtains' : '+ Add Curtains'} icon="add" variant="accent" onPress={() => setShowAddCurtain(v => !v)} style={{ marginTop: 8 }} />
      {showAddCurtain ? (
        <Card style={{ marginTop: 10 }}>
          <Text style={styles.rowTitle}>New Main Curtain</Text>
          <Field label="Area Name" value={newCurtain.area} onChangeText={v => setNewCurtain(s => ({ ...s, area: v }))} placeholder="e.g. Hall Window" />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Field label="Part" value={newCurtain.part} onChangeText={v => setNewCurtain(s => ({ ...s, part: numericInput(v) }))} keyboardType="numeric" /></View>
            <View style={{ flex: 1 }}><Field label="Width (in)" value={newCurtain.width} onChangeText={v => setNewCurtain(s => ({ ...s, width: numericInput(v) }))} keyboardType="numeric" /></View>
            <View style={{ flex: 1 }}><Field label="Height" value={newCurtain.height} onChangeText={v => setNewCurtain(s => ({ ...s, height: numericInput(v) }))} keyboardType="numeric" /></View>
          </View>
          <Field label="Main Curtains Fabric Details" value={newCurtain.fabric} onChangeText={v => setNewCurtain(s => ({ ...s, fabric: v }))} placeholder="Enter main fabric details" />
          <Field label="Curtain Price (₹ / mtr)" value={newCurtain.price} onChangeText={v => setNewCurtain(s => ({ ...s, price: numericInput(v) }))} keyboardType="numeric" />
          <Text style={styles.formulaNote}>Optional lining</Text>
          {newCurtain.lining ? <Field label={newCurtain.lining + " Fabric Details"} value={newCurtain.liningFabric} onChangeText={v => setNewCurtain(s => ({ ...s, liningFabric: v }))} placeholder="Enter separate lining fabric details" /> : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['', 'Blackout Lining', 'Semi Lining'] as const).map(value => (
              <TouchableOpacity key={value || 'none'} onPress={() => setNewCurtain(s => ({ ...s, lining: value }))} style={{ padding: 9, borderRadius: 10, backgroundColor: newCurtain.lining === value ? colors.navy : colors.chipBg }}>
                <Text style={{ color: newCurtain.lining === value ? '#fff' : colors.navy, fontWeight: '700', fontSize: 11 }}>{value || 'No Lining'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Button title="Add Curtain to Quotation" icon="checkmark" variant="accent" onPress={addCurtainToQuotation} style={{ marginTop: 12 }} />
        </Card>
      ) : null}

      <SectionTitle>
        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>Material Reference Photos (Optional)</Text>
      </SectionTitle>
      <Card>
        <Text style={styles.note}>Optional. Photos are compressed automatically and printed from Page 2 onwards with Area Name.</Text>
        <View style={{flexDirection:'row',gap:8,marginBottom:10}}>
          <Button title="Camera" icon="camera-outline" variant="outline" style={{flex:1}} onPress={()=>addReferencePhoto('camera')} />
          <Button title="Gallery" icon="images-outline" variant="outline" style={{flex:1}} onPress={()=>addReferencePhoto('gallery')} />
        </View>
        {referencePhotos.map((photo)=><View key={photo.id} style={{marginTop:10,borderTopWidth:1,borderTopColor:colors.border,paddingTop:10}}>
          <Image source={{uri:photo.data_uri}} style={{width:'100%',height:150,borderRadius:12,resizeMode:'cover',marginBottom:8}} />
          <Field label="Area Name" value={photo.area_name} onChangeText={t=>updateReference(photo.id,{area_name:t})} placeholder="e.g. Hall" />
          <Field label="Reference Type" value={photo.label} onChangeText={t=>updateReference(photo.id,{label:t})} placeholder="e.g. Curtain Fabric / Track" />
          <Button title="Remove Photo" icon="trash-outline" variant="ghost" onPress={()=>setReferencePhotos(rows=>rows.filter(r=>r.id!==photo.id))} />
        </View>)}
      </Card>

      <SectionTitle>
        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>Accessories</Text>
      </SectionTitle>
      {accRows.map((row) => (
        <Card key={row.id} style={{ marginBottom: 10 }}>
          <View style={styles.rowHead}>
            <Text style={styles.rowTitle}>Accessory</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Text style={styles.miniTotal}>Qty / R.ft {accQty(row)} · {formatINR(accTotal(row))}</Text>
              <Text onPress={() => setAccRows((r) => r.filter((x) => x.id !== row.id))} style={{ color: colors.danger, fontWeight: '800' }}>✕</Text>
            </View>
          </View>
          <Field label="Area Name" value={row.area} onChangeText={(t) => updateAcc(row.id, { area: t })} placeholder="e.g. Living Room" />
          <Field label="Track Type" value={row.trackType} onChangeText={(t) => updateAcc(row.id, { trackType: t })} />
          <View style={{ flexDirection: 'row' }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Field label="Curtain Width (in)" value={row.width} onChangeText={(t) => updateAcc(row.id, { width: numericInput(t) })} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Price (₹)" value={row.price} onChangeText={(t) => updateAcc(row.id, { price: numericInput(t) })} keyboardType="numeric" />
            </View>
          </View>
          <Text style={styles.formulaNote}>Quantity / R.ft = Width / 12 (auto)</Text>
        </Card>
      ))}
      <View style={{gap:8}}><Button title="+ Add Accessory Row" icon="add" variant="outline" onPress={addAccRow} /><Button title="+ Sheer Track · Copy Main Track Size" icon="copy-outline" variant="accent" onPress={addSheerTrack} /></View>

      <SectionTitle>
        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>Other Charges</Text>
      </SectionTitle>
      <Card>
        <Text style={styles.chargeTitle}>Fitting (per window)</Text>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Field label="No. of Windows" value={charges.fittingWindows} onChangeText={(t) => setCharges({ ...charges, fittingWindows: numericInput(t, false) })} keyboardType="numeric" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Price / Window" value={charges.fittingPrice} onChangeText={(t) => setCharges({ ...charges, fittingPrice: numericInput(t) })} keyboardType="numeric" />
          </View>
        </View>
        <Field label="Fitting — Description" value={charges.fittingDesc} onChangeText={(t) => setCharges({ ...charges, fittingDesc: t })} placeholder="Fitting Charges" />
        <Text style={styles.formulaNote}>Total = Windows × Price = {formatINR(bundle.totals.fitting)}</Text>

        <Text style={styles.chargeTitle}>Stitching</Text>
        <View style={styles.partsBox}>
          <Text style={styles.partsLabel}>Curtain Parts</Text>
          <Text style={styles.partsValue}>{curtainParts}</Text>
          <Text style={styles.partsHint}>From Curtain Measurements · decimal supported</Text>
        </View>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Field label="Stitching Qty (Part)" value={String(curtainParts)} editable={false} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Stitching Price / Part" value={charges.stitchingPrice} onChangeText={(t) => setCharges({ ...charges, stitchingPrice: numericInput(t) })} keyboardType="numeric" />
          </View>
        </View>
        <Field label="Stitching — Description" value={charges.stitchingDesc} onChangeText={(t) => setCharges({ ...charges, stitchingDesc: t })} placeholder="Stitching Charges" />
        <Text style={styles.formulaNote}>
          Total = {curtainParts} Part × {charges.stitchingPrice || 0} = {formatINR(bundle.totals.stitching)}
        </Text>

        <Text style={styles.chargeTitle}>Transport</Text>
        <Field label="Transport — Description" value={charges.transportDesc} onChangeText={(t) => setCharges({ ...charges, transportDesc: t })} placeholder="Transport Charges" />
        <Field label="Transport Charges (₹)" value={charges.transport} onChangeText={(t) => setCharges({ ...charges, transport: numericInput(t) })} keyboardType="numeric" />

        <Text style={styles.chargeTitle}>Additional</Text>
        <Field label="Description" value={charges.additionalDesc} onChangeText={(t) => setCharges({ ...charges, additionalDesc: t })} placeholder="e.g. Material handling" />
        <Field label="Additional Charges (₹)" value={charges.additionalAmount} onChangeText={(t) => setCharges({ ...charges, additionalAmount: numericInput(t) })} keyboardType="numeric" />

        <Text style={styles.formulaNote}>Fabric and lining rates are entered together in the final Rate & Amount section below.</Text>

        <Text style={styles.chargeTitle}>Fabric in this quotation</Text>
        <Text style={styles.formulaNote}>{fabricNote || 'No fabric quantity recorded yet — add it in Measurements.'}</Text>
        {fabricNote ? (
          <Text onPress={() => setCharges({ ...charges, additionalDesc: fabricNote })} style={styles.resetInline}>
            Use as Additional description
          </Text>
        ) : null}
        <Field label="Discount — Description" value={charges.discDesc} onChangeText={(t) => setCharges({ ...charges, discDesc: t })} placeholder="Discount" />

        <View style={styles.extraHead}>
          <Text style={styles.chargeTitle}>Extra Charges (individual)</Text>
          <Text style={styles.extraSum}>total {formatINR(bundle.totals.extras)}</Text>
        </View>
        {charges.extras.length === 0 ? (
          <Text style={styles.formulaNote}>
            No extra charges yet. Add a row to bill any other item with its own label and amount.
          </Text>
        ) : (
          charges.extras.map((row, i) => (
            <View key={row.id} style={styles.extraRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Field
                  label={`Extra ${i + 1} — Description`}
                  value={row.description}
                  onChangeText={(t) => updExtra(row.id, { description: t })}
                  placeholder="e.g. Packing, Rod bending, Tax"
                />
              </View>
              <View style={{ flex: 0.65, marginRight: 8 }}>
                <Field
                  label="Quantity"
                  value={row.quantity}
                  onChangeText={(t) => updExtra(row.id, { quantity: numericInput(t) })}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="Price (₹)"
                  value={row.amount}
                  onChangeText={(t) => updExtra(row.id, { amount: numericInput(t) })}
                  keyboardType="numeric"
                />
              </View>
              <Text onPress={() => removeExtra(row.id)} style={styles.extraDel}>✕</Text>
            </View>
          ))
        )}
        <Button title="+ Add Extra Charge" icon="add" variant="outline" onPress={addExtra} />

        <Text style={styles.chargeTitle}>Discount</Text>
        <Field label="Discount (₹)" value={charges.discount} onChangeText={(t) => setCharges({ ...charges, discount: numericInput(t) })} keyboardType="numeric" />
      </Card>

      <SectionTitle>
        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>Final Rate & Amount</Text>
      </SectionTitle>
      <Card>
        <Text style={styles.chargeTitle}>Fabric Rates — Common Rate by Fabric</Text>
        <Text style={styles.formulaNote}>ஒரே fabric name பயன்படுத்திய rooms-க்கு common rate apply ஆகும். கீழே தனி item rate மாற்றினால் அந்த room மட்டும் override ஆகும்.</Text>
        {[...mainFabricTotals.map(f => ({ ...f, layer: 'Main' as const })), ...sheerFabricTotals.map(f => ({ ...f, layer: 'Sheer' as const }))].map(group => {
          const matched = items.filter(item => item.product_type === 'curtains' && (group.layer === 'Sheer' ? item.type === 'Sheer' : item.type !== 'Sheer') && (item.fabric_type ?? '').trim().toLocaleLowerCase() === group.name.trim().toLocaleLowerCase());
          const commonRate = matched[0]?.price ?? 0;
          return <View key={group.layer + group.name} style={{ backgroundColor: colors.chipBg, borderRadius: 10, padding: 10, marginTop: 9 }}>
            <Text style={{ color: colors.navy, fontWeight: '800', marginBottom: 4 }}>{group.layer} Fabric — {group.name}</Text>
            <Text style={styles.formulaNote}>Total required: {group.quantity.toFixed(2)} mtr</Text>
            <Field label="Common Fabric Rate / mtr (₹)" value={fabricCommonRates[group.layer + '|' + group.name.trim().toLocaleLowerCase()] ?? String(commonRate)} onChangeText={v => applyFabricGroupRate(group.name, group.layer, v)} keyboardType="decimal-pad" placeholder="Enter common rate"/>
            {matched.map(item => <View key={item.id} style={{ marginTop: 5 }}>
              <Field label={`${item.area_name || 'Room'} — Individual Rate Override / mtr (₹)`} value={String(item.price ?? '')} onChangeText={v => updateFabricItemRate(item.id, v)} keyboardType="decimal-pad"/>
              <Text style={styles.formulaNote}>{Number(item.quantity || 0).toFixed(2)} mtr × ₹{Number(item.price || 0).toFixed(2)} = {formatINR(calculateTotal(item.quantity, item.price))}</Text>
            </View>)}
          </View>;
        })}
        {!mainFabricTotals.length && !sheerFabricTotals.length ? <Text style={styles.formulaNote}>Fabric name enter செய்த curtain items இங்கே வரும்.</Text> : null}

        {liningItems.length ? <>
          <Text style={[styles.chargeTitle, { marginTop: 16 }]}>Lining Rate — Common Rate</Text>
          <Text style={styles.formulaNote}>இந்த rate எல்லா Semi / Blackout lining items-க்கும் apply ஆகும். Room-wise rate தனியாக மாற்றலாம்.</Text>
          <Field label="Common Lining Rate / mtr (₹)" value={commonLiningRate !== '' ? commonLiningRate : String(liningItems[0]?.lining_price ?? 0)} onChangeText={applyCommonLiningRate} keyboardType="decimal-pad" placeholder="Enter common lining rate"/>
          {liningItems.map(item => {
            const qty = Number(item.lining_quantity ?? item.quantity) || 0;
            const rate = Number(item.lining_price) || 0;
            return <View key={item.id} style={{ backgroundColor: colors.chipBg, borderRadius: 10, padding: 10, marginTop: 8 }}>
              <Text style={{ color: colors.navy, fontWeight: '800', marginBottom: 5 }}>{item.lining_type} — {item.area_name || 'Curtain'}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}><Field label="Required (mtr)" value={qty.toFixed(2)} editable={false}/></View>
                <View style={{ flex: 1 }}><Field label="Individual Rate Override (₹ / mtr)" value={String(item.lining_price ?? '')} onChangeText={v => updateLiningItemRate(item.id, v)} keyboardType="decimal-pad"/></View>
              </View>
              <Text style={styles.formulaNote}>{qty.toFixed(2)} mtr × ₹{rate.toFixed(2)} = {formatINR(calculateTotal(qty, rate))}</Text>
            </View>;
          })}
        </> : null}
      </Card>

      <Card style={{ marginTop: 14 }}>
        <Text style={styles.section}>Total Summary</Text>
        <View style={styles.sumRow}><Text style={styles.sumLbl}>Products Subtotal</Text><Text style={styles.sumVal}>{formatINR(subtotal)}</Text></View>
        <View style={styles.sumRow}><Text style={styles.sumLbl}>Accessories Total</Text><Text style={styles.sumVal}>{formatINR(accessoriesTotal)}</Text></View>
        <View style={styles.sumRow}><Text style={styles.sumLbl}>Fitting</Text><Text style={styles.sumVal}>{formatINR(bundle.totals.fitting)}</Text></View>
        <View style={styles.sumRow}><Text style={styles.sumLbl}>Stitching</Text><Text style={styles.sumVal}>{formatINR(bundle.totals.stitching)}</Text></View>
        <View style={styles.sumRow}><Text style={styles.sumLbl}>Transport</Text><Text style={styles.sumVal}>{formatINR(bundle.totals.transport)}</Text></View>
        <View style={styles.sumRow}><Text style={styles.sumLbl}>Additional</Text><Text style={styles.sumVal}>{formatINR(bundle.totals.additional)}</Text></View>
        {bundle.totals.extras > 0 ? (
          <View style={styles.sumRow}><Text style={styles.sumLbl}>Extra Charges</Text><Text style={styles.sumVal}>{formatINR(bundle.totals.extras)}</Text></View>
        ) : null}
        <View style={styles.sumRow}><Text style={[styles.sumLbl, { color: colors.success }]}>Discount</Text><Text style={[styles.sumVal, { color: colors.success }]}>- {formatINR(bundle.totals.discount)}</Text></View>
        <View style={[styles.sumRow, { borderTopWidth: 2, borderTopColor: colors.navy, paddingTop: 10, marginTop: 6 }]}>
          <Text style={styles.grandLbl}>GRAND TOTAL</Text>
          <Text style={styles.grandVal}>{formatINR(grandTotal)}</Text>
        </View>
      </Card>

      <Modal visible={!!editingItem} transparent animationType="slide" onRequestClose={() => setEditingItem(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, maxHeight: '90%' }}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.section}>Edit Quotation Item</Text>
              <Text style={styles.note}>{editingItem ? getProduct(editingItem.product_type).name : ''} · Changes apply to this item only.</Text>
              <Field label="Area / Room Name" value={itemForm.area} onChangeText={t => setItemForm(v => ({ ...v, area: t }))} />
              <Field label="Type / Description" value={itemForm.type} onChangeText={t => setItemForm(v => ({ ...v, type: t }))} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}><Field label="Width" value={itemForm.width} onChangeText={t => setItemForm(v => ({ ...v, width: numericInput(t) }))} keyboardType="decimal-pad" /></View>
                <View style={{ flex: 1 }}><Field label="Height" value={itemForm.height} onChangeText={t => setItemForm(v => ({ ...v, height: numericInput(t) }))} keyboardType="decimal-pad" /></View>
              </View>
              {editingItem?.product_type === 'curtains' ? <Field label="Part" value={itemForm.part} onChangeText={t => setItemForm(v => ({ ...v, part: numericInput(t) }))} keyboardType="decimal-pad" /> : null}
              <Field label="Quantity (editable)" value={itemForm.quantity} onChangeText={t => setItemForm(v => ({ ...v, quantity: numericInput(t) }))} keyboardType="decimal-pad" />
              <Field label="Rate (₹)" value={itemForm.price} onChangeText={t => setItemForm(v => ({ ...v, price: numericInput(t) }))} keyboardType="decimal-pad" />
              <Field label="Fabric Details" value={itemForm.fabric} onChangeText={t => setItemForm(v => ({ ...v, fabric: t }))} />
              <Field label="Fabric Area (sq.ft)" value={itemForm.fabricArea} onChangeText={t => setItemForm(v => ({ ...v, fabricArea: numericInput(t) }))} keyboardType="decimal-pad" />
              {editingItem?.product_type === 'curtains' ? <>
                <Text style={styles.chargeTitle}>Lining Details</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['Semi Lining', 'Blackout Lining'] as const).map(value => <TouchableOpacity key={value} onPress={() => setItemForm(v => ({ ...v, liningType: v.liningType === value ? '' : value }))} style={{ flex: 1, padding: 10, borderRadius: 10, backgroundColor: itemForm.liningType === value ? colors.navy : colors.chipBg }}><Text style={{ color: itemForm.liningType === value ? '#fff' : colors.textDark, fontSize: 12, fontWeight: '700', textAlign: 'center' }}>{value}</Text></TouchableOpacity>)}
                </View>
                <Field label="Lining Fabric" value={itemForm.liningFabric} onChangeText={t => setItemForm(v => ({ ...v, liningFabric: t }))} />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}><Field label="Lining Metres" value={itemForm.liningQuantity} onChangeText={t => setItemForm(v => ({ ...v, liningQuantity: numericInput(t) }))} keyboardType="decimal-pad" /></View>
                  <View style={{ flex: 1 }}><Field label="Lining Rate / mtr" value={itemForm.liningPrice} onChangeText={t => setItemForm(v => ({ ...v, liningPrice: numericInput(t) }))} keyboardType="decimal-pad" /></View>
                </View>
                <Text style={styles.note}>Lining amount: {formatINR(calculateTotal(itemForm.liningQuantity, itemForm.liningPrice))}</Text>
              </> : null}
              <Text style={styles.note}>Item total: {formatINR(calculateTotal(itemForm.quantity, itemForm.price))}</Text>
              <View style={{ gap: 8, marginTop: 10 }}>
                <Button title="Save Item Changes" icon="checkmark" variant="accent" onPress={saveItemEdit} />
                <Button title="Cancel" variant="outline" onPress={() => setEditingItem(null)} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <View style={{ gap: 10, marginTop: 18 }}>
        <Button title="Update Quotation & Preview" icon="document-text" variant="accent" onPress={onSavePreview} disabled={saving} />
        <Button title="Save as Draft" icon="save-outline" onPress={onSaveDraft} disabled={saving} />
        <Button title="Save & Mark as Sent" icon="send-outline" onPress={onFinalize} disabled={saving} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 24, fontWeight: '900', color: colors.navy },
  sub: { color: colors.textMuted, fontSize: 13.5, marginTop: 4 },
  qLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '700', letterSpacing: 0.5 },
  qNumber: { fontSize: 19, fontWeight: '900', color: colors.navy, marginTop: 2 },
  grandPreview: { fontSize: 19, fontWeight: '900', color: colors.orange },
  note: { color: colors.textMuted, marginBottom: 10 },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 6 },
  lineText: { flex: 1, color: colors.textDark, fontSize: 13, marginRight: 8 },
  lineTotal: { fontWeight: '800', color: colors.navy },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' },
  rowTitle: { fontWeight: '800', color: colors.navy },
  miniTotal: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  formulaNote: { fontSize: 11.5, color: '#C77700', marginTop: 2, marginBottom: 8, fontWeight: '600' },
  chargeTitle: { fontWeight: '800', color: colors.navy, marginTop: 10, marginBottom: 4, fontSize: 13.5 },
  partsBox: { backgroundColor: colors.chipBg, borderRadius: 12, padding: 12, marginBottom: 10 },
  partsLabel: { fontSize: 11.5, color: colors.textMuted, fontWeight: '700' },
  partsValue: { fontSize: 22, color: colors.navy, fontWeight: '900', marginTop: 2 },
  partsHint: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  extraHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10 },
  extraSum: { color: colors.orange, fontWeight: '800', fontSize: 12.5, marginBottom: 4 },
  extraRow: { flexDirection: 'row', alignItems: 'flex-end' },
  extraDel: { color: colors.danger, fontWeight: '800', paddingBottom: 14, paddingLeft: 6 },
  resetInline: { color: colors.navy, fontWeight: '800', fontSize: 12, backgroundColor: colors.chipBg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10, marginBottom: 8 },
  rateChip:{paddingHorizontal:12,paddingVertical:8,borderRadius:999,backgroundColor:'#E9EDF4'},rateChipOn:{backgroundColor:colors.navy},rateChipText:{fontSize:12,fontWeight:'700',color:colors.textMuted},rateChipTextOn:{color:'#fff'},rateRow:{flexDirection:'row',alignItems:'center',paddingVertical:9,borderBottomWidth:1,borderBottomColor:'#EEF1F5'},rateName:{fontWeight:'800',color:colors.textDark,fontSize:13},rateMeta:{fontSize:11,color:colors.textMuted,marginTop:2},ratePrice:{fontWeight:'900',color:colors.orange},
  section: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 8 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  sumLbl: { color: colors.textMuted, fontSize: 13.5 },
  sumVal: { fontWeight: '700', color: colors.textDark, fontSize: 13.5 },
  grandLbl: { fontWeight: '900', color: colors.navy, fontSize: 15 },
  grandVal: { fontWeight: '900', color: colors.red, fontSize: 17 },
});
