import { File } from 'expo-file-system';
import * as Print from 'expo-print';

import { htmlScheda, type DatiScheda, type RigaPdf } from '@/pdf/template';
import type { Bozza } from '@/types/bozza';
import { rigaCompilata } from '@/types/bozza';
import type { Ispezione, Pdv, Profilo, VoceLista } from '@/types/database';

import { dataBreve, daDataISO } from './format';
import { supabase } from './supabase';

/**
 * Passaggio dalla bozza locale alle tabelle remote. Ogni fase è separata e riportata
 * a schermo: se qualcosa fallisce l'ispettore deve sapere a che punto si è fermato,
 * e la bozza locale non viene mai eliminata prima della conferma di salvataggio remoto.
 */

export type Fase =
  | 'salvataggio'
  | 'righe'
  | 'firme'
  | 'pdf'
  | 'completato';

export type Avanzamento = { fase: Fase; messaggio: string };

type Riferimenti = {
  destinatari: VoceLista[];
  reparti: VoceLista[];
  tipiIntervento: VoceLista[];
};

const nomeDi = (voci: VoceLista[], id: string | null) => voci.find((v) => v.id === id)?.nome ?? '';

/** Crea o aggiorna la riga di testata su Supabase, restituendo il numero progressivo. */
export async function salvaTestata(bozza: Bozza): Promise<Ispezione> {
  const { data, error } = await supabase
    .from('ispezioni')
    .upsert(
      {
        id: bozza.id,
        pdv_id: bozza.pdv_id,
        ispettore_id: bozza.ispettore_id,
        data_ispezione: bozza.data_ispezione,
        ora_ingresso: bozza.ora_ingresso,
        niente_da_rilevare: bozza.niente_da_rilevare,
        ha_svolto_attivita: bozza.ha_svolto_attivita,
        nome_responsabile: bozza.nome_responsabile.trim() || null,
        motivo_assenza_firma: bozza.motivo_assenza_firma.trim() || null,
        stato: 'bozza' as const,
      },
      { onConflict: 'id' },
    )
    .select('*')
    .single();

  if (error) throw error;
  return data as Ispezione;
}

/** Riscrive le righe figlie. Sono sempre sostituite in blocco: la scheda è un documento unico. */
export async function salvaRighe(bozza: Bozza): Promise<void> {
  const attivita = bozza.niente_da_rilevare ? [] : bozza.attivita.filter(rigaCompilata);
  const svolte = bozza.ha_svolto_attivita
    ? bozza.svolte.filter((s) => s.descrizione.trim().length > 0)
    : [];

  const [delA, delS] = await Promise.all([
    supabase.from('ispezione_attivita').delete().eq('ispezione_id', bozza.id),
    supabase.from('ispezione_svolte').delete().eq('ispezione_id', bozza.id),
  ]);
  if (delA.error) throw delA.error;
  if (delS.error) throw delS.error;

  if (attivita.length > 0) {
    const { error } = await supabase.from('ispezione_attivita').insert(
      attivita.map((r, i) => ({
        id: r.id,
        ispezione_id: bozza.id,
        ordine: i,
        destinatario_id: r.destinatario_id,
        reparto_id: r.reparto_id,
        tipo_intervento_id: r.tipo_intervento_id,
        note: r.note.trim() || null,
        scadenza_data: r.scadenza_data,
        scadenza_testo: r.scadenza_testo.trim() || null,
        scadenza_note: r.scadenza_note.trim() || null,
      })),
    );
    if (error) throw error;
  }

  if (svolte.length > 0) {
    const { error } = await supabase.from('ispezione_svolte').insert(
      svolte.map((s, i) => ({
        id: s.id,
        ispezione_id: bozza.id,
        ordine: i,
        descrizione: s.descrizione.trim(),
      })),
    );
    if (error) throw error;
  }
}

async function caricaFirma(uri: string, percorso: string): Promise<string> {
  const bytes = await new File(uri).bytes();
  const { error } = await supabase.storage.from('firme').upload(percorso, bytes, {
    contentType: 'image/png',
    upsert: true,
  });
  if (error) throw error;
  return percorso;
}

export function testoScadenza(r: {
  scadenza_data: string | null;
  scadenza_testo: string;
  scadenza_note: string;
}): string {
  const base = r.scadenza_data ? dataBreve(daDataISO(r.scadenza_data)) : r.scadenza_testo.trim();
  const note = r.scadenza_note.trim();
  return note ? `${base} (${note})` : base;
}

export function righePdf(bozza: Bozza, rif: Riferimenti): RigaPdf[] {
  return bozza.attivita.filter(rigaCompilata).map((r) => ({
    destinatario: nomeDi(rif.destinatari, r.destinatario_id),
    reparto: nomeDi(rif.reparti, r.reparto_id),
    tipoIntervento: nomeDi(rif.tipiIntervento, r.tipo_intervento_id),
    note: r.note.trim(),
    scadenza: testoScadenza(r),
  }));
}

/**
 * Conclude l'ispezione: salva su Supabase, carica le firme, genera il PDF e lo archivia.
 *
 * L'invio email non è compreso: dipende dalle credenziali SMTP Aruba, non ancora
 * disponibili (milestone 8). L'ispezione resta in stato `conclusa` e riprovabile.
 */
export async function concludiIspezione(
  bozza: Bozza,
  pdv: Pdv,
  ispettore: Profilo,
  rif: Riferimenti,
  onAvanzamento: (a: Avanzamento) => void,
): Promise<{ ispezione: Ispezione; pdfUri: string }> {
  onAvanzamento({ fase: 'salvataggio', messaggio: 'Salvataggio della scheda…' });
  const testata = await salvaTestata(bozza);

  onAvanzamento({ fase: 'righe', messaggio: 'Salvataggio delle attività…' });
  await salvaRighe(bozza);

  onAvanzamento({ fase: 'firme', messaggio: 'Caricamento delle firme…' });
  let firmaIspettorePath: string | null = null;
  let firmaResponsabilePath: string | null = null;

  if (bozza.firma_ispettore_uri) {
    firmaIspettorePath = await caricaFirma(bozza.firma_ispettore_uri, `${bozza.id}/ispettore.png`);
  }
  if (bozza.firma_responsabile_uri) {
    firmaResponsabilePath = await caricaFirma(bozza.firma_responsabile_uri, `${bozza.id}/responsabile.png`);
  }

  onAvanzamento({ fase: 'pdf', messaggio: 'Generazione del PDF…' });
  const oraUscita = bozza.ora_uscita ? new Date(bozza.ora_uscita) : new Date();

  const dati: DatiScheda = {
    numero: testata.numero,
    pdvCodice: pdv.codice,
    pdvCitta: pdv.citta,
    pdvIndirizzo: pdv.indirizzo,
    pdvRagioneSociale: pdv.ragione_sociale,
    ispettore: `${ispettore.nome} ${ispettore.cognome}`.trim() || ispettore.email,
    dataIspezione: daDataISO(bozza.data_ispezione),
    oraIngresso: new Date(bozza.ora_ingresso),
    oraUscita,
    nienteDaRilevare: bozza.niente_da_rilevare,
    righe: righePdf(bozza, rif),
    svolte: bozza.ha_svolto_attivita
      ? bozza.svolte.map((s) => s.descrizione.trim()).filter(Boolean)
      : [],
    firmaIspettoreBase64: bozza.firma_ispettore_uri
      ? await new File(bozza.firma_ispettore_uri).base64()
      : null,
    firmaResponsabileBase64: bozza.firma_responsabile_uri
      ? await new File(bozza.firma_responsabile_uri).base64()
      : null,
    nomeResponsabile: bozza.nome_responsabile.trim(),
    motivoAssenzaFirma: bozza.motivo_assenza_firma.trim(),
  };

  // expo-print ignora `@page size` e produce US Letter se non gli si passano le misure:
  // A4 a 72 punti per pollice è 595 x 842.
  const { uri: pdfUri } = await Print.printToFileAsync({
    html: htmlScheda(dati),
    base64: false,
    width: 595,
    height: 842,
  });

  const data = daDataISO(bozza.data_ispezione);
  const percorsoPdf = `${data.getFullYear()}/${String(data.getMonth() + 1).padStart(2, '0')}/${testata.numero}_${pdv.codice}.pdf`;
  const bytesPdf = await new File(pdfUri).bytes();

  const caricamento = await supabase.storage.from('schede').upload(percorsoPdf, bytesPdf, {
    contentType: 'application/pdf',
    upsert: true,
  });
  if (caricamento.error) throw caricamento.error;

  const { data: conclusa, error } = await supabase
    .from('ispezioni')
    .update({
      ora_uscita: oraUscita.toISOString(),
      niente_da_rilevare: bozza.niente_da_rilevare,
      ha_svolto_attivita: bozza.ha_svolto_attivita,
      nome_responsabile: bozza.nome_responsabile.trim() || null,
      motivo_assenza_firma: bozza.motivo_assenza_firma.trim() || null,
      firma_ispettore_path: firmaIspettorePath,
      firma_responsabile_path: firmaResponsabilePath,
      pdf_path: percorsoPdf,
      stato: 'conclusa' as const,
    })
    .eq('id', bozza.id)
    .select('*')
    .single();

  if (error) throw error;

  onAvanzamento({ fase: 'completato', messaggio: 'Scheda salvata.' });
  return { ispezione: conclusa as Ispezione, pdfUri };
}

/** Link temporaneo per riaprire il PDF di un'ispezione già archiviata. */
export async function urlPdf(percorso: string): Promise<string> {
  const { data, error } = await supabase.storage.from('schede').createSignedUrl(percorso, 300);
  if (error) throw error;
  return data.signedUrl;
}

/** Riga attività così come torna dal database, con i nomi delle liste già risolti. */
export type AttivitaLetta = {
  ordine: number;
  note: string | null;
  scadenza_data: string | null;
  scadenza_testo: string | null;
  scadenza_note: string | null;
  destinatari: { nome: string } | null;
  reparti: { nome: string } | null;
  tipi_intervento: { nome: string } | null;
};

export type Dettaglio = {
  ispezione: Ispezione;
  attivita: AttivitaLetta[];
  svolte: { ordine: number; descrizione: string }[];
};

/**
 * Carica un'ispezione conclusa per la sola lettura. I nomi di destinatario, reparto e
 * tipo di intervento arrivano da una join: se l'admin disattiva una voce di lista, la
 * scheda storica deve restare leggibile com'era.
 */
export async function caricaDettaglio(id: string): Promise<Dettaglio> {
  const [testata, attivita, svolte] = await Promise.all([
    supabase.from('ispezioni').select('*').eq('id', id).single(),
    supabase
      .from('ispezione_attivita')
      .select(
        'ordine, note, scadenza_data, scadenza_testo, scadenza_note, destinatari(nome), reparti(nome), tipi_intervento(nome)',
      )
      .eq('ispezione_id', id)
      .order('ordine'),
    supabase
      .from('ispezione_svolte')
      .select('ordine, descrizione')
      .eq('ispezione_id', id)
      .order('ordine'),
  ]);

  if (testata.error) throw testata.error;
  if (attivita.error) throw attivita.error;
  if (svolte.error) throw svolte.error;

  return {
    ispezione: testata.data as Ispezione,
    attivita: (attivita.data ?? []) as unknown as AttivitaLetta[],
    svolte: (svolte.data ?? []) as { ordine: number; descrizione: string }[],
  };
}
