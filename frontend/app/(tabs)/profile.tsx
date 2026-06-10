import React, { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, Switch, Alert, Platform, Linking, Modal } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../src/lib/theme";
import { useEffect } from "react";
import { useAuth } from "../../src/lib/auth";
import { api } from "../../src/lib/api";
import { currencySymbol } from "../../src/lib/tokens";
import { ProGate } from "../../src/components/ProGate";

const CURRENCIES = ["INR","USD","EUR","GBP","AED","SGD","JPY","AUD","CAD","THB"];
const LANGUAGES = ["English","Hindi","Telugu","Tamil","Kannada","Malayalam","Marathi","Bengali","Gujarati"];

function Row({ icon, label, sub, onPress, right, danger=false, c, isDark }: any) {
  return (
    <TouchableOpacity onPress={onPress} style={{ flexDirection:"row", alignItems:"center", gap:12, paddingVertical:13, paddingHorizontal:16 }}>
      <View style={{ width:34, height:34, borderRadius:10, backgroundColor:danger?"rgba(255,67,58,0.1)":"rgba(109,93,252,0.08)", alignItems:"center", justifyContent:"center" }}>
        <Ionicons name={icon} size={17} color={danger?"#FF453A":"#6D5DFC"} />
      </View>
      <View style={{ flex:1 }}>
        <Text style={{ fontSize:14, fontWeight:"500", color:danger?"#FF453A":c.textPrimary }}>{label}</Text>
        {sub && <Text style={{ fontSize:12, color:c.textSecondary, marginTop:1 }}>{sub}</Text>}
      </View>
      {right !== undefined ? right : <Ionicons name="chevron-forward" size={16} color={c.textMuted} />}
    </TouchableOpacity>
  );
}

function Divider({ c }: any) {
  return <View style={{ height:0.5, backgroundColor:c.border, marginLeft:62 }} />;
}

function Section({ title, children, c }: any) {
  return (
    <View style={{ marginHorizontal:20, marginBottom:20 }}>
      <Text style={{ fontSize:11, fontWeight:"600", color:c.textSecondary, letterSpacing:1.5, textTransform:"uppercase", marginBottom:8, paddingHorizontal:4 }}>{title}</Text>
      <View style={{ backgroundColor:isDark?"#1C1C1E":"#fff", borderRadius:16, overflow:"hidden", borderWidth:0.5, borderColor:c.border }}>
        {children}
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const { c, isDark, toggle } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({ count:0, settled:0 });
  const [showPro, setShowPro] = useState(false);
  const [currency, setCurrency] = useState("INR");
  const [language, setLanguage] = useState("English");
  const [notifications, setNotifications] = useState(true);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);

  useFocusEffect(useCallback(() => {
    api.get("/trips").then(r => {
      const trips = r.data || [];
      let settled = 0;
      trips.forEach((t: any) => { settled += t.total_spent || 0; });
      setStats({ count: trips.length, settled: Math.round(settled) });
    }).catch(() => {});
  }, []));

  const initial = (user?.name || "U").trim().charAt(0).toUpperCase();
  const sym = currencySymbol("INR");

  const onSignOut = () => {
    Alert.alert("Sign out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: async () => { await logout(); router.replace("/login"); } }
    ]);
  };

  const onDeleteAccount = () => {
    Alert.alert("Delete account", "This will permanently delete your account and all data.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await logout(); router.replace("/login"); } }
    ]);
  };

  const onClearData = () => {
    Alert.alert("Clear all data", "This will delete all your groups and expenses.", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: () => Alert.alert("Done", "All data cleared.") }
    ]);
  };

  return (
    <View style={{ flex:1, backgroundColor:c.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop:Platform.OS==="ios"?56:40, paddingBottom:100 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{ paddingHorizontal:20, marginBottom:20, flexDirection:"row", alignItems:"center", justifyContent:"space-between" }}>
          <Text style={{ fontSize:28, fontWeight:"500", color:c.textPrimary, letterSpacing:-0.5 }}>Profile</Text>
          <TouchableOpacity onPress={toggle} style={{ width:36, height:36, borderRadius:18, backgroundColor:isDark?"#2C2C2E":"#F0EDE8", alignItems:"center", justifyContent:"center" }}>
            <Ionicons name={isDark?"sunny":"moon"} size={17} color={c.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* User card */}
        <View style={{ marginHorizontal:20, backgroundColor:isDark?"#1C1C1E":"#fff", borderRadius:20, padding:20, marginBottom:20, borderWidth:0.5, borderColor:c.border, flexDirection:"row", alignItems:"center", gap:14 }}>
          <View style={{ width:56, height:56, borderRadius:28, backgroundColor:"#111", alignItems:"center", justifyContent:"center" }}>
            <Text style={{ fontSize:22, fontWeight:"500", color:"#fff" }}>{initial}</Text>
          </View>
          <View style={{ flex:1 }}>
            <Text style={{ fontSize:18, fontWeight:"500", color:c.textPrimary, marginBottom:2 }}>{user?.name || "User"}</Text>
            <Text style={{ fontSize:13, color:c.textSecondary }}>{user?.email || ""}</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={{ flexDirection:"row", gap:10, paddingHorizontal:20, marginBottom:20 }}>
          {[
            { label:"GROUPS", value:String(stats.count) },
            { label:"TOTAL SPENT", value:`${sym}${stats.settled.toLocaleString("en-IN")}` },
            { label:"ACTIVE", value:String(stats.count) },
          ].map((s,i) => (
            <View key={i} style={{ flex:1, backgroundColor:isDark?"#1C1C1E":"#fff", borderRadius:14, padding:12, borderWidth:0.5, borderColor:c.border }}>
              <Text style={{ fontSize:9, fontWeight:"600", color:c.textSecondary, letterSpacing:1, marginBottom:4 }}>{s.label}</Text>
              <Text style={{ fontSize:i===1?13:18, fontWeight:"500", color:i===1?"#6D5DFC":c.textPrimary }} numberOfLines={1} adjustsFontSizeToFit>{s.value}</Text>
            </View>
          ))}
        </View>

        {/* Pro upgrade */}
        <TouchableOpacity onPress={()=>setShowPro(true)} style={{ marginHorizontal:20, marginBottom:20, backgroundColor:"#111", borderRadius:18, padding:18 }}>
          <View style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between" }}>
            <View>
              <View style={{ flexDirection:"row", alignItems:"center", gap:8, marginBottom:4 }}>
                <View style={{ backgroundColor:"#6D5DFC", borderRadius:6, paddingHorizontal:6, paddingVertical:2 }}>
                  <Text style={{ color:"#fff", fontSize:9, fontWeight:"700" }}>PRO</Text>
                </View>
                <Text style={{ color:"#fff", fontSize:14, fontWeight:"500" }}>Upgrade to Merizo Pro</Text>
              </View>
              <Text style={{ color:"rgba(255,255,255,0.4)", fontSize:12 }}>AI insights, graphs, exports · ₹299/mo</Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.4)" />
          </View>
        </TouchableOpacity>

        {/* Appearance */}
        <View style={{ marginHorizontal:20, marginBottom:20 }}>
          <Text style={{ fontSize:11, fontWeight:"600", color:c.textSecondary, letterSpacing:1.5, textTransform:"uppercase", marginBottom:8, paddingHorizontal:4 }}>Appearance</Text>
          <View style={{ backgroundColor:isDark?"#1C1C1E":"#fff", borderRadius:16, padding:16, borderWidth:0.5, borderColor:c.border }}>
            <View style={{ flexDirection:"row", backgroundColor:isDark?"#2C2C2E":"#F0EDE8", borderRadius:12, padding:3, gap:2 }}>
              <TouchableOpacity onPress={()=>isDark&&toggle()} style={{ flex:1, paddingVertical:9, alignItems:"center", borderRadius:9, backgroundColor:!isDark?"#fff":"transparent" }}>
                <Text style={{ fontSize:13, fontWeight:!isDark?"500":"400", color:!isDark?"#6D5DFC":c.textSecondary }}>☀️ Light</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={()=>!isDark&&toggle()} style={{ flex:1, paddingVertical:9, alignItems:"center", borderRadius:9, backgroundColor:isDark?"#1C1C1E":"transparent" }}>
                <Text style={{ fontSize:13, fontWeight:isDark?"500":"400", color:isDark?"#7B6FFF":c.textSecondary }}>🌙 Dark</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Preferences */}
        <View style={{ marginHorizontal:20, marginBottom:20 }}>
          <Text style={{ fontSize:11, fontWeight:"600", color:c.textSecondary, letterSpacing:1.5, textTransform:"uppercase", marginBottom:8, paddingHorizontal:4 }}>Preferences</Text>
          <View style={{ backgroundColor:isDark?"#1C1C1E":"#fff", borderRadius:16, overflow:"hidden", borderWidth:0.5, borderColor:c.border }}>
            <Row icon="card" label="Default Currency" sub={currency} onPress={()=>setShowCurrencyPicker(true)} c={c} isDark={isDark} />
            <Divider c={c} />
            <Row icon="globe" label="Language" sub={language} onPress={()=>setShowLangPicker(true)} c={c} isDark={isDark} />
            <Divider c={c} />
            <Row icon="notifications" label="Notifications" sub="Expense reminders" c={c} isDark={isDark}
              right={<Switch value={notifications} onValueChange={setNotifications} trackColor={{false:"#ccc",true:"#6D5DFC"}} />} />
          </View>
        </View>

        {/* Features */}
        <View style={{ marginHorizontal:20, marginBottom:20 }}>
          <Text style={{ fontSize:11, fontWeight:"600", color:c.textSecondary, letterSpacing:1.5, textTransform:"uppercase", marginBottom:8, paddingHorizontal:4 }}>Features</Text>
          <View style={{ backgroundColor:isDark?"#1C1C1E":"#fff", borderRadius:16, overflow:"hidden", borderWidth:0.5, borderColor:c.border }}>
            <Row icon="bar-chart" label="Spending Analytics" sub="View charts and graphs" onPress={()=>setShowPro(true)} c={c} isDark={isDark} />
            <Divider c={c} />
            <Row icon="repeat" label="Recurring Expenses" sub="Smart subscriptions" onPress={()=>router.push("/recurring")} c={c} isDark={isDark} />
          </View>
        </View>

        {/* Support */}
        <View style={{ marginHorizontal:20, marginBottom:20 }}>
          <Text style={{ fontSize:11, fontWeight:"600", color:c.textSecondary, letterSpacing:1.5, textTransform:"uppercase", marginBottom:8, paddingHorizontal:4 }}>Support</Text>
          <View style={{ backgroundColor:isDark?"#1C1C1E":"#fff", borderRadius:16, overflow:"hidden", borderWidth:0.5, borderColor:c.border }}>
            <Row icon="help-circle" label="Help & FAQ" sub="Common questions" onPress={()=>Linking.openURL("https://merizo-app.onrender.com")} c={c} isDark={isDark} />
            <Divider c={c} />
            <Row icon="chatbubble" label="Contact Us" sub="support@merizo.app" onPress={()=>Linking.openURL("mailto:support@merizo.app")} c={c} isDark={isDark} />
          </View>
        </View>

        {/* Data */}
        <View style={{ marginHorizontal:20, marginBottom:20 }}>
          <Text style={{ fontSize:11, fontWeight:"600", color:c.textSecondary, letterSpacing:1.5, textTransform:"uppercase", marginBottom:8, paddingHorizontal:4 }}>Data</Text>
          <View style={{ backgroundColor:isDark?"#1C1C1E":"#fff", borderRadius:16, overflow:"hidden", borderWidth:0.5, borderColor:c.border }}>
            <Row icon="download" label="Export Data" sub="Download expense history" onPress={()=>setShowPro(true)} c={c} isDark={isDark} />
            <Divider c={c} />
            <Row icon="trash" label="Clear All Data" sub="Delete all groups and expenses" onPress={onClearData} c={c} isDark={isDark} danger />
          </View>
        </View>

        {/* Included features */}
        <View style={{ marginHorizontal:20, marginBottom:20 }}>
          <Text style={{ fontSize:11, fontWeight:"600", color:c.textSecondary, letterSpacing:1.5, textTransform:"uppercase", marginBottom:10 }}>Included Features</Text>
          <View style={{ flexDirection:"row", flexWrap:"wrap", gap:8 }}>
            {["Unlimited Groups","Unlimited Expenses","100+ Currencies","7+ Languages","Offline Mode","Ad-Free","Split by %/Shares","Categories","Recurring Expenses"].map((f,i)=>(
              <View key={i} style={{ flexDirection:"row", alignItems:"center", gap:5 }}>
                <Ionicons name="checkmark" size={13} color="#00C48C" />
                <Text style={{ fontSize:12, color:c.textSecondary }}>{f}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Sign out / Delete */}
        <View style={{ paddingHorizontal:20, gap:10, marginBottom:20 }}>
          <TouchableOpacity onPress={onSignOut} style={{ borderRadius:14, padding:16, alignItems:"center", borderWidth:1.5, borderColor:"#FF453A" }}>
            <View style={{ flexDirection:"row", alignItems:"center", gap:8 }}>
              <Ionicons name="log-out" size={18} color="#FF453A" />
              <Text style={{ fontSize:15, fontWeight:"500", color:"#FF453A" }}>Sign Out</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDeleteAccount} style={{ borderRadius:14, padding:16, alignItems:"center", borderWidth:1.5, borderColor:"#FF453A" }}>
            <View style={{ flexDirection:"row", alignItems:"center", gap:8 }}>
              <Ionicons name="trash" size={18} color="#FF453A" />
              <Text style={{ fontSize:15, fontWeight:"500", color:"#FF453A" }}>Delete Account</Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={{ textAlign:"center", color:c.textMuted, fontSize:12, marginBottom:20 }}>Merizo AI · Made with ❤️</Text>
      </ScrollView>

      {/* Currency Picker Modal */}
      <Modal visible={showCurrencyPicker} transparent animationType="slide" onRequestClose={()=>setShowCurrencyPicker(false)}>
        <View style={{ flex:1, backgroundColor:"rgba(0,0,0,0.5)", justifyContent:"flex-end" }}>
          <View style={{ backgroundColor:c.bg, borderTopLeftRadius:24, borderTopRightRadius:24, padding:20, paddingBottom:40 }}>
            <Text style={{ fontSize:16, fontWeight:"500", color:c.textPrimary, marginBottom:16 }}>Select Currency</Text>
            {CURRENCIES.map(cur => (
              <TouchableOpacity key={cur} onPress={()=>{setCurrency(cur);setShowCurrencyPicker(false);}} style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between", paddingVertical:12, borderBottomWidth:0.5, borderBottomColor:c.border }}>
                <Text style={{ fontSize:15, color:c.textPrimary }}>{cur}</Text>
                {currency===cur && <Ionicons name="checkmark" size={18} color="#6D5DFC" />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Language Picker Modal */}
      <Modal visible={showLangPicker} transparent animationType="slide" onRequestClose={()=>setShowLangPicker(false)}>
        <View style={{ flex:1, backgroundColor:"rgba(0,0,0,0.5)", justifyContent:"flex-end" }}>
          <View style={{ backgroundColor:c.bg, borderTopLeftRadius:24, borderTopRightRadius:24, padding:20, paddingBottom:40 }}>
            <Text style={{ fontSize:16, fontWeight:"500", color:c.textPrimary, marginBottom:16 }}>Select Language</Text>
            {LANGUAGES.map(lang => (
              <TouchableOpacity key={lang} onPress={()=>{setLanguage(lang);setShowLangPicker(false);}} style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between", paddingVertical:12, borderBottomWidth:0.5, borderBottomColor:c.border }}>
                <Text style={{ fontSize:15, color:c.textPrimary }}>{lang}</Text>
                {language===lang && <Ionicons name="checkmark" size={18} color="#6D5DFC" />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      <ProGate visible={showPro} onClose={()=>setShowPro(false)} feature="Pro Features" />
    </View>
  );
}
