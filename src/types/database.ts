/**
 * Tipi delle tabelle Supabase, ricavati da 01_schema.sql.
 * Vanno rigenerati con `supabase gen types typescript` se lo schema cambia.
 */

export type RuoloUtente = 'admin' | 'ispettore';
export type StatoIspezione = 'bozza' | 'conclusa' | 'inviata' | 'errore_invio';
export type StatoInvio = 'in_coda' | 'inviata' | 'errore';

export type Profilo = {
  id: string;
  nome: string;
  cognome: string;
  email: string;
  ruolo: RuoloUtente;
  attivo: boolean;
  deve_cambiare_password: boolean;
  created_at: string;
  updated_at: string;
};

export type Pdv = {
  id: string;
  progressivo: string;
  codice: string;
  citta: string;
  indirizzo: string;
  ragione_sociale: string;
  codice_deposito: string | null;
  telefono: string | null;
  email: string | null;
  responsabile_nome: string | null;
  attivo: boolean;
  created_at: string;
};

/** destinatari, reparti e tipi_intervento hanno la stessa forma tranne l'email. */
export type VoceLista = {
  id: string;
  nome: string;
  ordine: number;
  attivo: boolean;
};

export type Destinatario = VoceLista & { email: string | null };

export type Ispezione = {
  id: string;
  numero: number;
  pdv_id: string;
  ispettore_id: string;
  data_ispezione: string;
  ora_ingresso: string;
  ora_uscita: string | null;
  niente_da_rilevare: boolean;
  ha_svolto_attivita: boolean;
  firma_ispettore_path: string | null;
  firma_responsabile_path: string | null;
  nome_responsabile: string | null;
  motivo_assenza_firma: string | null;
  pdf_path: string | null;
  stato: StatoIspezione;
  created_at: string;
  updated_at: string;
};

export type IspezioneAttivita = {
  id: string;
  ispezione_id: string;
  ordine: number;
  destinatario_id: string | null;
  reparto_id: string | null;
  tipo_intervento_id: string | null;
  note: string | null;
  scadenza_data: string | null;
  scadenza_testo: string | null;
  scadenza_note: string | null;
  created_at: string;
};

export type IspezioneSvolta = {
  id: string;
  ispezione_id: string;
  ordine: number;
  descrizione: string;
};

export type InvioEmail = {
  id: string;
  ispezione_id: string;
  destinatari: { to: string[]; cc: string[] };
  oggetto: string;
  stato: StatoInvio;
  errore: string | null;
  tentativi: number;
  inviata_at: string | null;
  created_at: string;
};
