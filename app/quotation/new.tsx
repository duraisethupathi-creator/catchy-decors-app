import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button, Card, Field, SectionTitle } from '../../src/components/common';
import { toast } from '../../src/components/common/ui';
import { colors } from '../../src/constants/colors';
import { quantityColumnLabel, getProduct } from '../../src/constants/products';
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
import { round2, calculateAccessories, calculateTotal } from '../../src/utils/calculations';
import type { Customer } from '../../src/types/customer';
import type { Measurement, Accessory, OtherCharge } from '../../src/types/measurement';
import type { Quotation } from '../../src/types/quotation';
import { getRatesForProduct, saveRate, type RateItem } from '../../src/services/rateLibraryService';

const uid = () => Math.random().toString(36).slice(2);

interface AccRow {
  id: string;
  area: string;
  trackType: string;
  width: string;
  price: string;
}

export default function NewQuotation() {
  const params = useLocalSearchParams<{ customerId?: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [items, setItems] = useState<Measurement[]>([]);
  const [accRows, setAccRows] = useState<AccRow[]>([]);
  const [qNumber, setQNumber] = useState('');
  const [charges, setCharges] = useState<ChargesBundle>(emptyChargesBundle);
  const [saving, setSaving] = useState(false);
  const [rateRows, setRateRows] = useState<RateItem[]>([]);
  const [rateProduct, setRateProduct] = useState<'curtains'|'blinds'|'mosquito_net'|'wallpaper'|'headboard'|'flooring'|'accessories'>('curtains');
  const [rateType, setRateType] = useState(''); const [rateMaterial,setRateMaterial]=useState(''); const [rateValue,setRateValue]=useState('');

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const cid = params.customerId ?? (await AsyncStorage.getItem('cd_current_customer'));
        if (!cid) {
          router.replace('/customer/new?mode=quotation');
          return;
        }
        const c = await getCustomer(cid);
        setCustomer(c);
        setItems(await loadDraftMeasurements(cid));
        const draftAcc = await loadDraftAccessories(cid);
        setAccRows(
          draftAcc.map((a) => ({
            id: a.id,
            area: a.area_name,
            trackType: a.track_type,
            width: String(a.width || ''),
            price: String(a.price || ''),
          }))
        );
        const draftCharges = await loadChargesDraft(cid);
        if (draftCharges.length > 0) setCharges(bundleFromChargesWithExtras(draftCharges));
        setQNumber(await peekQuotationNumber());
      })();
    }, [params.customerId])
  );

  function accQty(r: AccRow): number { return calculateAccessories(r.width); }
  function accTotal(r: AccRow): number { return calculateTotal(accQty(r), r.price); }

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.total, 0), [items]);
  const accessoriesTotal = useMemo(() => accRows.reduce((s, r) => s + accTotal(r), 0), [accRows]);
  const curtainParts = useMemo(() => round2(items.filter((i) => i.product_type === 'curtains').reduce((s, i) => s + (i.part || 0), 0)), [items]);
  const effectiveCharges = useMemo(() => ({ ...charges, stitchingQty: String(curtainParts || '') }), [charges, curtainParts]);
  const bundle = useMemo(() => buildCharges(effectiveCharges), [effectiveCharges]);
  const grandTotal = computeGrandTotal(subtotal, accessoriesTotal, bundle.totals);
  /* Requirement 5: fabric quantity that belongs in the Other Charges area. */
  const fabricNote = (() => {
    const mtr = round2(items.filter((i) => i.product_type === 'curtains').reduce((s, i) => s + (i.quantity || 0), 0));
    const sqft = round2(items.reduce((s, i) => s + (i.fabric_area || 0), 0));
    const parts: string[] = [];
    if (mtr) parts.push(`curtains ${mtr} mtr`);
    if (sqft) parts.push(`fabric area ${sqft} sq.ft`);
    return parts.length ? `Fabric total: ${parts.join(' · ')}` : '';
  })();

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
      const num = await nextQuotationNumber();
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
      const q = await saveQuotation({
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
        status,
      });
      const { commitQuotation } = await import('../../src/services/quotationService');
      await commitQuotation(q, customer.id);
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
    const num = await nextQuotationNumber();
    const q = await saveQuotation({
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
      status: 'draft',
    });
    const { commitQuotation } = await import('../../src/services/quotationService');
    await commitQuotation(q, customer.id);
    router.replace(`/quotation/preview?id=${q.id}`);
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Create Quotation</Text>
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
              <Text style={styles.lineText}>{i + 1}. {it.area_name} — {def.name} · {unitLabel} {it.quantity}</Text>
              <Text style={styles.lineTotal}>{formatINR(it.total, false)}</Text>
            </View>
          );
        })
      )}

      <SectionTitle><Text style={{ fontSize:16,fontWeight:'800',color:colors.text }}>Smart Rate Library</Text></SectionTitle>
      <Card>
        <Text style={styles.formulaNote}>Optional reference only — quotation rates remain fully editable.</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:7,marginBottom:10}}>
          {(['curtains','blinds','mosquito_net','wallpaper','headboard','flooring','accessories'] as const).map(p=><TouchableOpacity key={p} onPress={async()=>{setRateProduct(p);setRateRows(await getRatesForProduct(p));}} style={[styles.rateChip,rateProduct===p&&styles.rateChipOn]}><Text style={[styles.rateChipText,rateProduct===p&&styles.rateChipTextOn]}>{getProduct(p).name}</Text></TouchableOpacity>)}
        </ScrollView>
        <Field label="Type / Model" value={rateType} onChangeText={setRateType} placeholder="e.g. Zebra / Blackout" />
        <Field label="Material / Design Name" value={rateMaterial} onChangeText={setRateMaterial} placeholder="e.g. Premium Grey 01" />
        <Field label="Reference Rate (₹)" value={rateValue} onChangeText={t=>setRateValue(numericInput(t))} keyboardType="numeric" />
        <Button title="Save Rate for Future" icon="bookmark" variant="outline" onPress={async()=>{const rate=Number(rateValue)||0;if(!rateMaterial.trim()||rate<=0)return Alert.alert('Rate Library','Enter material/design name and rate.');await saveRate({product:rateProduct,type:rateType,material:rateMaterial,rate,unit:getProduct(rateProduct).qtyUnit});setRateRows(await getRatesForProduct(rateProduct));setRateMaterial('');setRateValue('');toast('Rate saved to library');}}/>
        {rateRows.slice(0,6).map(r=><TouchableOpacity key={r.id} style={styles.rateRow} onPress={()=>{setRateType(r.type);setRateMaterial(r.material);setRateValue(String(r.rate));}}><View style={{flex:1}}><Text style={styles.rateName}>{r.material}</Text><Text style={styles.rateMeta}>{r.type||getProduct(r.product).name} · per {r.unit}</Text></View><Text style={styles.ratePrice}>{formatINR(r.rate)}</Text></TouchableOpacity>)}
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
      <Button title="+ Add Accessory Row" icon="add" variant="outline" onPress={addAccRow} />

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
              <View style={{ flex: 1 }}>
                <Field
                  label="Amount (₹)"
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

      <View style={{ gap: 10, marginTop: 18 }}>
        <Button title="Generate Quotation & Preview" icon="document-text" variant="accent" onPress={onSavePreview} disabled={saving} />
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
