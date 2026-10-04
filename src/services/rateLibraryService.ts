import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ProductKey } from '../constants/products';
import { uuid } from './db';
export interface RateItem { id:string; product:ProductKey; type:string; material:string; rate:number; unit:string; updatedAt:string; }
const KEY='cd_rate_library';
export async function getRateLibrary():Promise<RateItem[]>{try{return JSON.parse((await AsyncStorage.getItem(KEY))||'[]')}catch{return []}}
export async function getRatesForProduct(product:ProductKey):Promise<RateItem[]>{return (await getRateLibrary()).filter(r=>r.product===product).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))}
export async function saveRate(input:{product:ProductKey;type?:string;material:string;rate:number;unit:string}):Promise<RateItem>{
 const rows=await getRateLibrary(); const type=(input.type||'').trim(); const material=input.material.trim();
 const i=rows.findIndex(r=>r.product===input.product&&r.type.toLowerCase()===type.toLowerCase()&&r.material.toLowerCase()===material.toLowerCase());
 const item:RateItem={id:i>=0?rows[i].id:uuid(),product:input.product,type,material,rate:input.rate,unit:input.unit,updatedAt:new Date().toISOString()};
 if(i>=0)rows[i]=item;else rows.unshift(item); await AsyncStorage.setItem(KEY,JSON.stringify(rows)); return item;
}
export async function deleteRate(id:string){const rows=await getRateLibrary();await AsyncStorage.setItem(KEY,JSON.stringify(rows.filter(r=>r.id!==id)))}
