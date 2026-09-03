import { useCallback, useEffect, useRef, useState } from 'react';

import { eliminaBozza, leggiBozza, salvaBozza } from '@/db/bozze';
import type { Bozza } from '@/types/bozza';

/** Ritardo prima di scrivere su SQLite: evita una scrittura per ogni carattere digitato. */
const ATTESA_SALVATAGGIO = 800;

type Stato = {
  bozza: Bozza | null;
  caricamento: boolean;
  /** Momento dell'ultimo salvataggio locale riuscito, per darne conferma a schermo. */
  salvataAlle: Date | null;
  modifica: (cambia: (b: Bozza) => Bozza) => void;
  /** Forza la scrittura immediata, senza attendere il ritardo. */
  salvaSubito: () => Promise<void>;
  scarta: () => Promise<void>;
};

/**
 * Tiene in memoria la scheda in compilazione e la persiste sul dispositivo a ogni modifica.
 * Nessun dato inserito deve andare perso per una chiusura imprevista o per mancanza di rete.
 */
export function useBozza(id: string | undefined): Stato {
  const [bozza, setBozza] = useState<Bozza | null>(null);
  const [caricamento, setCaricamento] = useState(true);
  const [salvataAlle, setSalvataAlle] = useState<Date | null>(null);

  const attesa = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inSospeso = useRef<Bozza | null>(null);

  useEffect(() => {
    let vivo = true;
    if (!id) {
      setCaricamento(false);
      return;
    }
    leggiBozza(id)
      .then((b) => {
        if (!vivo) return;
        setBozza(b);
        setCaricamento(false);
      })
      .catch(() => vivo && setCaricamento(false));
    return () => {
      vivo = false;
    };
  }, [id]);

  const scrivi = useCallback(async (b: Bozza) => {
    await salvaBozza(b);
    setSalvataAlle(new Date());
  }, []);

  const modifica = useCallback(
    (cambia: (b: Bozza) => Bozza) => {
      setBozza((precedente) => {
        if (!precedente) return precedente;
        const aggiornata = { ...cambia(precedente), aggiornata: Date.now() };
        inSospeso.current = aggiornata;

        if (attesa.current) clearTimeout(attesa.current);
        attesa.current = setTimeout(() => {
          const da = inSospeso.current;
          inSospeso.current = null;
          if (da) void scrivi(da);
        }, ATTESA_SALVATAGGIO);

        return aggiornata;
      });
    },
    [scrivi],
  );

  const salvaSubito = useCallback(async () => {
    if (attesa.current) {
      clearTimeout(attesa.current);
      attesa.current = null;
    }
    const da = inSospeso.current ?? bozza;
    inSospeso.current = null;
    if (da) await scrivi(da);
  }, [bozza, scrivi]);

  const scarta = useCallback(async () => {
    if (attesa.current) clearTimeout(attesa.current);
    inSospeso.current = null;
    if (id) await eliminaBozza(id);
    setBozza(null);
  }, [id]);

  // Una modifica ancora in attesa non deve perdersi quando la schermata viene chiusa.
  useEffect(
    () => () => {
      if (attesa.current) clearTimeout(attesa.current);
      if (inSospeso.current) void salvaBozza(inSospeso.current);
    },
    [],
  );

  return { bozza, caricamento, salvataAlle, modifica, salvaSubito, scarta };
}
