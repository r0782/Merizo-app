import React, { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Platform, TextInput, Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../src/lib/theme";
import { api } from "../../src/lib/api";
import { categoryMeta, currencySymbol } from "../../src/lib/tokens";
import { ProGate, ProBadge } from "../../src/components/ProGate";
import { LiveTicker } from "../../src/components/LiveTicker";
import { CurrencyRateCard } from "../../src/components/CurrencyConverter";

type Period = "1M" | "3M" | "6M" | "1Y";

export default function InsightsScreen() {
  const { c, isDark } = useTheme();
  const [period, setPeriod] = useState<Period>("1M");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPro, setShowPro] = useState(false);
  const [showBudget, setShowBudget] = useState(false);
  const [budgets, setBudgets] = useState<Record<string,number>>({ food:5000, travel:10000, entertainment:2000 });
  const [editBudget, setEditBudget] = useState<string|null>(null);
  const [proFeature, setProFeature] = useState("AI Insights");

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

  const openPro = (feature: string) => { setProFeature(feature); setShowPro(true); };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: Platform.OS === "ios" ? 56 : 40, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 28, fontWeight: "500", color: c.textPrimary, letterSpacing: -0.5 }}>Insights</Text>
          <TouchableOpacity onPress={()=>setShowBudget(true)} style={{ padding:16, flexDirection:"row", alignItems:"center", gap:12 }}>
              <View style={{ width:40, height:40, borderRadius:12, backgroundColor:"rgba(109,93,252,0.1)", alignItems:"center", justifyContent:"center" }}>
                <Ionicons name="flag" size={18} color="#6D5DFC" />
              </View>
              <View style={{ flex:1 }}>
                <Text style={{ fontSize:14, fontWeight:"500", color:c.textPrimary }}>Set Monthly Budget</Text>
                <Text style={{ fontSize:12, color:c.textSecondary }}>Tap to edit spending limits</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
            </TouchableOpacity>
        </View>

        {/* Monthly graph — PRO locked */}
        <View style={{ marginHorizontal: 20, marginBottom: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: "500", color: c.textSecondary, letterSpacing: 1.5, textTransform: "uppercase" }}>Monthly trends</Text>
            <ProBadge />
          </View>
          <TouchableOpacity onPress={() => openPro("Monthly Trends")} activeOpacity={0.9}>
            <View style={{ backgroundColor: isDark ? "#1C1C1E" : "#fff", borderRadius: 18, padding: 16, borderWidth: 0.5, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)", alignItems: "center" }}>
              <View style={{ opacity: 0.15, width: "100%", height: 100, flexDirection: "row", alignItems: "flex-end", gap: 6, marginBottom: 8 }}>
                {[30,55,40,70,45,90].map((h,i) => (
                  <View key={i} style={{ flex: 1, height: `${h}%` as any, backgroundColor: "#6D5DFC", borderRadius: 4 }} />
                ))}
              </View>
              <Ionicons name="lock-closed" size={20} color="#6D5DFC" />
              <Text style={{ fontSize: 13, color: c.textSecondary, marginTop: 6 }}>Upgrade to see monthly trends</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

        {/* Live exchange rates */}
        <View style={{ marginHorizontal:20, marginBottom:20 }}>
          <Text style={{ fontSize:11, fontWeight:"500", color:c.textSecondary, letterSpacing:1.5, textTransform:"uppercase", marginBottom:12 }}>Live exchange rates</Text>
          <CurrencyRateCard base="INR" />
        </View>


      {/* Budget Modal */}
      {showBudget && (
        <View style={{ position:"absolute", top:0, left:0, right:0, bottom:0, backgroundColor:"rgba(0,0,0,0.5)", justifyContent:"flex-end", zIndex:100 }}>
          <View style={{ backgroundColor:c.bg, borderTopLeftRadius:28, borderTopRightRadius:28, padding:24, paddingBottom:40 }}>
            <View style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
              <Text style={{ fontSize:18, fontWeight:"500", color:c.textPrimary }}>Monthly Budgets</Text>
              <TouchableOpacity onPress={()=>setShowBudget(false)} style={{ width:32, height:32, borderRadius:16, backgroundColor:isDark?"#2C2C2E":"#F0EDE8", alignItems:"center", justifyContent:"center" }}>
                <Ionicons name="close" size={16} color={c.textPrimary} />
              </TouchableOpacity>
            </View>
            {[
              { key:"food", label:"Food & Dining", emoji:"🍕" },
              { key:"travel", label:"Travel", emoji:"✈️" },
              { key:"entertainment", label:"Entertainment", emoji:"🎬" },
              { key:"shopping", label:"Shopping", emoji:"🛍️" },
              { key:"bills", label:"Bills", emoji:"💡" },
            ].map(cat => (
              <View key={cat.key} style={{ flexDirection:"row", alignItems:"center", gap:12, marginBottom:14 }}>
                <Text style={{ fontSize:22, width:36 }}>{cat.emoji}</Text>
                <View style={{ flex:1 }}>
                  <Text style={{ fontSize:13, fontWeight:"500", color:c.textPrimary, marginBottom:4 }}>{cat.label}</Text>
                  <View style={{ flexDirection:"row", alignItems:"center", gap:8 }}>
                    <Text style={{ fontSize:14, color:c.textSecondary }}>₹</Text>
                    <TextInput
                      value={String(budgets[cat.key] || "")}
                      onChangeText={v => setBudgets(prev => ({ ...prev, [cat.key]: parseInt(v)||0 }))}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={c.textMuted}
                      style={{ flex:1, backgroundColor:isDark?"#2C2C2E":"#F0EDE8", borderRadius:10, paddingHorizontal:12, paddingVertical:8, fontSize:14, color:c.textPrimary }}
                    />
                  </View>
                </View>
              </View>
            ))}
            <TouchableOpacity
              onPress={()=>{ setShowBudget(false); Alert.alert("Saved", "Monthly budgets saved!"); }}
              style={{ backgroundColor:"#6D5DFC", borderRadius:14, padding:16, alignItems:"center", marginTop:8 }}
            >
              <Text style={{ color:"#fff", fontSize:15, fontWeight:"500" }}>Save budgets</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
        <View style={{ marginBottom:20 }}>
          <Text style={{ fontSize:11, fontWeight:"500", color:c.textSecondary, letterSpacing:1.5, textTransform:"uppercase", marginBottom:10, paddingHorizontal:20 }}>Live rates</Text>
          <LiveTicker base="INR" />
        </View>

      <ProGate visible={showPro} onClose={() => setShowPro(false)} feature={proFeature} />
    </View>
  );
}
