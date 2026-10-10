import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button, Card, Field } from '../../src/components/common';
import { EmptyState, toast, confirm } from '../../src/components/common/ui';
import { colors } from '../../src/constants/colors';
import {
  getStats,
  getSalesInRange,
  getProductWiseSales,
  getMonthSales,
  getQuotations,
  updateQuotationStatus,
  deleteQuotation,
} from '../../src/services/quotationService';
import { countCustomers } from '../../src/services/customerService';
import { formatINR, formatDate } from '../../src/utils/currency';
import type { Quotation, SalesStats } from '../../src/types/all';
import { shareCompleteReportPdf, type ReportPeriod } from '../../src/services/reportPdfService';

type RangeKey = 7 | 14 | 30 | 90;

const RANGES: { key: RangeKey; label: string }[] = [
  { key: 7, label: '7 days' },
  { key: 14, label: '14 days' },
  { key: 30, label: '30 days' },
  { key: 90, label: '90 days' },
];

/**
 * EDITABLE Reports screen.
 *
 *  - Date range is editable (7 / 14 / 30 / 90 days).
 *  - The visible "quotations in range" list below the charts lets the user tap any
 *    row to OPEN the editable preview, OR use the inline Edit / Delete buttons to
 *    edit fields OR change status right from this screen. Same persistence layer
 *    (quotationService.saveQuotation / updateQuotationStatus / deleteQuotation /
 *    AsyncStorage) — no new storage mechanism introduced.
 */
export default function Reports() {
  const [stats, setStats] = useState<SalesStats | null>(null);
  const [customers, setCustomers] = useState(0);
  const [daily, setDaily] = useState<{ label: string; total: number; count: number; date: string }[]>([]);
  const [productWise, setProductWise] = useState<{ product: string; total: number; count: number }[]>([]);
  const [month, setMonth] = useState(0);
  const [range, setRange] = useState<RangeKey>(7);
  const [view, setView] = useState<'overview' | 'list'>('overview');
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'sent' | 'approved' | 'completed'>('all');
  const [reportPeriod, setReportPeriod] = useState<ReportPeriod>('monthly');
  const [exportingPdf, setExportingPdf] = useState(false);

  const reload = useCallback(async () => {
    const [s, c, m, d, p, q] = await Promise.all([
      getStats(),
      countCustomers(),
      getMonthSales(),
      getSalesInRange(range),
      getProductWiseSales(),
      getQuotations(),
    ]);
    setStats(s);
    setCustomers(c);
    setMonth(m);
    setDaily(d as any);
    setProductWise(p);
    setQuotes(q);
  }, [range]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const maxDaily = Math.max(1, ...daily.map((d) => d.total));
  const maxProduct = Math.max(1, ...productWise.map((p) => p.total));

  const filteredQuotes = quotes.filter((q) => {
    if (statusFilter === 'all') return true;
    return q.status === statusFilter;
  });

  async function onEdit(q: Quotation) {
    router.push(`/quotation/preview?id=${q.id}` as never);
  }
  async function onDelete(q: Quotation) {
    confirm('Delete Quotation', `Delete ${q.quotation_number} for ${q.customer_name}?`, async () => {
      await deleteQuotation(q.id);
      toast('Quotation deleted');
      reload();
    });
  }
  async function onStatus(q: Quotation, status: 'draft' | 'sent' | 'approved' | 'completed') {
    await updateQuotationStatus(q.id, status);
    toast(`${q.quotation_number} → ${status}`);
    reload();
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={styles.header}>Reports</Text>

      <Card style={{ marginBottom: 12 }}>
        <Text style={styles.section}>Complete PDF Report</Text>
        <Text style={styles.subNote}>Quotation, payments, expenses and service bills in one PDF.</Text>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          {(['daily','weekly','monthly','yearly'] as ReportPeriod[]).map((p) => (
            <TouchableOpacity key={p} onPress={() => setReportPeriod(p)} style={[styles.rangeChip, reportPeriod === p ? styles.rangeChipActive : null]}>
              <Text style={[styles.rangeChipText, reportPeriod === p ? styles.rangeChipTextActive : null]}>{p.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Button title={exportingPdf ? 'Generating PDF…' : 'Download / Share Complete PDF'} icon="document-text-outline" variant="accent" style={{ marginTop: 12 }} onPress={async()=>{if(exportingPdf)return;setExportingPdf(true);try{await shareCompleteReportPdf(reportPeriod);toast('Report PDF ready');}catch(e){toast('Could not generate report PDF');}finally{setExportingPdf(false);}}} />
      </Card>

      {/* Editable controls: range tabs + view toggle */}
      <Card style={{ padding: 10, marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={styles.subLabel}>Date Range</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {RANGES.map((r) => (
              <TouchableOpacity
                key={r.key}
                onPress={() => setRange(r.key)}
                style={[styles.rangeChip, range === r.key ? styles.rangeChipActive : null]}
              >
                <Text style={[styles.rangeChipText, range === r.key ? styles.rangeChipTextActive : null]}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
          <TouchableOpacity
            onPress={() => setView('overview')}
            style={[styles.tabBtn, view === 'overview' ? styles.tabBtnActive : null]}
          >
            <Text style={[styles.tabText, view === 'overview' ? styles.tabTextActive : null]}>Overview</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setView('list')}
            style={[styles.tabBtn, view === 'list' ? styles.tabBtnActive : null]}
          >
            <Text style={[styles.tabText, view === 'list' ? styles.tabTextActive : null]}>Editable List ({filteredQuotes.length})</Text>
          </TouchableOpacity>
        </View>
      </Card>

      {view === 'overview' ? (
        <>
          <View style={styles.grid}>
            <View style={[styles.statCard, { backgroundColor: colors.navy }]}>
              <Text style={styles.statValue}>{stats?.totalQuotations ?? 0}</Text>
              <Text style={styles.statLabel}>Total Quotations</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.orange }]}>
              <Text style={styles.statValue}>{formatINR(stats?.totalSales ?? 0)}</Text>
              <Text style={styles.statLabel}>Total Sales</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#C77700' }]}>
              <Text style={styles.statValue}>{stats?.pending ?? 0}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: '#0E9A4C' }]}>
              <Text style={styles.statValue}>{stats?.approved ?? 0}</Text>
              <Text style={styles.statLabel}>Approved</Text>
            </View>
          </View>

          <Card style={{ marginTop: 14 }}>
            <Text style={styles.section}>This Month Sales</Text>
            <Text style={styles.bigValue}>{formatINR(month)}</Text>
            <Text style={styles.subNote}>{customers} customers on record</Text>
          </Card>

          <Card style={{ marginTop: 14 }}>
            <Text style={styles.section}>Daily Sales — Last {range} Days</Text>
            {daily.every((d) => d.total === 0) ? (
              <EmptyState icon="📊" title="No sales yet" subtitle="Charts appear once quotations are created" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 140, gap: 6, marginTop: 12 }}>
                {daily.map((d) => (
                  <View key={d.label} style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={styles.barValue}>{d.total > 0 ? Math.round(d.total / 1000) + 'k' : ''}</Text>
                    <View
                      style={{
                        width: '70%',
                        height: Math.max(4, (d.total / maxDaily) * 100),
                        backgroundColor: d.total > 0 ? colors.orange : '#E5E8EF',
                        borderRadius: 6,
                      }}
                    />
                    <Text style={styles.barLabel}>{d.label}</Text>
                  </View>
                ))}
              </View>
            )}
          </Card>

          <Card style={{ marginTop: 14, marginBottom: 20 }}>
            <Text style={styles.section}>Product-wise Sales</Text>
            {productWise.length === 0 ? (
              <EmptyState icon="🛋" title="No product data yet" subtitle="Product totals appear after quotations are saved" />
            ) : (
              productWise.map((p) => (
                <View key={p.product} style={{ marginTop: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={styles.productName}>{p.product}</Text>
                    <Text style={styles.productTotal}>{formatINR(p.total)}</Text>
                  </View>
                  <View style={{ height: 8, backgroundColor: '#EEF1F7', borderRadius: 999, marginTop: 6 }}>
                    <View style={{ height: 8, width: `${Math.max(4, (p.total / maxProduct) * 100)}%` as never, backgroundColor: colors.navy, borderRadius: 999 }} />
                  </View>
                </View>
              ))
            )}
          </Card>
        </>
      ) : (
        <>
          {/* Editable list of underlying quotations */}
          <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {(['all', 'draft', 'sent', 'approved', 'completed'] as const).map((s) => (
              <TouchableOpacity key={s} onPress={() => setStatusFilter(s)} style={[styles.rangeChip, statusFilter === s ? styles.rangeChipActive : null]}>
                <Text style={[styles.rangeChipText, statusFilter === s ? styles.rangeChipTextActive : null]}>{s.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {filteredQuotes.length === 0 ? (
            <EmptyState icon="📑" title="No quotations" subtitle="Create one from the Quotations tab" />
          ) : (
            filteredQuotes.map((q) => (
              <Card key={q.id} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={styles.qTitle}>{q.quotation_number}</Text>
                    <Text style={styles.qCustomer}>{q.customer_name} · {q.customer_phone}</Text>
                    <Text style={styles.qDate}>{formatDate(q.quotation_date)} · <Text style={{ color: colors.orange, fontWeight: '800' }}>{formatINR(q.grand_total)}</Text></Text>
                    <Text style={{ fontSize: 11.5, color: colors.textMuted, marginTop: 4 }}>Status: <Text style={{ fontWeight: '800', color: colors.navy }}>{q.status.toUpperCase()}</Text></Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <Button title="Edit" icon="pencil" variant="outline" style={{ flex: 1, paddingVertical: 10 }} onPress={() => onEdit(q)} />
                  <Button title="Delete" icon="trash" variant="danger" style={{ flex: 1, paddingVertical: 10 }} onPress={() => onDelete(q)} />
                </View>

                <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                  {(['draft', 'sent', 'approved', 'completed'] as const).map((s) => (
                    <TouchableOpacity
                      key={s}
                      onPress={() => onStatus(q, s)}
                      style={[styles.statusChip, q.status === s ? styles.statusChipActive : null]}
                    >
                      <Text style={[styles.statusChipText, q.status === s ? styles.statusChipTextActive : null]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Card>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { fontSize: 24, fontWeight: '900', color: colors.navy, paddingBottom: 14 },
  subLabel: { fontWeight: '800', color: colors.navy, fontSize: 13 },
  rangeChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.chipBg },
  rangeChipActive: { backgroundColor: colors.navy },
  rangeChipText: { fontSize: 11.5, color: colors.textDark, fontWeight: '700' },
  rangeChipTextActive: { color: '#fff' },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#EEF1F7', alignItems: 'center' },
  tabBtnActive: { backgroundColor: colors.navy },
  tabText: { fontWeight: '800', color: colors.textDark, fontSize: 13 },
  tabTextActive: { color: '#fff' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { width: '47.5%', borderRadius: 18, padding: 16, elevation: 3 },
  statValue: { color: '#fff', fontSize: 19, fontWeight: '900' },
  statLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12.5, marginTop: 4 },
  section: { fontSize: 15, fontWeight: '800', color: colors.text },
  bigValue: { fontSize: 26, fontWeight: '900', color: colors.orange, marginTop: 6 },
  subNote: { color: colors.textMuted, fontSize: 12.5, marginTop: 4 },
  barValue: { fontSize: 10, color: colors.textMuted, marginBottom: 4, height: 12 },
  barLabel: { fontSize: 10, color: colors.textMuted, marginTop: 4 },
  productName: { fontWeight: '700', color: colors.textDark, fontSize: 13.5 },
  productTotal: { fontWeight: '800', color: colors.navy, fontSize: 13.5 },
  qTitle: { fontWeight: '900', color: colors.navy, fontSize: 14.5 },
  qCustomer: { color: colors.textDark, fontSize: 13.5, marginTop: 2 },
  qDate: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  statusChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#EEF1F7' },
  statusChipActive: { backgroundColor: colors.orange },
  statusChipText: { fontSize: 11.5, color: colors.textDark, fontWeight: '700' },
  statusChipTextActive: { color: '#fff' },
});
