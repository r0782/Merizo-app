import React, { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, Switch, Alert, Platform, Linking, TextInput } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../src/lib/theme";
import { useAuth } from "../../src/lib/auth";
import { api } from "../../src/lib/api";
import { currencySymbol } from "../../src/lib/tokens";
import { ProGate } from "../../src/components/ProGate";
import { useRouter } from "expo-router";

function SettingRow({ icon, label, sublabel, onPress, right, danger = false, c, isDark }: any) {
  return (
    <TouchableOpacity onPress={onPress} style={{ flexDirection:"row", alignItems:"center", gap:12, paddingVertical:13, paddingHorizontal:16 }}>
      <View style={{ width:34, height:34, borderRadius:10, backgroundColor:danger?"rgba(255,67,58,0.1)":"rgba(109,93,252,0.08)", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
        <Ionicons name={icon} size={17} color={danger?"#FF453A":"#6D5DFC"} />
      </View>
      <View style={{ flex:1 }}>
        <Text style={{ fontSize:14, fontWeight:"500", color:danger?"#FF453A":c.textPrimary }}>{label}</Text>
        {sublabel && <Text style={{ fontSize:12, color:c.textSecondary, marginTop:1 }}>{sublabel}</Text>}
      </View>
      {right || <Ionicons name="chevron-forward" size={16} color={c.textMuted} />}
    </TouchableOpacity>
  );
}

function Section({ title, children, c }: any) {
  return (
    <View style={{ marginHorizontal:20, marginBottom:20 }}>
      <Text style={{ fontSize:11, fontWeight:"600", color:c.textSecondary, letterSpacing:1.5, textTransform:"uppercase", marginBottom:8, paddingHorizontal:4 }}>{title}</Text>
      <View style={{ backgroundColor:c.surface, borderRadius:16, overflow:"hidden", borderWidth:0.5, borderColor:c.border }}>
        {children}
      </View>
    </View>
  );
}

function Divider({ c }: any) {
  return <View style={{ height:0.5, backgroundColor:c.border, marginLeft:62 }} />;
}

export default function ProfileScreen() {
  const { c, isDark, toggle } = useTheme();
  const { user, logout } = useAuth();
  const [stats, setStats] = useState({ count:0, settled:0 });
  const [overbudget, setOverbudget] = useState(true);
  const [showPro, setShowPro] = useState(false);
  const router = useRouter();
  const [upi, setUpi] = useState("");
  const [editUpi, setEditUpi] = useState(false);

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
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: logout }
    ]);
  };

  const onDeleteAccount = () => {
    Alert.alert("Delete account", "This will permanently delete your account and all data. This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => Alert.alert("Contact support", "Please email support@merizo.app to delete your account.") }
    ]);
  };

  const onClearData = () => {
    Alert.alert("Clear all data", "This will delete all your groups and expenses. Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: () => Alert.alert("Cleared", "All data has been cleared.") }
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
          <TouchableOpacity style={{ width:34, height:34, borderRadius:10, backgroundColor:isDark?"#2C2C2E":"#F0EDE8", alignItems:"center", justifyContent:"center" }}>
            <Ionicons name="pencil" size={15} color={c.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={{ flexDirection:"row", gap:10, paddingHorizontal:20, marginBottom:20 }}>
          {[
            { label:"SPLITS", value:String(stats.count) },
            { label:"TOTAL SPENT", value:`${sym}${stats.settled.toLocaleString("en-IN")}` },
            { label:"ACTIVE", value:String(stats.count) },
          ].map((s,i) => (
            <View key={i} style={{ flex:1, backgroundColor:isDark?"#1C1C1E":"#fff", borderRadius:14, padding:12, borderWidth:0.5, borderColor:c.border }}>
              <Text style={{ fontSize:9, fontWeight:"600", color:c.textSecondary, letterSpacing:1, marginBottom:4 }}>{s.label}</Text>
              <Text style={{ fontSize:i===1?15:18, fontWeight:"500", color:i===1?"#6D5DFC":c.textPrimary, letterSpacing:-0.3 }} numberOfLines={1} adjustsFontSizeToFit>{s.value}</Text>
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
        <Section title="Appearance" c={c}>
          <View style={{ padding:16 }}>
            <View style={{ flexDirection:"row", backgroundColor:isDark?"#2C2C2E":"#F0EDE8", borderRadius:12, padding:3, gap:2 }}>
              <TouchableOpacity onPress={()=>isDark&&toggle()} style={{ flex:1, paddingVertical:9, alignItems:"center", borderRadius:9, backgroundColor:!isDark?(isDark?"#2C2C2E":"#fff"):"transparent" }}>
                <Text style={{ fontSize:13, fontWeight:!isDark?"500":"400", color:!isDark?"#6D5DFC":c.textSecondary }}>☀️ Light</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={()=>!isDark&&toggle()} style={{ flex:1, paddingVertical:9, alignItems:"center", borderRadius:9, backgroundColor:isDark?"#1C1C1E":"transparent" }}>
                <Text style={{ fontSize:13, fontWeight:isDark?"500":"400", color:isDark?"#7B6FFF":c.textSecondary }}>🌙 Dark</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Section>

        {/* Preferences */}
        <Section title="Preferences" c={c}>
          <SettingRow icon="card" label="Default Currency" sublabel="₹ INR" c={c} isDark={isDark} />
          <Divider c={c} />
          <SettingRow icon="globe" label="Language" sublabel="English" c={c} isDark={isDark} />
          <Divider c={c} />
          <SettingRow icon="phone-portrait" label="Haptic Feedback" sublabel="Vibration on interactions" c={c} isDark={isDark}
            right={<Switch value={true} onValueChange={()=>{}} trackColor={{true:"#6D5DFC"}} />}
          />
          <Divider c={c} />
          <SettingRow icon="notifications" label="Notifications" sublabel="Expense reminders" c={c} isDark={isDark}
            right={<Switch value={overbudget} onValueChange={setOverbudget} trackColor={{true:"#6D5DFC"}} />}
          />
          <Divider c={c} />
          <SettingRow icon="lock-closed" label="App Lock" sublabel="Face ID, fingerprint, or passcode" c={c} isDark={isDark}
            right={<Switch value={false} onValueChange={()=>{}} trackColor={{true:"#6D5DFC"}} />}
          />
        </Section>

        {/* UPI */}
        <Section title="Payment" c={c}>
          <View style={{ padding:16 }}>
            <View style={{ flexDirection:"row", alignItems:"center", gap:10, marginBottom:10 }}>
              <View style={{ width:34, height:34, borderRadius:10, backgroundColor:"rgba(109,93,252,0.08)", alignItems:"center", justifyContent:"center" }}>
                <Ionicons name="phone-portrait" size={17} color="#6D5DFC" />
              </View>
              <View>
                <Text style={{ fontSize:14, fontWeight:"500", color:c.textPrimary }}>UPI Payment ID</Text>
                <Text style={{ fontSize:12, color:c.textSecondary }}>Others pay you instantly with one tap</Text>
              </View>
            </View>
            <View style={{ flexDirection:"row", gap:8 }}>
              <TextInput value={upi} onChangeText={setUpi} placeholder="yourname@upi or phone@paytm" placeholderTextColor={c.textMuted}
                style={{ flex:1, backgroundColor:isDark?"#2C2C2E":"#F0EDE8", borderRadius:10, paddingHorizontal:12, paddingVertical:10, fontSize:13, color:c.textPrimary }} />
              <TouchableOpacity onPress={()=>Alert.alert("Saved","UPI ID saved!")} style={{ backgroundColor:"#6D5DFC", borderRadius:10, paddingHorizontal:16, alignItems:"center", justifyContent:"center" }}>
                <Text style={{ color:"#fff", fontSize:13, fontWeight:"500" }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Section>

        {/* Features */}
        <Section title="Features" c={c}>
          <SettingRow icon="bar-chart" label="Spending Analytics" sublabel="View charts and graphs" onPress={()=>setShowPro(true)} c={c} isDark={isDark} />
          <Divider c={c} />
          <SettingRow icon="repeat" label="Recurring Expenses" sublabel="Set up automatic expense tracking" onPress={()=>router.push("/recurring")} c={c} isDark={isDark} />
        </Section>

        {/* Support */}
        <Section title="Support" c={c}>
          <SettingRow icon="help-circle" label="Help & FAQ" sublabel="Get answers to common questions" onPress={()=>Linking.openURL("https://merizo-app.onrender.com")} c={c} isDark={isDark} />
          <Divider c={c} />
          <SettingRow icon="chatbubble" label="Contact Us" sublabel="support@merizo.app" onPress={()=>Linking.openURL("mailto:support@merizo.app")} c={c} isDark={isDark} />
        </Section>

        {/* Data */}
        <Section title="Data" c={c}>
          <SettingRow icon="download" label="Export Data" sublabel="Download your expense history" onPress={()=>setShowPro(true)} c={c} isDark={isDark} />
          <Divider c={c} />
          <SettingRow icon="cloud-upload" label="Cloud Sync" sublabel="Enabled" c={c} isDark={isDark} right={<View style={{flexDirection:"row",alignItems:"center",gap:4}}><View style={{width:6,height:6,borderRadius:3,backgroundColor:"#00C48C"}}/><Text style={{fontSize:12,color:"#00C48C"}}>On</Text></View>} />
          <Divider c={c} />
          <SettingRow icon="trash" label="Clear All Data" sublabel="Delete all groups and expenses" onPress={onClearData} c={c} isDark={isDark} danger />
        </Section>

        {/* Included features */}
        <View style={{ marginHorizontal:20, marginBottom:20 }}>
          <Text style={{ fontSize:11, fontWeight:"600", color:c.textSecondary, letterSpacing:1.5, textTransform:"uppercase", marginBottom:10 }}>Included Features</Text>
          <View style={{ flexDirection:"row", flexWrap:"wrap", gap:8 }}>
            {["Unlimited Groups","Unlimited Expenses","100+ Currencies","7+ Languages","Offline Mode","Ad-Free","Charts & Graphs","Split by %/Shares","Categories","Recurring Expenses"].map((f,i)=>(
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

      <ProGate visible={showPro} onClose={()=>setShowPro(false)} feature="Pro Features" />
    </View>
  );
}
