import AsyncStorage from '@react-native-async-storage/async-storage';
import { queueForSync, uuid } from './db';
export type ExpenseCategory='Material'|'Stitching'|'Transport'|'Installation'|'Labour'|'Other';
export interface Expense{id:string;quotationId?:string;category:ExpenseCategory;description:string;amount:number;date:string;updated_at?:string;}
const KEY='cd_expenses';
export async function getExpenses():Promise<Expense[]>{try{return JSON.parse((await AsyncStorage.getItem(KEY))||'[]')}catch{return []}}
export async function addExpense(input:Omit<Expense,'id'|'date'>):Promise<Expense>{const now=new Date().toISOString();const e:Expense={...input,id:uuid(),date:now,updated_at:now};const rows=await getExpenses();rows.unshift(e);await AsyncStorage.setItem(KEY,JSON.stringify(rows));await AsyncStorage.setItem(`cd_expenses_${e.id}`,JSON.stringify(e));await queueForSync('expenses',e.id);return e}
export async function deleteExpense(id:string){const rows=await getExpenses();await AsyncStorage.setItem(KEY,JSON.stringify(rows.filter(e=>e.id!==id)))}
export async function getExpenseSummary(){const rows=await getExpenses();const now=new Date();const month=rows.filter(e=>{const d=new Date(e.date);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear()});return {all:rows,month,total:rows.reduce((s,e)=>s+e.amount,0),monthTotal:month.reduce((s,e)=>s+e.amount,0)}}
