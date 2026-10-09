import AsyncStorage from '@react-native-async-storage/async-storage';
import { queueForSync, uuid } from './db';
export type ExpenseCategory='Material'|'Stitching'|'Transport'|'Installation'|'Labour'|'Other';
export interface Expense{id:string;quotationId?:string;category:ExpenseCategory;description:string;amount:number;date:string;updated_at?:string;}
const KEY='cd_expenses';
export async function getExpenses():Promise<Expense[]>{try{return JSON.parse((await AsyncStorage.getItem(KEY))||'[]')}catch{return []}}
export async function addExpense(input:Omit<Expense,'id'|'date'> & {date?:string}):Promise<Expense>{const now=new Date().toISOString();const e:Expense={...input,id:uuid(),date:input.date||now,updated_at:now};const rows=await getExpenses();rows.unshift(e);await AsyncStorage.setItem(KEY,JSON.stringify(rows));await AsyncStorage.setItem(`cd_expenses_${e.id}`,JSON.stringify(e));await queueForSync('expenses',e.id);return e}
export async function updateExpense(id:string,patch:Partial<Omit<Expense,'id'>>):Promise<Expense|null>{const rows=await getExpenses();const index=rows.findIndex(e=>e.id===id);if(index<0)return null;const updated:Expense={...rows[index],...patch,id,updated_at:new Date().toISOString()};rows[index]=updated;await AsyncStorage.setItem(KEY,JSON.stringify(rows));await AsyncStorage.setItem(`cd_expenses_${id}`,JSON.stringify(updated));await queueForSync('expenses',id);return updated}
export async function deleteExpense(id:string){
 const rows=await getExpenses();
 await AsyncStorage.setItem(KEY,JSON.stringify(rows.filter(e=>e.id!==id)));
 // Remove the per-record payload, then queue the id as a delete tombstone so
 // Supabase deletion is propagated to the other devices.
 await AsyncStorage.removeItem(`cd_expenses_${id}`);
 await queueForSync('expenses',id);
}
export async function getExpenseSummary(){const rows=await getExpenses();const now=new Date();const month=rows.filter(e=>{const d=new Date(e.date);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear()});return {all:rows,month,total:rows.reduce((s,e)=>s+e.amount,0),monthTotal:month.reduce((s,e)=>s+e.amount,0)}}
