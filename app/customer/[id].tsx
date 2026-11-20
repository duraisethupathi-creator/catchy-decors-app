import React, { useCallback, useState } from 'react';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, Button, Field } from '../../src/components/common';
import { EmptyState } from '../../src/components/common/ui';
import { colors } from '../../src/constants/colors';
import { getCustomer, saveCustomer } from '../../src/services/customerService';
import type { Customer } from '../../src/types/customer';
import type { Quotation } from '../../src/types/quotation';
import { getQuotationsByCustomer } from '../../src/services/quotationService';
import { getPayments } from '../../src/services/paymentService';
import { getAllMeasurements, loadDraftMeasurements, getAllAccessories, loadDraftAccessories } from '../../src/services/measurementService';
import { getProduct } from '../../src/constants/products';

export default function CustomerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [history, setHistory] = useState<Array<{ quotation: Quotation; paid: number; balance: number }>>([]);

  useFocusEffect(
    useCallback(() => {
      const customerId = String(id);
      getCustomer(customerId).then(setCustomer);
      Promise.all([getQuotationsByCustomer(customerId), getPayments()]).then(([quotes, payments]) => {
        setHistory(quotes.map((quotation) => {
          const paid = payments.filter((p) => p.quotationId === quotation.id).reduce((sum, p) => sum + p.amount, 0);
          return { quotation, paid, balance: Math.max(0, quotation.grand_total - paid) };
        }));
      });
    }, [id])
  );

  if (!customer) {
    return (
      <View style={styles.root}>
        <EmptyState icon="🔍" title="Customer not found" />
      </View>
    );
  }

  async function update(patch: Partial<Customer>) {
    const saved = await saveCustomer({ ...customer, ...patch } as Customer);
    setCustomer(saved);
  }

  async function downloadMeasurementsPdf() {
    const [savedMeasurements, draftMeasurements, savedAccessories, draftAccessories, quotations] = await Promise.all([
      getAllMeasurements(), loadDraftMeasurements(customer.id), getAllAccessories(), loadDraftAccessories(customer.id), getQuotationsByCustomer(customer.id),
    ]);
    const uniqueById = <T extends { id: string }>(rows: T[]) => Array.from(new Map(rows.map(row => [row.id, row])).values());
    const measurements = uniqueById([
      ...savedMeasurements.filter(row => row.customer_id === customer.id), ...draftMeasurements,
      ...quotations.flatMap(q => q.items ?? []),
    ]);
    const accessories = uniqueById([
      ...savedAccessories.filter(row => row.customer_id === customer.id), ...draftAccessories,
      ...quotations.flatMap(q => q.accessories ?? []),
    ]);
    const photos = quotations.flatMap(q => (q.reference_photos ?? []).map(photo => ({ ...photo, quotation_number: q.quotation_number })));
    if (!measurements.length && !accessories.length && !photos.length) return;

    const esc = (value: unknown) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const detail = (value?: string) => {
      if (!value) return '';
      try {
        const meta = JSON.parse(value);
        if (meta?.__mosquitoMeta === 1) return [meta.description, meta.frameColor ? `Frame: ${meta.frameColor}` : '', meta.openMethod ? `Opening: ${meta.openMethod}` : '', meta.leftOpenCount ? `Left open: ${meta.leftOpenCount}` : '', meta.rightOpenCount ? `Right open: ${meta.rightOpenCount}` : '', meta.doorSplitCount ? `Splits: ${meta.doorSplitCount}` : '', meta.additionalSqft ? `Additional area: ${meta.additionalSqft} sq.ft` : ''].filter(Boolean).join(' · ');
      } catch {}
      return value;
    };
    const measurementRows = measurements.map((m, i) => {
      const fabric = [detail(m.fabric_type), m.fabric_area ? `Fabric area: ${m.fabric_area} sq.ft` : '', m.fabric_quantity_mtr ? `Fabric required: ${m.fabric_quantity_mtr} mtr` : ''].filter(Boolean).join(' · ');
      const lining = m.lining_type ? `${m.lining_type}${m.lining_fabric ? ` — ${m.lining_fabric}` : ''}${m.lining_quantity ? ` · ${m.lining_quantity} mtr` : ''}` : '';
      return `<tr><td>${i + 1}</td><td>${esc(m.area_name)}</td><td>${esc(getProduct(m.product_type).name)} ${esc(m.type || '')}</td><td>${esc(m.width)} × ${esc(m.height)} ${esc(m.measurement_unit || 'inch')}</td><td>${esc(m.part ?? '')}</td><td>${esc(fabric)}</td><td>${esc(lining)}</td><td>${Number(m.quantity || 0).toFixed(2)}</td></tr>`;
    }).join('');
    const accessoryRows = accessories.map((item, i) => `<tr><td>${i + 1}</td><td>${esc(item.area_name)}</td><td>${esc(item.track_type)}</td><td>${esc(item.width)} inch</td><td>${esc(item.part ?? '')}</td><td>${Number(item.quantity || 0).toFixed(2)}</td><td>₹${Number(item.price || 0).toLocaleString('en-IN')}</td><td>₹${Number(item.total || 0).toLocaleString('en-IN')}</td></tr>`).join('');
    const photoHtml = photos.length ? photos.map((photo, i) => `<div class="photo"><b>${esc(photo.area_name || 'General')} — ${esc(photo.label || 'Reference Photo')}</b><div class="sub">Quotation: ${esc(photo.quotation_number || '')}</div><img src="${photo.data_uri}" /></div>`).join('') : '<p class="sub">No reference photos attached.</p>';
    const tableStyle = 'width:100%;border-collapse:collapse;margin:12px 0 22px;font-size:9px;table-layout:auto';
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:12mm}body{font-family:Arial,sans-serif;color:#17213d;font-size:11px}h1{color:#101D4A;margin-bottom:4px}.sub{color:#667085;font-size:9px}h2{font-size:15px;color:#101D4A;margin:22px 0 8px}table{ ${tableStyle} }th{background:#101D4A;color:#fff;padding:6px;text-align:left}td{padding:6px;border:1px solid #e3e6ed;vertical-align:top}tr{page-break-inside:avoid}.photo{page-break-inside:avoid;margin:14px 0 20px}.photo img{display:block;max-width:100%;max-height:230px;object-fit:contain;margin-top:8px;border:1px solid #e3e6ed;padding:4px}</style></head><body><h1>CATCHY DECORS</h1><h2>Customer Work Details</h2><b>${esc(customer.name)}</b><br>${esc(customer.phone)}<br>${esc(customer.address || '')}<br><span class="sub">Generated: ${new Date().toLocaleDateString('en-IN')}</span>
      <h2>All Products — Measurements & Fabric Details</h2>${measurements.length ? `<table><tr><th>S.No</th><th>Room / Area</th><th>Product / Type</th><th>Size</th><th>Part</th><th>Fabric / Material Details</th><th>Lining Details</th><th>Qty</th></tr>${measurementRows}</table>` : '<p class="sub">No measurement records.</p>'}
      <h2>Accessories Details</h2>${accessories.length ? `<table><tr><th>S.No</th><th>Room / Area</th><th>Accessory / Track</th><th>Width</th><th>Part</th><th>Qty / Length</th><th>Rate</th><th>Amount</th></tr>${accessoryRows}</table>` : '<p class="sub">No accessories records.</p>'}
      <h2>Attached Reference Photos</h2>${photoHtml}</body></html>`;
    const file = await Print.printToFileAsync({ html });
    // Open the generated PDF directly with Android's installed PDF viewer.
    try {
      const contentUri = await (await import('expo-file-system')).getContentUriAsync(file.uri);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri, type: 'application/pdf', flags: 1,
      });
    } catch {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Open Customer Work Details PDF' });
      }
    }
  }
  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={styles.header}>
        <Ionicons name="person-circle" size={52} color={colors.navy} />
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={styles.name}>{customer.name}</Text>
          <Text style={styles.phone}>{customer.phone}</Text>
        </View>
      </View>

      <Card>
        <Field label="Name" value={customer.name} onChangeText={(t) => setCustomer({ ...customer, name: t })} />
        <Field label="Phone" value={customer.phone} onChangeText={(t) => setCustomer({ ...customer, phone: t })} keyboardType="phone-pad" />
        <Field label="Address" value={customer.address ?? ''} onChangeText={(t) => setCustomer({ ...customer, address: t })} multiline />
        <Field label="Site Location" value={customer.site_location ?? ''} onChangeText={(t) => setCustomer({ ...customer, site_location: t })} />
        <Field label="Notes" value={customer.notes ?? ''} onChangeText={(t) => setCustomer({ ...customer, notes: t })} multiline />
        <Button title="Save Changes" icon="save-outline" onPress={() => update({})} />
      </Card>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
        <Button title="Measurements" icon="resize" variant="accent" style={{ flex: 1 }} onPress={() => router.push(`/measurement/new?customerId=${customer.id}` as never)} />
        <Button title="Quotation" icon="document" style={{ flex: 1 }} onPress={() => router.push(`/quotation/new?customerId=${customer.id}` as never)} />
      </View>
      <Button title="Download Measurements & Fabric PDF" icon="download-outline" variant="outline" style={{ marginTop: 10 }} onPress={downloadMeasurementsPdf} />

      <View style={{ marginTop: 20 }}>
        <Text style={styles.historyTitle}>Purchase & Payment History</Text>
        {history.length === 0 ? (
          <Text style={styles.historyEmpty}>No quotations or payments yet.</Text>
        ) : history.map(({ quotation, paid, balance }) => (
          <Card key={quotation.id}>
            <Text style={styles.historyNumber}>{quotation.quotation_number}</Text>
            <Text style={styles.historyMeta}>{new Date(quotation.quotation_date).toLocaleDateString('en-IN')} · {(quotation.work_status ?? quotation.status).replace(/_/g, ' ').toUpperCase()}</Text>
            <View style={styles.historyMoney}>
              <Text style={styles.historyValue}>Total ₹{quotation.grand_total.toLocaleString('en-IN')}</Text>
              <Text style={styles.historyPaid}>Paid ₹{paid.toLocaleString('en-IN')}</Text>
              <Text style={balance > 0 ? styles.historyBalance : styles.historyPaid}>Balance ₹{balance.toLocaleString('en-IN')}</Text>
            </View>
            <Button title="Open Quotation" icon="document-text-outline" onPress={() => router.push(`/quotation/${quotation.id}` as never)} />
          </Card>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  name: { fontSize: 20, fontWeight: '900', color: colors.navy },
  phone: { color: colors.textMuted, fontSize: 13.5, marginTop: 2 },
  historyTitle: { fontSize: 18, fontWeight: '900', color: colors.navy, marginBottom: 10 },
  historyEmpty: { color: colors.textMuted, fontSize: 14, paddingVertical: 12 },
  historyNumber: { fontSize: 16, fontWeight: '800', color: colors.navy },
  historyMeta: { color: colors.textMuted, fontSize: 12.5, marginTop: 3, marginBottom: 10 },
  historyMoney: { gap: 4, marginBottom: 12 },
  historyValue: { fontSize: 14, fontWeight: '700', color: colors.navy },
  historyPaid: { fontSize: 13.5, fontWeight: '700', color: colors.success },
  historyBalance: { fontSize: 13.5, fontWeight: '800', color: colors.danger },
});
