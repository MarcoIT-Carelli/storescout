import * as Crypto from 'expo-crypto';

import type { Profilo, RuoloUtente } from '@/types/database';

import { messaggioDaFunzione } from './errori';
import { supabase } from './supabase';

/**
 * Gestione degli ispettori dal pannello admin.
 *
 * Creazione e reset password passano dalla Edge Function `gestisci-ispettori`, perché
 * richiedono la chiave `service_role`. Tutto il resto agisce direttamente su `profili`,
 * dove la policy di update per gli admin è già in vigore.
 */

const FUNZIONE = 'gestisci-ispettori';

export async function leggiIspettori(): Promise<Profilo[]> {
  const { data, error } = await supabase
    .from('profili')
    .select('*')
    .order('attivo', { ascending: false })
    .order('cognome')
    .order('nome');
  if (error) throw error;
  return (data ?? []) as Profilo[];
}

export async function creaIspettore(dati: {
  nome: string;
  cognome: string;
  email: string;
  ruolo: RuoloUtente;
  password: string;
}): Promise<Profilo> {
  const { data, error } = await supabase.functions.invoke(FUNZIONE, {
    body: { azione: 'crea', ...dati },
  });
  if (error) throw new Error(await messaggioDaFunzione(error));
  return (data as { profilo: Profilo }).profilo;
}

export async function reimpostaPassword(id: string, password: string): Promise<void> {
  const { error } = await supabase.functions.invoke(FUNZIONE, {
    body: { azione: 'reimposta_password', id, password },
  });
  if (error) throw new Error(await messaggioDaFunzione(error));
}

/** Rinomina, cambio ruolo e attivazione: nessuna chiave privilegiata, basta la policy. */
export async function aggiornaIspettore(
  id: string,
  cambi: { nome?: string; cognome?: string; ruolo?: RuoloUtente; attivo?: boolean },
): Promise<void> {
  const { error } = await supabase.from('profili').update(cambi).eq('id', id);
  if (error) throw error;
}

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

/**
 * Password iniziale leggibile: niente caratteri che si confondono (0/O, 1/l/I), perché
 * l'amministratore la detta a voce o la scrive su un foglio.
 */
export function passwordCasuale(lunghezza = 10): string {
  const byte = Crypto.getRandomBytes(lunghezza);
  return Array.from(byte, (b) => ALFABETO[b % ALFABETO.length]).join('');
}

export const LUNGHEZZA_MINIMA_PASSWORD = 8;
