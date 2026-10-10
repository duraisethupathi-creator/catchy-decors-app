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
  /** Fabric chosen for this item (type + area). */
  fabricType: string;
  fabricArea: string;
  /** Wallpaper: user-controlled bonus-roll toggle (enabled when D ≥ 2) */
  wallBonusRoll: boolean;
  part: string;
  measurementUnit: 'inch' | 'mm';
}

const uid = () => Math.random().toString(36).slice(2);

export default function Measurements() {
  const params = useLocalSearchParams<{ customerId?: string }>();
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
        const draft = await loadDraftMeasurements(cid);
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
              fabricType: d.fabric_type ?? '',
              fabricArea: d.fabric_area ? String(d.fabric_area) : '',
              wallBonusRoll: false,
              part: d.part ? String(d.part) : '',
              measurementUnit: d.measurement_unit ?? 'inch',
            }))
          );
          setSelectedProducts(Array.from(new Set(draft.map((d) => d.product_type))));
          setActiveId(draft[draft.length - 1]?.id ?? '');
        }
        hydrated.current = true;
      })();
    }, [params.customerId])
  );

  function addRow(product: ProductKey) {
    const def = getProduct(product);
    const id = uid();
    setRows((r) => [
      ...r,
      { id, product, area: '', type: def.typeOptions[0] ?? '', width: '', height: '', price: '', fabricType: '', fabricArea: '', wallBonusRoll: false, part: '', measurementUnit: 'inch' },
    ]);
    setActiveId(id);
    setSelectedProducts((p) => (p.includes(product) ? p : [...p, product]));
  }

  function updateRow(id: string, patch: Partial<Row>) {
    setDraftSaved(false);
    setRows((r) => r.map((row) => (row.id === id ? { ...row, ...patch } : row)));
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
        fabric_type: r.fabricType.trim(),
        fabric_area: Number(r.fabricArea) || 0,
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
    const invalid = rows.find((r) => Number(r.width) <= 0 || (getProduct(r.product).usesHeight && Number(r.height) <= 0) || (r.product === 'curtains' && Number(r.part) <= 0));
    if (invalid) { toast('Enter valid Width, Height and Curtain Part values'); return; }
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
          <View style={styles.rowHead}><Text style={styles.rowTitle}>Add {def.name}</Text><Text style={styles.autoSave}>{draftSaved?'✓ Auto saved':'Saving…'}</Text></View>
          <Field label="Area Name" value={row.area} onChangeText={t=>updateRow(row.id,{area:t})} placeholder="e.g. Living Room Window 1"/>
          <Text style={styles.miniLabel}>{def.typeLabel}</Text><ChipGroup options={def.typeOptions} selected={row.type} onSelect={v=>updateRow(row.id,{type:v})}/>
          {(row.product==='blinds'||row.product==='mosquito_net')?<><Text style={styles.miniLabel}>Measurement Unit</Text><ChipGroup options={['inch','mm']} selected={row.measurementUnit} onSelect={v=>updateRow(row.id,{measurementUnit:v as 'inch'|'mm'})}/></>:null}
          {row.product==='curtains'?<Field label="Part" value={row.part} onChangeText={t=>updateRow(row.id,{part:numericInput(t)})} keyboardType="numeric" placeholder="0"/>:null}
          <View style={styles.halfRow}><View style={{flex:1,marginRight:8}}><Field label={def.formula==='accessories'?'Curtain Width (in)':def.formula==='linear_meter'?'Material (mtr)':'Width (in)'} value={row.width} onChangeText={t=>updateRow(row.id,{width:numericInput(t)})} keyboardType="numeric" placeholder="0"/></View>{def.usesHeight?<View style={{flex:1}}><Field label="Height" value={row.height} onChangeText={t=>updateRow(row.id,{height:numericInput(t)})} keyboardType="numeric" placeholder="0"/></View>:<View style={{flex:1}}/>}</View>
          <Field label="Fabric Details" value={row.fabricType} onChangeText={t=>updateRow(row.id,{fabricType:t})} placeholder="e.g. Cotton, Blackout"/>
          <Field label="Price (₹)" value={row.price} onChangeText={t=>updateRow(row.id,{price:numericInput(t)})} keyboardType="numeric" placeholder="0"/>
          <View style={styles.preview}><Text style={styles.previewLabel}>LIVE CALCULATION</Text><View style={{flexDirection:'row',justifyContent:'space-between',marginTop:6}}><Text style={styles.previewQty}>Quantity ({def.qtyUnit}): <Text style={styles.previewVal}>{qty}</Text></Text><Text style={styles.previewQty}>Total: <Text style={styles.previewVal}>{formatINR(tot)}</Text></Text></View></View>
          <View style={{flexDirection:'row',gap:8,marginTop:12}}><Button title="Delete" icon="trash-outline" variant="outline" style={{flex:1}} onPress={()=>removeRow(row.id)}/><Button title="Add to List" icon="add" variant="accent" style={{flex:2}} onPress={()=>{setActiveId('');toast('Item added · Auto saved');}}/></View>
        </Card>;
      })():null}

      {completedRows.length>0?<Card style={{marginTop:14}}><View style={styles.rowHead}><Text style={styles.rowTitle}>Added Items ({completedRows.length})</Text><Text style={styles.autoSave}>✓ Auto saved</Text></View>{completedRows.map((row,i)=>{const def=getProduct(row.product);return <TouchableOpacity key={row.id} style={styles.savedRow} onPress={()=>setActiveId(row.id)}><View style={{flex:1}}><Text style={styles.savedTitle}>{i+1}. {row.area||'Untitled'} · {def.name}</Text><Text style={styles.savedMeta}>{row.type||'—'} · {quantityOf(row)} {def.qtyUnit}</Text></View><Text style={styles.savedTotal}>{formatINR(totalOf(row),false)}</Text><Ionicons name="pencil" size={18} color={colors.navy}/><TouchableOpacity onPress={()=>removeRow(row.id)}><Ionicons name="trash-outline" size={18} color={colors.danger}/></TouchableOpacity></TouchableOpacity>})}</Card>:null}

      <Button title="+ Add Another Item" icon="add" variant="outline" style={{ marginTop: 14 }} onPress={() => addRow(activeRow?.product ?? selectedProducts[selectedProducts.length - 1] ?? 'curtains')} />

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
});
