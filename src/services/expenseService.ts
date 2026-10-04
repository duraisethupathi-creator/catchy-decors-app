import AsyncStorage from '@react-native-async-storage/async-storage';
import { uuid } from './db';
export type ExpenseCategory='Material'|'Stitching'|'Transport'|'Installation'|'Labour'|'Other';
export interface Expense{id:string;quotationId?:string;category:ExpenseCategory;description:string;amount:number;date:string;}
const KEY='cd_expenses';
export async function getExpenses():Promise<Expense[]>{try{return JSON.parse((await AsyncStorage.getItem(KEY))||'[]')}catch{return []}}
export async function addExpense(input:Omit<Expense,'id'|'date'>):Promise<Expense>{const e:Expense={...input,id:uuid(),date:new Date().toISOString()};const rows=await getExpenses();rows.unshift(e);await AsyncStorage.setItem(KEY,JSON.stringify(rows));return e}
export async function deleteExpense(id:string){const rows=await getExpenses();await AsyncStorage.setItem(KEY,JSON.stringify(rows.filter(e=>e.id!==id)))}
export async function getExpenseSummary(){const rows=await getExpenses();const now=new Date();const month=rows.filter(e=>{const d=new Date(e.date);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear()});return {all:rows,month,total:rows.reduce((s,e)=>s+e.amount,0),monthTotal:month.reduce((s,e)=>s+e.amount,0)}}
