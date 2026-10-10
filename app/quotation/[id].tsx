import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Linking } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Button } from '../../src/components/common';
import { EmptyState, toast, confirm } from '../../src/components/common/ui';
import { StatusChip } from '../../src/components/common';
import { colors } from '../../src/constants/colors';
import { getQuotation, deleteQuotation, duplicateQuotation, updateQuotationStatus, updateWorkStatus } from '../../src/services/quotationService';
import { buildQuotationHtml, buildNonGstBillHtml, buildGstBillHtml, quotationFileName } from '../../src/services/pdfService';
import { useSettings } from '../../src/context/SettingsContext';
import { readLogoDataUri } from '../../src/services/logoData';
import { shareQuotationExcel } from '../../src/services/excelShare';
import { gstInputFromQuotation } from '../../src/services/excelService';
import { formatINR, formatDate } from '../../src/utils/currency';
import { getProduct } from '../../src/constants/products';
import type { Quotation, WorkStatus } from '../../src/types/quotation';
import { addPayment, paymentSummary, buildAdvancePaymentMessage, type PaymentEntry, type PaymentMode, type PaymentType } from '../../src/services/paymentService';

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
  const [paymentType, setPaymentType] = useState<PaymentType>('regular');

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

  async function pdf(kind: 'quotation' | 'bill' | 'gst' = 'quotation'): Promise<string | null> {
    try {
      setBusy(true);
      const resolvedLogo = logoDataUri || await readLogoDataUri(settings.profile.logoUri);
      const ctx = { profile: settings.profile, template: settings.template, logoDataUri: resolvedLogo };
      const gst = gstInputFromQuotation(q!);
      const html =
        kind === 'gst'
          ? buildGstBillHtml(q!, gst, ctx)
          : kind === 'bill'
            ? buildNonGstBillHtml(q!, ctx)
            : buildQuotationHtml(q!, null, ctx);
      const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
      // expo-print creates a UUID temp filename. Copy it to our branded filename
      // before sharing so WhatsApp/Files shows the real document name.
      const namedUri = `${FileSystem.cacheDirectory}${quotationFileName(q!, kind)}`;
      const existing = await FileSystem.getInfoAsync(namedUri);
      if (existing.exists) await FileSystem.deleteAsync(namedUri, { idempotent: true });
      await FileSystem.copyAsync({ from: uri, to: namedUri });
      toast(kind === 'gst' ? 'GST Tax Invoice ready' : kind === 'bill' ? 'Bill Without GST ready' : 'Quotation PDF ready');
      return namedUri;
    } catch {
      toast('PDF generation failed');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function sharePdf(kind: 'quotation' | 'bill' | 'gst'): Promise<void> {
    const uri = await pdf(kind);
    if (!uri || !(await Sharing.isAvailableAsync())) return;
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: quotationFileName(q!, kind),
      UTI: 'com.adobe.pdf',
    });
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
        <Text style={styles.sec}>Order / Work Status</Text>
        <Text style={styles.workCurrent}>{(q.work_status ?? 'quotation').replace(/_/g, ' ').toUpperCase()}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.workRow}>
          {([
            ['quotation','Quotation'],['confirmed','Confirmed'],['payment_pending','Payment Pending'],['paid','Paid']
          ] as [WorkStatus,string][]).map(([value,label])=><TouchableOpacity key={value} onPress={async()=>{await updateWorkStatus(q.id,value);setQ(await getQuotation(q.id));toast(`Work status: ${label}`);}} style={[styles.workChip,(q.work_status??'quotation')===value&&styles.workChipOn]}><Text style={[styles.workChipText,(q.work_status??'quotation')===value&&styles.workChipTextOn]}>{label}</Text></TouchableOpacity>)}
        </ScrollView>
      </View>

      <View style={styles.card}>
        <Text style={styles.sec}>Payment & Balance</Text>
        <View style={styles.paySummary}><View><Text style={styles.payLabel}>Paid</Text><Text style={styles.paid}>{formatINR(paid)}</Text></View><View><Text style={styles.payLabel}>Balance</Text><Text style={styles.balance}>{formatINR(balance)}</Text></View></View>
        <Text style={styles.payLabel}>Payment Type</Text>
        <View style={styles.modeRow}>{(['advance','regular'] as PaymentType[]).map(t=><TouchableOpacity key={t} onPress={()=>setPaymentType(t)} style={[styles.mode,paymentType===t&&styles.modeOn]}><Text style={[styles.modeText,paymentType===t&&styles.modeTextOn]}>{t==='advance'?'Advance Payment':'Regular Payment'}</Text></TouchableOpacity>)}</View>
        <TextInput style={styles.payInput} value={paymentAmount} onChangeText={setPaymentAmount} keyboardType="decimal-pad" placeholder="Enter payment amount" />
        <View style={styles.modeRow}>{(['Cash','UPI','Bank'] as PaymentMode[]).map(m=><TouchableOpacity key={m} onPress={()=>setPaymentMode(m)} style={[styles.mode, paymentMode===m&&styles.modeOn]}><Text style={[styles.modeText,paymentMode===m&&styles.modeTextOn]}>{m}</Text></TouchableOpacity>)}</View>
        <Button title="Add Payment" icon="cash" variant="accent" onPress={async()=>{
          // Accept both plain decimal input (30000.70) and display-style
          // Indian grouping (30,000.70). Number("30,000.70") is NaN.
          const normalizedAmount = paymentAmount.replace(/,/g, '').trim();
          const amount=Number(normalizedAmount)||0;
          if(amount<=0) return Alert.alert('Payment','Enter a valid amount.');
          if(amount>balance + 0.001) return Alert.alert('Payment',`Balance amount is ${formatINR(balance)}`);
          await addPayment({quotationId:q.id,amount,mode:paymentMode,type:paymentType});
          const p=await paymentSummary(q.id,q.grand_total);
          setPayments(p.rows); setPaid(p.paid); setBalance(p.balance); setPaymentAmount('');
          // Keep work status consistent with the actual payment balance.
          // Full payment automatically closes the job as Paid; a partial payment
          // moves a completed job to Payment Pending.
          if (p.balance <= 0 && q.work_status !== 'paid') {
            await updateWorkStatus(q.id,'paid');
            setQ(await getQuotation(q.id));
          } else if (p.balance > 0 && q.work_status === 'completed') {
            await updateWorkStatus(q.id,'payment_pending');
            setQ(await getQuotation(q.id));
          }
          if (paymentType === 'advance') {
            const rawPhone=String(q.customer_phone??'').replace(/\D/g,'');
            const mobile=rawPhone.length===10?`91${rawPhone}`:rawPhone;
            if (mobile) {
              const msg=buildAdvancePaymentMessage({customerName:q.customer_name,quotationNumber:q.quotation_number,total:q.grand_total,advanceAmount:amount,balance:p.balance,paymentMode});
              const waUrl=`https://wa.me/${mobile}?text=${encodeURIComponent(msg)}`;
              if(await Linking.canOpenURL(waUrl)) await Linking.openURL(waUrl);
            }
          }
          toast(p.balance <= 0 ? 'Payment saved · Fully paid' : paymentType === 'advance' ? 'Advance payment saved' : 'Payment saved');
        }}/>
        {payments.slice(0,5).map(p=><View key={p.id} style={styles.paymentRow}><Text style={styles.itemText}>{new Date(p.date).toLocaleDateString('en-IN')} · {p.type === 'advance' ? 'Advance · ' : ''}{p.mode}</Text><Text style={styles.itemTotal}>{formatINR(p.amount)}</Text></View>)}
      </View>

      <View style={styles.card}>
        <Text style={styles.sec}>WhatsApp & Due Reminder</Text>
        <Button
          title={balance <= 0 || q.work_status === 'paid' ? 'Send Thank You Message' : 'Send Balance Reminder'}
          icon="logo-whatsapp"
          variant="accent"
          onPress={async()=>{
            const phone=String(q.customer_phone??'').replace(/\D/g,'');
            if(!phone) return Alert.alert('WhatsApp','Customer mobile number is missing.');
            const mobile=phone.length===10?`91${phone}`:phone;
            const fullyPaid = balance <= 0 || q.work_status === 'paid';
            const companyName = settings.profile.name || 'Catchy Decors';
            const companyPhone = settings.profile.phone || '';
            const companyAddress = [
              settings.profile.addressLine1,
              settings.profile.addressLine2,
              settings.profile.addressLine3,
              settings.profile.addressLine4,
            ].filter(Boolean).join(', ');
            const workDetails = [
              ...(q.items ?? []).map((it) => `${it.area_name ? `${it.area_name} - ` : ''}${getProduct(it.product_type).name}`),
              ...(q.accessories ?? []).map((a) => `${a.area_name ? `${a.area_name} - ` : ''}${a.track_type || 'Accessory'}`),
            ].filter(Boolean).join(', ');
            const reviewUrl = 'https://g.page/r/CZXutlVz8pW4EBM/review';
            const latestPaymentMode = payments[0]?.mode || paymentMode;
            const msg = fullyPaid
              ? `Payment Received ✅\n\nவணக்கம் ${q.customer_name || ''}, உங்கள் payment முழுமையாக பெற்றுக்கொண்டோம். ${companyName}-ஐ தேர்வு செய்ததற்கு நன்றி! 🙏\n\nPayment Mode: ${latestPaymentMode}\n\nமீண்டும் உங்கள் வீட்டை அழகாக்க எங்களை நினைவில் கொள்ளுங்கள். ❤️\n⭐ Google Review: ${reviewUrl}\n\n${companyName}${companyPhone ? `\n📞 ${companyPhone}` : ''}`
              : `Payment Reminder\n\nவணக்கம் ${q.customer_name || ''},\nQuotation: ${q.quotation_number}\nTotal: ${formatINR(q.grand_total)}\nPaid: ${formatINR(paid)}\nPayment Mode: ${latestPaymentMode}\nBalance Due: ${formatINR(balance)}\n\nமீதமுள்ள payment-ஐ செலுத்துமாறு அன்புடன் கேட்டுக்கொள்கிறோம்.\n\n${companyName}${companyPhone ? `\n📞 ${companyPhone}` : ''}${companyAddress ? `\n📍 ${companyAddress}` : ''}`;
            const url=`https://wa.me/${mobile}?text=${encodeURIComponent(msg)}`;
            if(await Linking.canOpenURL(url)) await Linking.openURL(url); else Alert.alert('WhatsApp','Unable to open WhatsApp.');
          }}
        />
        <View style={{height:8}}/>
        <Button title="Share Quotation PDF to WhatsApp" icon="logo-whatsapp" variant="outline" disabled={busy} onPress={async()=>{
          const uri=await pdf('quotation');
          if(uri && await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri,{mimeType:'application/pdf',dialogTitle:`WhatsApp - ${quotationFileName(q)}`});
        }}/>
      </View>

      <View style={{ gap: 10, marginTop: 16 }}>
        <View style={styles.card}>
          <Text style={styles.sec}>PDF & Billing</Text>
          <Button title="Quotation PDF" icon="document-text-outline" variant="accent" onPress={() => sharePdf('quotation')} disabled={busy} />
          <View style={{ height: 8 }} />
          <Button title="Bill Without GST" icon="receipt-outline" variant="outline" onPress={() => sharePdf('bill')} disabled={busy} />
          <View style={{ height: 8 }} />
          <Button title="GST Tax Invoice" icon="receipt" variant="outline" onPress={() => sharePdf('gst')} disabled={busy || !q.gst?.enabled} />
          {!q.gst?.enabled ? <Text style={styles.billingHint}>Enable GST in the quotation to generate the GST Tax Invoice.</Text> : null}
          <View style={styles.moreDivider} />
          <Text style={styles.moreTitle}>More Options</Text>
          <Button
            title={busy ? 'Building Excel…' : 'Export Excel (.xlsx)'}
            icon="grid-outline"
            variant="ghost"
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              try {
                const res = await shareQuotationExcel(
                  q,
                  { profile: settings.profile, template: settings.template, logoDataUri },
                  gstInputFromQuotation(q),
                  q.gst?.enabled ? 'both' : 'quotation'
                );
                toast(`Excel ready — ${res.name}`);
              } catch {
                toast('Excel export failed');
              } finally {
                setBusy(false);
              }
            }}
          />
        </View>
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
  workCurrent:{fontSize:16,fontWeight:'900',color:colors.orange,marginBottom:10},workRow:{gap:8,paddingBottom:4},workChip:{paddingHorizontal:13,paddingVertical:9,borderRadius:999,backgroundColor:'#E9EDF4'},workChipOn:{backgroundColor:colors.navy},workChipText:{fontSize:12,fontWeight:'700',color:colors.textMuted},workChipTextOn:{color:'#fff'},
  paySummary:{flexDirection:'row',justifyContent:'space-between',backgroundColor:'#F6F8FC',borderRadius:12,padding:14,marginBottom:12},
  payLabel:{fontSize:11,color:colors.textMuted},paid:{fontSize:18,fontWeight:'900',color:colors.success,marginTop:2},balance:{fontSize:18,fontWeight:'900',color:colors.red,marginTop:2},
  billingHint:{fontSize:11.5,color:colors.textMuted,marginTop:8},moreDivider:{height:1,backgroundColor:colors.border,marginVertical:14},moreTitle:{fontSize:12,fontWeight:'800',color:colors.textMuted,marginBottom:8},
  payInput:{borderWidth:1,borderColor:'#DDE2EA',borderRadius:12,padding:12,marginBottom:10,color:colors.text},modeRow:{flexDirection:'row',gap:8,marginBottom:12},mode:{paddingHorizontal:16,paddingVertical:8,borderRadius:999,backgroundColor:'#E9EDF4'},modeOn:{backgroundColor:colors.navy},modeText:{color:colors.textMuted,fontWeight:'700'},modeTextOn:{color:'#fff'},paymentRow:{flexDirection:'row',justifyContent:'space-between',paddingVertical:7,borderBottomWidth:1,borderBottomColor:'#EEF1F5'},
});
