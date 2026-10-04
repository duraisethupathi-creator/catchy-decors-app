import React,{useCallback,useState} from 'react';
import {Alert,ScrollView,StyleSheet,Text,TouchableOpacity,View} from 'react-native';
import {useFocusEffect} from 'expo-router';
import {Button,Card,Field} from '../../src/components/common';
import {colors} from '../../src/constants/colors';
import {formatINR} from '../../src/utils/currency';
import {numericInput} from '../../src/utils/validation';
import {addExpense,getExpenseSummary,type Expense,type ExpenseCategory} from '../../src/services/expenseService';
import {getMonthSales} from '../../src/services/quotationService';
const CATS:ExpenseCategory[]=['Material','Stitching','Transport','Installation','Labour','Other'];
export default function Expenses(){
 const [rows,setRows]=useState<Expense[]>([]),[sales,setSales]=useState(0),[monthExpense,setMonthExpense]=useState(0);
 const [cat,setCat]=useState<ExpenseCategory>('Material'),[desc,setDesc]=useState(''),[amount,setAmount]=useState('');
 const load=useCallback(async()=>{const [e,s]=await Promise.all([getExpenseSummary(),getMonthSales()]);setRows(e.month);setMonthExpense(e.monthTotal);setSales(s)},[]);
 useFocusEffect(useCallback(()=>{load()},[load])); const profit=sales-monthExpense;
 return <ScrollView style={s.root} contentContainerStyle={{padding:16,paddingBottom:40}}>
  <Text style={s.title}>Expenses & Profit</Text><Text style={s.sub}>This month business summary</Text>
  <View style={s.summary}><View><Text style={s.lbl}>Sales</Text><Text style={s.sales}>{formatINR(sales)}</Text></View><View><Text style={s.lbl}>Expenses</Text><Text style={s.exp}>{formatINR(monthExpense)}</Text></View><View><Text style={s.lbl}>Net Profit</Text><Text style={[s.profit,profit<0&&{color:colors.red}]}>{formatINR(profit)}</Text></View></View>
  <Card style={{marginTop:14}}><Text style={s.sec}>Add Expense</Text><View style={s.chips}>{CATS.map(x=><TouchableOpacity key={x} onPress={()=>setCat(x)} style={[s.chip,cat===x&&s.chipOn]}><Text style={[s.chipText,cat===x&&s.chipTextOn]}>{x}</Text></TouchableOpacity>)}</View>
  <Field label="Description" value={desc} onChangeText={setDesc} placeholder="e.g. Curtain fabric purchase"/><Field label="Amount (₹)" value={amount} onChangeText={t=>setAmount(numericInput(t))} keyboardType="decimal-pad"/>
  <Button title="Save Expense" icon="save" variant="accent" onPress={async()=>{const n=Number(amount)||0;if(n<=0)return Alert.alert('Expense','Enter a valid amount.');await addExpense({category:cat,description:desc.trim()||cat,amount:n});setDesc('');setAmount('');await load()}}/></Card>
  <Text style={s.sec2}>This Month Expenses</Text>{rows.map(e=><View key={e.id} style={s.row}><View style={{flex:1}}><Text style={s.name}>{e.description}</Text><Text style={s.meta}>{e.category} · {new Date(e.date).toLocaleDateString('en-IN')}</Text></View><Text style={s.amount}>- {formatINR(e.amount)}</Text></View>)}
 </ScrollView>
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:colors.bg},title:{fontSize:24,fontWeight:'900',color:colors.navy},sub:{color:colors.textMuted,marginTop:3},summary:{backgroundColor:colors.navy,borderRadius:18,padding:16,marginTop:14,gap:12},lbl:{color:'rgba(255,255,255,.7)',fontSize:11},sales:{color:'#fff',fontSize:20,fontWeight:'900'},exp:{color:'#FFB4B4',fontSize:20,fontWeight:'900'},profit:{color:'#72E6A0',fontSize:22,fontWeight:'900'},sec:{fontWeight:'900',color:colors.navy,fontSize:16,marginBottom:10},chips:{flexDirection:'row',flexWrap:'wrap',gap:7,marginBottom:10},chip:{backgroundColor:'#E9EDF4',paddingHorizontal:11,paddingVertical:8,borderRadius:999},chipOn:{backgroundColor:colors.navy},chipText:{fontSize:12,fontWeight:'700',color:colors.textMuted},chipTextOn:{color:'#fff'},sec2:{fontSize:16,fontWeight:'900',color:colors.text,marginTop:20,marginBottom:8},row:{backgroundColor:'#fff',borderRadius:13,padding:13,marginBottom:8,flexDirection:'row',alignItems:'center'},name:{fontWeight:'800',color:colors.text},meta:{fontSize:11.5,color:colors.textMuted,marginTop:3},amount:{fontWeight:'900',color:colors.red}});
