import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../src/lib/theme";
import { useAuth }  from "../src/lib/auth";
import { api }      from "../src/lib/api";
import { supabase } from "../src/lib/supabase";

const { width, height } = Dimensions.get("window");

type Screen = "main" | "email_otp" | "phone_otp" | "verify_email" | "verify_phone";

export default function LoginScreen() {
  const { c, isDark } = useTheme();
  const { login, loginWithToken } = useAuth();
  const router        = useRouter();

  const [screen,   setScreen]   = useState<Screen>("main");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [phone,    setPhone]    = useState("");
  const [otp,      setOtp]      = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);

  const bg      = isDark ? "#0F0D0A" : "#F5F2ED";
  const card    = isDark ? "#1C1814" : "#FFFFFF";
  const inp     = isDark ? "#231F1A" : "#FFFFFF";
  const border  = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
  const blob1   = isDark ? "rgba(255,255,255,0.03)" : "rgba(210,195,175,0.55)";
  const blob2   = isDark ? "rgba(255,255,255,0.02)" : "rgba(180,165,145,0.45)";
  const txt     = isDark ? "#F4E6D0" : "#1A1208";
  const sub     = isDark ? "#9A7B5E" : "#8C7A68";
  const accent  = isDark ? "#F4E6D0" : "#1A1208";

  // ── Password login ───────────────────────────────────────────────────────
  const demoLogin = async () => {
    setLoading(true);
    try {
      const r = await api.post("/auth/demo-login", {});
      await loginWithToken(r.data.access_token, r.data.user);
      router.replace("/(tabs)/home");
    } catch (e: any) {
      Alert.alert("Demo login failed", e?.message || "Try again");
    } finally { setLoading(false); }
  };

  const doLogin = async () => {
    if (!email.trim() || !password) { Alert.alert("Fill in all fields"); return; }
    setLoading(true);
    try {
      const r = await api.post("/auth/login", {
        email: email.trim().toLowerCase(), password,
      });
      await loginWithToken(r.data.access_token, r.data.user);
      router.replace("/(tabs)/home");
    } catch (e: any) {
      Alert.alert("Login failed", e?.response?.data?.detail || "Check your credentials");
    } finally { setLoading(false); }
  };

  // ── Send OTP ─────────────────────────────────────────────────────────────
  const sendEmailOtp = async () => {
    if (!email.trim()) { Alert.alert("Enter your email"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      setScreen("verify_email");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not send code");
    } finally { setLoading(false); }
  };

  const sendPhoneOtp = async () => {
    const raw = phone.replace(/\D/g, "");
    if (raw.length < 10) { Alert.alert("Enter a valid 10-digit number"); return; }
    const num = "+91" + raw.slice(-10);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: num });
      if (error) throw error;
      setScreen("verify_phone");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not send SMS");
    } finally { setLoading(false); }
  };

  // ── Verify OTP ───────────────────────────────────────────────────────────
  const verifyOtp = async (type: "email" | "phone") => {
    if (otp.length < 6) { Alert.alert("Enter the 6-digit code"); return; }
    setLoading(true);
    try {
      let session: any;
      if (type === "email") {
        const { data, error } = await supabase.auth.verifyOtp({
          email: email.trim().toLowerCase(), token: otp, type: "email",
        });
        if (error) throw error;
        session = data.session;
      } else {
        const num = "+91" + phone.replace(/\D/g,"").slice(-10);
        const { data, error } = await supabase.auth.verifyOtp({
          phone: num, token: otp, type: "sms",
        });
        if (error) throw error;
        session = data.session;
      }
      const r = await api.post("/auth/social-login", {
        supabase_token: session?.access_token,
        email: session?.user?.email || email,
        phone: session?.user?.phone || phone,
        name:  session?.user?.user_metadata?.full_name
             || session?.user?.email?.split("@")[0]
             || "User",
      });
      await loginWithToken(r.data.access_token, r.data.user);
      router.replace("/(tabs)/home");
    } catch (e: any) {
      Alert.alert("Invalid code", e?.message || "Try again");
    } finally { setLoading(false); }
  };

  // ── Google OAuth ─────────────────────────────────────────────────────────
  const doGoogle = async () => {
    setLoading(true);
    try {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: Platform.OS === "web" ? window.location.origin : "merizo://auth/callback" },
      });
    } catch (e: any) {
      Alert.alert("Google login failed", e?.message);
    } finally { setLoading(false); }
  };

  // ── Shared input style ───────────────────────────────────────────────────
  const InputRow = React.useCallback(({ icon, children }: { icon: string; children: React.ReactNode }) => (
    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: inp,
      borderRadius: 16, borderWidth: 1, borderColor: border,
      paddingHorizontal: 16, gap: 12, marginBottom: 12,
      shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width:0,height:2 }, elevation:2 }}>
      <Ionicons name={icon as any} size={18} color={sub} style={{ flexShrink:0 }}/>
      {children}
    </View>
  ), [inp, border, sub]);

  const PrimaryBtn = ({ onPress, label }: { onPress:()=>void; label:string }) => (
    <TouchableOpacity onPress={onPress} disabled={loading}
      style={{ backgroundColor: accent, borderRadius: 16, padding: 18, flexDirection: "row",
        alignItems: "center", justifyContent: "center", gap: 10, marginTop: 8,
        shadowColor: accent, shadowOpacity: 0.25, shadowRadius: 16, shadowOffset:{width:0,height:6}, elevation:6 }}>
      {loading
        ? <ActivityIndicator color={isDark?"#1A1208":"#FFF"}/>
        : <>
            <Text style={{ color: isDark ? "#1A1208" : "#FFF", fontSize: 16, fontWeight: "800" }}>{label}</Text>
            <Ionicons name="arrow-forward" size={18} color={isDark?"#1A1208":"#FFF"}/>
          </>
      }
    </TouchableOpacity>
  );

  // ── OTP verify screen ─────────────────────────────────────────────────────
  if (screen === "verify_email" || screen === "verify_phone") {
    const isEmail = screen === "verify_email";
    return (
      <View style={{ flex:1, backgroundColor:bg }}>
        <Blob1 color={blob1}/><Blob2 color={blob2}/>
        <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==="ios"?"padding":undefined}>
          <ScrollView contentContainerStyle={{flexGrow:1,padding:28,justifyContent:"center"}} keyboardShouldPersistTaps="always">
            <TouchableOpacity onPress={()=>{setScreen(isEmail?"email_otp":"phone_otp");setOtp("");}}
              style={{flexDirection:"row",alignItems:"center",gap:8,marginBottom:32}}>
              <Ionicons name="arrow-back" size={20} color={sub}/>
              <Text style={{color:sub,fontSize:14}}>Back</Text>
            </TouchableOpacity>

            <Logo card={card} txt={txt}/>
            <Text style={{color:txt,fontSize:28,fontWeight:"800",marginTop:24,marginBottom:8}}>Enter the code</Text>
            <Text style={{color:sub,fontSize:14,lineHeight:22,marginBottom:32}}>
              {isEmail ? "We sent a 6-digit code to\n"+email : "We sent a 6-digit SMS to +91 "+phone}
            </Text>

            <TextInput
              value={otp} onChangeText={v=>setOtp(v.replace(/\D/g,"").slice(0,6))}
              placeholder="• • • • • •" placeholderTextColor={sub}
              keyboardType="number-pad" maxLength={6}
              style={{backgroundColor:inp,borderRadius:16,borderWidth:1,borderColor:border,
                padding:20,fontSize:32,fontWeight:"800",color:txt,textAlign:"center",
                letterSpacing:16,marginBottom:16} as any}
            />

            <PrimaryBtn onPress={()=>verifyOtp(isEmail?"email":"phone")} label="Verify Code"/>

            <TouchableOpacity onPress={isEmail?sendEmailOtp:sendPhoneOtp}
              style={{alignItems:"center",paddingVertical:16,marginTop:4}}>
              <Text style={{color:sub,fontSize:14}}>Didn't get it? <Text style={{color:accent,fontWeight:"700"}}>Resend</Text></Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ── Email OTP screen ──────────────────────────────────────────────────────
  if (screen === "email_otp") {
    return (
      <View style={{flex:1,backgroundColor:bg}}>
        <Blob1 color={blob1}/><Blob2 color={blob2}/>
        <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==="ios"?"padding":undefined}>
          <ScrollView contentContainerStyle={{flexGrow:1,padding:28,justifyContent:"center"}} keyboardShouldPersistTaps="always">
            <TouchableOpacity onPress={()=>setScreen("main")} style={{flexDirection:"row",alignItems:"center",gap:8,marginBottom:32}}>
              <Ionicons name="arrow-back" size={20} color={sub}/>
              <Text style={{color:sub,fontSize:14}}>Back</Text>
            </TouchableOpacity>
            <Logo card={card} txt={txt}/>
            <Text style={{color:txt,fontSize:28,fontWeight:"800",marginTop:24,marginBottom:8}}>Sign in with Email</Text>
            <Text style={{color:sub,fontSize:14,marginBottom:32}}>We'll send a 6-digit code — no password needed</Text>
            <InputRow icon="mail-outline">
              <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com"
                placeholderTextColor={sub} keyboardType="email-address" autoCapitalize="none"
                style={{flex:1,fontSize:15,color:txt,paddingVertical:18} as any}/>
            </InputRow>
            <PrimaryBtn onPress={sendEmailOtp} label="Send Code"/>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ── Phone OTP screen ──────────────────────────────────────────────────────
  if (screen === "phone_otp") {
    return (
      <View style={{flex:1,backgroundColor:bg}}>
        <Blob1 color={blob1}/><Blob2 color={blob2}/>
        <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==="ios"?"padding":undefined}>
          <ScrollView contentContainerStyle={{flexGrow:1,padding:28,justifyContent:"center"}} keyboardShouldPersistTaps="always">
            <TouchableOpacity onPress={()=>setScreen("main")} style={{flexDirection:"row",alignItems:"center",gap:8,marginBottom:32}}>
              <Ionicons name="arrow-back" size={20} color={sub}/>
              <Text style={{color:sub,fontSize:14}}>Back</Text>
            </TouchableOpacity>
            <Logo card={card} txt={txt}/>
            <Text style={{color:txt,fontSize:28,fontWeight:"800",marginTop:24,marginBottom:8}}>Sign in with Phone</Text>
            <Text style={{color:sub,fontSize:14,marginBottom:32}}>We'll send a 6-digit SMS to your number</Text>
            <View style={{flexDirection:"row",alignItems:"center",backgroundColor:inp,
              borderRadius:16,borderWidth:1,borderColor:border,paddingHorizontal:16,gap:10,marginBottom:12}}>
              <View style={{flexDirection:"row",alignItems:"center",gap:6,paddingVertical:18,
                borderRightWidth:1,borderRightColor:border,paddingRight:12}}>
                <Text style={{fontSize:18}}>🇮🇳</Text>
                <Text style={{color:txt,fontSize:15,fontWeight:"700"}}>+91</Text>
              </View>
              <TextInput value={phone} onChangeText={v=>setPhone(v.replace(/\D/g,"").slice(0,10))}
                placeholder="98765 43210" placeholderTextColor={sub}
                keyboardType="phone-pad" maxLength={10}
                style={{flex:1,fontSize:16,color:txt,paddingVertical:18} as any}/>
            </View>
            <PrimaryBtn onPress={sendPhoneOtp} label="Send OTP"/>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ── Main login screen ─────────────────────────────────────────────────────
  return (
    <View style={{flex:1,backgroundColor:bg}}>
      <Blob1 color={blob1}/><Blob2 color={blob2}/>
      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==="ios"?"padding":undefined}>
        <ScrollView contentContainerStyle={{flexGrow:1,padding:28,justifyContent:"center"}}
          keyboardShouldPersistTaps="always" showsVerticalScrollIndicator={false}>

          <Logo card={card} txt={txt}/>

          <Text style={{color:txt,fontSize:38,fontWeight:"900",marginTop:24,letterSpacing:-1}}>Merizo</Text>
          <Text style={{color:sub,fontSize:15,marginTop:6,marginBottom:36}}>Split smarter. Settle faster.</Text>

          {/* Email */}
          <InputRow icon="mail-outline">
            <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com"
              placeholderTextColor={sub} keyboardType="email-address" autoCapitalize="none"
              autoCorrect={false} autoComplete="email" blurOnSubmit={false}
              style={{flex:1,fontSize:15,color:txt,paddingVertical:18} as any}/>
          </InputRow>

          {/* Password */}
          <InputRow icon="lock-closed-outline">
            <TextInput value={password} onChangeText={setPassword} placeholder="••••••••"
              placeholderTextColor={sub} secureTextEntry={!showPw}
              autoComplete="password" blurOnSubmit={false}
              style={{flex:1,fontSize:15,color:txt,paddingVertical:18} as any}/>
            <TouchableOpacity onPress={()=>setShowPw(s=>!s)}>
              <Ionicons name={showPw?"eye-off-outline":"eye-outline"} size={18} color={sub}/>
            </TouchableOpacity>
          </InputRow>

          {/* Forgot */}
          <TouchableOpacity style={{alignSelf:"flex-end",marginBottom:4}}>
            <Text style={{color:sub,fontSize:13}}>Forgot password?</Text>
          </TouchableOpacity>

          {/* Sign In */}
          <PrimaryBtn onPress={doLogin} label="Sign In"/>

          {/* Divider */}
          <View style={{flexDirection:"row",alignItems:"center",gap:12,marginVertical:24}}>
            <View style={{flex:1,height:1,backgroundColor:border}}/>
            <Text style={{color:sub,fontSize:13}}>or continue with</Text>
            <View style={{flex:1,height:1,backgroundColor:border}}/>
          </View>

          {/* Google */}
          <TouchableOpacity onPress={doGoogle} disabled={loading}
            style={{flexDirection:"row",alignItems:"center",justifyContent:"center",gap:12,
              backgroundColor:card,borderRadius:16,padding:16,borderWidth:1,borderColor:border,
              shadowColor:"#000",shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:2},elevation:2,marginBottom:12}}>
            <GoogleIcon/>
            <Text style={{color:txt,fontSize:15,fontWeight:"700"}}>Continue with Google</Text>
          </TouchableOpacity>



          {/* Demo login */}
          <TouchableOpacity onPress={demoLogin}
            style={{flexDirection:"row",alignItems:"center",justifyContent:"center",gap:12,
              backgroundColor:"rgba(109,93,252,0.08)",borderRadius:16,padding:16,borderWidth:1,borderColor:"rgba(109,93,252,0.2)",marginBottom:12}}>
            <Ionicons name="sparkles" size={20} color="#6D5DFC"/>
            <Text style={{color:"#6D5DFC",fontSize:15,fontWeight:"600"}}>Try Demo Account</Text>
          </TouchableOpacity>
          {/* Phone OTP */}
          <TouchableOpacity onPress={()=>setScreen("phone_otp")}
            style={{flexDirection:"row",alignItems:"center",justifyContent:"center",gap:12,
              backgroundColor:card,borderRadius:16,padding:16,borderWidth:1,borderColor:border,
              shadowColor:"#000",shadowOpacity:0.04,shadowRadius:6,shadowOffset:{width:0,height:1},elevation:1,marginBottom:24}}>
            <Text style={{fontSize:20}}>🇮🇳</Text>
            <Text style={{color:txt,fontSize:15,fontWeight:"600"}}>Continue with Phone OTP</Text>
          </TouchableOpacity>

          {/* Register */}
          <TouchableOpacity onPress={()=>router.push("/register")} style={{alignItems:"center"}}>
            <Text style={{color:sub,fontSize:14}}>
              No account?{" "}
              <Text style={{color:txt,fontWeight:"800",textDecorationLine:"underline"}}>Create one</Text>
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Shared sub-components ──────────────────────────────────────────────────────
function Logo({ card, txt }: { card: string; txt: string }) {
  return (
    <View style={{width:72,height:72,borderRadius:20,backgroundColor:card,
      alignItems:"center",justifyContent:"center",
      shadowColor:"#000",shadowOpacity:0.1,shadowRadius:20,shadowOffset:{width:0,height:8},elevation:8}}>
      <Text style={{color:txt,fontSize:32,fontWeight:"900"}}>M</Text>
    </View>
  );
}

function Blob1({ color }: { color: string }) {
  return (
    <View pointerEvents="none" style={{position:"absolute",top:-80,right:-60,
      width:260,height:260,borderRadius:130,backgroundColor:color,transform:[{rotate:"20deg"}]}}/>
  );
}

function Blob2({ color }: { color: string }) {
  return (
    <View pointerEvents="none" style={{position:"absolute",bottom:-40,left:-80,
      width:300,height:240,borderRadius:120,backgroundColor:color,transform:[{rotate:"-15deg"}]}}/>
  );
}

function GoogleIcon() {
  return (
    <View style={{width:20,height:20}}>
      <Text style={{fontSize:18,lineHeight:20}}>G</Text>
    </View>
  );
}