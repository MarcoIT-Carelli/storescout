import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { supabaseConfigurato } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import type { Profilo } from '@/types/database';

type Stato = {
  caricamento: boolean;
  sessione: Session | null;
  profilo: Profilo | null;
  /** Vero quando c'è una sessione ma il profilo risulta disattivato. */
  disattivato: boolean;
  accedi: (email: string, password: string) => Promise<void>;
  esci: () => Promise<void>;
  cambiaPassword: (nuova: string) => Promise<void>;
  inviaResetPassword: (email: string) => Promise<void>;
  ricaricaProfilo: () => Promise<void>;
};

const Contesto = createContext<Stato | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [caricamento, setCaricamento] = useState(true);
  const [sessione, setSessione] = useState<Session | null>(null);
  const [profilo, setProfilo] = useState<Profilo | null>(null);
  const [disattivato, setDisattivato] = useState(false);

  const caricaProfilo = useCallback(async (utenteId: string) => {
    const { data, error } = await supabase.from('profili').select('*').eq('id', utenteId).single();
    if (error || !data) {
      setProfilo(null);
      return;
    }
    const p = data as Profilo;
    setProfilo(p);
    setDisattivato(!p.attivo);
    // Un ispettore disattivato non deve poter restare dentro con una sessione già aperta.
    if (!p.attivo) await supabase.auth.signOut();
  }, []);

  useEffect(() => {
    if (!supabaseConfigurato) {
      setCaricamento(false);
      return;
    }

    let vivo = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!vivo) return;
      setSessione(data.session);
      if (data.session?.user) await caricaProfilo(data.session.user.id);
      if (vivo) setCaricamento(false);
    });

    const { data: iscrizione } = supabase.auth.onAuthStateChange(async (_evento, s) => {
      if (!vivo) return;
      setSessione(s);
      if (s?.user) await caricaProfilo(s.user.id);
      else setProfilo(null);
    });

    return () => {
      vivo = false;
      iscrizione.subscription.unsubscribe();
    };
  }, [caricaProfilo]);

  const accedi = useCallback(async (email: string, password: string) => {
    setDisattivato(false);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw error;

    const { data: p } = await supabase.from('profili').select('*').eq('id', data.user.id).single();
    if (p && !(p as Profilo).attivo) {
      await supabase.auth.signOut();
      setDisattivato(true);
      throw new Error('account disattivato');
    }
  }, []);

  const esci = useCallback(async () => {
    await supabase.auth.signOut();
    setProfilo(null);
    setSessione(null);
  }, []);

  const cambiaPassword = useCallback(
    async (nuova: string) => {
      const { error } = await supabase.auth.updateUser({ password: nuova });
      if (error) throw error;
      if (profilo?.deve_cambiare_password) {
        await supabase.from('profili').update({ deve_cambiare_password: false }).eq('id', profilo.id);
        setProfilo({ ...profilo, deve_cambiare_password: false });
      }
    },
    [profilo],
  );

  const inviaResetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
    if (error) throw error;
  }, []);

  const ricaricaProfilo = useCallback(async () => {
    if (sessione?.user) await caricaProfilo(sessione.user.id);
  }, [sessione, caricaProfilo]);

  const valore = useMemo<Stato>(
    () => ({
      caricamento,
      sessione,
      profilo,
      disattivato,
      accedi,
      esci,
      cambiaPassword,
      inviaResetPassword,
      ricaricaProfilo,
    }),
    [caricamento, sessione, profilo, disattivato, accedi, esci, cambiaPassword, inviaResetPassword, ricaricaProfilo],
  );

  return <Contesto.Provider value={valore}>{children}</Contesto.Provider>;
}

export function useAuth(): Stato {
  const s = useContext(Contesto);
  if (!s) throw new Error('useAuth va usato dentro AuthProvider');
  return s;
}
