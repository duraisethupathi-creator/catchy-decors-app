import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, Button, Field } from '../../src/components/common';
import { EmptyState } from '../../src/components/common/ui';
import { colors } from '../../src/constants/colors';
import { getCustomer, saveCustomer } from '../../src/services/customerService';
import type { Customer } from '../../src/types/customer';

export default function CustomerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);

  useFocusEffect(
    useCallback(() => {
      getCustomer(String(id)).then(setCustomer);
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  name: { fontSize: 20, fontWeight: '900', color: colors.navy },
  phone: { color: colors.textMuted, fontSize: 13.5, marginTop: 2 },
});
