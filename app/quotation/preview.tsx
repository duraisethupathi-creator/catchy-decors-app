import React, { useCallback, useState } from 'react';
import { Image, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Field, ChipGroup } from '../../src/components/common';
import { EmptyState, toast, confirm } from '../../src/components/common/ui';
import { colors } from '../../src/constants/colors';
import { COMPANY } from '../../src/constants/company';
import {
  getQuotation,
  deleteQuotation,
  updateQuotationStatus,
  updateQuotation,
  buildCharges,
  computeGrandTotal,
  otherChargesTotalFrom,
  bundleFromChargesWithExtras,
  emptyChargesBundle,
  newExtraRow,
  stitchingQuantity,
  type ChargesBundle,
  type ExtraChargeRow,
} from '../../src/services/quotationService';
import {
  buildQuotationHtml,
  buildNonGstBillHtml,
  buildGstBillHtml,
  quotationFileName,
  type GstBillSettings,
} from '../../src/services/pdfService';
import { formatINR, formatDate } from '../../src/utils/currency';
import {
  calculateTotal,
  calculateCurtainQty,
  calculateSquareFeet,
  calculateSquareFeetMm,
  calculateAccessories,
  calculateWallpaperQty,
  round2,
  toNum,
} from '../../src/utils/calculations';
import { numericInput } from '../../src/utils/validation';
import { getProduct, quantityColumnLabel } from '../../src/constants/products';
import type { Quotation } from '../../src/types/quotation';
import type { Measurement } from '../../src/types/measurement';
import { useSettings } from '../../src/context/SettingsContext';
import { readLogoDataUri } from '../../src/services/logoData';
import { shareQuotationExcel } from '../../src/services/excelShare';

const GST_PERCENTAGES = [0, 5, 12, 18, 28] as const;

/** Formula default for a product row — the value an override replaces (never deletes). */
function formulaQty(it: Measurement): number {
  const def = getProduct(it.product_type);
  if (def.formula === 'curtain') return calculateCurtainQty(it.part ?? 0, it.height);
  if (def.formula === 'square_feet') return (it.product_type === 'blinds' || it.product_type === 'mosquito_net') && it.measurement_unit === 'mm' ? calculateSquareFeetMm(it.width, it.height) : calculateSquareFeet(it.width, it.height);
  if (def.formula === 'wallpaper') return calculateWallpaperQty(it.width, it.height, false).qty;
  if (def.formula === 'accessories') return calculateAccessories(it.width);
  return it.quantity;
}

export default function Preview() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { settings } = useSettings();
  // Business profile + template drive every printed document (editable in Settings).
  const [logoDataUri, setLogoDataUri] = useState('');
  /** Requirement 7: free description printed on the Other Charges row. */
  const [chargesDesc, setChargesDesc] = useState('');
  const docCtx = { profile: settings.profile, template: settings.template, logoDataUri };
  const [q, setQ] = useState<Quotation | null>(null); // last saved copy
  const [draft, setDraft] = useState<Quotation | null>(null); // editable copy
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [charges, setCharges] = useState<ChargesBundle>(emptyChargesBundle);
  const [showGstEditor, setShowGstEditor] = useState(false);
  const [showMoreExports, setShowMoreExports] = useState(false);
  const [gst, setGst] = useState<GstBillSettings>({
    enabled: settings.template.gstEnabledByDefault,
    percent: settings.template.gstPercent || 18,
    invoiceNumber: '',
    company: {
      name: settings.profile.name || COMPANY.name,
      tagline: settings.profile.tagline || COMPANY.tagline,
      addressLine1: settings.profile.addressLine1 || COMPANY.addressLine1,
      addressLine2: settings.profile.addressLine2 || COMPANY.addressLine2,
      addressLine3: settings.profile.addressLine3 || COMPANY.addressLine3,
      addressLine4: settings.profile.addressLine4 || COMPANY.addressLine4,
      phone: settings.profile.phone || COMPANY.phone,
      website: settings.profile.website || COMPANY.website,
      gstin: settings.profile.gstin || '',
    },
    customer: { name: '', phone: '', address: '', site: '', gstin: '' },
  });

  const setGstCompanyField = (key: keyof GstBillSettings['company'], value: string) =>
    setGst((g) => ({ ...g, company: { ...g.company, [key]: value } }));
  const setGstCustomerField = (key: keyof GstBillSettings['customer'], value: string) =>
    setGst((g) => ({ ...g, customer: { ...g.customer, [key]: value } }));

  useFocusEffect(
    useCallback(() => {
      if (id)
        getQuotation(String(id)).then((loaded) => {
          setQ(loaded);
          setDraft(loaded);
          setDirty(false);
          if (!loaded) return;
          setCharges(bundleFromChargesWithExtras(loaded.charges));
          setChargesDesc(loaded.charges_label ?? '');
          if (loaded.gst) {
            setGst((cur) => ({
              ...cur,
              enabled: loaded.gst?.enabled ?? cur.enabled,
              percent: loaded.gst?.percent ?? cur.percent,
              invoiceNumber: (loaded.gst as any)?.invoiceNumber ?? (loaded.gst as any)?.invoice_number ?? cur.invoiceNumber,
              company: { ...cur.company, ...(loaded.gst?.company ?? {}) },
              customer: { ...cur.customer, ...(loaded.gst?.customer ?? {}) },
            }));
          } else {
            setGst((cur) => ({
              ...cur,
              customer: {
                ...cur.customer,
                name: loaded.customer_name ?? '',
                phone: loaded.customer_phone ?? '',
                site: loaded.site_location ?? '',
              },
            }));
          }
        });
      readLogoDataUri(settings.profile.logoUri).then(setLogoDataUri);
    }, [id, settings.profile.logoUri])
  );

  /* Requirement 5: total fabric quantity shown in the Other Charges area. */
  const fabricNote = (() => {
    const rows = (draft?.items ?? q?.items ?? []) as Measurement[];
    const mtr = round2(rows.filter((i) => i.product_type === 'curtains').reduce((s, i) => s + (i.quantity || 0), 0));
    const sqft = round2(rows.reduce((s, i) => s + (i.fabric_area || 0), 0));
    const parts: string[] = [];
    if (mtr) parts.push(`curtains ${mtr} mtr`);
    if (sqft) parts.push(`fabric area ${sqft} sq.ft`);
    return parts.length ? `Fabric total: ${parts.join(' · ')}` : '';
  })();

  if (!q || !draft) {
    return (
      <View style={styles.root}>
        <EmptyState icon="🧾" title="Quotation not found" />
      </View>
    );
  }

  // ---------- editable item/acc helpers (live recompute, totals always derived) ----------
  function updItem(itemId: string, patch: Partial<Measurement>) {
    setDraft((d) =>
      d
        ? {
            ...d,
            items: (d.items ?? []).map((it) => (it.id === itemId ? { ...it, ...patch } : it)),
          }
        : d
    );
    setDirty(true);
  }
  function removeItem(itemId: string) {
    setDraft((d) => (d ? { ...d, items: (d.items ?? []).filter((it) => it.id !== itemId) } : d));
    setDirty(true);
  }
  function updAcc(accId: string, patch: Partial<NonNullable<Quotation['accessories']>[number]>) {
    setDraft((d) =>
      d
        ? {
            ...d,
            accessories: (d.accessories ?? []).map((a) => (a.id === accId ? { ...a, ...patch } : a)),
          }
        : d
    );
    setDirty(true);
  }
  function removeAcc(accId: string) {
    setDraft((d) => (d ? { ...d, accessories: (d.accessories ?? []).filter((a) => a.id !== accId) } : d));
    setDirty(true);
  }
  function updExtra(id: string, patch: Partial<ExtraChargeRow>) {
    setCharges((c) => ({ ...c, extras: c.extras.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
    setDirty(true);
  }
  function addExtra() {
    setCharges((c) => ({ ...c, extras: [...c.extras, newExtraRow()] }));
    setDirty(true);
  }
  function removeExtra(id: string) {
    setCharges((c) => ({ ...c, extras: c.extras.filter((r) => r.id !== id) }));
    setDirty(true);
  }
  const curtainParts = round2((draft?.items ?? []).filter((i) => i.product_type === 'curtains').reduce((s, i) => s + (Number(i.part) || 0), 0));
  const effectiveCharges: ChargesBundle = { ...charges, stitchingQty: charges.stitchingQty.trim() || String(curtainParts || '') };

  function resetStitchingQty() {
    setCharges((c) => ({ ...c, stitchingQty: String(curtainParts || '') }));
    setDirty(true);
    toast('Stitching quantity restored from Curtain Parts');
  }
  function resetQtyToFormula(it: Measurement) {
    updItem(it.id, { quantity: formulaQty(it) });
    toast(`Quantity restored to formula value (${formulaQty(it)})`);
  }
  function resetAccQty(acc: NonNullable<Quotation['accessories']>[number]) {
    updAcc(acc.id, { quantity: calculateAccessories(acc.width) });
    toast(`Quantity restored to formula value (${calculateAccessories(acc.width)})`);
  }

  // ---------- live totals (from edited draft, nothing persisted yet) ----------
  const liveItems = (draft.items ?? []).map((it) => ({ ...it, liveTotal: calculateTotal(it.quantity, it.price) }));
  const liveAccs = (draft.accessories ?? []).map((a) => ({ ...a, liveTotal: calculateTotal(a.quantity, a.price) }));
  const liveBundle = buildCharges(effectiveCharges);
  const liveSubtotal = round2(liveItems.reduce((s, i) => s + i.liveTotal, 0));
  const liveAccTotal = round2(liveAccs.reduce((s, a) => s + a.liveTotal, 0));
  const liveGrand = computeGrandTotal(liveSubtotal, liveAccTotal, liveBundle.totals);

  // ---------- merge edited draft into a savable quotation (totals recomputed from edits) ----------
  function buildMerged(): Quotation {
    const items: Measurement[] = (draft?.items ?? []).map((it) => ({ ...it, total: calculateTotal(it.quantity, it.price) }));
    const accs = (draft?.accessories ?? []).map((a) => ({ ...a, total: calculateTotal(a.quantity, a.price) }));
    const otherChargesTotal = otherChargesTotalFrom(liveBundle.totals);
    return {
      ...draft!,
      quotation_number: (draft?.quotation_number ?? '').trim() || q!.quotation_number,
      quotation_date: (draft?.quotation_date ?? '').trim() || q!.quotation_date,
      customer_name: (draft?.customer_name ?? '').trim() || q!.customer_name,
      customer_phone: (draft?.customer_phone ?? '').trim() || q!.customer_phone,
      items,
      accessories: accs,
      charges: liveBundle.charges,
      subtotal: liveSubtotal,
      accessories_total: liveAccTotal,
      other_charges: otherChargesTotal,
      charges_label: chargesDesc.trim(),
      discount_label: charges.discDesc.trim(),
      discount: liveBundle.totals.discount,
      grand_total: liveGrand,
      gst,
    };
  }

  async function persistEdits(): Promise<Quotation | null> {
    if (!q || !draft) return null;
    try {
      const saved = await updateQuotation(buildMerged());
      setQ(saved);
      setDraft(saved);
      setDirty(false);
      return saved;
    } catch {
      toast('Save failed');
      return null;
    }
  }

  async function onSave() {
    setBusy(true);
    try {
      const saved = await persistEdits();
      if (saved) toast('Quotation updated');
    } finally {
      setBusy(false);
    }
  }

  /** Always export the CURRENT edited values: auto-saves first when dirty, then builds HTML from the merged copy. */
  async function currentExportSource(): Promise<Quotation | null> {
    if (dirty) {
      const saved = await persistEdits();
      if (!saved) return null;
      return saved;
    }
    return buildMerged();
  }

  async function generatePdf(kind: 'quotation' | 'bill' | 'gst'): Promise<void> {
    try {
      setBusy(true);
      const src = await currentExportSource();
      if (!src) return;
      const resolvedLogo = logoDataUri || await readLogoDataUri(settings.profile.logoUri);
      const exportCtx = { profile: settings.profile, template: settings.template, logoDataUri: resolvedLogo };
      const html = kind === 'gst' ? buildGstBillHtml(src, gst, exportCtx) : kind === 'bill' ? buildNonGstBillHtml(src, exportCtx) : buildQuotationHtml(src, null, exportCtx);
      const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
      toast(`${kind === 'gst' ? 'GST Invoice' : kind === 'bill' ? 'Bill' : 'Quotation PDF'} generated from edited values`);
      if (kind !== 'gst') await shareOrSave(uri, quotationFileName(src, kind));
    } catch {
      toast('PDF generation failed');
    } finally {
      setBusy(false);
    }
  }

  async function shareOrSave(uri: string, fname: string): Promise<void> {
    const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
    const safeName = fname.endsWith('.pdf') ? fname : `${fname}.pdf`;
    const namedUri = dir ? `${dir}${safeName}` : uri;
    if (namedUri !== uri) {
      try {
        await FileSystem.deleteAsync(namedUri, { idempotent: true });
        await FileSystem.copyAsync({ from: uri, to: namedUri });
      } catch {
        // Fall back to the generated URI if the cache copy is unavailable.
      }
    }
    const shareUri = namedUri !== uri ? namedUri : uri;
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(shareUri, {
        mimeType: 'application/pdf',
        dialogTitle: `${safeName} — share via WhatsApp, Email or Save`,
        UTI: 'com.adobe.pdf',
      });
    } else {
      toast('Sharing not available on this device');
    }
  }

  async function onShare(kind: 'quotation' | 'bill' | 'gst') {
    setBusy(true);
    try {
      const src = await currentExportSource();
      if (!src) return;
      const resolvedLogo = logoDataUri || await readLogoDataUri(settings.profile.logoUri);
      const exportCtx = { profile: settings.profile, template: settings.template, logoDataUri: resolvedLogo };
      const html = kind === 'gst' ? buildGstBillHtml(src, gst, exportCtx) : kind === 'bill' ? buildNonGstBillHtml(src, exportCtx) : buildQuotationHtml(src, null, exportCtx);
      const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
      await shareOrSave(uri, quotationFileName(src, kind));
    } catch {
      toast('Share failed');
    } finally {
      setBusy(false);
    }
  }

  /** Excel export — always from the CURRENT edited values (auto-saves when dirty). */
  async function exportExcel(kind: 'quotation' | 'gst') {
    setBusy(true);
    try {
      const src = await currentExportSource();
      if (!src) return;
      const gstInput = gst.enabled
        ? {
            enabled: true,
            percent: gst.percent,
            invoiceNumber: gst.invoiceNumber,
            company: gst.company,
            customer: gst.customer,
          }
        : null;
      const res = await shareQuotationExcel(src, docCtx, gstInput, kind);
      toast(`Excel ready — ${res.name}`);
    } catch {
      toast('Excel export failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      {/* Branded preview header */}
      <View style={styles.letterhead}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={styles.logoBox}>
            {settings.profile.logoUri ? (
              <Image source={{ uri: settings.profile.logoUri }} style={styles.logoImg} resizeMode="contain" />
            ) : (
              <Text style={styles.logoText}>CD</Text>
            )}
          </View>
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.brandName}>{settings.profile.name || COMPANY.name}</Text>
            <Text style={styles.brandTag}>{(settings.profile.tagline || COMPANY.tagline).toUpperCase()}</Text>
          </View>
        </View>
        <View style={styles.accent} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
          <View>
            <Text style={styles.docTitle}>QUOTATION</Text>
            <Text style={styles.qNum}>{draft.quotation_number}</Text>
            <Text style={styles.meta}>Date: {formatDate(draft.quotation_date)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.custName}>{draft.customer_name}</Text>
            <Text style={styles.meta}>{draft.customer_phone}</Text>
          </View>
        </View>
      </View>

      {dirty ? (
        <View style={styles.dirtyBar}>
          <Ionicons name="create" size={15} color="#C77700" />
          <Text style={styles.dirtyText}>Unsaved edits — tap “Save Changes” to keep them</Text>
        </View>
      ) : null}

      {/* ===== EDITABLE: quotation details ===== */}
      <Card style={{ marginTop: 14 }}>
        <Text style={styles.subsection}>Quotation Details</Text>
        <Field label="Quotation Number" value={draft.quotation_number} onChangeText={(t) => { setDraft({ ...draft, quotation_number: t }); setDirty(true); }} />
        <Field label="Date (YYYY-MM-DD)" value={draft.quotation_date} onChangeText={(t) => { setDraft({ ...draft, quotation_date: t }); setDirty(true); }} placeholder="2026-09-13" />
        <Field label="Customer Name" value={draft.customer_name ?? ''} onChangeText={(t) => { setDraft({ ...draft, customer_name: t }); setDirty(true); }} />
        <Field label="Customer Phone" value={draft.customer_phone ?? ''} onChangeText={(t) => { setDraft({ ...draft, customer_phone: t.replace(/[^0-9+]/g, '').slice(0, 13) }); setDirty(true); }} keyboardType="phone-pad" />
      </Card>

      {/* ===== EDITABLE: product rows ===== */}
      <Text style={styles.subsection}>Products — tap any value to edit</Text>
      {liveItems.length === 0 ? (
        <Card><Text style={styles.note}>No product rows. Add them from the measurement screen.</Text></Card>
      ) : (
        liveItems.map((it) => {
          const def = getProduct(it.product_type);
          const colLabel = quantityColumnLabel(it.product_type);
          const unitLabel = colLabel === 'Qty' ? `Qty (${def.qtyUnit})` : colLabel;
          return (
            <Card key={it.id} style={{ marginBottom: 10 }}>
              <View style={styles.rowHead}>
                <Text style={styles.rowTitle}>{def.name}</Text>
                <TouchableOpacity onPress={() => removeItem(it.id)}>
                  <Ionicons name="trash-outline" size={18} color={colors.danger} />
                </TouchableOpacity>
              </View>
              <Field label="Area Name" value={it.area_name} onChangeText={(t) => updItem(it.id, { area_name: t })} placeholder="e.g. Living Room Window 1" />
              <Field label={def.typeLabel} value={it.type ?? ''} onChangeText={(t) => updItem(it.id, { type: t })} />
              {it.product_type === 'curtains' ? <Field label="Part" value={String(it.part ?? '')} onChangeText={(t) => updItem(it.id, { part: toNum(numericInput(t)) })} keyboardType="numeric" /> : null}
              {(it.product_type === 'blinds' || it.product_type === 'mosquito_net') ? (
                <>
                  <Text style={styles.miniLabel}>Measurement Unit</Text>
                  <ChipGroup options={['inch', 'mm']} selected={it.measurement_unit ?? 'inch'} onSelect={(v) => updItem(it.id, { measurement_unit: v as 'inch' | 'mm' })} />
                </>
              ) : null}
              <View style={{ flexDirection: 'row' }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Field label="Width (in)" value={String(it.width)} onChangeText={(t) => updItem(it.id, { width: toNum(numericInput(t)) })} keyboardType="numeric" />
                </View>
                {def.usesHeight ? (
                  <View style={{ flex: 1 }}>
                    <Field label="Height (in)" value={String(it.height)} onChangeText={(t) => updItem(it.id, { height: toNum(numericInput(t)) })} keyboardType="numeric" />
                  </View>
                ) : <View style={{ flex: 1 }} />}
              </View>
              <View style={{ flexDirection: 'row' }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Field label="Fabric Details" value={it.fabric_type ?? ''} onChangeText={(t) => updItem(it.id, { fabric_type: t })} placeholder="e.g. Cotton, Blackout" />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Fabric Area (sq.ft)" value={String(it.fabric_area ?? '')} onChangeText={(t) => updItem(it.id, { fabric_area: toNum(numericInput(t)) })} keyboardType="numeric" />
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Field
                    label={`${unitLabel} — override allowed`}
                    value={String(it.quantity)}
                    onChangeText={(t) => updItem(it.id, { quantity: toNum(numericInput(t)) })}
                    keyboardType="numeric"
                  />
                </View>
                <TouchableOpacity onPress={() => resetQtyToFormula(it)} style={styles.resetBtn}>
                  <Ionicons name="refresh" size={18} color={colors.navy} />
                  <Text style={styles.resetText}>↻ Formula</Text>
                </TouchableOpacity>
              </View>
              <Field label="Price / unit (₹)" value={String(it.price)} onChangeText={(t) => updItem(it.id, { price: toNum(numericInput(t)) })} keyboardType="numeric" />
              <Field label="GST % (this item)" value={String(it.gst_percent ?? gst.percent ?? 0)} onChangeText={(t) => updItem(it.id, { gst_percent: Math.max(0, Math.min(100, toNum(numericInput(t)))) })} keyboardType="numeric" />
              <View style={styles.liveTotalRow}>
                <Text style={styles.liveTotalLabel}>Line Total (Qty × Price)</Text>
                <Text style={styles.liveTotalValue}>{formatINR(it.liveTotal)}</Text>
              </View>
            </Card>
          );
        })
      )}

      {/* ===== EDITABLE: accessory rows ===== */}
      <Text style={styles.subsection}>Accessories</Text>
      {liveAccs.map((a) => (
        <Card key={a.id} style={{ marginBottom: 10 }}>
          <View style={styles.rowHead}>
            <Text style={styles.rowTitle}>{a.track_type}</Text>
            <TouchableOpacity onPress={() => removeAcc(a.id)}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </TouchableOpacity>
          </View>
          <Field label="Area Name" value={a.area_name} onChangeText={(t) => updAcc(a.id, { area_name: t })} />
          <Field label="Track Type" value={a.track_type} onChangeText={(t) => updAcc(a.id, { track_type: t })} />
          <Field label="Curtain Width (in)" value={String(a.width)} onChangeText={(t) => updAcc(a.id, { width: toNum(numericInput(t)) })} keyboardType="numeric" />
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Field label="Qty / R.ft — override allowed" value={String(a.quantity)} onChangeText={(t) => updAcc(a.id, { quantity: toNum(numericInput(t)) })} keyboardType="numeric" />
            </View>
            <TouchableOpacity onPress={() => resetAccQty(a)} style={styles.resetBtn}>
              <Ionicons name="refresh" size={18} color={colors.navy} />
              <Text style={styles.resetText}>↻ W/12</Text>
            </TouchableOpacity>
          </View>
          <Field label="Price / R.ft (₹)" value={String(a.price)} onChangeText={(t) => updAcc(a.id, { price: toNum(numericInput(t)) })} keyboardType="numeric" />
          <View style={styles.liveTotalRow}>
            <Text style={styles.liveTotalLabel}>Line Total (Qty × Price)</Text>
            <Text style={styles.liveTotalValue}>{formatINR(a.liveTotal)}</Text>
          </View>
        </Card>
      ))}

      {/* ===== EDITABLE: other charges (same builder as quotation/new) ===== */}
      <Card style={{ marginTop: 6 }}>
        <Text style={styles.subsection}>Other Charges</Text>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Field label="Fitting — Description" value={charges.fittingDesc} onChangeText={(t) => { setCharges({ ...charges, fittingDesc: t }); setDirty(true); }} placeholder="Fitting Charges" />
        <Field label="Fitting — No. of Windows" value={charges.fittingWindows} onChangeText={(t) => { setCharges({ ...charges, fittingWindows: numericInput(t, false) }); setDirty(true); }} keyboardType="numeric" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Price / Window" value={charges.fittingPrice} onChangeText={(t) => { setCharges({ ...charges, fittingPrice: numericInput(t) }); setDirty(true); }} keyboardType="numeric" />
          </View>
        </View>
        <View style={styles.partsBox}>
          <Text style={styles.partsLabel}>Curtain Parts</Text>
          <Text style={styles.partsValue}>{curtainParts}</Text>
          <Text style={styles.partsHint}>From Curtain Measurements · decimal supported</Text>
        </View>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Field label="Stitching Qty (Part) — editable" value={charges.stitchingQty} onChangeText={(t) => { setCharges({ ...charges, stitchingQty: numericInput(t) }); setDirty(true); }} keyboardType="numeric" placeholder={`auto = ${curtainParts}`} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Stitching Price / Part" value={charges.stitchingPrice} onChangeText={(t) => { setCharges({ ...charges, stitchingPrice: numericInput(t) }); setDirty(true); }} keyboardType="numeric" />
          </View>
        </View>
        <TouchableOpacity onPress={resetStitchingQty} style={styles.resetBtn}>
          <Ionicons name="refresh" size={18} color={colors.navy} />
          <Text style={styles.resetText}>↻ Curtain Parts</Text>
        </TouchableOpacity>
        <Text style={styles.formulaNote}>Stitching total = {stitchingQuantity(effectiveCharges)} Part × {charges.stitchingPrice || 0} = {formatINR(liveBundle.totals.stitching)}</Text>
        <Field label="Transport — Description" value={charges.transportDesc} onChangeText={(t) => { setCharges({ ...charges, transportDesc: t }); setDirty(true); }} placeholder="Transport Charges" />
        <Field label="Transport (₹)" value={charges.transport} onChangeText={(t) => { setCharges({ ...charges, transport: numericInput(t) }); setDirty(true); }} keyboardType="numeric" />
        <Field label="Additional — Description" value={charges.additionalDesc} onChangeText={(t) => { setCharges({ ...charges, additionalDesc: t }); setDirty(true); }} />
        <Field label="Additional Charges (₹)" value={charges.additionalAmount} onChangeText={(t) => { setCharges({ ...charges, additionalAmount: numericInput(t) }); setDirty(true); }} keyboardType="numeric" />

        <Field label="Other Charges — Description (printed on documents)" value={chargesDesc} onChangeText={(t) => { setChargesDesc(t); setDirty(true); }} placeholder="e.g. Other Charges" />
        <Text style={styles.formulaNote}>{fabricNote || 'No fabric quantity recorded in the measurements yet.'}</Text>
        {fabricNote ? (
          <TouchableOpacity onPress={() => { setChargesDesc(fabricNote); setDirty(true); }} style={styles.resetBtn}>
            <Ionicons name="add-circle-outline" size={16} color={colors.navy} />
            <Text style={styles.resetText}>Use fabric quantity as description</Text>
          </TouchableOpacity>
        ) : null}
        <View style={styles.extraHead}>
          <Text style={styles.extraTitle}>Extra Charges (individual)</Text>
          <Text style={styles.extraSum}>total {formatINR(liveBundle.totals.extras)}</Text>
        </View>
        {charges.extras.length === 0 ? (
          <Text style={styles.extraEmpty}>No extra charges yet. Add a row to bill any other item with its own label and amount.</Text>
        ) : (
          charges.extras.map((row, i) => (
            <View key={row.id} style={styles.extraRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Field label={`Extra ${i + 1} — Description`} value={row.description} onChangeText={(t) => updExtra(row.id, { description: t })} placeholder="e.g. Packing, Rod bending, Tax" />
              </View>
              <View style={{ flex: 0.65, marginRight: 8 }}>
                <Field label="Quantity" value={row.quantity} onChangeText={(t) => updExtra(row.id, { quantity: numericInput(t) })} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Price (₹)" value={row.amount} onChangeText={(t) => updExtra(row.id, { amount: numericInput(t) })} keyboardType="numeric" />
              </View>
              <TouchableOpacity onPress={() => removeExtra(row.id)} style={styles.extraDel}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </TouchableOpacity>
            </View>
          ))
        )}
        <Button title="+ Add Extra Charge" icon="add" variant="outline" onPress={addExtra} />
        <Field label="Discount — Description" value={charges.discDesc} onChangeText={(t) => { setCharges({ ...charges, discDesc: t }); setDirty(true); }} placeholder="Discount" />
        <Field label="Discount (₹)" value={charges.discount} onChangeText={(t) => { setCharges({ ...charges, discount: numericInput(t) }); setDirty(true); }} keyboardType="numeric" />
      </Card>

      {/* ===== LIVE totals ===== */}
      <View style={styles.totalsCard}>
        <View style={styles.sumRow}><Text style={styles.sumLbl}>Products Subtotal</Text><Text style={styles.sumVal}>{formatINR(liveSubtotal)}</Text></View>
        <View style={styles.sumRow}><Text style={styles.sumLbl}>Accessories Total</Text><Text style={styles.sumVal}>{formatINR(liveAccTotal)}</Text></View>
        <View style={styles.sumRow}><Text style={styles.sumLbl}>Fitting</Text><Text style={styles.sumVal}>{formatINR(liveBundle.totals.fitting)}</Text></View>
        <View style={styles.sumRow}><Text style={styles.sumLbl}>Stitching</Text><Text style={styles.sumVal}>{formatINR(liveBundle.totals.stitching)}</Text></View>
        <View style={styles.sumRow}><Text style={styles.sumLbl}>Transport</Text><Text style={styles.sumVal}>{formatINR(liveBundle.totals.transport)}</Text></View>
        <View style={styles.sumRow}><Text style={styles.sumLbl}>Additional</Text><Text style={styles.sumVal}>{formatINR(liveBundle.totals.additional)}</Text></View>
        {liveBundle.totals.extras > 0 ? (
          <View style={styles.sumRow}><Text style={styles.sumLbl}>Extra Charges</Text><Text style={styles.sumVal}>{formatINR(liveBundle.totals.extras)}</Text></View>
        ) : null}
        {liveBundle.totals.discount > 0 ? (
          <View style={styles.sumRow}><Text style={[styles.sumLbl, { color: colors.success }]}>Discount</Text><Text style={[styles.sumVal, { color: colors.success }]}>- {formatINR(liveBundle.totals.discount)}</Text></View>
        ) : null}
        <View style={[styles.sumRow, { borderTopWidth: 2, borderTopColor: colors.navy, paddingTop: 10, marginTop: 4 }]}>
          <Text style={styles.grandLbl}>GRAND TOTAL</Text>
          <Text style={styles.grandVal}>{formatINR(liveGrand)}</Text>
        </View>
      </View>

      <Text style={styles.thanks}>Thank you for choosing Catchy Decors!</Text>

      {/* GST BILL is a separate optional document. Quotation never requires GST. */}
      <Card style={{ marginTop: 14 }}>
        <TouchableOpacity
          onPress={() => {
            const next = !showGstEditor;
            setShowGstEditor(next);
            if (next && !gst.enabled) setGst((g) => ({ ...g, enabled: true }));
          }}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={{ fontWeight: '900', color: colors.navy, fontSize: 15 }}>🧾 Generate Separate GST Bill</Text>
            <Text style={{ color: colors.textMuted, fontSize: 11.5, marginTop: 3 }}>Optional · quotation PDF stays GST-free</Text>
          </View>
          <Ionicons name={showGstEditor ? 'chevron-up' : 'chevron-forward'} size={20} color={colors.navy} />
        </TouchableOpacity>
        {showGstEditor ? (
          <View style={{ marginTop: 12 }}>
            <View style={styles.gstToggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.gstToggleTitle}>GST Bill Enabled</Text>
                <Text style={styles.gstToggleHint}>Only the separate GST Invoice PDF will include GST calculations.</Text>
              </View>
              <Switch value={gst.enabled} onValueChange={(v) => { setGst((g) => ({ ...g, enabled: v })); setDirty(true); }} trackColor={{ false: '#CBD2E1', true: colors.orange }} />
            </View>
            <Text style={styles.subsection}>GST %</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {GST_PERCENTAGES.map((p) => (
                <TouchableOpacity
                  key={p}
                  onPress={() => { setGst((g) => ({ ...g, percent: p })); setDirty(true); }}
                  style={[styles.gstChip, gst.percent === p ? styles.gstChipActive : null]}
                >
                  <Text style={[styles.gstChipText, gst.percent === p ? styles.gstChipTextActive : null]}>{p}%</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Field label="Invoice Number" value={gst.invoiceNumber} onChangeText={(t) => setGst((g) => ({ ...g, invoiceNumber: t }))} placeholder={`INV-${draft.quotation_number}`} />

            <Text style={styles.subsection}>Company Details (editable on bill)</Text>
            <Field label="Name" value={gst.company.name} onChangeText={(t) => setGstCompanyField('name', t)} />
            <Field label="Tagline" value={gst.company.tagline} onChangeText={(t) => setGstCompanyField('tagline', t)} />
            <Field label="Address Line 1" value={gst.company.addressLine1} onChangeText={(t) => setGstCompanyField('addressLine1', t)} />
            <Field label="Address Line 2" value={gst.company.addressLine2} onChangeText={(t) => setGstCompanyField('addressLine2', t)} />
            <Field label="Address Line 3" value={gst.company.addressLine3} onChangeText={(t) => setGstCompanyField('addressLine3', t)} />
            <Field label="Address Line 4" value={gst.company.addressLine4} onChangeText={(t) => setGstCompanyField('addressLine4', t)} />
            <Field label="Phone" value={gst.company.phone} onChangeText={(t) => setGstCompanyField('phone', t)} />
            <Field label="Website" value={gst.company.website} onChangeText={(t) => setGstCompanyField('website', t)} />
            <Field label="GSTIN" value={gst.company.gstin} onChangeText={(t) => setGstCompanyField('gstin', t)} placeholder="22AAAAA0000A1Z5" />

            <Text style={styles.subsection}>Customer Details (editable on bill)</Text>
            <Field label="Customer Name" value={gst.customer.name} onChangeText={(t) => setGstCustomerField('name', t)} />
            <Field label="Phone" value={gst.customer.phone} onChangeText={(t) => setGstCustomerField('phone', t)} />
            <Field label="Address" value={gst.customer.address} onChangeText={(t) => setGstCustomerField('address', t)} multiline />
            <Field label="Site" value={gst.customer.site} onChangeText={(t) => setGstCustomerField('site', t)} />
            <Field label="Customer GSTIN" value={gst.customer.gstin} onChangeText={(t) => setGstCustomerField('gstin', t)} />

            <Button title="Save GST Bill Details" icon="save-outline" variant="accent" onPress={onSave} style={{ marginTop: 10 }} />
          </View>
        ) : null}
      </Card>

      {/* ===== PDF & Billing ===== */}
      <Card style={{ marginTop: 14 }}>
        <Text style={styles.actionSectionTitle}>PDF & Billing</Text>
        <Text style={styles.actionSectionHint}>Choose the document you want to send to the customer.</Text>

        <View style={styles.docActionCard}>
          <View style={styles.docActionIcon}><Ionicons name="document-text-outline" size={22} color={colors.navy} /></View>
          <View style={styles.docActionCopy}>
            <Text style={styles.docActionTitle}>Quotation PDF</Text>
            <Text style={styles.docActionHint}>Estimate / quotation only · no GST</Text>
          </View>
          <TouchableOpacity disabled={busy} onPress={() => onShare('quotation')} style={styles.docActionButton}>
            <Ionicons name="share-social-outline" size={18} color="#fff" />
            <Text style={styles.docActionButtonText}>Send</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.docActionCard}>
          <View style={styles.docActionIcon}><Ionicons name="receipt-outline" size={22} color={colors.navy} /></View>
          <View style={styles.docActionCopy}>
            <Text style={styles.docActionTitle}>Bill Without GST</Text>
            <Text style={styles.docActionHint}>Uses the approved quotation values · GST-free bill copy</Text>
          </View>
          <TouchableOpacity disabled={busy} onPress={() => onShare('bill')} style={styles.docActionButton}>
            <Ionicons name="share-social-outline" size={18} color="#fff" />
            <Text style={styles.docActionButtonText}>Send</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.docActionCard}>
          <View style={styles.docActionIcon}><Ionicons name="calculator-outline" size={22} color={colors.navy} /></View>
          <View style={styles.docActionCopy}>
            <Text style={styles.docActionTitle}>GST Tax Invoice</Text>
            <Text style={styles.docActionHint}>Separate GST invoice with item-wise GST calculation</Text>
          </View>
          <TouchableOpacity
            disabled={busy}
            onPress={() => {
              if (!showGstEditor) setShowGstEditor(true);
              if (!gst.enabled) setGst((g) => ({ ...g, enabled: true }));
              toast('GST bill section opened — verify GST details, then share invoice');
            }}
            style={[styles.docActionButton, styles.gstActionButton]}
          >
            <Ionicons name="create-outline" size={18} color="#fff" />
            <Text style={styles.docActionButtonText}>Open</Text>
          </TouchableOpacity>
        </View>

        {showGstEditor && gst.enabled ? (
          <Button title="Share GST Tax Invoice" icon="share-social" variant="accent" onPress={() => onShare('gst')} disabled={busy} style={{ marginTop: 8 }} />
        ) : null}

        <TouchableOpacity onPress={() => setShowMoreExports((v) => !v)} style={styles.moreOptions}>
          <Ionicons name="ellipsis-horizontal-circle-outline" size={20} color={colors.navy} />
          <Text style={styles.moreOptionsText}>More Options</Text>
          <Ionicons name={showMoreExports ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {showMoreExports ? (
          <View style={{ gap: 8, marginTop: 8 }}>
            <Button title={busy ? 'Building Excel…' : 'Export Excel — Quotation (.xlsx)'} icon="grid-outline" variant="outline" onPress={() => exportExcel('quotation')} disabled={busy} />
            <Button title="Export Excel — GST Billing (.xlsx)" icon="grid-outline" variant="outline" onPress={() => gst.enabled && exportExcel('gst')} disabled={busy || !gst.enabled} />
          </View>
        ) : null}
      </Card>

      <View style={{ gap: 10, marginTop: 14 }}>
        <Button title={busy ? 'Working…' : dirty ? 'Save Changes' : 'Saved — No Pending Edits'} icon="save" variant="primary" onPress={onSave} disabled={busy || !dirty} />
        <Button title="Delete" icon="trash" variant="danger" onPress={() =>
          confirm('Delete Quotation', `Delete ${q.quotation_number}?`, async () => {
            await deleteQuotation(q.id);
            toast('Quotation deleted');
            router.back();
          })
        } />
        <Text style={styles.statusTitle}>QUOTATION STATUS</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusScroller}>
          {(['draft', 'sent', 'approved', 'completed'] as const).map((s, index) => {
            const active = q.status === s;
            return (
              <View key={s} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity
                  style={[styles.statusChip, active && styles.statusChipActive]}
                  onPress={async () => {
                    await updateQuotationStatus(q.id, s);
                    setQ(await getQuotation(q.id));
                    toast(`Marked as ${s}`);
                  }}
                >
                  <Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={active ? '#fff' : colors.navy} />
                  <Text style={[styles.statusChipText, active && styles.statusChipTextActive]}>{s.toUpperCase()}</Text>
                </TouchableOpacity>
                {index < 3 ? <Ionicons name="chevron-forward" size={15} color={colors.textMuted} style={{ marginHorizontal: 4 }} /> : null}
              </View>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.footer}>
        <Ionicons name="business" size={14} color={colors.textMuted} />
        <Text style={styles.footerText}>
          {' '}
          {settings.profile.name || COMPANY.name} · {settings.profile.phone || COMPANY.phone} ·{' '}
          {settings.profile.website || COMPANY.website}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  letterhead: { backgroundColor: colors.navy, borderRadius: 18, padding: 18, paddingBottom: 16 },
  logoBox: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  logoText: { color: colors.navy, fontWeight: '900', fontSize: 15 },
  logoImg: { width: 44, height: 44, borderRadius: 8 },
  brandName: { color: '#fff', fontWeight: '900', fontSize: 17, letterSpacing: 1 },
  brandTag: { color: colors.gold, fontSize: 8, letterSpacing: 1.5, marginTop: 3 },
  accent: { height: 4, borderRadius: 999, backgroundColor: colors.orange, marginTop: 12 },
  docTitle: { color: '#fff', fontWeight: '900', fontSize: 15 },
  qNum: { color: colors.orange, fontWeight: '800', fontSize: 13, marginTop: 2 },
  meta: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 2 },
  custName: { color: '#fff', fontWeight: '800', fontSize: 13 },
  dirtyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF4E0',
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
  },
  dirtyText: { color: '#C77700', fontSize: 12.5, fontWeight: '600', flex: 1 },
  subsection: { fontWeight: '800', color: colors.navy, marginTop: 12, marginBottom: 6, fontSize: 13.5 },
  gstToggleRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: '#F4F7FB', marginBottom: 10 },
  gstToggleTitle: { color: colors.navy, fontWeight: '900', fontSize: 14 },
  gstToggleHint: { color: colors.textMuted, fontSize: 11.5, marginTop: 2 },
  actionSectionTitle: { color: colors.navy, fontWeight: '900', fontSize: 16 },
  actionSectionHint: { color: colors.textMuted, fontSize: 11.5, marginTop: 3, marginBottom: 10 },
  docActionCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 11, marginTop: 8, backgroundColor: '#fff' },
  docActionIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F1F4F9', alignItems: 'center', justifyContent: 'center' },
  docActionCopy: { flex: 1, paddingHorizontal: 10 },
  docActionTitle: { color: colors.navy, fontWeight: '900', fontSize: 13.5 },
  docActionHint: { color: colors.textMuted, fontSize: 10.5, lineHeight: 14, marginTop: 2 },
  docActionButton: { minWidth: 66, borderRadius: 10, backgroundColor: colors.navy, paddingHorizontal: 10, paddingVertical: 9, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center' },
  gstActionButton: { backgroundColor: colors.orange },
  docActionButtonText: { color: '#fff', fontWeight: '800', fontSize: 11.5 },
  moreOptions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  moreOptionsText: { flex: 1, color: colors.navy, fontWeight: '800', fontSize: 12.5 },
  statusTitle: { color: colors.textMuted, fontWeight: '800', fontSize: 11, letterSpacing: 1, marginTop: 8 },
  statusScroller: { alignItems: 'center', paddingVertical: 8, paddingRight: 12 },
  statusChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: colors.navy, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9, backgroundColor: '#fff' },
  statusChipActive: { backgroundColor: colors.navy },
  statusChipText: { color: colors.navy, fontWeight: '800', fontSize: 11.5 },
  statusChipTextActive: { color: '#fff' },
  partsBox: { padding: 12, borderRadius: 10, backgroundColor: '#F4F7FB', marginBottom: 10 },
  partsLabel: { fontSize: 12, color: colors.muted },
  partsValue: { fontSize: 22, fontWeight: '700', color: colors.navy },
  partsHint: { fontSize: 11, color: colors.muted, marginTop: 2 },
  formulaNote: { fontSize: 11.5, color: '#C77700', fontWeight: '600', lineHeight: 16, marginBottom: 6 },
  note: { color: colors.textMuted, fontSize: 13 },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  rowTitle: { fontWeight: '800', color: colors.navy, fontSize: 14.5 },
  resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.chipBg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9 },
  resetText: { fontSize: 12, fontWeight: '800', color: colors.navy },
  liveTotalRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#FFF7EC', borderRadius: 10, padding: 10, marginTop: 8 },
  liveTotalLabel: { fontSize: 12, color: '#C77700', fontWeight: '700' },
  liveTotalValue: { fontSize: 13.5, fontWeight: '900', color: colors.navy },
  totalsCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginTop: 12 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  sumLbl: { color: colors.textMuted, fontSize: 13 },
  sumVal: { fontWeight: '700', color: colors.textDark, fontSize: 13 },
  grandLbl: { fontWeight: '900', color: colors.navy, fontSize: 14.5 },
  grandVal: { fontWeight: '900', color: colors.red, fontSize: 16.5 },
  thanks: { textAlign: 'center', color: colors.navy, fontWeight: '800', marginTop: 16, fontSize: 13 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  footerText: { color: colors.textMuted, fontSize: 11 },
  extraHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, marginBottom: 2 },
  extraTitle: { fontWeight: '800', color: colors.navy, fontSize: 13.5 },
  extraSum: { color: colors.orange, fontWeight: '800', fontSize: 12.5 },
  extraEmpty: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginBottom: 8 },
  extraRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 2 },
  extraDel: { paddingBottom: 12, paddingLeft: 4 },
  gstChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.chipBg },
  gstChipActive: { backgroundColor: colors.navy },
  gstChipText: { fontSize: 12, color: colors.textDark, fontWeight: '700' },
  gstChipTextActive: { color: '#fff' },
});
