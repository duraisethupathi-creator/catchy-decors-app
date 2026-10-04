import AsyncStorage from '@react-native-async-storage/async-storage';
import { queueForSync, uuid } from './db';

export type PaymentMode = 'Cash' | 'UPI' | 'Bank';
export interface PaymentEntry { id:string; quotationId:string; amount:number; mode:PaymentMode; date:string; note?:string; updated_at?:string; }
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
  return quotes.map(q=>{const paid=payments.filter(p=>p.quotationId===q.id).reduce((s,p)=>s+p.amount,0);return {quotationId:q.id,quotationNumber:q.quotation_number,customerName:q.customer_name||'',customerPhone:q.customer_phone||'',total:q.grand_total,paid,balance:Math.max(0,q.grand_total-paid)};}).filter(x=>x.balance>0).sort((a,b)=>b.balance-a.balance);
}
