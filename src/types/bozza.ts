import * as Crypto from 'expo-crypto';

import { dataISO } from '@/lib/format';

/**
 * Forma della scheda mentre viene compilata. È il documento che vive su SQLite e che, alla
 * conclusione, viene tradotto nelle righe delle tabelle remote.
 *
 * L'identificativo è generato sul dispositivo: la stessa ispezione deve avere lo stesso id
 * in locale e su Supabase, altrimenti una scheda salvata senza rete e sincronizzata dopo
 * risulterebbe duplicata.
 */

export type RigaAttivita = {
  id: string;
  destinatario_id: string | null;
  reparto_id: string | null;
  tipo_intervento_id: string | null;
  note: string;
  /** Formato YYYY-MM-DD. Mutuamente esclusivo con `scadenza_testo`. */
  scadenza_data: string | null;
  scadenza_testo: string;
  scadenza_note: string;
};

export type RigaSvolta = {
  id: string;
  descrizione: string;
};

export type Bozza = {
  id: string;
  ispettore_id: string;
  pdv_id: string;
  data_ispezione: string;
  ora_ingresso: string;
  ora_uscita: string | null;
  niente_da_rilevare: boolean;
  ha_svolto_attivita: boolean;
  attivita: RigaAttivita[];
  svolte: RigaSvolta[];
  nome_responsabile: string;
  motivo_assenza_firma: string;
  /** URI locale del PNG della firma, prima dell'upload su Storage. */
  firma_ispettore_uri: string | null;
  firma_responsabile_uri: string | null;
  aggiornata: number;
};

export const nuovoId = () => Crypto.randomUUID();

/** Le cinque righe vuote previste dal modulo quando si attiva "Ho svolto le seguenti attività". */
export const RIGHE_SVOLTE_INIZIALI = 5;

export function rigaAttivitaVuota(): RigaAttivita {
  return {
    id: nuovoId(),
    destinatario_id: null,
    reparto_id: null,
    tipo_intervento_id: null,
    note: '',
    scadenza_data: null,
    scadenza_testo: '',
    scadenza_note: '',
  };
}

export function righeSvolteVuote(quante = RIGHE_SVOLTE_INIZIALI): RigaSvolta[] {
  return Array.from({ length: quante }, () => ({ id: nuovoId(), descrizione: '' }));
}

export function nuovaBozza(ispettoreId: string, pdvId: string): Bozza {
  const adesso = new Date();
  return {
    id: nuovoId(),
    ispettore_id: ispettoreId,
    pdv_id: pdvId,
    data_ispezione: dataISO(adesso),
    ora_ingresso: adesso.toISOString(),
    ora_uscita: null,
    niente_da_rilevare: false,
    ha_svolto_attivita: false,
    attivita: [],
    svolte: [],
    nome_responsabile: '',
    motivo_assenza_firma: '',
    firma_ispettore_uri: null,
    firma_responsabile_uri: null,
    aggiornata: Date.now(),
  };
}

/** Una riga conta come compilata se ha almeno un campo valorizzato. */
export function rigaCompilata(r: RigaAttivita): boolean {
  return Boolean(
    r.destinatario_id ||
      r.reparto_id ||
      r.tipo_intervento_id ||
      r.note.trim() ||
      r.scadenza_data ||
      r.scadenza_testo.trim() ||
      r.scadenza_note.trim(),
  );
}
