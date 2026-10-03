import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Button } from '../../src/components/common';
import { EmptyState, toast, confirm } from '../../src/components/common/ui';
import { StatusChip } from '../../src/components/common';
import { colors } from '../../src/constants/colors';
import { getQuotation, deleteQuotation, duplicateQuotation, updateQuotationStatus } from '../../src/services/quotationService';
import { buildQuotationHtml, quotationFileName } from '../../src/services/pdfService';
import { useSettings } from '../../src/context/SettingsContext';
import { readLogoDataUri } from '../../src/services/logoData';
import { shareQuotationExcel } from '../../src/services/excelShare';
import { gstInputFromQuotation } from '../../src/services/excelService';
import { formatINR, formatDate } from '../../src/utils/currency';
import { getProduct } from '../../src/constants/products';
import type { Quotation } from '../../src/types/quotation';
import { addPayment, paymentSummary, type PaymentEntry, type PaymentMode } from '../../src/services/paymentService';

export default function QuotationDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [q, setQ] = useState<Quotation | null>(null);
  const [busy, setBusy] = useState(false);
  const { settings } = useSettings();
  const [logoDataUri, setLogoDataUri] = useState('');
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [paid, setPaid] = useState(0);
  const [balance, setBalance] = useState(0);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('UPI');

  useFocusEffect(
    useCallback(() => {
      getQuotation(String(id)).then(async (row) => {
        setQ(row);
        if (row) { const p = await paymentSummary(row.id, row.grand_total); setPayments(p.rows); setPaid(p.paid); setBalance(p.balance); }
      });
      readLogoDataUri(settings.profile.logoUri).then(setLogoDataUri);
    }, [id, settings.profile.logoUri])
  );

  if (!q) {
    return (
      <View style={styles.root}>
        <EmptyState icon="🔍" title="Quotation not found" />
      </View>
    );
  }

  async function pdf(): Promise<string | null> {
    try {
      setBusy(true);
      const html = buildQuotationHtml(q!, null, {
        profile: settings.profile,
        template: settings.template,
        logoDataUri,
      });
      const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
      toast('PDF ready');
      return uri;
    } catch {
      toast('PDF failed');
      return null;
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text style={styles.title}>{q.quotation_number}</Text>
        <StatusChip status={q.status} />
      </View>
      <Text style={styles.sub}>{q.customer_name} · {q.customer_phone} · {formatDate(q.quotation_date)}</Text>

      <View style={styles.card}>
        <Text style={styles.sec}>Items</Text>
        {(q.items ?? []).map((it) => (
          <View key={it.id} style={styles.itemRow}>
            <Text style={styles.itemText}>{it.area_name} · {getProduct(it.product_type).name} · {it.quantity}</Text>
            <Text style={styles.itemTotal}>{formatINR(it.total, false)}</Text>
          </View>
        ))}
        {(q.accessories ?? []).map((a) => (
          <View key={a.id} style={styles.itemRow}>
            <Text style={styles.itemText}>{a.area_name} · {a.track_type} · {a.quantity}</Text>
            <Text style={styles.itemTotal}>{formatINR(a.total, false)}</Text>
          </View>
        ))}
        {(q.charges ?? []).map((c) => (
          <View key={c.id} style={styles.itemRow}>
            <Text style={[styles.itemText, c.total < 0 ? { color: colors.success } : null]}>{c.description} {c.total < 0 ? '(discount)' : ''}</Text>
            <Text style={[styles.itemTotal, c.total < 0 ? { color: colors.success } : null]}>{formatINR(c.total, false)}</Text>
          </View>
        ))}
        <View style={[styles.itemRow, { borderTopWidth: 2, borderTopColor: colors.navy, paddingTop: 10, marginTop: 6 }]}>
          <Text style={styles.grandLbl}>GRAND TOTAL</Text>
          <Text style={styles.grandVal}>{formatINR(q.grand_total)}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sec}>Payment & Balance</Text>
        <View style={styles.paySummary}><View><Text style={styles.payLabel}>Paid</Text><Text style={styles.paid}>{formatINR(paid)}</Text></View><View><Text style={styles.payLabel}>Balance</Text><Text style={styles.balance}>{formatINR(balance)}</Text></View></View>
        <TextInput style={styles.payInput} value={paymentAmount} onChangeText={setPaymentAmount} keyboardType="decimal-pad" placeholder="Enter payment amount" />
        <View style={styles.modeRow}>{(['Cash','UPI','Bank'] as PaymentMode[]).map(m=><TouchableOpacity key={m} onPress={()=>setPaymentMode(m)} style={[styles.mode, paymentMode===m&&styles.modeOn]}><Text style={[styles.modeText,paymentMode===m&&styles.modeTextOn]}>{m}</Text></TouchableOpacity>)}</View>
        <Button title="Add Payment" icon="cash" variant="accent" onPress={async()=>{
          const amount=Number(paymentAmount)||0;
          if(amount<=0) return Alert.alert('Payment','Enter a valid amount.');
          if(amount>balance) return Alert.alert('Payment',`Balance amount is ${formatINR(balance)}`);
          await addPayment({quotationId:q.id,amount,mode:paymentMode});
          const p=await paymentSummary(q.id,q.grand_total); setPayments(p.rows); setPaid(p.paid); setBalance(p.balance); setPaymentAmount(''); toast('Payment saved');
        }}/>
        {payments.slice(0,5).map(p=><View key={p.id} style={styles.paymentRow}><Text style={styles.itemText}>{new Date(p.date).toLocaleDateString('en-IN')} · {p.mode}</Text><Text style={styles.itemTotal}>{formatINR(p.amount)}</Text></View>)}
      </View>

      <View style={{ gap: 10, marginTop: 16 }}>
        <Button title={busy ? 'Working…' : 'Regenerate PDF'} icon="document" variant="accent" onPress={pdf} disabled={busy} />
        <Button title="Share PDF" icon="share-social" onPress={async () => {
          const uri = await pdf();
          if (uri && (await Sharing.isAvailableAsync())) {
            await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: quotationFileName(q) });
          }
        }} disabled={busy} />
        <Button
          title={busy ? 'Building Excel…' : q.gst?.enabled ? 'Export Excel — Quotation + GST' : 'Export Excel — Quotation'}
          icon="grid"
          variant="outline"
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            try {
              const res = await shareQuotationExcel(
                q,
                { profile: settings.profile, template: settings.template },
                gstInputFromQuotation(q),
                'both'
              );
              toast(`Excel ready — ${res.name}`);
            } catch {
              toast('Excel export failed');
            } finally {
              setBusy(false);
            }
          }}
        />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title="Duplicate" icon="copy" variant="outline" style={{ flex: 1 }} onPress={async () => {
            const copy = await duplicateQuotation(q.id);
            if (copy) {
              toast(`Duplicated as ${copy.quotation_number}`);
              router.replace(`/quotation/${copy.id}`);
            }
          }} />
          <Button title="Edit" icon="pencil" variant="outline" style={{ flex: 1 }} onPress={() => router.push(`/quotation/new?customerId=${q.customer_id}` as never)} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {(['draft', 'sent', 'approved', 'completed'] as const).map((s) => (
            <Button key={s} title={s.toUpperCase()} variant={q.status === s ? 'primary' : 'ghost'} style={{ paddingVertical: 8 }} onPress={async () => {
              await updateQuotationStatus(q.id, s);
              setQ(await getQuotation(q.id));
              toast(`Marked as ${s}`);
            }} />
          ))}
        </View>
        <Button title="Delete Quotation" icon="trash" variant="danger" onPress={() =>
          confirm('Delete Quotation', `Delete ${q.quotation_number}? This cannot be undone.`, async () => {
            await deleteQuotation(q.id);
            toast('Deleted');
            router.back();
          })
        } />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 22, fontWeight: '900', color: colors.navy },
  sub: { color: colors.textMuted, fontSize: 13, marginTop: 4, marginBottom: 14 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, elevation: 2 },
  sec: { fontWeight: '800', color: colors.text, marginBottom: 8, fontSize: 15 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  itemText: { flex: 1, color: colors.textDark, fontSize: 13, marginRight: 10 },
  itemTotal: { fontWeight: '700', color: colors.navy },
  grandLbl: { fontWeight: '900', color: colors.navy, fontSize: 14.5 },
  grandVal: { fontWeight: '900', color: colors.red, fontSize: 16.5 },
  paySummary:{flexDirection:'row',justifyContent:'space-between',backgroundColor:'#F6F8FC',borderRadius:12,padding:14,marginBottom:12},
  payLabel:{fontSize:11,color:colors.textMuted},paid:{fontSize:18,fontWeight:'900',color:colors.success,marginTop:2},balance:{fontSize:18,fontWeight:'900',color:colors.red,marginTop:2},
  payInput:{borderWidth:1,borderColor:'#DDE2EA',borderRadius:12,padding:12,marginBottom:10,color:colors.text},modeRow:{flexDirection:'row',gap:8,marginBottom:12},mode:{paddingHorizontal:16,paddingVertical:8,borderRadius:999,backgroundColor:'#E9EDF4'},modeOn:{backgroundColor:colors.navy},modeText:{color:colors.textMuted,fontWeight:'700'},modeTextOn:{color:'#fff'},paymentRow:{flexDirection:'row',justifyContent:'space-between',paddingVertical:7,borderBottomWidth:1,borderBottomColor:'#EEF1F5'},
});
