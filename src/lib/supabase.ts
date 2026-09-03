import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigurato } from './env';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    // Non c'è alcun redirect OAuth da interpretare: l'accesso è solo email + password.
    detectSessionInUrl: false,
  },
});

// Il refresh del token va sospeso quando l'app è in background, altrimenti Supabase
// continua a schedulare richieste che Android congela e che poi falliscono al risveglio.
if (supabaseConfigurato) {
  AppState.addEventListener('change', (stato) => {
    if (stato === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
