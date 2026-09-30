import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SearchBar, StatusChip } from '../../src/components/common';
import { EmptyState } from '../../src/components/common/ui';
import { colors } from '../../src/constants/colors';
import { getQuotations } from '../../src/services/quotationService';
import { formatINR, formatDate } from '../../src/utils/currency';
import type { Quotation } from '../../src/types/quotation';

const FILTERS = ['All', 'Draft', 'Sent', 'Approved', 'Completed'] as const;

export default function Quotations() {
  const [rows, setRows] = useState<Quotation[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');

  useFocusEffect(
    useCallback(() => {
      getQuotations().then(setRows);
    }, [])
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesQuery =
        !q ||
        r.quotation_number.toLowerCase().includes(q) ||
        (r.customer_name ?? '').toLowerCase().includes(q) ||
        (r.customer_phone ?? '').includes(q);
      const matchesFilter = filter === 'All' || r.status === filter.toLowerCase();
      return matchesQuery && matchesFilter;
    });
  }, [rows, query, filter]);

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>Quotations</Text>
        <TouchableOpacity style={styles.newBtn} onPress={() => router.push('/customer/new?mode=quotation' as never)}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.newBtnText}>New</Text>
        </TouchableOpacity>
      </View>
      <View style={{ paddingHorizontal: 16 }}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search by number, name or phone…" />
      </View>
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.filterChip, filter === f ? styles.filterChipActive : null]}
          >
            <Text style={[styles.filterText, filter === f ? styles.filterTextActive : null]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(q) => q.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
        ListEmptyComponent={
          <EmptyState icon="🧾" title="No quotations found" subtitle={query ? 'Try a different search or filter' : 'Create your first quotation'} />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/quotation/${item.id}` as never)}
          >
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.qNum}>{item.quotation_number}</Text>
                <StatusChip status={item.status} />
              </View>
              <Text style={styles.qCustomer}>{item.customer_name} · {item.customer_phone}</Text>
              <Text style={styles.qDate}>{formatDate(item.quotation_date)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.qTotal}>{formatINR(item.grand_total)}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 12 },
  header: { fontSize: 24, fontWeight: '900', color: colors.navy },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.orange, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12 },
  newBtnText: { color: '#fff', fontWeight: '800' },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: '#E9EDF4' },
  filterChipActive: { backgroundColor: colors.navy },
  filterText: { fontSize: 12.5, fontWeight: '700', color: colors.textMuted },
  filterTextActive: { color: '#fff' },
  card: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    elevation: 2,
    alignItems: 'center',
  },
  qNum: { fontWeight: '900', color: colors.navy, fontSize: 14.5 },
  qCustomer: { color: colors.textDark, fontSize: 13.5, marginTop: 4 },
  qDate: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  qTotal: { fontWeight: '900', color: colors.orange, fontSize: 15 },
});
