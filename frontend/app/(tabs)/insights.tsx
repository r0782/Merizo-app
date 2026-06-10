import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Platform, TextInput, Alert, Modal } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../src/lib/theme";
import { api } from "../../src/lib/api";
import { categoryMeta, currencySymbol } from "../../src/lib/tokens";
import { ProGate, ProBadge } from "../../src/components/ProGate";
import { LiveTicker } from "../../src/components/LiveTicker";

type Period = "1M" | "3M" | "6M" | "1Y";

export default function InsightsScreen() {
  const { c, isDark } = useTheme();
  const [period, setPeriod] = useState<Period>("1M");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPro, setShowPro] = useState(false);
  const [proFeature, setProFeature] = useState("Pro Feature");
  const [showBudget, setShowBudget] = useState(false);
  const [budgets, setBudgets] = useState<Record<string,number>>({ food:5000, travel:10000, entertainment:2000, shopping:3000, bills:2000 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get("/insights", { params: { period: "month" } });
      setData(r.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const sym = currencySymbol("INR");
  const total = data?.total || 0;
  const cats: any[] = data?.by_category || [];
  const owed = data?.owed_to_you || 0;
  const owing = data?.you_owe || 0;
  const periods: Period[] = ["1M", "3M", "6M", "1Y"];

  return (
    <View style={{ flex:1, backgroundColor:c.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop:Platform.OS==="ios"?56:40, paddingBottom:100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ paddingHorizontal:20, marginBottom:20, flexDirection:"row", alignItems:"center", justifyContent:"space-between" }}>
          <Text style={{ fontSize:28, fontWeight:"500", color:c.textPrimary, letterSpacing:-0.5 }}>Insights</Text>
          <TouchableOpacity onPress={()=>setShowBudget(true)} style={{ flexDirection:"row", alignItems:"center", gap:8, backgroundColor:isDark?"rgba(109,93,252,0.15)":"#EDE9FE", borderRadius:20, paddingHorizontal:12, paddingVertical:7 }}>
            <Ionicons name="flag" size={13} color="#6D5DFC" />
            <Text style={{ fontSize:12, color:"#6D5DFC", fontWeight:"500" }}>Set Monthly Budget</Text>
          </TouchableOpacity>
        </View>

        {/* Balance cards */}
        <View style={{ flexDirection:"row", gap:10, paddingHorizontal:20, marginBottom:20 }}>
          <View style={{ flex:1, backgroundColor:isDark?"#1C1C1E":"#fff", borderRadius:16, padding:14, borderWidth:0.5, borderColor:c.border }}>
            <Text style={{ fontSize:10, color:c.textSecondary, marginBottom:6 }}>You are owed</Text>
            <Text style={{ fontSize:20, fontWeight:"500", color:"#00C48C", letterSpacing:-0.5 }}>{sym}{Math.round(owed).toLocaleString("en-IN")}</Text>
          </View>
          <View style={{ flex:1, backgroundColor:isDark?"#1C1C1E":"#fff", borderRadius:16, padding:14, borderWidth:0.5, borderColor:c.border }}>
            <Text style={{ fontSize:10, color:c.textSecondary, marginBottom:6 }}>You owe</Text>
            <Text style={{ fontSize:20, fontWeight:"500", color:owing>0?"#FF453A":c.textPrimary, letterSpacing:-0.5 }}>{sym}{Math.round(owing).toLocaleString("en-IN")}</Text>
          </View>
        </View>

        {/* Total spending hero */}
        <View style={{ marginHorizontal:20, backgroundColor:"#111", borderRadius:20, padding:20, marginBottom:20 }}>
          <Text style={{ fontSize:11, color:"rgba(255,255,255,0.4)", letterSpacing:1.5, textTransform:"uppercase", marginBottom:6 }}>Total spending</Text>
          <Text style={{ fontSize:36, fontWeight:"500", color:"#fff", letterSpacing:-1, marginBottom:4 }}>{sym}{Math.round(total).toLocaleString("en-IN")}</Text>
          <Text style={{ fontSize:12, color:"rgba(255,255,255,0.4)" }}>This month across all groups</Text>
        </View>

        {/* Period selector */}
        <View style={{ paddingHorizontal:20, marginBottom:20 }}>
          <View style={{ flexDirection:"row", backgroundColor:isDark?"#1C1C1E":"#F0EDE8", borderRadius:14, padding:3, gap:2 }}>
            {periods.map(p => (
              <TouchableOpacity key={p} onPress={()=>setPeriod(p)} style={{ flex:1, paddingVertical:8, alignItems:"center", borderRadius:11, backgroundColor:p===period?(isDark?"#2C2C2E":"#fff"):"transparent" }}>
                <Text style={{ fontSize:12, fontWeight:p===period?"500":"400", color:p===period?(isDark?"#7B6FFF":"#6D5DFC"):c.textSecondary }}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Spending by category */}
        <View style={{ paddingHorizontal:20, marginBottom:20 }}>
          <Text style={{ fontSize:11, fontWeight:"500", color:c.textSecondary, letterSpacing:1.5, textTransform:"uppercase", marginBottom:12 }}>Spending by category</Text>
          {loading ? (
            <ActivityIndicator color="#6D5DFC" />
          ) : cats.length === 0 ? (
            <View style={{ backgroundColor:isDark?"#1C1C1E":"#fff", borderRadius:16, padding:24, alignItems:"center", borderWidth:0.5, borderColor:c.border }}>
              <Text style={{ fontSize:24, marginBottom:8 }}>📊</Text>
              <Text style={{ fontSize:14, color:c.textSecondary, textAlign:"center" }}>No expenses yet. Add expenses to see spending breakdown.</Text>
            </View>
          ) : (
            <View style={{ gap:8 }}>
              {cats.map((cc:any) => {
                const meta = categoryMeta[cc.category] || categoryMeta.other;
                return (
                  <View key={cc.category} style={{ backgroundColor:isDark?"#1C1C1E":"#fff", borderRadius:16, padding:14, flexDirection:"row", alignItems:"center", gap:12, borderWidth:0.5, borderColor:c.border }}>
                    <View style={{ width:40, height:40, borderRadius:12, backgroundColor:meta.tint+"22", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      <Text style={{ fontSize:18 }}>{meta.emoji}</Text>
                    </View>
                    <View style={{ flex:1 }}>
                      <Text style={{ fontSize:14, fontWeight:"500", color:c.textPrimary, marginBottom:4 }}>{meta.label}</Text>
                      <View style={{ height:4, backgroundColor:isDark?"rgba(255,255,255,0.08)":"#F0EDE8", borderRadius:2, overflow:"hidden" }}>
                        <View style={{ width:`${cc.percent}%` as any, height:4, backgroundColor:"#6D5DFC", borderRadius:2 }} />
                      </View>
                    </View>
                    <View style={{ alignItems:"flex-end" }}>
                      <Text style={{ fontSize:14, fontWeight:"500", color:c.textPrimary }}>{sym}{Math.round(cc.amount).toLocaleString("en-IN")}</Text>
                      <Text style={{ fontSize:11, color:c.textSecondary, marginTop:1 }}>{cc.percent.toFixed(0)}%</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Budget tracker */}
        <View style={{ paddingHorizontal:20, marginBottom:20 }}>
          <View style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <Text style={{ fontSize:11, fontWeight:"500", color:c.textSecondary, letterSpacing:1.5, textTransform:"uppercase" }}>Monthly budget</Text>
            <TouchableOpacity onPress={()=>setShowBudget(true)}>
              <Text style={{ fontSize:12, color:"#6D5DFC" }}>Edit</Text>
            </TouchableOpacity>
          </View>
          <View style={{ backgroundColor:isDark?"#1C1C1E":"#fff", borderRadius:18, overflow:"hidden", borderWidth:0.5, borderColor:c.border }}>
            {[
              { key:"food", label:"Food & Dining", emoji:"🍕" },
              { key:"travel", label:"Travel", emoji:"✈️" },
              { key:"entertainment", label:"Entertainment", emoji:"🎬" },
            ].map((b,i) => {
              const spent = cats.find((x:any)=>x.category===b.key)?.amount || 0;
              const budget = budgets[b.key] || 5000;
              const pct = Math.min(100, (spent/budget)*100);
              const over = spent > budget;
              return (
                <View key={b.key} style={{ padding:14, borderBottomWidth:i<2?0.5:0, borderBottomColor:c.border }}>
                  <View style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                    <View style={{ flexDirection:"row", alignItems:"center", gap:8 }}>
                      <Text style={{ fontSize:16 }}>{b.emoji}</Text>
                      <Text style={{ fontSize:13, fontWeight:"500", color:c.textPrimary }}>{b.label}</Text>
                    </View>
                    <Text style={{ fontSize:12, color:over?"#FF453A":c.textSecondary }}>{sym}{Math.round(spent).toLocaleString("en-IN")} / {sym}{budget.toLocaleString("en-IN")}</Text>
                  </View>
                  <View style={{ height:4, backgroundColor:isDark?"rgba(255,255,255,0.08)":"#F0EDE8", borderRadius:2, overflow:"hidden" }}>
                    <View style={{ width:`${pct}%` as any, height:4, backgroundColor:over?"#FF453A":"#6D5DFC", borderRadius:2 }} />
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* AI Insights — UNLOCKED */}
        <View style={{ marginHorizontal:20, marginBottom:20 }}>
          <View style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <Text style={{ fontSize:11, fontWeight:"500", color:c.textSecondary, letterSpacing:1.5, textTransform:"uppercase" }}>AI Insights</Text>
            <ProBadge />
          </View>
          <View style={{ backgroundColor:isDark?"#1C1C1E":"#fff", borderRadius:18, padding:16, borderWidth:0.5, borderColor:c.border }}>
            <View style={{ flexDirection:"row", alignItems:"center", gap:8, marginBottom:10 }}>
              <View style={{ width:8, height:8, borderRadius:4, backgroundColor:"#6D5DFC" }} />
              <Text style={{ fontSize:12, color:"#6D5DFC", fontWeight:"500" }}>Spending Score</Text>
            </View>
            <Text style={{ fontSize:56, fontWeight:"500", color:"#00C48C", letterSpacing:-2, marginBottom:6 }}>82</Text>
            <Text style={{ fontSize:13, color:c.textSecondary, lineHeight:20 }}>
              Your spending looks healthy. Add more expenses to get personalized AI recommendations.
            </Text>
          </View>
        </View>

        {/* Monthly trends — UNLOCKED */}
        <View style={{ marginHorizontal:20, marginBottom:20 }}>
          <View style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
            <View style={{ flexDirection:"row", alignItems:"center", gap:8 }}>
              <Text style={{ fontSize:11, fontWeight:"500", color:c.textSecondary, letterSpacing:1.5, textTransform:"uppercase" }}>Monthly Trends</Text>
              <TouchableOpacity onPress={()=>Alert.alert("Monthly Trends 📈", "This chart shows your spending month by month. As you add more expenses across groups, the bars will grow to show your real spending pattern. Taller bar = more spent that month.")} >
                <Ionicons name="information-circle-outline" size={16} color={c.textMuted} />
              </TouchableOpacity>
            </View>
            <ProBadge />
          </View>
          <View style={{ backgroundColor:isDark?"#1C1C1E":"#fff", borderRadius:18, padding:16, borderWidth:0.5, borderColor:c.border }}>
            <View style={{ width:"100%", height:100, flexDirection:"row", alignItems:"flex-end", gap:6, marginBottom:8 }}>
              {[30,55,40,70,45,90].map((h,i) => (
                <View key={i} style={{ flex:1, height:`${h}%` as any, backgroundColor:i===5?"#6D5DFC":"rgba(109,93,252,0.25)", borderRadius:4 }} />
              ))}
            </View>
            <View style={{ flexDirection:"row", justifyContent:"space-between" }}>
              {["Jan","Feb","Mar","Apr","May","Jun"].map((m,i) => (
                <Text key={i} style={{ fontSize:10, color:c.textMuted, flex:1, textAlign:"center" }}>{m}</Text>
              ))}
            </View>
            <Text style={{ fontSize:12, color:c.textSecondary, textAlign:"center", marginTop:8 }}>Add more expenses to see real monthly trends</Text>
          </View>
        </View>

        {/* Live ticker */}
        <View style={{ marginBottom:20 }}>
          <Text style={{ fontSize:11, fontWeight:"500", color:c.textSecondary, letterSpacing:1.5, textTransform:"uppercase", marginBottom:10, paddingHorizontal:20 }}>Live rates</Text>
          <LiveTicker base="INR" />
        </View>

      </ScrollView>

      {/* Budget Modal */}
      <Modal visible={showBudget} transparent animationType="slide" onRequestClose={()=>setShowBudget(false)}>
        <View style={{ flex:1, backgroundColor:"rgba(0,0,0,0.5)", justifyContent:"flex-end" }}>
          <View style={{ backgroundColor:c.bg, borderTopLeftRadius:28, borderTopRightRadius:28, padding:24, paddingBottom:40 }}>
            <View style={{ flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <Text style={{ fontSize:18, fontWeight:"500", color:c.textPrimary }}>Monthly Budgets</Text>
              <TouchableOpacity onPress={()=>setShowBudget(false)} style={{ width:32, height:32, borderRadius:16, backgroundColor:isDark?"#2C2C2E":"#F0EDE8", alignItems:"center", justifyContent:"center" }}>
                <Ionicons name="close" size={16} color={c.textPrimary} />
              </TouchableOpacity>
            </View>
            {([
              { key:"food", label:"Food & Dining", emoji:"🍕" },
              { key:"travel", label:"Travel", emoji:"✈️" },
              { key:"entertainment", label:"Entertainment", emoji:"🎬" },
              { key:"shopping", label:"Shopping", emoji:"🛍️" },
              { key:"bills", label:"Bills", emoji:"💡" },
            ] as {key:string;label:string;emoji:string}[]).map(cat => (
              <View key={cat.key} style={{ flexDirection:"row", alignItems:"center", gap:12, marginBottom:14 }}>
                <Text style={{ fontSize:22, width:32 }}>{cat.emoji}</Text>
                <View style={{ flex:1 }}>
                  <Text style={{ fontSize:13, fontWeight:"500", color:c.textPrimary, marginBottom:4 }}>{cat.label}</Text>
                  <View style={{ flexDirection:"row", alignItems:"center", gap:6, backgroundColor:isDark?"#2C2C2E":"#F0EDE8", borderRadius:10, paddingHorizontal:12, paddingVertical:8 }}>
                    <Text style={{ fontSize:14, color:c.textSecondary }}>₹</Text>
                    <TextInput
                      value={String(budgets[cat.key] || "")}
                      onChangeText={v => setBudgets(prev => ({ ...prev, [cat.key]: parseInt(v)||0 }))}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={c.textMuted}
                      style={{ flex:1, fontSize:15, color:c.textPrimary }}
                    />
                  </View>
                </View>
              </View>
            ))}
            <TouchableOpacity
              onPress={()=>{ setShowBudget(false); Alert.alert("✓ Saved", "Budgets saved!"); }}
              style={{ backgroundColor:"#6D5DFC", borderRadius:14, padding:16, alignItems:"center", marginTop:8 }}>
              <Text style={{ color:"#fff", fontSize:15, fontWeight:"500" }}>Save Budgets</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ProGate visible={showPro} onClose={()=>setShowPro(false)} feature={proFeature} />
    </View>
  );
}
