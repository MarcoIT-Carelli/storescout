/**
 * Le uniche variabili d'ambiente lette dall'app. Entrambe pubbliche per costruzione:
 * l'APK è ispezionabile, quindi qui non può finire nessun segreto. La chiave service_role
 * e le credenziali SMTP vivono solo nelle Edge Function Secrets.
 */

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabaseConfigurato = SUPABASE_URL.startsWith('http') && SUPABASE_ANON_KEY.length > 20;
