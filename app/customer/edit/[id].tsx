import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Field } from '../../../src/components/common';
import { toast } from '../../../src/components/common/ui';
import { colors } from '../../../src/constants/colors';
import { getCustomer, saveCustomer } from '../../../src/services/customerService';
import { validateCustomer } from '../../../src/utils/validation';
import type { Customer } from '../../../src/types/customer';

export default function EditCustomer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    getCustomer(String(id)).then(setCustomer);
  }, [id]);

  if (!customer) return <View style={styles.root} />;

  async function save() {
    const errs = validateCustomer(customer!.name, customer!.phone);
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast('Fix highlighted fields');
      return;
    }
    const saved = await saveCustomer(customer!);
    toast('Customer updated');
    router.back();
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={styles.title}>Edit Customer</Text>
      <Card>
        <Field label="Customer Name" value={customer.name} onChangeText={(t) => setCustomer({ ...customer, name: t })} error={errors.name} />
        <Field label="Phone Number" value={customer.phone} onChangeText={(t) => setCustomer({ ...customer, phone: t })} keyboardType="phone-pad" error={errors.phone} />
        <Field label="Address" value={customer.address ?? ''} onChangeText={(t) => setCustomer({ ...customer, address: t })} multiline />
        <Field label="Site Location" value={customer.site_location ?? ''} onChangeText={(t) => setCustomer({ ...customer, site_location: t })} />
        <Field label="Notes" value={customer.notes ?? ''} onChangeText={(t) => setCustomer({ ...customer, notes: t })} multiline />
        <Button title="Save Customer" icon="save-outline" onPress={save} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 24, fontWeight: '900', color: colors.navy, marginBottom: 16 },
});
