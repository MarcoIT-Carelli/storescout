import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';
import type { Destinatario, Pdv, VoceLista } from '@/types/database';

/**
 * Liste valori e anagrafica punti vendita. Vengono sempre dal database, mai dal codice:
 * l'admin le modifica a runtime. Una copia locale permette di aprire una scheda anche
 * dentro un magazzino senza campo; viene rinfrescata a ogni avvio con rete.
 */

const CHIAVE_CACHE = 'storescout.liste.v1';

export type Liste = {
  pdv: Pdv[];
  destinatari: Destinatario[];
  reparti: VoceLista[];
  tipiIntervento: VoceLista[];
};

const VUOTE: Liste = { pdv: [], destinatari: [], reparti: [], tipiIntervento: [] };

type Stato = {
  liste: Liste;
  caricamento: boolean;
  daCache: boolean;
  errore: string | null;
  aggiorna: () => Promise<void>;
  pdvPerId: (id: string | null | undefined) => Pdv | null;
};

const Contesto = createContext<Stato | null>(null);

export function ListeProvider({ children, attivo }: { children: ReactNode; attivo: boolean }) {
  const [liste, setListe] = useState<Liste>(VUOTE);
  const [caricamento, setCaricamento] = useState(true);
  const [daCache, setDaCache] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const aggiorna = useCallback(async () => {
    setErrore(null);
    try {
      const [pdv, destinatari, reparti, tipi] = await Promise.all([
        supabase.from('pdv').select('*').eq('attivo', true).order('codice'),
        supabase.from('destinatari').select('*').eq('attivo', true).order('ordine'),
        supabase.from('reparti').select('*').eq('attivo', true).order('ordine'),
        supabase.from('tipi_intervento').select('*').eq('attivo', true).order('ordine'),
      ]);

      const primoErrore = pdv.error ?? destinatari.error ?? reparti.error ?? tipi.error;
      if (primoErrore) throw primoErrore;

      const fresche: Liste = {
        pdv: (pdv.data ?? []) as Pdv[],
        destinatari: (destinatari.data ?? []) as Destinatario[],
        reparti: (reparti.data ?? []) as VoceLista[],
        tipiIntervento: (tipi.data ?? []) as VoceLista[],
      };

      setListe(fresche);
      setDaCache(false);
      await AsyncStorage.setItem(CHIAVE_CACHE, JSON.stringify(fresche));
    } catch (e) {
      setErrore(e instanceof Error ? e.message : String(e));
      const salvate = await AsyncStorage.getItem(CHIAVE_CACHE);
      if (salvate) {
        setListe(JSON.parse(salvate) as Liste);
        setDaCache(true);
      }
    } finally {
      setCaricamento(false);
    }
  }, []);

  useEffect(() => {
    if (!attivo) {
      setListe(VUOTE);
      setCaricamento(false);
      return;
    }
    setCaricamento(true);
    void aggiorna();
  }, [attivo, aggiorna]);

  const pdvPerId = useCallback(
    (id: string | null | undefined) => liste.pdv.find((p) => p.id === id) ?? null,
    [liste.pdv],
  );

  const valore = useMemo<Stato>(
    () => ({ liste, caricamento, daCache, errore, aggiorna, pdvPerId }),
    [liste, caricamento, daCache, errore, aggiorna, pdvPerId],
  );

  return <Contesto.Provider value={valore}>{children}</Contesto.Provider>;
}

export function useListe(): Stato {
  const s = useContext(Contesto);
  if (!s) throw new Error('useListe va usato dentro ListeProvider');
  return s;
}
