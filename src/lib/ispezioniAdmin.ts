import type { Ispezione, Pdv, Profilo, StatoIspezione } from '@/types/database';

import { dataBreve, dataISO, daDataISO, ora } from './format';
import { testoScadenza } from './ispezioni';
import { supabase } from './supabase';

/**
 * Vista amministrativa delle ispezioni: tutte, di tutti gli ispettori, bozze comprese.
 *
 * La differenza dallo storico sono proprio le bozze. Una bozza salvata anche sul server e
 * poi eliminata dal tablet resta lì e nessuna schermata la mostra più, perché l'elenco
 * delle bozze dell'ispettore viene da SQLite: questo è l'unico posto da cui si vede e si
 * toglie.
 */

export type Filtri = {
  pdvId: string | null;
  ispettoreId: string | null;
  stato: StatoIspezione | null;
  da: Date | null;
  a: Date | null;
};

export const FILTRI_VUOTI: Filtri = {
  pdvId: null,
  ispettoreId: null,
  stato: null,
  da: null,
  a: null,
};

/**
 * Tetto alle righe scaricate. L'export riguarda quello che si vede: se un giorno le
 * ispezioni supereranno questo numero servirà la paginazione, ma un export che tronca in
 * silenzio sarebbe peggio di uno che non c'è, quindi la schermata avvisa quando lo tocca.
 */
export const LIMITE = 500;

export async function leggiIspezioni(f: Filtri): Promise<Ispezione[]> {
  let query = supabase
    .from('ispezioni')
    .select('*')
    .order('data_ispezione', { ascending: false })
    .order('numero', { ascending: false })
    .limit(LIMITE);

  if (f.pdvId) query = query.eq('pdv_id', f.pdvId);
  if (f.ispettoreId) query = query.eq('ispettore_id', f.ispettoreId);
  if (f.stato) query = query.eq('stato', f.stato);
  if (f.da) query = query.gte('data_ispezione', dataISO(f.da));
  if (f.a) query = query.lte('data_ispezione', dataISO(f.a));

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Ispezione[];
}

/**
 * Elimina una bozza rimasta sul server. Le righe collegate spariscono da sole:
 * `ispezione_attivita` e `ispezione_svolte` hanno `on delete cascade`.
 *
 * Restituisce `false` quando il database non ha eliminato niente. Senza una policy di
 * delete su `ispezioni` PostgREST risponde lo stesso «fatto» senza toccare una riga, e
 * un'eliminazione che non elimina deve dirlo, non far sparire la voce dall'elenco fino
 * al prossimo aggiornamento.
 */
export async function eliminaBozza(id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('ispezioni')
    .delete()
    .eq('id', id)
    // Una scheda firmata e inviata non si tocca, nemmeno passando l'id sbagliato.
    .eq('stato', 'bozza')
    .select('id');

  if (error) throw error;
  if ((data ?? []).length === 0) return false;

  // Una conclusione interrotta dopo il caricamento delle firme ma prima del PDF lascia
  // la scheda in bozza e i due PNG sullo Storage. Tolta la riga, nessuno può più
  // risalirci: si puliscono qui, senza far fallire l'eliminazione se non ci sono.
  try {
    await supabase.storage.from('firme').remove([`${id}/ispettore.png`, `${id}/responsabile.png`]);
  } catch {
    // best effort
  }

  return true;
}

type AttivitaExport = {
  ispezione_id: string;
  ordine: number;
  note: string | null;
  scadenza_data: string | null;
  scadenza_testo: string | null;
  scadenza_note: string | null;
  destinatari: { nome: string } | null;
  reparti: { nome: string } | null;
  tipi_intervento: { nome: string } | null;
};

const ETICHETTA_STATO: Record<StatoIspezione, string> = {
  bozza: 'Bozza',
  conclusa: 'Da inviare',
  inviata: 'Inviata',
  errore_invio: 'Invio non riuscito',
};

const COLONNE = [
  'Numero',
  'Data',
  'Ingresso',
  'Uscita',
  'Sigla',
  'Città',
  'Insegna',
  'Ispettore',
  'Stato',
  'Esito',
  'Destinatario',
  'Reparto',
  'Tipo intervento',
  'Note',
  'Scadenza',
  'Attività svolte',
];

/**
 * Il punto e virgola, non la virgola: Excel in italiano apre un CSV separato da virgole
 * tutto dentro la prima colonna, e chi lo riceve pensa che l'export sia rotto. Il BOM
 * serve allo stesso Excel per riconoscere UTF-8 e non storpiare gli accenti.
 */
const SEPARATORE = ';';

function campo(valore: string | number | null | undefined): string {
  const s = String(valore ?? '');
  return /[";\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/**
 * Una riga per attività rilevata, con i dati dell'ispezione ripetuti accanto: è la forma
 * che le tabelle pivot si aspettano. Un'ispezione senza rilievi produce comunque la sua
 * riga, con le colonne dell'attività vuote, così dall'export non sparisce nessuna visita.
 */
export async function esportaCsv(
  ispezioni: Ispezione[],
  pdvPerId: (id: string) => Pdv | null,
  ispettori: Profilo[],
): Promise<string> {
  const ids = ispezioni.map((i) => i.id);

  const [attivita, svolte] = await Promise.all([
    ids.length
      ? supabase
          .from('ispezione_attivita')
          .select(
            'ispezione_id, ordine, note, scadenza_data, scadenza_testo, scadenza_note, destinatari(nome), reparti(nome), tipi_intervento(nome)',
          )
          .in('ispezione_id', ids)
          .order('ordine')
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? supabase
          .from('ispezione_svolte')
          .select('ispezione_id, ordine, descrizione')
          .in('ispezione_id', ids)
          .order('ordine')
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (attivita.error) throw attivita.error;
  if (svolte.error) throw svolte.error;

  const perIspezione = new Map<string, AttivitaExport[]>();
  for (const r of (attivita.data ?? []) as unknown as AttivitaExport[]) {
    const elenco = perIspezione.get(r.ispezione_id) ?? [];
    elenco.push(r);
    perIspezione.set(r.ispezione_id, elenco);
  }

  const svoltePerIspezione = new Map<string, string[]>();
  for (const r of (svolte.data ?? []) as { ispezione_id: string; descrizione: string }[]) {
    const elenco = svoltePerIspezione.get(r.ispezione_id) ?? [];
    elenco.push(r.descrizione);
    svoltePerIspezione.set(r.ispezione_id, elenco);
  }

  const nomeIspettore = new Map(ispettori.map((p) => [p.id, `${p.cognome} ${p.nome}`]));

  const righe: string[] = [COLONNE.join(SEPARATORE)];

  for (const i of ispezioni) {
    const pdv = pdvPerId(i.pdv_id);
    const testata = [
      i.numero,
      dataBreve(daDataISO(i.data_ispezione)),
      ora(new Date(i.ora_ingresso)),
      i.ora_uscita ? ora(new Date(i.ora_uscita)) : '',
      pdv?.codice ?? '',
      pdv?.citta ?? '',
      pdv?.ragione_sociale ?? '',
      nomeIspettore.get(i.ispettore_id) ?? '',
      ETICHETTA_STATO[i.stato],
      i.niente_da_rilevare ? 'Niente da rilevare' : 'Con rilievi',
    ];
    const svolteTesto = (svoltePerIspezione.get(i.id) ?? []).join(' · ');
    const attivitaIspezione = perIspezione.get(i.id) ?? [];

    if (attivitaIspezione.length === 0) {
      righe.push([...testata, '', '', '', '', '', svolteTesto].map(campo).join(SEPARATORE));
      continue;
    }

    for (const a of attivitaIspezione) {
      righe.push(
        [
          ...testata,
          a.destinatari?.nome ?? '',
          a.reparti?.nome ?? '',
          a.tipi_intervento?.nome ?? '',
          a.note ?? '',
          testoScadenza({
            scadenza_data: a.scadenza_data,
            scadenza_testo: a.scadenza_testo ?? '',
            scadenza_note: a.scadenza_note ?? '',
          }),
          svolteTesto,
        ]
          .map(campo)
          .join(SEPARATORE),
      );
    }
  }

  return '﻿' + righe.join('\r\n') + '\r\n';
}

export function nomeFileExport(f: Filtri): string {
  const periodo =
    f.da || f.a ? `_${f.da ? dataISO(f.da) : 'inizio'}_${f.a ? dataISO(f.a) : 'oggi'}` : '';
  return `ispezioni${periodo}.csv`;
}
