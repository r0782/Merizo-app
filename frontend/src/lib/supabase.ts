// frontend/src/lib/supabase.ts
// Supabase client for Auth (OTP, Google, Phone)
import { createClient } from "@supabase/supabase-js";

const URL  = process.env.EXPO_PUBLIC_SUPABASE_URL  || "";
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON || "";

export const supabase = createClient(URL, ANON, {
  auth: { persistSession: true, autoRefreshToken: true },
});