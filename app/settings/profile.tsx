import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Field } from '../../src/components/common';
import { toast, confirm } from '../../src/components/common/ui';
import { colors } from '../../src/constants/colors';
import { getBrandLogo } from '../../src/constants/company';
import { useSettings } from '../../src/context/SettingsContext';
import { defaultProfile } from '../../src/services/settingsService';
import type { CompanyProfile } from '../../src/types/settings';
import { PermissionGuard } from '../../src/components/PermissionGuard';

function ProfileSettingsContent() {
  const { settings, setProfile } = useSettings();
  const [p, setP] = useState<CompanyProfile>(settings.profile);
  const [saving, setSaving] = useState(false);

  const upd = (patch: Partial<CompanyProfile>) => setP((cur) => ({ ...cur, ...patch }));

  async function pickLogo() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast('Gallery permission is needed to choose a logo');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (!res.canceled && res.assets?.[0]?.uri) {
      upd({ logoUri: res.assets[0].uri });
      toast('Logo selected — tap Save Profile to apply');
    }
  }

  async function save() {
    if (!p.name.trim()) {
      toast('Business name is required');
      return;
    }
    setSaving(true);
    try {
      await setProfile(p);
      toast('Business profile saved');
    } finally {
      setSaving(false);
    }
  }

  const logoSource = p.logoUri ? { uri: p.logoUri } : getBrandLogo();

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Business Profile</Text>
      <Text style={styles.sub}>Your details & logo, printed on every quotation and invoice</Text>

      <Card style={{ marginTop: 14 }}>
        <Text style={styles.section}>Logo</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={styles.logoBox}>
            {logoSource ? <Image source={logoSource} style={styles.logoImg} resizeMode="contain" /> : <Text style={styles.logoTxt}>CD</Text>}
          </View>
          <View style={{ flex: 1, marginLeft: 14, gap: 8 }}>
            <Button title={p.logoUri ? 'Change Logo' : 'Choose Logo from Gallery'} icon="image" variant="outline" onPress={pickLogo} />
            {p.logoUri ? (
              <Button title="Use Brand Logo Instead" icon="refresh" variant="ghost" onPress={() => upd({ logoUri: '' })} />
            ) : null}
          </View>
        </View>
        <Text style={styles.hint}>
          Pick a square image (PNG/JPG). It is stored on the device and used on the in-app header; the branded document
          layout keeps the navy/CD header mark for print clarity.
        </Text>
      </Card>

      <Card style={{ marginTop: 14 }}>
        <Text style={styles.section}>Identity</Text>
        <Field label="Business Name *" value={p.name} onChangeText={(t) => upd({ name: t })} placeholder="CATCHY DECORS" />
        <Field label="Tagline" value={p.tagline} onChangeText={(t) => upd({ tagline: t })} placeholder="Transform Your Space Beautifully" />
        <Field label="Legal Form" value={p.legalForm} onChangeText={(t) => upd({ legalForm: t })} placeholder="Proprietorship / Partnership / Pvt Ltd" />
        <Field label="GSTIN" value={p.gstin} onChangeText={(t) => upd({ gstin: t.toUpperCase() })} placeholder="33AAAAA0000A1Z5" />
      </Card>

      <Card style={{ marginTop: 14 }}>
        <Text style={styles.section}>Address</Text>
        <Field label="Address Line 1" value={p.addressLine1} onChangeText={(t) => upd({ addressLine1: t })} />
        <Field label="Address Line 2" value={p.addressLine2} onChangeText={(t) => upd({ addressLine2: t })} />
        <Field label="Address Line 3" value={p.addressLine3} onChangeText={(t) => upd({ addressLine3: t })} />
        <Field label="Address Line 4" value={p.addressLine4} onChangeText={(t) => upd({ addressLine4: t })} />
      </Card>

      <Card style={{ marginTop: 14 }}>
        <Text style={styles.section}>Contact</Text>
        <Field label="Primary Phone" value={p.phone} onChangeText={(t) => upd({ phone: t.replace(/[^0-9+]/g, '') })} keyboardType="phone-pad" />
        <Field label="Alternate Phone" value={p.altPhone} onChangeText={(t) => upd({ altPhone: t.replace(/[^0-9+]/g, '') })} keyboardType="phone-pad" />
        <Field label="Email" value={p.email} onChangeText={(t) => upd({ email: t })} keyboardType="email-address" placeholder="sales@catchydecors.in" />
        <Field label="Website" value={p.website} onChangeText={(t) => upd({ website: t })} placeholder="www.catchydecors.in" />
      </Card>

      <Card style={{ marginTop: 14 }}>
        <Text style={styles.section}>Payment Details (optional)</Text>
        <Text style={styles.hint}>Shown on documents when “Show bank details” is enabled in the template.</Text>
        <Field label="Bank Name" value={p.bankName} onChangeText={(t) => upd({ bankName: t })} />
        <Field label="Account Number" value={p.bankAccount} onChangeText={(t) => upd({ bankAccount: t.replace(/[^0-9]/g, '') })} keyboardType="numeric" />
        <Field label="IFSC" value={p.bankIfsc} onChangeText={(t) => upd({ bankIfsc: t.toUpperCase() })} />
        <Field label="UPI ID" value={p.upiId} onChangeText={(t) => upd({ upiId: t })} placeholder="catchydecors@upi" />
      </Card>

      <Card style={{ marginTop: 14 }}>
        <Text style={styles.section}>Customer Records</Text>
        <Text style={styles.hint}>
          Customer details stay fully editable per record — open any customer from the Customers tab, or use the
          Edit action to change name, phone, address, site and notes. Fields you leave blank fall back to the values
          you type on the quotation’s own editable screen.
        </Text>
      </Card>

      <View style={{ gap: 10, marginTop: 18 }}>
        <Button title={saving ? 'Saving…' : 'Save Profile'} icon="save" variant="accent" onPress={save} disabled={saving} />
        <Button
          title="Reset to Defaults"
          icon="refresh"
          variant="outline"
          onPress={() =>
            confirm('Reset Profile', 'Discard your edits and restore the original business details?', () => {
              setP(defaultProfile());
              toast('Defaults loaded — tap Save Profile to apply');
            })
          }
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 24, fontWeight: '900', color: colors.navy },
  sub: { color: colors.textMuted, fontSize: 13.5, marginTop: 4 },
  section: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 10 },
  logoBox: {
    width: 96,
    height: 96,
    borderRadius: 16,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImg: { width: 96, height: 96 },
  logoTxt: { color: colors.gold, fontWeight: '900', fontSize: 26 },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: 8, lineHeight: 17 },
});


export default function GuardedScreen() {
  return <PermissionGuard permission="settings.manage"><ProfileSettingsContent /></PermissionGuard>;
}
