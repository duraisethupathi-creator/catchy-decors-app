import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { colors } from '../../src/constants/colors';
import { useSettings } from '../../src/context/SettingsContext';
import { readLogoDataUri } from '../../src/services/logoData';
import { buildServiceBillHtml, serviceBillFileName } from '../../src/services/serviceBillPdf';
import { nextServiceBillNumber, saveServiceBill, type ServiceBill, type ServiceCategory } from '../../src/services/serviceBillService';

const categories: ServiceCategory[] = ['Curtain Service','Blinds Service','Mosquito Net Service','Track Service','Other Service'];
const num = (v:string) => Math.max(0, Number(v) || 0);

export default function NewServiceBill() {
  const settings = useSettings();
  const [billNo,setBillNo]=useState('SRV-0001');
  const [customerName,setCustomerName]=useState(''); const [phone,setPhone]=useState(''); const [address,setAddress]=useState('');
  const [category,setCategory]=useState<ServiceCategory>('Curtain Service'); const [description,setDescription]=useState('');
  const [qty,setQty]=useState('1'); const [serviceCharge,setServiceCharge]=useState(''); const [materialCharge,setMaterialCharge]=useState('');
  const [discount,setDiscount]=useState(''); const [gst,setGst]=useState('0'); const [busy,setBusy]=useState(false);
  useEffect(()=>{ nextServiceBillNumber().then(setBillNo); },[]);
  const subtotal=num(qty)*num(serviceCharge)+num(materialCharge); const taxable=Math.max(0,subtotal-num(discount));
  const gstAmount=taxable*num(gst)/100; const grand=taxable+gstAmount;
  const makeBill=():ServiceBill=>({id:`srv_${Date.now()}`,billNumber:billNo,date:new Date().toLocaleDateString('en-IN'),customerName:customerName.trim(),phone:phone.trim(),address:address.trim(),category,description:description.trim(),quantity:num(qty),serviceCharge:num(serviceCharge),materialCharge:num(materialCharge),discount:num(discount),gstPercent:num(gst),subtotal,gstAmount,grandTotal:grand});
  async function generate(){
    if(!customerName.trim()) return Alert.alert('Customer required','Enter customer name.');
    if(!description.trim()) return Alert.alert('Service details required','Enter the service / repair work completed.');
    setBusy(true);
    try{
      const bill=makeBill(); await saveServiceBill(bill);
      const logoDataUri=await readLogoDataUri(settings.profile.logoUri);
      const {uri}=await Print.printToFileAsync({html:buildServiceBillHtml(bill,{profile:settings.profile,template:settings.template,logoDataUri})});
      const fname=serviceBillFileName(bill); const dir=FileSystem.cacheDirectory||FileSystem.documentDirectory; let shareUri=uri;
      if(dir){ const target=dir+fname; await FileSystem.deleteAsync(target,{idempotent:true}); await FileSystem.copyAsync({from:uri,to:target}); shareUri=target; }
      if(await Sharing.isAvailableAsync()) await Sharing.shareAsync(shareUri,{mimeType:'application/pdf',dialogTitle:fname,UTI:'com.adobe.pdf'});
      setBillNo(await nextServiceBillNumber());
    }catch(e){ Alert.alert('Service Bill','Could not generate PDF. Please try again.'); }finally{setBusy(false);}
  }
  const field=(label:string,value:string,setter:(v:string)=>void,keyboard=false)=><View style={s.field}><Text style={s.label}>{label}</Text><TextInput style={s.input} value={value} onChangeText={setter} keyboardType={keyboard?'decimal-pad':'default'} placeholderTextColor="#98A2B3"/></View>;
  return <ScrollView style={s.root} contentContainerStyle={{paddingBottom:40}}>
    <View style={s.header}><TouchableOpacity onPress={()=>router.back()}><Ionicons name="arrow-back" size={25} color="#fff"/></TouchableOpacity><View><Text style={s.title}>Service Bill</Text><Text style={s.sub}>{billNo}</Text></View><Ionicons name="construct-outline" size={25} color={colors.gold}/></View>
    <View style={s.body}><Text style={s.section}>Customer Details</Text>{field('Customer Name',customerName,setCustomerName)}{field('Mobile Number',phone,setPhone,true)}{field('Address / Site',address,setAddress)}
    <Text style={s.section}>Service Type</Text><View style={s.chips}>{categories.map(x=><TouchableOpacity key={x} onPress={()=>setCategory(x)} style={[s.chip,category===x&&s.chipOn]}><Text style={[s.chipText,category===x&&s.chipTextOn]}>{x}</Text></TouchableOpacity>)}</View>
    {field('Service / Repair Details',description,setDescription)}
    <View style={s.row}><View style={s.half}>{field('Quantity',qty,setQty,true)}</View><View style={s.half}>{field('Service Charge / Qty',serviceCharge,setServiceCharge,true)}</View></View>
    <View style={s.row}><View style={s.half}>{field('Material / Spare Charge',materialCharge,setMaterialCharge,true)}</View><View style={s.half}>{field('Discount',discount,setDiscount,true)}</View></View>
    {field('GST % (optional)',gst,setGst,true)}
    <View style={s.total}><Text style={s.totalLabel}>Grand Total</Text><Text style={s.totalValue}>₹{grand.toFixed(2)}</Text><Text style={s.calc}>Subtotal ₹{subtotal.toFixed(2)} · GST ₹{gstAmount.toFixed(2)}</Text></View>
    <TouchableOpacity style={s.btn} onPress={generate} disabled={busy}><Ionicons name="document-text-outline" size={22} color="#fff"/><Text style={s.btnText}>{busy?'Generating…':'Generate Service Bill PDF'}</Text></TouchableOpacity>
    </View></ScrollView>;
}
const s=StyleSheet.create({root:{flex:1,backgroundColor:colors.bg},header:{backgroundColor:colors.navy,paddingTop:54,paddingBottom:20,paddingHorizontal:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},title:{color:'#fff',fontSize:20,fontWeight:'900'},sub:{color:colors.gold,fontSize:12,textAlign:'center',marginTop:2},body:{padding:16},section:{fontSize:16,fontWeight:'800',color:colors.navy,marginTop:10,marginBottom:10},field:{marginBottom:12},label:{fontSize:12,fontWeight:'700',color:colors.textMuted,marginBottom:5},input:{backgroundColor:'#fff',borderWidth:1,borderColor:'#E3E7EF',borderRadius:12,paddingHorizontal:13,paddingVertical:12,color:colors.text,fontSize:14},chips:{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:14},chip:{backgroundColor:'#fff',borderWidth:1,borderColor:'#D9DFEA',borderRadius:999,paddingHorizontal:12,paddingVertical:9},chipOn:{backgroundColor:colors.navy,borderColor:colors.navy},chipText:{fontSize:12,color:colors.text},chipTextOn:{color:'#fff',fontWeight:'800'},row:{flexDirection:'row',gap:10},half:{flex:1},total:{backgroundColor:'#fff',borderRadius:16,padding:18,marginTop:6,marginBottom:16},totalLabel:{color:colors.textMuted,fontSize:12},totalValue:{fontSize:25,fontWeight:'900',color:colors.navy,marginTop:4},calc:{color:colors.textMuted,fontSize:11,marginTop:5},btn:{backgroundColor:colors.orange,borderRadius:15,padding:16,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:9},btnText:{color:'#fff',fontWeight:'900',fontSize:15}});
