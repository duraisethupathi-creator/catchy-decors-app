import React, { useCallback, useState } from 'react';
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
