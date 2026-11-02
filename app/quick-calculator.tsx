import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PRODUCTS, getProduct, type ProductKey } from '../src/constants/products';
import { colors } from '../src/constants/colors';
import { formatINR } from '../src/utils/currency';
import { calculateAccessories, calculateCurtainQty, calculateSquareFeet, calculateSquareFeetMm, calculateWallpaperQty, calculateTotal } from '../src/utils/calculations';

type Estimate = { id: string; product: ProductKey; type: string; width: string; height: string; part: string; rate: string; unit: 'inch' | 'mm'; romanMtr: string; qty: number; total: number };
const blank = (product: ProductKey): Estimate => ({ id: Math.random().toString(36).slice(2), product, type: getProduct(product).typeOptions[0] ?? '', width: '', height: '', part: '', rate: '', unit: 'inch', romanMtr: '', qty: 0, total: 0 });
const num = (v: string) => Math.max(0, Number(v) || 0);

export default function QuickCalculator() {
  const [row, setRow] = useState<Estimate>(blank('curtains'));
  const [items, setItems] = useState<Estimate[]>([]);
  const product = getProduct(row.product);
  const isRoman = row.product === 'blinds' && row.type.toLowerCase() === 'roman';
  const quantity = useMemo(() => {
    if (row.product === 'curtains') return calculateCurtainQty(row.part, row.height);
    if (row.product === 'accessories') return calculateAccessories(row.width);
    if (row.product === 'cushion') return num(row.width);
    if (row.product === 'wallpaper') return calculateWallpaperQty(row.width, row.height, false, row.type === 'Normal Wallpaper' ? 'Normal Wallpaper' : 'Customize').qty;
    if (isRoman) return num(row.romanMtr);
    if ((row.product === 'blinds' || row.product === 'mosquito_net') && row.unit === 'mm') return calculateSquareFeetMm(row.width, row.height);
    return calculateSquareFeet(row.width, row.height);
  }, [row, isRoman]);
  const lineTotal = calculateTotal(quantity, row.rate);
  const grandTotal = items.reduce((sum, item) => sum + item.total, 0) + lineTotal;

  const patch = (values: Partial<Estimate>) => setRow(current => ({ ...current, ...values }));
  const field = (label: string, value: string, onChangeText: (value: string) => void, placeholder = '0') => (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#9AA2B2" keyboardType="decimal-pad" style={styles.input} />
    </View>
  );
  const addItem = () => {
    if (quantity <= 0 || num(row.rate) <= 0) return;
    setItems(current => [...current, { ...row, qty: quantity, total: lineTotal }]);
    setRow(blank(row.product));
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.top}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={22} color="#fff" /></TouchableOpacity>
        <View style={{ flex: 1 }}><Text style={styles.title}>Quick Price Calculator</Text><Text style={styles.subtitle}>Instant estimate · No customer details needed</Text></View>
        <Ionicons name="calculator" size={27} color={colors.gold} />
      </View>

      <Text style={styles.section}>Select Product</Text>
      <View style={styles.products}>
        {PRODUCTS.map(p => <TouchableOpacity key={p.key} onPress={() => setRow(blank(p.key))} style={[styles.product, row.product === p.key && styles.productActive]}><Ionicons name={p.icon as never} size={19} color={row.product === p.key ? '#fff' : colors.navy}/><Text style={[styles.productText, row.product === p.key && { color: '#fff' }]}>{p.name}</Text></TouchableOpacity>)}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{product.name} Details</Text>
        <Text style={styles.label}>{product.typeLabel}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingBottom: 8 }}>
          {product.typeOptions.map(type => <TouchableOpacity key={type} onPress={() => patch({ type })} style={[styles.chip, row.type === type && styles.chipActive]}><Text style={[styles.chipText, row.type === type && { color: '#fff' }]}>{type}</Text></TouchableOpacity>)}
        </ScrollView>

        {(row.product === 'blinds' || row.product === 'mosquito_net') && <><Text style={styles.label}>Measurement Unit</Text><View style={styles.inline}>{(['inch','mm'] as const).map(unit => <TouchableOpacity key={unit} onPress={() => patch({ unit })} style={[styles.chip, row.unit === unit && styles.chipActive]}><Text style={[styles.chipText, row.unit === unit && { color: '#fff' }]}>{unit.toUpperCase()}</Text></TouchableOpacity>)}</View></>}

        {row.product === 'curtains' && field('Part', row.part, v => patch({ part: v }), 'Enter curtain parts')}
        {field(row.product === 'accessories' ? 'Width (inch)' : row.product === 'cushion' ? 'Fabric Quantity (mtr)' : 'Width', row.width, v => patch({ width: v }))}
        {product.usesHeight && !isRoman && field('Height', row.height, v => patch({ height: v }))}
        {isRoman && field('Fabric Required (mtr) — Manual', row.romanMtr, v => patch({ romanMtr: v }), 'Enter metres manually')}
        {field('Rate (₹ / ' + (isRoman ? 'mtr' : row.product === 'curtains' || row.product === 'cushion' ? 'mtr' : row.product === 'accessories' ? 'R.ft' : 'sq.ft') + ')', row.rate, v => patch({ rate: v })}

        <View style={styles.liveBox}>
          <Text style={styles.liveLabel}>LIVE ESTIMATE</Text>
          <View style={styles.liveRow}><Text style={styles.liveText}>Quantity ({isRoman ? 'mtr' : product.qtyUnit})</Text><Text style={styles.liveValue}>{quantity.toFixed(2)}</Text></View>
          <View style={styles.liveRow}><Text style={styles.liveText}>Item Amount</Text><Text style={styles.amount}>{formatINR(lineTotal)}</Text></View>
        </View>
        <TouchableOpacity onPress={addItem} disabled={quantity <= 0 || num(row.rate) <= 0} style={[styles.addButton, (quantity <= 0 || num(row.rate) <= 0) && { opacity: 0.45 }]}><Ionicons name="add-circle-outline" size={20} color="#fff"/><Text style={styles.addText}>Add Item to Estimate</Text></TouchableOpacity>
      </View>

      <View style={styles.listHead}><Text style={styles.section}>Estimate Items ({items.length})</Text><TouchableOpacity onPress={() => setItems([])}><Text style={styles.clear}>Clear All</Text></TouchableOpacity></View>
      {items.map((item, index) => <View key={item.id} style={styles.item}><View style={{ flex: 1 }}><Text style={styles.itemName}>{index + 1}. {getProduct(item.product).name} · {item.type}</Text><Text style={styles.itemMeta}>{item.qty.toFixed(2)} {item.product === 'curtains' || item.product === 'cushion' || (item.product === 'blinds' && item.type.toLowerCase() === 'roman') ? 'mtr' : getProduct(item.product).qtyUnit} × {formatINR(num(item.rate))}</Text></View><Text style={styles.itemTotal}>{formatINR(item.total)}</Text><TouchableOpacity onPress={() => setItems(current => current.filter(x => x.id !== item.id))}><Ionicons name="trash-outline" size={18} color={colors.danger}/></TouchableOpacity></View>)}
      <View style={styles.grand}><Text style={styles.grandLabel}>Grand Total</Text><Text style={styles.grandValue}>{formatINR(grandTotal)}</Text></View>
      <Text style={styles.note}>Estimate only. This does not create or save a quotation.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
 root:{flex:1,backgroundColor:colors.bg},content:{paddingBottom:40},top:{backgroundColor:colors.navy,paddingTop:52,paddingBottom:22,paddingHorizontal:18,flexDirection:'row',alignItems:'center',gap:12,borderBottomLeftRadius:22,borderBottomRightRadius:22},back:{width:38,height:38,borderRadius:12,backgroundColor:'rgba(255,255,255,.14)',alignItems:'center',justifyContent:'center'},title:{color:'#fff',fontSize:19,fontWeight:'900'},subtitle:{color:'rgba(255,255,255,.72)',fontSize:11.5,marginTop:3},section:{fontSize:15,fontWeight:'900',color:colors.text,marginHorizontal:18,marginTop:20,marginBottom:10},products:{flexDirection:'row',flexWrap:'wrap',gap:8,paddingHorizontal:16},product:{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:'#fff',borderRadius:12,borderWidth:1,borderColor:colors.border,paddingHorizontal:11,paddingVertical:10},productActive:{backgroundColor:colors.navy,borderColor:colors.navy},productText:{fontSize:12,fontWeight:'800',color:colors.text},card:{backgroundColor:'#fff',margin:16,marginTop:18,borderRadius:18,padding:16,elevation:2},cardTitle:{fontSize:16,fontWeight:'900',color:colors.navy,marginBottom:14},label:{fontSize:12,fontWeight:'800',color:colors.textDark,marginBottom:7,marginTop:9},chip:{borderWidth:1,borderColor:colors.border,borderRadius:20,paddingHorizontal:12,paddingVertical:8,backgroundColor:'#fff'},chipActive:{backgroundColor:colors.navy,borderColor:colors.navy},chipText:{fontSize:11.5,fontWeight:'700',color:colors.text},inline:{flexDirection:'row',gap:8},fieldWrap:{marginTop:9},input:{height:45,borderWidth:1,borderColor:colors.border,borderRadius:11,paddingHorizontal:12,color:colors.text,fontSize:15,backgroundColor:'#fff'},liveBox:{backgroundColor:'#FFF7EC',borderRadius:13,padding:13,marginTop:16},liveLabel:{fontSize:10,fontWeight:'900',letterSpacing:1,color:'#B66B00',marginBottom:7},liveRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:4},liveText:{fontSize:13,color:colors.textDark},liveValue:{fontSize:15,fontWeight:'900',color:colors.navy},amount:{fontSize:20,fontWeight:'900',color:colors.navy},addButton:{backgroundColor:colors.navy,borderRadius:12,padding:14,marginTop:14,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:8},addText:{color:'#fff',fontWeight:'900',fontSize:14},listHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginRight:18},clear:{color:colors.danger,fontWeight:'800',fontSize:12},item:{marginHorizontal:16,marginTop:7,backgroundColor:'#fff',borderRadius:12,padding:13,flexDirection:'row',alignItems:'center',gap:10},itemName:{fontSize:12.5,fontWeight:'900',color:colors.textDark},itemMeta:{fontSize:11,color:colors.textMuted,marginTop:4},itemTotal:{fontWeight:'900',color:colors.navy,fontSize:13},grand:{margin:16,backgroundColor:colors.navy,borderRadius:16,padding:17,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},grandLabel:{color:'#fff',fontWeight:'800',fontSize:15},grandValue:{color:colors.gold,fontSize:22,fontWeight:'900'},note:{textAlign:'center',color:colors.textMuted,fontSize:11,marginHorizontal:18}
});
