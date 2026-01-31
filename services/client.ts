import { createClient, SupabaseClient } from '@supabase/supabase-js';

export let supabase: SupabaseClient | null = null;
export let supabaseConfigError: string | null = null;

try {
  const supabaseUrl = 'https://tsnjxvefqcfkrxcwwyjd.supabase.co';
  const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzbmp4dmVmcWNma3J4Y3d3eWpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxMDMzNDQsImV4cCI6MjA3ODY3OTM0NH0.aHVvoFDrD5GIxo3e3iPQfiQjkhPMWpm98PnLdCKEapI';

  if (!supabaseUrl || !supabaseAnonKey) {
    supabaseConfigError = 'خطا: کلیدهای Supabase در کد برنامه یافت نشدند.';
    console.error(supabaseConfigError);
    // Do NOT create client, supabase remains null
  } else {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
} catch (e: any) {
    supabaseConfigError = `خطا: مشکلی در مقداردهی اولیه Supabase رخ داد. (${e.message})`;
    console.error(supabaseConfigError, e.message);
}


// Helper to ensure supabase client is available, throws if not
export function getSupabaseSafe(): SupabaseClient {
  if (!supabase) {
    throw new Error(supabaseConfigError || 'Supabase client is not initialized.');
  }
  return supabase;
}
