import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import { Alert, FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, SearchBar } from '../../src/components/common';
import { EmptyState, confirm } from '../../src/components/common/ui';
import { colors } from '../../src/constants/colors';
import { getCustomers, deleteCustomer } from '../../src/services/customerService';
import { getQuotationsByCustomer } from '../../src/services/quotationService';
import { formatDate } from '../../src/utils/currency';
import type { Customer } from '../../src/types/customer';
import type { Quotation } from '../../src/types/quotation';
import { onSyncStateChange } from '../../src/services/db';
import { getAllMeasurements, loadDraftMeasurements, getAllAccessories, loadDraftAccessories } from '../../src/services/measurementService';
import { getProduct } from '../../src/constants/products';

export default function Customers() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Customer | null>(null);
  const [history, setHistory] = useState<Quotation[]>([]);

  useFocusEffect(
    useCallback(() => {
      getCustomers().then(setRows);
    }, [])
  );

  useEffect(() => {
    return onSyncStateChange(() => {
      getCustomers().then(setRows).catch(() => {});
    });
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.replace(/\D/g, '').includes(q.replace(/\D/g, ''))
    );
  }, [rows, query]);

  async function openDetails(c: Customer) {
    setSelected(c);
    setHistory(await getQuotationsByCustomer(c.id));
  }

  function editCustomer(c: Customer) {
    router.push(`/customer/edit/${c.id}` as never);
  }

  function removeCustomer(c: Customer) {
    confirm('Delete Customer', `Delete ${c.name}? This cannot be undone.`, async () => {
      await deleteCustomer(c.id);
      setSelected(null);
      setRows(await getCustomers());
    });
  }

  function newMeasurementFor(c: Customer) {
    router.push(`/measurement/new?customerId=${c.id}` as never);
  }

  async function downloadCustomerWorkPdf(c: Customer) {
    const [savedMeasurements, draftMeasurements, savedAccessories, draftAccessories, quotations] = await Promise.all([
      getAllMeasurements(), loadDraftMeasurements(c.id), getAllAccessories(), loadDraftAccessories(c.id), getQuotationsByCustomer(c.id),
    ]);
    const uniqueById = <T extends { id: string }>(items: T[]) => Array.from(new Map(items.map(item => [item.id, item])).values());
    const measurements = uniqueById([
      ...savedMeasurements.filter(item => item.customer_id === c.id), ...draftMeasurements,
      ...quotations.flatMap(q => q.items ?? []),
    ]);
    const accessories = uniqueById([
      ...savedAccessories.filter(item => item.customer_id === c.id), ...draftAccessories,
      ...quotations.flatMap(q => q.accessories ?? []),
    ]);
    const photos = quotations.flatMap(q => (q.reference_photos ?? []).map(photo => ({ ...photo, quotation_number: q.quotation_number })));
    const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    const prettyValue = (v: unknown) => esc(v === undefined || v === null || v === '' ? '-' : v);
    const measurementCards = measurements.map((m, i) => {
      let mosquito: Record<string, unknown> | null = null;
      const rawFabric = String(m.fabric_type ?? '');
      if (rawFabric.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(rawFabric);
          if (parsed && parsed.__mosquitoMeta) mosquito = parsed;
        } catch {}
      }
      const fabricText = mosquito ? '' : rawFabric;
      const productName = `${getProduct(m.product_type).name}${m.type ? ` — ${m.type}` : ''}`;
      const size = [m.width, m.height].some(v => v !== undefined && v !== null && v !== '')
        ? `${m.width ?? '-'} × ${m.height ?? '-'} ${m.measurement_unit || 'inch'}` : '-';
      const fabricDetails = [
        fabricText,
        m.fabric_area ? `Area: ${m.fabric_area} sq.ft` : '',
        m.fabric_quantity_mtr ? `Fabric: ${m.fabric_quantity_mtr} mtr` : '',
      ].filter(Boolean).join(' · ');
      const liningDetails = [
        m.lining_type, m.lining_fabric,
        m.lining_quantity ? `${m.lining_quantity} mtr` : '',
      ].filter(Boolean).join(' · ');
      const mosquitoDetails = mosquito ? [
        mosquito.description ? `Net: ${mosquito.description}` : '',
        mosquito.frameColor ? `Frame: ${mosquito.frameColor}` : '',
        mosquito.openMethod ? `Opening: ${mosquito.openMethod}` : '',
        mosquito.doorSplitCount ? `Door splits: ${mosquito.doorSplitCount}` : '',
        mosquito.leftOpenCount !== undefined ? `Left open: ${mosquito.leftOpenCount}` : '',
        mosquito.rightOpenCount !== undefined ? `Right open: ${mosquito.rightOpenCount}` : '',
        Number(mosquito.additionalSqft || 0) ? `Extra area: ${mosquito.additionalSqft} sq.ft` : '',
      ].filter(Boolean).join('  |  ') : '';
      const detail = (label: string, value: string) => value ? `<div class="detail"><span class="label">${label}</span><span class="value">${esc(value)}</span></div>` : '';
      return `<article class="item"><div class="itemhead"><span class="itemno">${i+1}</span><div><div class="room">${prettyValue(m.area_name || 'General Area')}</div><div class="product">${esc(productName)}</div></div><div class="qty"><small>QTY</small><b>${Number(m.quantity || 0).toFixed(2)}</b></div></div><div class="grid">${detail('Measurement',size)}${detail('Part',m.part !== undefined && m.part !== null ? String(m.part) : '')}${detail('Fabric / Material',fabricDetails)}${detail('Lining',liningDetails)}${detail('Mosquito details',mosquitoDetails)}</div></article>`;
    }).join('');
    const accessoryCards = accessories.map((a, i) => `<article class="accessory"><div class="itemhead"><span class="itemno">${i+1}</span><div><div class="room">${prettyValue(a.area_name || 'General Area')}</div><div class="product">${prettyValue(a.track_type)}</div></div><div class="qty"><small>QTY</small><b>${Number(a.quantity || 0).toFixed(2)}</b></div></div><div class="accessorygrid"><div><small>Width</small><b>${prettyValue(a.width)} inch</b></div><div><small>Part</small><b>${prettyValue(a.part)}</b></div></div></article>`).join('');
    const photoHtml = photos.map(p => `<div style="margin:14px 0;page-break-inside:avoid"><b>${esc(p.area_name || 'General')} — ${esc(p.label || 'Reference Photo')}</b><div>${esc(p.quotation_number || '')}</div><img style="max-width:100%;max-height:220px;object-fit:contain" src="${p.data_uri}"/></div>`).join('');
    if (!measurements.length && !accessories.length && !photos.length) {
      Alert.alert('No work details', 'இந்த customer-க்கு measurements, accessories அல்லது photos எதுவும் இல்லை.');
      return;
    }
    const html = `<!doctype html><html><head><meta charset="utf-8"/><style>
      @page{size:A4;margin:9mm}
      *{box-sizing:border-box}
      body{font-family:Arial,sans-serif;color:#1d2945;font-size:10px;line-height:1.25;margin:0}
      .brand{font-size:18px;font-weight:800;letter-spacing:.4px;color:#101d4a;margin:0 0 2px}
      .subtitle{font-size:13px;font-weight:700;margin:0 0 7px;color:#101d4a}
      .customer{background:#f2f5fb;border:1px solid #dce3ef;border-radius:8px;padding:7px 9px;margin-bottom:9px}
      .customer strong{font-size:12px}.muted{color:#66718a;margin-top:3px}
      h2{font-size:12px;color:#101d4a;border-bottom:1.5px solid #e4e9f2;padding-bottom:3px;margin:11px 0 6px}
      .item,.accessory{border:1px solid #d8dfeb;border-radius:8px;margin:0 0 5px;padding:6px 7px;page-break-inside:avoid;break-inside:avoid}
      .itemhead{display:flex;align-items:center;gap:6px;border-bottom:1px solid #edf0f5;padding-bottom:4px;margin-bottom:4px}
      .itemno{background:#101d4a;color:#fff;border-radius:5px;min-width:20px;height:20px;text-align:center;padding-top:3px;font-weight:700}
      .room{font-size:11px;font-weight:700;color:#101d4a}.product{font-size:10px;color:#47536d;margin-top:2px}
      .qty{margin-left:auto;text-align:right;min-width:48px}.qty small,.accessorygrid small{display:block;color:#71809a;font-size:7px;font-weight:700;letter-spacing:.3px}.qty b{font-size:11px;color:#101d4a}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 9px}
      .detail{min-width:0}.label{display:block;font-size:7px;text-transform:uppercase;letter-spacing:.3px;color:#7b8497;font-weight:700;margin-bottom:2px}.value{font-size:9px;color:#202b43;overflow-wrap:anywhere}
      .accessorygrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}.accessorygrid b{font-size:9px;color:#202b43}
      .empty{color:#768198;font-style:italic;padding:8px 2px}
      .photo{margin:7px 0 9px;page-break-inside:avoid;break-inside:avoid;border:1px solid #d8dfeb;border-radius:8px;padding:9px}
      .photo img{display:block;max-width:100%;max-height:180px;object-fit:contain;margin-top:7px}
      .photoTitle{font-weight:700;color:#101d4a}.photoMeta{font-size:9px;color:#71809a}
      .footer{margin-top:10px;padding-top:5px;border-top:1px solid #e5e9f0;font-size:8px;color:#8791a3;text-align:center}
    </style></head><body>
      <div class="brand">CATCHY DECORS</div><div class="subtitle">Customer Work Details</div>
      <div class="customer"><strong>${esc(c.name)}</strong><div class="muted">${esc(c.phone)} ${c.address ? ` · ${esc(c.address)}` : ''}</div>${c.site_location ? `<div class="muted">Site: ${esc(c.site_location)}</div>` : ''}</div>
      <h2>Measurements & Fabric Details (${measurements.length})</h2>
      ${measurements.length ? measurementCards : '<div class="empty">No measurement records.</div>'}
      <h2>Accessories Details (${accessories.length})</h2>
      ${accessories.length ? accessoryCards : '<div class="empty">No accessories records.</div>'}
      <h2>Attached Reference Photos (${photos.length})</h2>
      ${photoHtml || '<div class="empty">No reference photos attached.</div>'}
      <div class="footer">Catchy Decors · Customer Work Details</div>
    </body></html>`;

    const file = await Print.printToFileAsync({ html });
    try {
      const contentUri = await (await import('expo-file-system')).getContentUriAsync(file.uri);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', { data: contentUri, type: 'application/pdf', flags: 1 });
    } catch {
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Open Customer Work Details PDF' });
    }
  }

  if (selected) {
    return (
      <View style={styles.root}>
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={() => setSelected(null)} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.detailName}>{selected.name}</Text>
            <Text style={styles.detailSub}>{selected.phone}</Text>
          </View>
          <TouchableOpacity onPress={() => editCustomer(selected)} style={styles.back}>
            <Ionicons name="pencil" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => removeCustomer(selected)} style={[styles.back, { marginLeft: 8 }]}>
            <Ionicons name="trash-outline" size={20} color="#FFB4B6" />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          <Card>
            <Text style={styles.secTitle}>Customer Details</Text>
            <Text style={styles.detailRow}>📍 {selected.address || 'No address'}</Text>
            <Text style={styles.detailRow}>🏗 Site: {selected.site_location || '-'}</Text>
            <Text style={styles.detailRow}>📅 Added: {formatDate(selected.created_at ?? '')}</Text>
            {selected.notes ? <Text style={styles.detailRow}>📝 {selected.notes}</Text> : null}
          </Card>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <Button title="New Measurement" icon="resize" variant="accent" style={{ flex: 1 }} onPress={() => newMeasurementFor(selected)} />
            <Button title="New Quotation" icon="document" style={{ flex: 1 }} onPress={() => router.push(`/quotation/new?customerId=${selected.id}` as never)} />
          </View>
          <Button title="Download Measurements & Fabric PDF" icon="download-outline" variant="outline" style={{ marginTop: 10 }} onPress={() => downloadCustomerWorkPdf(selected)} />
          <Text style={styles.secTitle}>Previous Quotations ({history.length})</Text>
          {history.length === 0 ? (
            <EmptyState icon="📄" title="No quotations yet" subtitle="Create the first quotation for this customer" />
          ) : (
            history.map((q) => (
              <TouchableOpacity
                key={q.id}
                style={styles.qRow}
                onPress={() => router.push(`/quotation/${q.id}` as never)}
              >
                <Ionicons name="document-text" size={20} color={colors.orange} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.qNum}>{q.quotation_number}</Text>
                  <Text style={styles.qDate}>{formatDate(q.quotation_date)} · {q.status}</Text>
                </View>
                <Text style={styles.qTotal}>₹{q.grand_total.toLocaleString('en-IN')}</Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Text style={styles.header}>Customers</Text>
      <View style={{ paddingHorizontal: 16 }}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search by name or phone…" />
      </View>
      <View style={styles.choiceRow}>
        <Button title="New Customer" icon="person-add" style={{ flex: 1 }} onPress={() => router.push('/customer/new')} />
        <Button title="Continue to Products" icon="arrow-forward" variant="accent" style={{ flex: 1 }} onPress={() => router.push('/customer/new?mode=measurement')} />
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        ListEmptyComponent={
          <EmptyState icon="👥" title="No customers found" subtitle={query ? 'Try a different search' : 'Add your first customer to get started'} />
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.customerCard} onPress={() => openDetails(item)}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.cName}>{item.name}</Text>
              <Text style={styles.cPhone}>📱 {item.phone}</Text>
              {item.site_location ? <Text style={styles.cSite}>📍 {item.site_location}</Text> : null}
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity style={styles.fab} onPress={() => router.push('/customer/new')}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { fontSize: 24, fontWeight: '900', color: colors.navy, padding: 20, paddingBottom: 12 },
  choiceRow: { flexDirection: 'row', gap: 10, padding: 16, paddingTop: 12 },
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    elevation: 2,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.gold, fontWeight: '900', fontSize: 17 },
  cName: { fontWeight: '800', color: colors.text, fontSize: 15 },
  cPhone: { color: colors.textMuted, fontSize: 12.5, marginTop: 2 },
  cSite: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 90,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 12,
    zIndex: 20,
  },
  detailHeader: {
    backgroundColor: colors.navy,
    paddingTop: 52,
    paddingBottom: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  back: { marginRight: 10 },
  detailName: { color: '#fff', fontSize: 18, fontWeight: '900' },
  detailSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  secTitle: { fontWeight: '800', color: colors.text, fontSize: 15, marginTop: 18, marginBottom: 8 },
  detailRow: { color: colors.textDark, fontSize: 13.5, marginTop: 6 },
  qRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  qNum: { fontWeight: '800', color: colors.text, fontSize: 14 },
  qDate: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  qTotal: { fontWeight: '900', color: colors.navy },
});
