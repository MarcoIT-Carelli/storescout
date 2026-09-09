import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';
import type { Destinatario, Pdv, VoceLista } from '@/types/database';

import { useAuth } from './useAuth';

/**
 * Liste valori e anagrafica punti vendita. Vengono sempre dal database, mai dal codice:
 * l'admin le modifica a runtime. Una copia locale permette di aprire una scheda anche
 * dentro un magazzino senza campo; viene rinfrescata a ogni avvio con rete.
 */

const CHIAVE_CACHE = 'storescout.liste.v2';

export type Liste = {
  pdv: Pdv[];
  destinatari: Destinatario[];
  reparti: VoceLista[];
  tipiIntervento: VoceLista[];
  /** Id dei punti vendita assegnati all'ispettore che ha la sessione aperta. */
  assegnati: string[];
};

const VUOTE: Liste = { pdv: [], destinatari: [], reparti: [], tipiIntervento: [], assegnati: [] };

type Stato = {
  liste: Liste;
  caricamento: boolean;
  daCache: boolean;
  errore: string | null;
  aggiorna: () => Promise<void>;
  pdvPerId: (id: string | null | undefined) => Pdv | null;
  /**
   * I punti vendita su cui si può aprire una nuova ispezione.
   *
   * Sono meno di `liste.pdv`, che comprende anche quelli su cui l'ispettore ha già
   * lavorato in passato: quelli devono restare leggibili perché il suo storico continui
   * a mostrare sigla e città, ma un'assegnazione revocata non deve più permettere di
   * cominciare una scheda nuova.
   */
  pdvSelezionabili: Pdv[];
};

const Contesto = createContext<Stato | null>(null);

export function ListeProvider({ children, attivo }: { children: ReactNode; attivo: boolean }) {
  const { profilo } = useAuth();
  const [liste, setListe] = useState<Liste>(VUOTE);
  const [caricamento, setCaricamento] = useState(true);
  const [daCache, setDaCache] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const aggiorna = useCallback(async () => {
    setErrore(null);
    try {
      const [pdv, destinatari, reparti, tipi, assegnati] = await Promise.all([
        supabase.from('pdv').select('*').eq('attivo', true).order('codice'),
        supabase.from('destinatari').select('*').eq('attivo', true).order('ordine'),
        supabase.from('reparti').select('*').eq('attivo', true).order('ordine'),
        supabase.from('tipi_intervento').select('*').eq('attivo', true).order('ordine'),
        profilo
          ? supabase.from('ispettore_pdv').select('pdv_id').eq('ispettore_id', profilo.id)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const primoErrore =
        pdv.error ?? destinatari.error ?? reparti.error ?? tipi.error ?? assegnati.error;
      if (primoErrore) throw primoErrore;

      const fresche: Liste = {
        pdv: (pdv.data ?? []) as Pdv[],
        destinatari: (destinatari.data ?? []) as Destinatario[],
        reparti: (reparti.data ?? []) as VoceLista[],
        tipiIntervento: (tipi.data ?? []) as VoceLista[],
        assegnati: ((assegnati.data ?? []) as { pdv_id: string }[]).map((r) => r.pdv_id),
      };

      setListe(fresche);
      setDaCache(false);
      await AsyncStorage.setItem(CHIAVE_CACHE, JSON.stringify(fresche));
    } catch (e) {
      setErrore(e instanceof Error ? e.message : String(e));
      const salvate = await AsyncStorage.getItem(CHIAVE_CACHE);
      if (salvate) {
        const recuperate = JSON.parse(salvate) as Liste;
        setListe({ ...recuperate, assegnati: recuperate.assegnati ?? [] });
        setDaCache(true);
      }
    } finally {
      setCaricamento(false);
    }
  }, [profilo]);

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

  // L'amministratore non ha assegnazioni e non gli servono: il pannello deve poter
  // aprire una scheda ovunque, ed è lui a decidere chi vede che cosa.
  const pdvSelezionabili = useMemo(() => {
    if (profilo?.ruolo === 'admin') return liste.pdv;
    const suoi = new Set(liste.assegnati);
    return liste.pdv.filter((p) => suoi.has(p.id));
  }, [liste, profilo]);

  const valore = useMemo<Stato>(
    () => ({ liste, caricamento, daCache, errore, aggiorna, pdvPerId, pdvSelezionabili }),
    [liste, caricamento, daCache, errore, aggiorna, pdvPerId, pdvSelezionabili],
  );

  return <Contesto.Provider value={valore}>{children}</Contesto.Provider>;
}

export function useListe(): Stato {
  const s = useContext(Contesto);
  if (!s) throw new Error('useListe va usato dentro ListeProvider');
  return s;
}
