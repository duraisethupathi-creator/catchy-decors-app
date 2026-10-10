import AsyncStorage from '@react-native-async-storage/async-storage';
import { queueForSync, uuid } from './db';

export type PaymentMode = 'Cash' | 'UPI' | 'Bank';
export type PaymentType = 'advance' | 'regular';
export interface PaymentEntry { id:string; quotationId:string; amount:number; mode:PaymentMode; type?:PaymentType; date:string; note?:string; updated_at?:string; }
const KEY='cd_payments';
export async function getPayments():Promise<PaymentEntry[]>{ try{return JSON.parse((await AsyncStorage.getItem(KEY))||'[]')}catch{return []} }
export async function getPaymentsForQuotation(id:string){ return (await getPayments()).filter(p=>p.quotationId===id).sort((a,b)=>b.date.localeCompare(a.date)); }
export async function addPayment(input:Omit<PaymentEntry,'id'|'date'>):Promise<PaymentEntry>{
 const now=new Date().toISOString(); const p:PaymentEntry={...input,id:uuid(),date:now,updated_at:now}; const rows=await getPayments(); rows.unshift(p); await AsyncStorage.setItem(KEY,JSON.stringify(rows)); await AsyncStorage.setItem(`cd_payments_${p.id}`,JSON.stringify(p)); await queueForSync('payments',p.id); return p;
}
export async function paymentSummary(quotationId:string,total:number){ const rows=await getPaymentsForQuotation(quotationId); const paid=rows.reduce((s,p)=>s+p.amount,0); return {rows,paid,balance:Math.max(0,total-paid)}; }

export interface PendingPayment {
  quotationId:string; quotationNumber:string; customerName:string; customerPhone:string; total:number; paid:number; balance:number;
}
export async function getPendingPayments():Promise<PendingPayment[]>{
  const { getQuotations } = await import('./quotationService');
  const quotes=await getQuotations(); const payments=await getPayments();
  // Draft/sent quotations are proposals, not receivables. Only confirmed sales
  // should appear on the dashboard as money that is actually due.
  const receivables = quotes.filter(q =>
    q.status === 'approved' ||
    q.status === 'completed' ||
    (q.work_status != null && q.work_status !== 'quotation')
  );
  return receivables.map(q=>{const paid=payments.filter(p=>p.quotationId===q.id).reduce((s,p)=>s+p.amount,0);return {quotationId:q.id,quotationNumber:q.quotation_number,customerName:q.customer_name||'',customerPhone:q.customer_phone||'',total:q.grand_total,paid,balance:Math.max(0,q.grand_total-paid)};}).filter(x=>x.balance>0).sort((a,b)=>b.balance-a.balance);
}


export const GOOGLE_REVIEW_URL = 'https://g.page/r/CZXutlVz8pW4EBM/review';

function cleanWorkLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

export function buildCustomerPaymentMessage(input: {
  customerName?: string;
  quotationNumber?: string;
  total: number;
  paid: number;
  balance: number;
  workItems?: string[];
}): string {
  const name = input.customerName?.trim() || 'Customer';
  const work = Array.from(new Set((input.workItems ?? []).filter(Boolean).map(cleanWorkLabel)));
  const workLine = work.length ? `\nWork: ${work.join(', ')}` : '';
  const refLine = input.quotationNumber ? `\nRef: ${input.quotationNumber}` : '';
  const money = (n: number) => `₹${Math.max(0, n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  if (input.balance <= 0) {
    return `Payment Received ✅
Hi ${name}, உங்கள் payment முழுமையாக பெற்றுக்கொண்டோம். Catchy Decors-ஐ தேர்வு செய்ததற்கு நன்றி! 🙏${workLine}${refLine}
Total Paid: ${money(input.paid)}
மீண்டும் உங்கள் வீட்டை அழகாக்க எங்களை நினைவில் கொள்ளுங்கள். ❤️
⭐ Google Review: ${GOOGLE_REVIEW_URL}
🌐 Website: https://www.catchydecors.in
Catchy Decors, Karur
📞 9159194440
📍 18, 4th Cross, Kamarajapuram, Karur - 639002`;
  }

  return `Payment Reminder
Hi ${name}, Catchy Decors payment update.${workLine}${refLine}
Total: ${money(input.total)}
Paid: ${money(input.paid)}
Balance Due: ${money(input.balance)}
மீதமுள்ள payment-ஐ செலுத்துமாறு அன்புடன் கேட்டுக்கொள்கிறோம்.
Catchy Decors, Karur
📞 9159194440
📍 18, 4th Cross, Kamarajapuram, Karur - 639002`;
}

export function buildAdvancePaymentMessage(input:{customerName?:string;quotationNumber?:string;total:number;advanceAmount:number;balance:number;}):string{
 const money=(n:number)=>`₹${Math.max(0,n).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
 return `Advance Payment Received - Catchy Decors

Vanakkam ${input.customerName?.trim()||'Customer'},
Your order advance payment ${money(input.advanceAmount)} has been received. Thank you.

Quotation: ${input.quotationNumber||'-'}
Total Amount: ${money(input.total)}
Advance Paid: ${money(input.advanceAmount)}
Balance: ${money(input.balance)}

Your order process has started. We will share further work updates with you.

Website: https://www.catchydecors.in
Catchy Decors, Karur
Phone: 9159194440
18, 4th Cross, Kamarajapuram, Karur - 639002
Transform Your Space Beautifully`;
}
