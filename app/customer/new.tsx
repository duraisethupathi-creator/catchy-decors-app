import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button, Card, Field } from '../../src/components/common';
import { toast } from '../../src/components/common/ui';
import { colors } from '../../src/constants/colors';
import { saveCustomer, getCustomer } from '../../src/services/customerService';
import { validateCustomer, isValidIndianMobile } from '../../src/utils/validation';
import { todayISO } from '../../src/utils/currency';
import type { Customer } from '../../src/types/customer';

export default function NewCustomer() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode = params.mode ?? 'customer'; // customer | measurement | quotation
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [site, setSite] = useState('');
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Remember Me prefill / edit-prefill support
  useEffect(() => {
    (async () => {
      const editId = await AsyncStorage.getItem('cd_edit_customer');
      if (editId) {
        const c = await getCustomer(editId);
        if (c) {
          setName(c.name);
          setPhone(c.phone);
          setAddress(c.address ?? '');
          setSite(c.site_location ?? '');
          setDate(c.date ?? todayISO());
          setNotes(c.notes ?? '');
        }
        await AsyncStorage.removeItem('cd_edit_customer');
      }
    })();
  }, []);

  async function persist(): Promise<Customer | null> {
    const errs = validateCustomer(name, phone);
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast('Please fix the highlighted fields');
      return null;
    }
    setSaving(true);
    try {
      return await saveCustomer({ name, phone, address, site_location: site, date, notes });
    } finally {
      setSaving(false);
    }
  }

  async function onSave() {
    const c = await persist();
    if (c) {
      toast(`Customer ${c.name} saved`);
      router.back();
    }
  }

  async function onContinue() {
    const c = await persist();
    if (!c) return;
    await AsyncStorage.setItem('cd_current_customer', c.id);
    if (mode === 'quotation') router.replace('/quotation/new');
    else router.replace('/measurement/new');
  }

  const continueLabel = mode === 'quotation' ? 'Continue to Quotation' : 'Continue to Product Selection';

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={styles.header}>
        <Text style={styles.title}>New Customer</Text>
        <Text style={styles.sub}>Enter customer and site details</Text>
      </View>

      <Card>
        <Field label="Customer Name *" value={name} onChangeText={setName} placeholder="e.g. Ramesh Kumar" error={errors.name} />
        <Field
          label="Phone Number *"
          value={phone}
          onChangeText={(t) => setPhone(t.replace(/[^0-9+]/g, '').slice(0, 13))}
          placeholder="10-digit Indian mobile"
          keyboardType="phone-pad"
          error={errors.phone}
        />
        <Field label="Address" value={address} onChangeText={setAddress} placeholder="Street, City" multiline />
        <Field label="Site Location" value={site} onChangeText={setSite} placeholder="e.g. 2nd Floor, Villa 7" />
        <Field label="Date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
        <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Preferences, references…" multiline />
      </Card>

      <View style={{ marginTop: 18, gap: 10 }}>
        <Button title={continueLabel} icon="arrow-forward" variant="accent" onPress={onContinue} disabled={saving} />
        <Button title="Save Customer" icon="save-outline" onPress={onSave} disabled={saving} />
      </View>

      <View style={styles.noteRow}>
        <Ionicons name="information-circle" size={16} color={colors.textMuted} />
        <Text style={styles.note}>Indian mobile numbers starting 6-9 are accepted (10 digits).</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '900', color: colors.navy },
  sub: { color: colors.textMuted, marginTop: 4, fontSize: 13.5 },
  noteRow: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 14, paddingHorizontal: 6 },
  note: { color: colors.textMuted, fontSize: 12, flex: 1 },
});
