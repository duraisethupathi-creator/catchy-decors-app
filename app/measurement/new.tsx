import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button, Card, ChipGroup, Field, SectionTitle } from '../../src/components/common';
import { toast } from '../../src/components/common/ui';
import { colors } from '../../src/constants/colors';
import { PRODUCTS, getProduct } from '../../src/constants/products';
import {
  calculateCurtainQty,
  calculateSquareFeet,
  calculateSquareFeetMm,
  calculateAccessories,
  calculateWallpaperQty,
  calculateTotal
} from '../../src/utils/calculations';
import { formatINR } from '../../src/utils/currency';
import { numericInput } from '../../src/utils/validation';
import {
  loadDraftMeasurements,
  saveMeasurements,
  loadDraftAccessories,
  saveAccessories,
} from '../../src/services/measurementService';
import { getCustomer } from '../../src/services/customerService';
import type { Customer } from '../../src/types/customer';
import type { ProductKey } from '../../src/constants/products';

interface Row {
  id: string;
  product: ProductKey;
  area: string;
  type: string;
  width: string;
  height: string;
  price: string;
  manualFabricMtr: string;
  /** Fabric chosen for this item (type + area). */
  fabricType: string;
  fabricArea: string;
  liningType: '' | 'Blackout Lining' | 'Semi Lining';
  liningFabric: string;
  liningPrice: string;
  /** Wallpaper: user-controlled bonus-roll toggle (enabled when D ≥ 2) */
  wallBonusRoll: boolean;
  part: string;
  measurementUnit: 'inch' | 'mm';
  manualQuantity: string;
  additionalSqft: string;
  description: string;
  frameColor: string;
  openMethod: 'Bottom Open' | 'Left Open' | 'Right Open';
  leftOpenCount: string;
  rightOpenCount: string;
  doorSplitCount: string;
}

const uid = () => Math.random().toString(36).slice(2);

// These mosquito-net types are sold by measured square feet.
const isDoorNet = (type: string) => type.trim().toUpperCase() === 'DOOR NET';
const isVelcroNet = (row: Row) => row.product === 'mosquito_net' && row.type.trim().toLowerCase() === 'velcro net';
const velcroCut = (row: Row) => {
  const factor = row.measurementUnit === 'mm' ? 25.4 : 1;
  const wIn = (Number(row.width) || 0) / factor;
  const hIn = (Number(row.height) || 0) / factor;
  const cutWIn = wIn + 2;
  const cutHIn = hIn + 2;
  const actualAreaSqft = (cutWIn * cutHIn) / 144;
  return {
    width: row.measurementUnit === 'mm' ? cutWIn * 25.4 : cutWIn,
    height: row.measurementUnit === 'mm' ? cutHIn * 25.4 : cutHIn,
    // Velcro Net is charged in whole sq.ft per window: always round upward.
    // Example: 19.15 -> 20 and 11.30 -> 12.
    areaSqft: Math.ceil(actualAreaSqft),
  };
};
const readMosquitoMeta = (value?: string) => {
  try { const parsed = JSON.parse(value || ''); return parsed?.__mosquitoMeta === 1 ? parsed : null; } catch { return null; }
};

export default function Measurements() {
  const params = useLocalSearchParams<{ customerId?: string; fresh?: string }>();
  const [customerId, setCustomerId] = useState<string>('');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<ProductKey[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [draftSaved, setDraftSaved] = useState(true);
  const hydrated = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        let cid = params.customerId ?? (await AsyncStorage.getItem('cd_current_customer')) ?? '';
        if (!cid) {
          router.replace('/customer/new?mode=measurement');
          return;
        }
        setCustomerId(cid);
        setCustomer(await getCustomer(cid));
        const isFresh = params.fresh === '1';
        if (isFresh) {
          await saveMeasurements(cid, []);
          await saveAccessories(cid, []);
          setRows([]); setSelectedProducts([]); setActiveId('');
        }
        const draft = isFresh ? [] : await loadDraftMeasurements(cid);
        if (draft.length > 0) {
          setRows(
            draft.map((d) => ({
              id: d.id,
              product: d.product_type,
              area: d.area_name,
              type: d.type ?? '',
              width: String(d.width || ''),
              height: String(d.height || ''),
              price: String(d.price || ''),
              manualFabricMtr: d.product_type === 'blinds' && (d.type ?? '').toLowerCase() === 'roman' ? String(d.quantity || '') : '',
              fabricType: d.fabric_type ?? '',
              fabricArea: d.fabric_area ? String(d.fabric_area) : '',
              liningType: d.lining_type ?? '',
              liningFabric: d.lining_fabric ?? '',
              liningPrice: String(d.lining_price ?? ''),
              wallBonusRoll: false,
              part: d.part ? String(d.part) : '',
              measurementUnit: d.measurement_unit ?? 'inch',
              manualQuantity: d.product_type === 'mosquito_net' ? String(d.quantity || '') : '',
              additionalSqft: String(readMosquitoMeta(d.fabric_type)?.additionalSqft ?? ''),
              description: String(readMosquitoMeta(d.fabric_type)?.description ?? (d.product_type === 'mosquito_net' ? d.fabric_type ?? '' : '')),
              frameColor: String(readMosquitoMeta(d.fabric_type)?.frameColor ?? ''),
              openMethod: readMosquitoMeta(d.fabric_type)?.openMethod ?? 'Bottom Open',
              leftOpenCount: String(readMosquitoMeta(d.fabric_type)?.leftOpenCount ?? ''),
              rightOpenCount: String(readMosquitoMeta(d.fabric_type)?.rightOpenCount ?? ''),
              doorSplitCount: String(readMosquitoMeta(d.fabric_type)?.doorSplitCount ?? ''),
            }))
          );
          setSelectedProducts(Array.from(new Set(draft.map((d) => d.product_type))));
          setActiveId(draft[draft.length - 1]?.id ?? '');
        }
        hydrated.current = true;
      })();
    }, [params.customerId, params.fresh])
  );

  function addRow(product: ProductKey) {
    const def = getProduct(product);
    const id = uid();
    setRows((r) => [
      ...r,
      { id, product, area: '', type: product==='curtains' ? 'Main' : (def.typeOptions[0] ?? ''), width: '', height: '', price: '', manualFabricMtr: '', fabricType: '', fabricArea: '', liningType: '', liningFabric: '', liningPrice: '', wallBonusRoll: false, part: '', measurementUnit: 'inch', manualQuantity: '', additionalSqft: '', description: '', frameColor: '', openMethod: 'Bottom Open', leftOpenCount: '', rightOpenCount: '', doorSplitCount: '' },
    ]);
    setActiveId(id);
    setSelectedProducts((p) => (p.includes(product) ? p : [...p, product]));
  }

  function updateRow(id: string, patch: Partial<Row>) {
    setDraftSaved(false);
    setRows((r) => r.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function addCurtainLayer(kind: 'Sheer') {
    const active=rows.find(r=>r.product==='curtains'&&r.id===activeId);
    const source=(active?.type==='Sheer'?rows.find(r=>r.product==='curtains'&&r.area===active.area&&r.type!=='Sheer'):active) ?? [...rows].reverse().find(r=>r.product==='curtains'&&r.type!=='Sheer');
    if (!source) { toast('Add the main Curtain measurement first'); return; }
    const existing=rows.find(r=>r.product==='curtains'&&r.type==='Sheer'&&r.area.trim().toLowerCase()===source.area.trim().toLowerCase());
    if(existing){ setActiveId(existing.id); toast('Sheer already added for this area'); return; }
    const id=uid();
    const copy:Row={...source,id,type:'Sheer',price:'',fabricType:'',liningType:'',liningFabric:'',liningPrice:''};
    setRows(r=>[...r,copy]); setActiveId(id); setSelectedProducts(p=>p.includes('curtains')?p:[...p,'curtains']);
    toast('Sheer size copied from main Curtain');
  }

  function removeRow(id: string) {
    setRows((r) => {
      const next = r.filter((row) => row.id !== id);
      const remainingProducts = new Set(next.map((row) => row.product));
      setSelectedProducts(Array.from(remainingProducts));
      return next;
    });
  }

  /**
   * Per-product quantity logic.
   *  - curtain  → (Part × (H+10)) / 40
   *  - square_feet → (W × H) / 144
   *  - accessories → W / 12
   *  - wallpaper → qty = ceil(((W × H)/144) / 50), plus 1 bonus roll when user toggles
   *    (toggle becomes available when sq.ft ≥ 2)
   */
  function quantityInfo(row: Row): number {
    const def = getProduct(row.product);
    switch (def.formula) {
      case 'curtain':
        return calculateCurtainQty(row.part, row.height);
      case 'square_feet':
        if (row.product === 'mosquito_net') {
          const measured = isVelcroNet(row)
            ? velcroCut(row).areaSqft
            : row.measurementUnit === 'mm'
              ? calculateSquareFeetMm(row.width, row.height)
              : calculateSquareFeet(row.width, row.height);
          const additional = Math.max(0, Number(row.additionalSqft) || 0);
          return Math.round((measured + additional) * 100) / 100;
        }
        if (row.product === 'blinds' && row.type.toLowerCase() === 'roman') {
          return Math.max(0, Number(row.manualFabricMtr) || 0);
        }
        return (row.product === 'blinds' || row.product === 'mosquito_net') && row.measurementUnit === 'mm'
          ? calculateSquareFeetMm(row.width, row.height)
          : calculateSquareFeet(row.width, row.height);
      case 'accessories':
        return calculateAccessories(row.width);
      case 'wallpaper':
        return calculateWallpaperQty(row.width, row.height, row.wallBonusRoll).qty;
      case 'linear_meter':
        return Math.max(0, Number(row.width) || 0);
      default:
        return 0;
    }
  }

  function quantityOf(row: Row): number {
    return quantityInfo(row);
  }
  function totalOf(row: Row): number {
    return calculateTotal(quantityOf(row), row.price);
  }

  const subtotal = useMemo(() => rows.reduce((s, r) => s + totalOf(r), 0), [rows]);

  async function persistDraft() {
    if (!customerId) return;
    const draft = rows.map((r) => {
      const def = getProduct(r.product);
      const q = quantityOf(r);
      return {
        id: r.id,
        customer_id: customerId,
        product_type: r.product,
        area_name: r.area,
        type: r.type,
        part: Number(r.part) || 0,
        measurement_unit: r.measurementUnit,
        gst_percent: 0,
        width: Number(r.width) || 0,
        height: def.usesHeight ? Number(r.height) || 0 : 0,
        quantity: q,
        price: Number(r.price) || 0,
        fabric_type: r.product === 'mosquito_net' ? JSON.stringify({ __mosquitoMeta: 1, description: r.description.trim(), additionalSqft: Number(r.additionalSqft) || 0, frameColor: r.frameColor.trim(), openMethod: r.openMethod, leftOpenCount: Number(r.leftOpenCount) || 0, rightOpenCount: Number(r.rightOpenCount) || 0, doorSplitCount: Number(r.doorSplitCount) || 0 }) : r.fabricType.trim(),
        fabric_area: 0,
        lining_type: r.liningType || undefined,
        lining_fabric: r.liningFabric.trim(),
        lining_quantity: r.product === 'curtains' && r.type !== 'Sheer' && r.liningType ? q : 0,
        lining_price: Number(r.liningPrice) || 0,
        lining_total: calculateTotal(r.product === 'curtains' && r.type !== 'Sheer' && r.liningType ? q : 0, r.liningPrice),
        total: calculateTotal(q, r.price),
      };
    });
    await saveMeasurements(customerId, draft);
    await saveAccessories(customerId, []);
  }

  useEffect(() => {
    if (!hydrated.current || !customerId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setDraftSaved(false);
    saveTimer.current = setTimeout(async () => { await persistDraft(); setDraftSaved(true); }, 350);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [rows, customerId]);

  const activeRow = rows.find((r) => r.id === activeId) ?? null;
  const completedRows = rows.filter((r) => r.id !== activeId);

  async function continueToQuotation() {
    if (rows.length === 0) {
      toast('Add at least one measurement row');
      return;
    }
    const missing = rows.find((r) => !r.area.trim());
    if (missing) { toast('Every row needs an Area Name'); return; }
    const invalid = rows.find((r) => {
      if (r.product === 'mosquito_net') {
        if (Number(r.width) <= 0 || Number(r.height) <= 0 || Number(r.additionalSqft) < 0) return true;
        if (isDoorNet(r.type)) {
          if (!r.frameColor.trim() || Number(r.doorSplitCount) <= 0) return true;
          if (r.openMethod === 'Left Open' && Number(r.leftOpenCount) <= 0) return true;
          if (r.openMethod === 'Right Open' && Number(r.rightOpenCount) <= 0) return true;
        }
        return false;
      }
      return Number(r.width) <= 0 || (getProduct(r.product).usesHeight && Number(r.height) <= 0)
        || (r.product === 'curtains' && Number(r.part) <= 0)
        || (r.product === 'blinds' && r.type.toLowerCase() === 'roman' && Number(r.manualFabricMtr) <= 0);
    });
    if (invalid) { toast('Enter valid mosquito net Width / Height and required Door details'); return; }
    await persistDraft();
    router.push(`/quotation/new?customerId=${customerId}`);
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Measurements</Text>
      <Text style={styles.sub}>{customer ? `${customer.name} · ${customer.phone}` : 'Loading customer…'}</Text>

      <Text style={styles.sectionLabel}>Product Categories</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catScroll}>
        {PRODUCTS.map((p) => {
          const active = selectedProducts.includes(p.key);
          return (
            <TouchableOpacity
              key={p.key}
              style={[styles.catCard, active ? styles.catCardActive : null]}
              onPress={() => addRow(p.key)}
            >
              <Ionicons name={p.icon as never} size={22} color={active ? '#fff' : colors.navy} />
              <Text style={[styles.catName, active ? { color: '#fff' } : null]}>{p.name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {activeRow ? (() => {
        const row=activeRow, def=getProduct(row.product), qty=quantityOf(row), tot=totalOf(row);
        return <Card style={{marginTop:14}}>
          <View style={styles.rowHead}><Text style={styles.rowTitle}>{row.product==='curtains'?'Curtain Details':`Add ${def.name}`}</Text><Text style={styles.autoSave}>{draftSaved?'✓ Auto saved':'Saving…'}</Text></View>
          {row.product==='curtains' ? <>
            <View style={[styles.comboHead,{marginTop:4}]}><View><Text style={styles.comboTitle}>1. Select Curtain Type</Text><Text style={styles.comboSub}>Choose Main or add a matching Sheer layer</Text></View><Ionicons name="layers-outline" size={20} color={colors.orange}/></View>
            <ChipGroup options={['Main','Sheer']} selected={row.type==='Sheer'?'Sheer':'Main'} onSelect={v=>{if(v==='Sheer'){addCurtainLayer('Sheer');}else{updateRow(row.id,{type:'Main'});}}}/>
            <View style={styles.comboHead}><View><Text style={styles.comboTitle}>2. Area & Measurements</Text><Text style={styles.comboSub}>Enter the room/window name and size in inches</Text></View><Ionicons name="resize-outline" size={20} color={colors.orange}/></View>
            <Field label="Area Name" value={row.area} onChangeText={t=>updateRow(row.id,{area:t})} placeholder="e.g. Hall Window 1"/>
            <Field label="Part (number of curtain parts)" value={row.part} onChangeText={t=>updateRow(row.id,{part:numericInput(t)})} keyboardType="numeric" placeholder="e.g. 5"/>
            <View style={styles.halfRow}><View style={{flex:1,marginRight:8}}><Field label="Width (inch)" value={row.width} onChangeText={t=>updateRow(row.id,{width:numericInput(t)})} keyboardType="numeric" placeholder="e.g. 88"/></View><View style={{flex:1}}><Field label="Height (inch)" value={row.height} onChangeText={t=>updateRow(row.id,{height:numericInput(t)})} keyboardType="numeric" placeholder="e.g. 90"/></View></View>
            <View style={styles.comboHead}><View><Text style={styles.comboTitle}>3. Fabric Details</Text><Text style={styles.comboSub}>Enter fabric name; required metres calculate automatically</Text></View><Ionicons name="shirt-outline" size={20} color={colors.orange}/></View>
            <Field label={row.type==='Sheer'?'Sheer Fabric Name':'Main Fabric Name'} value={row.fabricType} onChangeText={t=>updateRow(row.id,{fabricType:t})} placeholder={row.type==='Sheer'?'e.g. White Sheer':'e.g. Royal Blue'}/>
            <View style={[styles.preview,{marginTop:4}]}><Text style={styles.previewLabel}>FABRIC REQUIRED</Text><Text style={[styles.previewVal,{fontSize:22,marginTop:5}]}>{qty.toFixed(2)} mtr</Text><Text style={styles.comboSub}>Calculated automatically from Part, Width and Height</Text></View>
            {row.type!=='Sheer' ? <>
              <View style={styles.comboHead}><View><Text style={styles.comboTitle}>4. Lining Details (Optional)</Text><Text style={styles.comboSub}>No separate lining fabric name needed</Text></View><Ionicons name="albums-outline" size={20} color={colors.orange}/></View>
              <ChipGroup options={['No Lining','Blackout Lining','Semi Lining']} selected={row.liningType||'No Lining'} onSelect={v=>updateRow(row.id,{liningType:v==='No Lining'?'':v as Row['liningType']})}/>
              {row.liningType ? <View style={styles.wpBox}><Text style={styles.wpFormula}>LINING QUANTITY · {qty.toFixed(2)} mtr</Text><Field label="Lining Rate (₹ / mtr)" value={row.liningPrice} onChangeText={t=>updateRow(row.id,{liningPrice:numericInput(t)})} keyboardType="decimal-pad" placeholder="e.g. 100"/><Text style={styles.wpFormula}>Lining Total: {formatINR(calculateTotal(qty,row.liningPrice))}</Text></View> : null}
            </> : null}
            <View style={styles.comboHead}><View><Text style={styles.comboTitle}>{row.type==='Sheer'?'Sheer':'Main'} Curtain Price</Text><Text style={styles.comboSub}>Enter the selling rate for this curtain</Text></View></View>
          </> : row.product==='blinds' ? <>
            <View style={[styles.comboHead,{marginTop:4}]}><View><Text style={styles.comboTitle}>1. Select Blind Type</Text><Text style={styles.comboSub}>Choose the product you are measuring</Text></View><Ionicons name="blinds" size={20} color={colors.orange}/></View>
            <ChipGroup options={def.typeOptions} selected={row.type} onSelect={v=>updateRow(row.id,{type:v})}/>
            <View style={styles.comboHead}><View><Text style={styles.comboTitle}>2. Area & Measurements</Text><Text style={styles.comboSub}>Choose inch or mm, then enter window size</Text></View><Ionicons name="resize-outline" size={20} color={colors.orange}/></View>
            <Field label="Area Name" value={row.area} onChangeText={t=>updateRow(row.id,{area:t})} placeholder="e.g. Hall Window 1"/>
            <Text style={styles.miniLabel}>Measurement Unit</Text><ChipGroup options={['inch','mm']} selected={row.measurementUnit} onSelect={v=>updateRow(row.id,{measurementUnit:v as 'inch'|'mm'})}/>
            <View style={styles.halfRow}><View style={{flex:1,marginRight:8}}><Field label={`Width (${row.measurementUnit})`} value={row.width} onChangeText={t=>updateRow(row.id,{width:numericInput(t)})} keyboardType="decimal-pad" placeholder="e.g. 48"/></View><View style={{flex:1}}><Field label={`Height (${row.measurementUnit})`} value={row.height} onChangeText={t=>updateRow(row.id,{height:numericInput(t)})} keyboardType="decimal-pad" placeholder="e.g. 60"/></View></View>
            {row.type.toLowerCase()==='roman' ? <><View style={styles.comboHead}><View><Text style={styles.comboTitle}>3. Roman Blind Fabric (Manual)</Text><Text style={styles.comboSub}>Enter fabric metres and fabric name manually</Text></View><Ionicons name="shirt-outline" size={20} color={colors.orange}/></View><Field label="Fabric Required (mtr)" value={row.manualFabricMtr} onChangeText={t=>updateRow(row.id,{manualFabricMtr:numericInput(t)})} keyboardType="decimal-pad" placeholder="Enter fabric metres"/><Field label="Fabric Name / Details" value={row.fabricType} onChangeText={t=>updateRow(row.id,{fabricType:t})} placeholder="e.g. Premium Grey Fabric"/></> : <Field label="Fabric / Colour Name (optional)" value={row.fabricType} onChangeText={t=>updateRow(row.id,{fabricType:t})} placeholder="e.g. Grey Premium"/>}
            <View style={[styles.preview,{marginTop:4}]}><Text style={styles.previewLabel}>{row.type.toLowerCase()==='roman'?'MANUAL FABRIC QUANTITY':'AUTOMATIC BLIND AREA'}</Text><Text style={[styles.previewVal,{fontSize:22,marginTop:5}]}>{qty.toFixed(2)} {row.type.toLowerCase()==='roman'?'mtr':'sq.ft'}</Text><Text style={styles.comboSub}>{row.type.toLowerCase()==='roman'?'Manual fabric quantity entered above':'Calculated automatically: Width × Height ÷ 144 (inch) or converted mm area'}</Text></View>
          </> : <>
            <View style={[styles.comboHead,{marginTop:4}]}><View><Text style={styles.comboTitle}>1. Product & Area</Text><Text style={styles.comboSub}>Choose the product type and name this room or item</Text></View><Ionicons name="pricetag-outline" size={20} color={colors.orange}/></View>
            <Field label="Area / Location Name" value={row.area} onChangeText={t=>updateRow(row.id,{area:t})} placeholder="e.g. Living Room / Hall Window 1"/>
            <Text style={styles.miniLabel}>{def.typeLabel}</Text><ChipGroup options={def.typeOptions} selected={row.type} onSelect={v=>updateRow(row.id,{type:v})}/>
            <View style={styles.comboHead}><View><Text style={styles.comboTitle}>2. Measurements</Text><Text style={styles.comboSub}>{def.usesHeight?'Enter width and height to calculate quantity':'Enter the required material length'}</Text></View><Ionicons name="resize-outline" size={20} color={colors.orange}/></View>
            {(row.product==='blinds' || row.product==='mosquito_net')?<><Text style={styles.miniLabel}>Measurement Unit</Text><ChipGroup options={['inch','mm']} selected={row.measurementUnit} onSelect={v=>updateRow(row.id,{measurementUnit:v as 'inch'|'mm'})}/></>:null}
            <View style={styles.halfRow}><View style={{flex:1,marginRight:8}}><Field label={row.product==='mosquito_net' ? `Width (${row.measurementUnit})` : def.formula==='accessories'?'Track / Rod Length (inch)':def.formula==='linear_meter'?'Material Required (mtr)':'Width (inch)'} value={row.width} onChangeText={t=>updateRow(row.id,{width:numericInput(t)})} keyboardType="decimal-pad" placeholder="Enter width / length"/></View>{def.usesHeight?<View style={{flex:1}}><Field label={`Height${row.product==='mosquito_net' ? ` (${row.measurementUnit})` : ' (inch)'}`} value={row.height} onChangeText={t=>updateRow(row.id,{height:numericInput(t)})} keyboardType="decimal-pad" placeholder="Enter height"/></View>:<View style={{flex:1}}/>}</View>
          </>}
          {isVelcroNet(row) ? (() => { const cut = velcroCut(row); return <View style={styles.wpBox}><Text style={styles.wpFormula}>VELCRO NET CUTTING SIZE (+2 inch allowance)</Text><Text style={styles.wpBonusText}>Original: {row.width} × {row.height} {row.measurementUnit}</Text><Text style={styles.wpBonusText}>Cutting: {cut.width.toFixed(1)} × {cut.height.toFixed(1)} {row.measurementUnit}</Text><Text style={styles.wpBonusText}>Material required: {cut.areaSqft.toFixed(2)} sq.ft</Text><Text style={styles.wpNote}>Rotation and panel splitting are allowed for both stock widths</Text></View>; })() : null}
          {row.product==='mosquito_net' ? <><View style={styles.comboHead}><View><Text style={styles.comboTitle}>3. Net & Fitting Details</Text><Text style={styles.comboSub}>Add only the details needed for this net type</Text></View><Ionicons name="shield-checkmark-outline" size={20} color={colors.orange}/></View><Field label="Additional Area (sq.ft), if any" value={row.additionalSqft} onChangeText={t=>updateRow(row.id,{additionalSqft:numericInput(t)})} keyboardType="decimal-pad" placeholder="0"/><Field label="Net Description / Colour" value={row.description} onChangeText={t=>updateRow(row.id,{description:t})} placeholder="e.g. Grey net / Black frame"/>{isDoorNet(row.type) ? <><Field label="Frame Color" value={row.frameColor} onChangeText={t=>updateRow(row.id,{frameColor:t})} placeholder="e.g. White / Black / Brown"/><Text style={styles.miniLabel}>Open Method</Text><ChipGroup options={['Bottom Open','Left Open','Right Open']} selected={row.openMethod} onSelect={v=>updateRow(row.id,{openMethod:v as Row['openMethod']})}/>{row.openMethod==='Left Open' ? <Field label="No. of Doors Opening Left" value={row.leftOpenCount} onChangeText={t=>updateRow(row.id,{leftOpenCount:numericInput(t,false)})} keyboardType="numeric" placeholder="Enter count"/> : null}{row.openMethod==='Right Open' ? <Field label="No. of Doors Opening Right" value={row.rightOpenCount} onChangeText={t=>updateRow(row.id,{rightOpenCount:numericInput(t,false)})} keyboardType="numeric" placeholder="Enter count"/> : null}<Field label="Door Split Count" value={row.doorSplitCount} onChangeText={t=>updateRow(row.id,{doorSplitCount:numericInput(t,false)})} keyboardType="numeric" placeholder="How many door panels?"/></> : null}</> : null}

          <View style={styles.comboHead}><View><Text style={styles.comboTitle}>{row.product==='mosquito_net'?'4.': '3.'} Price & Total</Text><Text style={styles.comboSub}>Enter the rate for each calculated unit</Text></View><Ionicons name="calculator-outline" size={20} color={colors.orange}/></View>
          <Field label={`Rate (₹ / ${row.product === 'blinds' && row.type.toLowerCase() === 'roman' ? 'mtr' : def.qtyUnit})`} value={row.price} onChangeText={t=>updateRow(row.id,{price:numericInput(t)})} keyboardType="decimal-pad" placeholder="Enter rate"/>
          <View style={styles.preview}><Text style={styles.previewLabel}>{row.product === 'mosquito_net' ? 'AUTO SQ.FT + ADDITIONAL SQ.FT' : row.product === 'blinds' && row.type.toLowerCase() === 'roman' ? 'MANUAL FABRIC QUANTITY' : 'LIVE CALCULATION'}</Text><View style={{flexDirection:'row',justifyContent:'space-between',marginTop:6}}><Text style={styles.previewQty}>Quantity ({row.product === 'blinds' && row.type.toLowerCase() === 'roman' ? 'mtr' : def.qtyUnit}): <Text style={styles.previewVal}>{qty}</Text></Text><Text style={styles.previewQty}>Total: <Text style={styles.previewVal}>{formatINR(tot)}</Text></Text></View></View>
          <View style={{flexDirection:'row',gap:8,marginTop:12}}><Button title="Delete" icon="trash-outline" variant="outline" style={{flex:1}} onPress={()=>removeRow(row.id)}/><Button title="Add to List" icon="add" variant="accent" style={{flex:2}} onPress={()=>{setActiveId('');toast('Item added · Auto saved');}}/></View>
        </Card>;
      })():null}

      {completedRows.length>0?<Card style={{marginTop:14}}><View style={styles.rowHead}><Text style={styles.rowTitle}>Added Items ({completedRows.length})</Text><Text style={styles.autoSave}>✓ Auto saved</Text></View>{completedRows.map((row,i)=>{const def=getProduct(row.product);return <TouchableOpacity key={row.id} style={styles.savedRow} onPress={()=>setActiveId(row.id)}><View style={{flex:1}}><Text style={styles.savedTitle}>{i+1}. {row.area||'Untitled'} · {def.name}</Text><Text style={styles.savedMeta}>{row.type||'—'} · {quantityOf(row)} {row.product === 'blinds' && row.type.toLowerCase() === 'roman' ? 'mtr' : def.qtyUnit}</Text></View><Text style={styles.savedTotal}>{formatINR(totalOf(row),false)}</Text><Ionicons name="pencil" size={18} color={colors.navy}/><TouchableOpacity onPress={()=>removeRow(row.id)}><Ionicons name="trash-outline" size={18} color={colors.danger}/></TouchableOpacity></TouchableOpacity>})}</Card>:null}

      <Button title="+ Add Another Item" icon="add" variant="outline" style={{ marginTop: 14 }} onPress={() => addRow(activeRow?.product ?? selectedProducts[selectedProducts.length - 1] ?? 'curtains')} />

      {(() => {
        const velcroRows = rows.filter(isVelcroNet);
        if (!velcroRows.length) return null;
        const totalSqft = velcroRows.reduce((sum, item) => sum + velcroCut(item).areaSqft + Math.max(0, Number(item.additionalSqft) || 0), 0);
        const feet3 = totalSqft / 3;
        const feet5 = totalSqft / 5;
        return <Card style={{ marginTop: 14 }}>
          <Text style={styles.rowTitle}>Velcro Net – Whole House Stock Calculation</Text>
          <Text style={styles.savedMeta}>Windows added: {velcroRows.length} · Cutting allowance: +2 inch on width and height per window</Text>
          {velcroRows.map((item, index) => { const cut = velcroCut(item); return <View key={item.id} style={{ marginTop: 5 }}><Text style={styles.wpFormula}>{index + 1}. {item.area || 'Window'} · Original {item.width} × {item.height} {item.measurementUnit}</Text><Text style={styles.wpBonusText}>Cut size: {cut.width.toFixed(1)} × {cut.height.toFixed(1)} {item.measurementUnit} · {cut.areaSqft.toFixed(2)} sq.ft</Text></View>; })}
          <View style={styles.wpBox}>
            <Text style={styles.wpFormula}>Total material: {totalSqft.toFixed(2)} sq.ft</Text>
            <Text style={styles.wpBonusText}>3 Feet Net: {feet3.toFixed(2)} running feet required</Text>
            <Text style={styles.wpBonusText}>5 Feet Net: {feet5.toFixed(2)} running feet required</Text>
            <Text style={styles.wpNote}>Estimate assumes panels can be rotated and split. Running feet = total cutting area ÷ stock roll width; actual cutting layout may create extra waste.</Text>
          </View>
        </Card>;
      })()}

      <Card style={{ marginTop: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={styles.subtotalLabel}>Products Subtotal</Text>
          <Text style={styles.subtotalValue}>{formatINR(subtotal)}</Text>
        </View>
      </Card>

      <View style={{ gap: 10, marginTop: 18 }}>
        <Button title="Continue to Quotation" icon="arrow-forward" variant="accent" onPress={continueToQuotation} />
        <Button
          title="Save Draft"
          icon="save-outline"
          onPress={async () => {
            await persistDraft();
            toast('Draft saved — safe to close the app');
          }}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 24, fontWeight: '900', color: colors.navy },
  sub: { color: colors.textMuted, fontSize: 13.5, marginTop: 4 },
  sectionLabel: { fontWeight: '800', color: colors.text, marginTop: 18, marginBottom: 8, fontSize: 15 },
  catScroll: { gap: 10, paddingRight: 18 },
  catCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 126,
    justifyContent: 'center',
  },
  catCardActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  catName: { fontWeight: '700', color: colors.textDark, fontSize: 13.5 },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  rowTitle: { fontWeight: '800', color: colors.navy, fontSize: 14.5 },
  miniLabel: { fontSize: 13, fontWeight: '600', color: colors.textDark, marginBottom: 6 },
  halfRow: { flexDirection: 'row' },
  preview: { backgroundColor: '#FFF7EC', borderRadius: 12, padding: 12, marginTop: 4 },
  previewLabel: { fontSize: 11, fontWeight: '800', color: '#C77700', letterSpacing: 0.5 },
  previewFormula: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  previewQty: { fontSize: 13, color: colors.textDark },
  previewVal: { fontWeight: '900', color: colors.navy },
  wpBox: { backgroundColor: '#EEF1F7', borderRadius: 12, padding: 12, marginTop: 6 },
  wpFormula: { fontSize: 12, color: colors.textDark, fontWeight: '700' },
  wpBonusText: { fontSize: 12.5, color: colors.textDark, fontWeight: '600' },
  wpNote: { fontSize: 12, color: colors.textMuted, marginTop: 4, fontStyle: 'italic' },
  subtotalLabel: { fontWeight: '800', color: colors.textDark },
  subtotalValue: { fontWeight: '900', color: colors.orange, fontSize: 17 },
  autoSave: { fontSize: 11.5, fontWeight: '800', color: '#0E9A4C' },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EEF1F7' },
  savedTitle: { fontWeight: '800', color: colors.textDark, fontSize: 13 },
  savedMeta: { color: colors.textMuted, fontSize: 11.5, marginTop: 2 },
  savedTotal: { fontWeight: '900', color: colors.navy, fontSize: 13 },
  comboHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',backgroundColor:'#F7F8FC',borderRadius:12,padding:10,marginBottom:8},
  comboTitle:{fontWeight:'900',color:colors.navy,fontSize:13.5},comboSub:{fontSize:11,color:colors.textMuted,marginTop:2},
  layerChip:{backgroundColor:'#FFF3E0',borderWidth:1,borderColor:colors.orange,borderRadius:999,paddingHorizontal:11,paddingVertical:8},
  layerChipText:{color:colors.navy,fontWeight:'800',fontSize:11.5},
});
