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
    const measurementRows = measurements.map((m, i) => {
      const fabric = [m.fabric_type, m.fabric_area ? `Fabric area: ${m.fabric_area} sq.ft` : '', m.fabric_quantity_mtr ? `Fabric: ${m.fabric_quantity_mtr} mtr` : ''].filter(Boolean).join(' · ');
      const lining = [m.lining_type, m.lining_fabric, m.lining_quantity ? `${m.lining_quantity} mtr` : ''].filter(Boolean).join(' · ');
      return `<tr><td>${i+1}</td><td>${esc(m.area_name)}</td><td>${esc(getProduct(m.product_type).name)} ${esc(m.type || '')}</td><td>${esc(m.width)} × ${esc(m.height)} ${esc(m.measurement_unit || 'inch')}</td><td>${esc(m.part ?? '')}</td><td>${esc(fabric)}</td><td>${esc(lining)}</td><td>${Number(m.quantity || 0).toFixed(2)}</td></tr>`;
    }).join('');
    const accessoryRows = accessories.map((a, i) => `<tr><td>${i+1}</td><td>${esc(a.area_name)}</td><td>${esc(a.track_type)}</td><td>${esc(a.width)} inch</td><td>${esc(a.part ?? '')}</td><td>${Number(a.quantity || 0).toFixed(2)}</td><td>₹${Number(a.price || 0).toLocaleString('en-IN')}</td><td>₹${Number(a.total || 0).toLocaleString('en-IN')}</td></tr>`).join('');
    const photoHtml = photos.map(p => `<div style="margin:14px 0;page-break-inside:avoid"><b>${esc(p.area_name || 'General')} — ${esc(p.label || 'Reference Photo')}</b><div>${esc(p.quotation_number || '')}</div><img style="max-width:100%;max-height:220px;object-fit:contain" src="${p.data_uri}"/></div>`).join('');
    if (!measurements.length && !accessories.length && !photos.length) {
      Alert.alert('No work details', 'இந்த customer-க்கு measurements, accessories அல்லது photos எதுவும் இல்லை.');
      return;
    }
    const html = `<!doctype html><html><head><meta charset="utf-8"/><style>@page{size:A4;margin:12mm}body{font-family:Arial;color:#17213d;font-size:10px}h1,h2{color:#101D4A}table{width:100%;border-collapse:collapse;margin:10px 0 20px}th{background:#101D4A;color:white}th,td{padding:6px;border:1px solid #ddd;text-align:left;vertical-align:top}tr{page-break-inside:avoid}</style></head><body><h1>CATCHY DECORS</h1><h2>Customer Work Details</h2><b>${esc(c.name)}</b><br/>${esc(c.phone)}<br/>${esc(c.address || '')}<h2>Measurements & Fabric Details</h2>${measurements.length ? `<table><tr><th>#</th><th>Area</th><th>Product</th><th>Size</th><th>Part</th><th>Fabric</th><th>Lining</th><th>Qty</th></tr>${measurementRows}</table>` : '<p>No measurement records.</p>'}<h2>Accessories Details</h2>${accessories.length ? `<table><tr><th>#</th><th>Area</th><th>Accessory</th><th>Width</th><th>Part</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>${accessoryRows}</table>` : '<p>No accessories records.</p>'}<h2>Attached Reference Photos</h2>${photoHtml || '<p>No reference photos attached.</p>'}</body></html>`;
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
