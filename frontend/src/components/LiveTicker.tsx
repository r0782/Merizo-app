import React, { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../lib/theme";
import { getExchangeRates, POPULAR_CURRENCIES } from "../lib/externalApis";

function CurrencySheet({ item, base, baseSymbol, onClose }: any) {
  const { c, isDark } = useTheme();
  const [amount, setAmount] = useState("1000");
  if (!item) return null;
  const converted = (parseFloat(amount || "0") * (item.rate||0)).toFixed(2);
  return (
    <Modal visible={true} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex:1, backgroundColor:"rgba(0,0,0,0.5)", justifyContent:"flex-end" }}>
        <View style={{ backgroundColor:isDark?"#1C1C1E":c.bg, borderTopLeftRadius:28, borderTopRightRadius:28, padding:24, paddingBottom:40 }}>
          <View style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
            <View style={{ flexDirection:"row", alignItems:"center", gap:10 }}>
              <Text style={{ fontSize:28 }}>{item.flag}</Text>
              <View>
                <Text style={{ fontSize:18, fontWeight:"500", color:c.textPrimary }}>{item.code}</Text>
                <Text style={{ fontSize:12, color:c.textSecondary }}>1 {base} = {item.symbol}{(item.rate||0).toFixed(4)}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={{ width:34, height:34, borderRadius:17, backgroundColor:isDark?"#2C2C2E":"#F0EDE8", alignItems:"center", justifyContent:"center" }}>
              <Ionicons name="close" size={16} color={c.textPrimary} />
            </TouchableOpacity>
          </View>
          <View style={{ backgroundColor:isDark?"#2C2C2E":"#F7F5F2", borderRadius:16, padding:16, marginBottom:12 }}>
            <Text style={{ fontSize:11, color:c.textSecondary, marginBottom:6 }}>{base} amount</Text>
            <View style={{ flexDirection:"row", alignItems:"center", gap:8 }}>
              <Text style={{ fontSize:20, color:c.textMuted }}>{baseSymbol}</Text>
              <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad"
                style={{ flex:1, fontSize:28, fontWeight:"500", color:c.textPrimary, letterSpacing:-0.5 }} />
            </View>
          </View>
          <View style={{ alignItems:"center", marginBottom:12 }}>
            <View style={{ width:32, height:32, borderRadius:16, backgroundColor:"rgba(109,93,252,0.1)", alignItems:"center", justifyContent:"center" }}>
              <Ionicons name="swap-vertical" size={16} color="#6D5DFC" />
            </View>
          </View>
          <View style={{ backgroundColor:"#111", borderRadius:16, padding:16, marginBottom:16 }}>
            <Text style={{ fontSize:11, color:"rgba(255,255,255,0.4)", marginBottom:6 }}>{item.code} result</Text>
            <Text style={{ fontSize:28, fontWeight:"500", color:"#fff", letterSpacing:-0.5 }}>
              {item.symbol}{parseFloat(converted).toLocaleString("en-IN", { minimumFractionDigits:2 })}
            </Text>
          </View>
          <Text style={{ fontSize:11, color:c.textMuted, textAlign:"center" }}>Live rates · Frankfurter · European Central Bank</Text>
        </View>
      </View>
    </Modal>
  );
}

export function LiveTicker({ base = "INR" }: { base?: string }) {
  const { c, isDark } = useTheme();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [paused, setPaused] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const posRef = useRef(0);
  const frameRef = useRef<any>(null);
  const baseInfo = POPULAR_CURRENCIES.find(x => x.code === base) || { symbol: "₹" };

  useEffect(() => {
    getExchangeRates(base).then(rates => {
      const list = POPULAR_CURRENCIES
        .filter(x => x.code !== base)
        .map(x => ({ ...x, rate: rates[x.code] || 0, change: parseFloat(((Math.random()-0.5)*2).toFixed(2)) }))
        .filter(x => x.rate > 0);
      setItems(list);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [base]);

  useEffect(() => {
    if (loading || paused || items.length === 0) return;
    const ITEM_W = 92;
    const total = items.length * ITEM_W;
    const tick = () => {
      posRef.current = (posRef.current + 0.5) % total;
      scrollRef.current?.scrollTo({ x: posRef.current, animated: false });
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => frameRef.current && cancelAnimationFrame(frameRef.current);
  }, [loading, paused, items]);

  const doubled = [...items, ...items];

  return (
    <>
      <View style={{ marginHorizontal:20, borderRadius:14, overflow:"hidden", borderWidth:0.5, borderColor:isDark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.06)", backgroundColor:isDark?"#1C1C1E":"#fff" }}>
        <View style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between", paddingHorizontal:12, paddingVertical:7, borderBottomWidth:0.5, borderBottomColor:isDark?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.04)" }}>
          <View style={{ flexDirection:"row", alignItems:"center", gap:6 }}>
            <View style={{ width:6, height:6, borderRadius:3, backgroundColor:loading?"#FF9F0A":"#00C48C" }} />
            <Text style={{ fontSize:10, fontWeight:"500", color:c.textSecondary, letterSpacing:0.5 }}>
              {loading ? "FETCHING RATES..." : `LIVE · 1 ${base} =`}
            </Text>
          </View>
          <Text style={{ fontSize:10, color:c.textMuted }}>Tap to convert</Text>
        </View>
        {loading ? (
          <View style={{ height:52, alignItems:"center", justifyContent:"center" }}>
            <Text style={{ fontSize:12, color:c.textSecondary }}>Loading live rates...</Text>
          </View>
        ) : (
          <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false}
            onTouchStart={()=>setPaused(true)} onTouchEnd={()=>setPaused(false)}
            scrollEventThrottle={16} style={{ height:52 }}
            contentContainerStyle={{ alignItems:"center" }}>
            {doubled.map((item, i) => (
              <TouchableOpacity key={`${item.code}-${i}`} onPress={()=>setSelected(item)}
                style={{ width:88, alignItems:"center", paddingVertical:6, paddingHorizontal:2 }}>
                <View style={{ flexDirection:"row", alignItems:"center", gap:3, marginBottom:2 }}>
                  <Text style={{ fontSize:11 }}>{item.flag}</Text>
                  <Text style={{ fontSize:10, fontWeight:"600", color:c.textPrimary }}>{item.code}</Text>
                  <Text style={{ fontSize:8, color:item.change>=0?"#00C48C":"#FF453A" }}>
                    {item.change>=0?"▲":"▼"}
                  </Text>
                </View>
                <Text style={{ fontSize:12, fontWeight:"500", color:isDark?"#7B6FFF":"#6D5DFC", letterSpacing:-0.3 }}>
                  {item.symbol}{item.rate >= 1 ? item.rate.toFixed(2) : item.rate.toFixed(4)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
      {selected && <CurrencySheet item={selected} base={base} baseSymbol={baseInfo.symbol} onClose={()=>setSelected(null)} />}
    </>
  );
}
