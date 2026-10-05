import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Field } from '../../src/components/common';
import { ColorSwatches, Toggle } from '../../src/components/common/Toggle';
import { toast, confirm } from '../../src/components/common/ui';
import { colors } from '../../src/constants/colors';
import { useSettings } from '../../src/context/SettingsContext';
import { defaultTemplate } from '../../src/services/settingsService';
import { formatQuotationNumber } from '../../src/utils/numbering';
import { resetQuotationSequence } from '../../src/utils/quotationNumber';
import { numericInput } from '../../src/utils/validation';
import type { QuotationTemplate } from '../../src/types/settings';
import { PermissionGuard } from '../../src/components/PermissionGuard';

const ACCENTS = ['#FF7A00', '#ED1C24', '#101D4A', '#0E9A4C', '#6B34C7', '#C77700'];

function TemplateSettingsContent() {
  const { settings, setTemplate } = useSettings();
  const [t, setT] = useState<QuotationTemplate>(settings.template);
  const [saving, setSaving] = useState(false);

  const upd = (patch: Partial<QuotationTemplate>) => setT((cur) => ({ ...cur, ...patch }));

  const preview = formatQuotationNumber(t, t.startNumber, new Date().getFullYear());

  async function save() {
    setSaving(true);
    try {
      if (!t.prefix.trim() && !t.includeYear) {
        toast('Add a prefix or include the year in the number');
        return;
      }
      await setTemplate(t);
      toast('Quotation template saved');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Quotation & Invoice Template</Text>
      <Text style={styles.sub}>Numbering, headings, colours, columns, tax and terms — all customisable</Text>

      <Card style={{ marginTop: 14 }}>
        <Text style={styles.section}>Numbering</Text>
        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Field label="Prefix" value={t.prefix} onChangeText={(v) => upd({ prefix: v })} placeholder="CD" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Separator" value={t.separator} onChangeText={(v) => upd({ separator: v.slice(0, 2) })} placeholder="-" />
          </View>
        </View>
        <Toggle label="Include year" hint="Adds the current year to every number" value={t.includeYear} onChange={(v) => upd({ includeYear: v })} />
        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Field
              label="Sequence digits"
              value={String(t.padding)}
              onChangeText={(v) => upd({ padding: Math.max(1, Math.min(8, parseInt(numericInput(v) || '1', 10) || 1)) })}
              keyboardType="numeric"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Start at number"
              value={String(t.startNumber)}
              onChangeText={(v) => upd({ startNumber: Math.max(1, parseInt(numericInput(v) || '1', 10) || 1) })}
              keyboardType="numeric"
            />
          </View>
        </View>
        <View style={styles.previewBox}>
          <Text style={styles.previewLabel}>Next number will look like</Text>
          <Text style={styles.previewValue}>{preview}</Text>
        </View>
        <Button
          title="Reset Running Counter"
          icon="refresh"
          variant="outline"
          onPress={() =>
            confirm('Reset Counter', `Start numbering again from ${t.startNumber}?`, async () => {
              await resetQuotationSequence(t.startNumber);
              toast('Counter reset');
            })
          }
        />
      </Card>

      <Card style={{ marginTop: 14 }}>
        <Text style={styles.section}>Document Headings</Text>
        <Field label="Quotation Title" value={t.quotationTitle} onChangeText={(v) => upd({ quotationTitle: v })} placeholder="QUOTATION" />
        <Field label="Invoice Title" value={t.invoiceTitle} onChangeText={(v) => upd({ invoiceTitle: v })} placeholder="TAX INVOICE" />
        <Field label="Validity (days)" value={String(t.validityDays)} onChangeText={(v) => upd({ validityDays: Math.max(0, parseInt(numericInput(v) || '0', 10) || 0) })} keyboardType="numeric" />
      </Card>

      <Card style={{ marginTop: 14 }}>
        <Text style={styles.section}>Branding</Text>
        <Text style={styles.hint}>Accent colour used for headings, rules and highlights in the app and PDF.</Text>
        <ColorSwatches value={t.accentColor} onChange={(c) => upd({ accentColor: c })} options={ACCENTS} />
        <Field label="Custom Accent Hex" value={t.accentColor} onChangeText={(v) => upd({ accentColor: v })} placeholder="#FF7A00" />
        <Toggle label="Show logo mark on documents" value={t.showLogo} onChange={(v) => upd({ showLogo: v })} />
        <Field label="Currency Symbol" value={t.currencySymbol} onChangeText={(v) => upd({ currencySymbol: v.slice(0, 3) })} placeholder="₹" />
      </Card>

      <Card style={{ marginTop: 14 }}>
        <Text style={styles.section}>Table Columns</Text>
        <Text style={styles.hint}>Turn individual columns on or off to match your preferred sheet layout.</Text>
        <Toggle label="S.No column" value={t.showSerialColumn} onChange={(v) => upd({ showSerialColumn: v })} />
        <Toggle label="Area Name column" value={t.showAreaColumn} onChange={(v) => upd({ showAreaColumn: v })} />
        <Toggle label="Type column" value={t.showTypeColumn} onChange={(v) => upd({ showTypeColumn: v })} />
        <Toggle label="Width column" value={t.showWidthColumn} onChange={(v) => upd({ showWidthColumn: v })} />
        <Toggle label="Fabric Details column" hint="Adds the fabric type / area column to quotations" value={t.showFabricColumn} onChange={(v) => upd({ showFabricColumn: v })} />
        <Toggle label="Height column" value={t.showHeightColumn} onChange={(v) => upd({ showHeightColumn: v })} />
        <Toggle label="Show measurement units" hint="Adds the mtr / R.ft / rolls legend under the tables" value={t.showUnitInQty} onChange={(v) => upd({ showUnitInQty: v })} />
      </Card>

      <Card style={{ marginTop: 14 }}>
        <Text style={styles.section}>GST Defaults</Text>
        <Toggle label="GST bill on by default" hint="Pre-enables the tax invoice toggle on new quotations" value={t.gstEnabledByDefault} onChange={(v) => upd({ gstEnabledByDefault: v })} />
        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Field label="GST %" value={String(t.gstPercent)} onChangeText={(v) => upd({ gstPercent: Math.max(0, Math.min(100, parseFloat(numericInput(v) || '0') || 0)) })} keyboardType="numeric" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="HSN / SAC" value={t.hsnCode} onChangeText={(v) => upd({ hsnCode: v })} placeholder="6303" />
          </View>
        </View>
        <Field label="Tax Label" value={t.taxLabel} onChangeText={(v) => upd({ taxLabel: v })} placeholder="CGST + SGST / IGST" />
        <Field label="Default GSTIN" value={t.gstin} onChangeText={(v) => upd({ gstin: v.toUpperCase() })} placeholder="33AAAAA0000A1Z5" />
        <Toggle label="Show business GSTIN on documents" value={t.showGstin} onChange={(v) => upd({ showGstin: v })} />
      </Card>

      <Card style={{ marginTop: 14 }}>
        <Text style={styles.section}>Terms & Notes</Text>
        <Field label="Terms & Conditions" value={t.terms} onChangeText={(v) => upd({ terms: v })} multiline placeholder={'1. 50% advance…'} />
        <Field label="Notes" value={t.notes} onChangeText={(v) => upd({ notes: v })} multiline />
        <Field label="Footer Line" value={t.footerNote} onChangeText={(v) => upd({ footerNote: v })} />
        <Field label="Thank-you Line" value={t.thankYouNote} onChangeText={(v) => upd({ thankYouNote: v })} placeholder="Thank you for choosing {COMPANY}!" />
        <Text style={styles.hint}>Use {'{COMPANY}'} inside the thank-you line to insert your business name automatically.</Text>
      </Card>

      <Card style={{ marginTop: 14 }}>
        <Text style={styles.section}>Sign-off</Text>
        <Toggle label="Show signature block" value={t.showSignature} onChange={(v) => upd({ showSignature: v })} />
        <Field label="Signatory Label" value={t.signatureLabel} onChangeText={(v) => upd({ signatureLabel: v })} placeholder="Authorised Signatory" />
      </Card>

      <Card style={{ marginTop: 14 }}>
        <Text style={styles.section}>Payment Block</Text>
        <Toggle label="Show bank details" hint="Uses the details from Business Profile" value={t.showBankDetails} onChange={(v) => upd({ showBankDetails: v })} />
        <Toggle label="Show UPI reference" hint="Displays your UPI ID for easy payment" value={t.showUpiQr} onChange={(v) => upd({ showUpiQr: v })} />
      </Card>

      <View style={{ gap: 10, marginTop: 18 }}>
        <Button title={saving ? 'Saving…' : 'Save Template'} icon="save" variant="accent" onPress={save} disabled={saving} />
        <Button
          title="Reset Template to Defaults"
          icon="refresh"
          variant="outline"
          onPress={() =>
            confirm('Reset Template', 'Restore every template setting to its factory value?', () => {
              setT(defaultTemplate());
              toast('Defaults loaded — tap Save Template to apply');
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
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginBottom: 6 },
  row: { flexDirection: 'row' },
  previewBox: { backgroundColor: '#FFF7EC', borderRadius: 12, padding: 12, marginTop: 4, marginBottom: 10 },
  previewLabel: { fontSize: 11, fontWeight: '800', color: '#C77700', letterSpacing: 0.5 },
  previewValue: { fontSize: 18, fontWeight: '900', color: colors.navy, marginTop: 4 },
});


export default function GuardedScreen() {
  return <PermissionGuard permission="settings.manage"><TemplateSettingsContent /></PermissionGuard>;
}
