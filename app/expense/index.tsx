import React,{useCallback,useState} from 'react';
import {Alert,ScrollView,StyleSheet,Text,TouchableOpacity,View} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {useFocusEffect} from 'expo-router';
import {Button,Card,Field} from '../../src/components/common';
import {colors} from '../../src/constants/colors';
import {formatINR} from '../../src/utils/currency';
import {numericInput} from '../../src/utils/validation';
import {addExpense,getExpenseSummary,type Expense,type ExpenseCategory} from '../../src/services/expenseService';
import {getMonthSales} from '../../src/services/quotationService';
import { PermissionGuard } from '../../src/components/PermissionGuard';
const CATS:ExpenseCategory[]=['Material','Stitching','Transport','Installation','Labour','Other'];
function ExpensesContent(){
 const [rows,setRows]=useState<Expense[]>([]),[sales,setSales]=useState(0),[monthExpense,setMonthExpense]=useState(0);
 const [cat,setCat]=useState<ExpenseCategory>('Material'),[desc,setDesc]=useState(''),[amount,setAmount]=useState('');
 const [period,setPeriod]=useState<'month'|'all'>('month');
 const load=useCallback(async()=>{const [e,s]=await Promise.all([getExpenseSummary(),getMonthSales()]);setRows(e.month);setMonthExpense(e.monthTotal);setSales(s)},[]);
 useFocusEffect(useCallback(()=>{load()},[load])); const profit=sales-monthExpense;
 return <ScrollView style={s.root} contentContainerStyle={{padding:16,paddingBottom:40}}>
  <Text style={s.title}>Expenses & Profit</Text><Text style={s.sub}>This month business summary</Text>
  <View style={s.summary}><View><Text style={s.lbl}>Sales</Text><Text style={s.sales}>{formatINR(sales)}</Text></View><View><Text style={s.lbl}>Expenses</Text><Text style={s.exp}>{formatINR(monthExpense)}</Text></View><View><Text style={s.lbl}>Net Profit</Text><Text style={[s.profit,profit<0&&{color:colors.red}]}>{formatINR(profit)}</Text></View></View>
  <Card style={{marginTop:14}}><Text style={s.sec}>Business Report</Text><View style={s.chips}><TouchableOpacity onPress={()=>setPeriod('month')} style={[s.chip,period==='month'&&s.chipOn]}><Text style={[s.chipText,period==='month'&&s.chipTextOn]}>This Month</Text></TouchableOpacity><TouchableOpacity onPress={()=>setPeriod('all')} style={[s.chip,period==='all'&&s.chipOn]}><Text style={[s.chipText,period==='all'&&s.chipTextOn]}>All Records</Text></TouchableOpacity></View>
  <Button title="Share Profit Report PDF" icon="share-social" variant="outline" onPress={async()=>{const e=await getExpenseSummary();const list=period==='month'?e.month:e.all;const expense=list.reduce((a,x)=>a+x.amount,0);const reportSales=period==='month'?sales:0;const title=period==='month'?'Monthly Profit Report':'Expense Report - All Records';const summaryHtml=period==='month'?'<h3>Sales: '+formatINR(reportSales)+' &nbsp; Expenses: '+formatINR(expense)+' &nbsp; Net Profit: '+formatINR(reportSales-expense)+'</h3>':'';const rowHtml=list.map(x=>'<tr><td style="padding:7px 0;border-bottom:1px solid #ddd">'+new Date(x.date).toLocaleDateString('en-IN')+'</td><td>'+x.category+'</td><td>'+x.description+'</td><td align="right">'+formatINR(x.amount)+'</td></tr>').join('');const html='<html><body style="font-family:Arial;padding:30px;color:#17204a"><h1>Catchy Decors</h1><h2>'+title+'</h2><p>Generated: '+new Date().toLocaleDateString('en-IN')+'</p>'+summaryHtml+'<table style="width:100%;border-collapse:collapse"><tr><th align="left">Date</th><th align="left">Category</th><th align="left">Description</th><th align="right">Amount</th></tr>'+rowHtml+'</table><h3 style="text-align:right">Total Expenses: '+formatINR(expense)+'</h3></body></html>';const {uri}=await Print.printToFileAsync({html});if(await Sharing.isAvailableAsync())await Sharing.shareAsync(uri,{mimeType:'application/pdf',dialogTitle:title});}}/></Card>
  <Card style={{marginTop:14}}><Text style={s.sec}>Add Expense</Text><View style={s.chips}>{CATS.map(x=><TouchableOpacity key={x} onPress={()=>setCat(x)} style={[s.chip,cat===x&&s.chipOn]}><Text style={[s.chipText,cat===x&&s.chipTextOn]}>{x}</Text></TouchableOpacity>)}</View>
  <Field label="Description" value={desc} onChangeText={setDesc} placeholder="e.g. Curtain fabric purchase"/><Field label="Amount (₹)" value={amount} onChangeText={t=>setAmount(numericInput(t))} keyboardType="decimal-pad"/>
  <Button title="Save Expense" icon="save" variant="accent" onPress={async()=>{const n=Number(amount)||0;if(n<=0)return Alert.alert('Expense','Enter a valid amount.');await addExpense({category:cat,description:desc.trim()||cat,amount:n});setDesc('');setAmount('');await load()}}/></Card>
  <Text style={s.sec2}>This Month Expenses</Text>{rows.map(e=><View key={e.id} style={s.row}><View style={{flex:1}}><Text style={s.name}>{e.description}</Text><Text style={s.meta}>{e.category} · {new Date(e.date).toLocaleDateString('en-IN')}</Text></View><Text style={s.amount}>- {formatINR(e.amount)}</Text></View>)}
 </ScrollView>
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:colors.bg},title:{fontSize:24,fontWeight:'900',color:colors.navy},sub:{color:colors.textMuted,marginTop:3},summary:{backgroundColor:colors.navy,borderRadius:18,padding:16,marginTop:14,gap:12},lbl:{color:'rgba(255,255,255,.7)',fontSize:11},sales:{color:'#fff',fontSize:20,fontWeight:'900'},exp:{color:'#FFB4B4',fontSize:20,fontWeight:'900'},profit:{color:'#72E6A0',fontSize:22,fontWeight:'900'},sec:{fontWeight:'900',color:colors.navy,fontSize:16,marginBottom:10},chips:{flexDirection:'row',flexWrap:'wrap',gap:7,marginBottom:10},chip:{backgroundColor:'#E9EDF4',paddingHorizontal:11,paddingVertical:8,borderRadius:999},chipOn:{backgroundColor:colors.navy},chipText:{fontSize:12,fontWeight:'700',color:colors.textMuted},chipTextOn:{color:'#fff'},sec2:{fontSize:16,fontWeight:'900',color:colors.text,marginTop:20,marginBottom:8},row:{backgroundColor:'#fff',borderRadius:13,padding:13,marginBottom:8,flexDirection:'row',alignItems:'center'},name:{fontWeight:'800',color:colors.text},meta:{fontSize:11.5,color:colors.textMuted,marginTop:3},amount:{fontWeight:'900',color:colors.red}});


export default function GuardedScreen() {
  return <PermissionGuard permission="expenses.view"><ExpensesContent /></PermissionGuard>;
}
