import type { Pdv } from '@/types/database';

import { booleano, leggiCsv, type RigaCsv } from './csv';
import { supabase } from './supabase';

/**
 * Anagrafica punti vendita dal pannello admin, importazione CSV compresa.
 *
 * L'importazione non scrive mai al primo colpo: prima produce un piano — quante righe
 * sono nuove, quante aggiornano un record esistente, quali sono scartate e perché — e
 * solo dopo conferma esplicita tocca il database. Un file sbagliato riscriverebbe
 * altrimenti quarantasei anagrafiche in silenzio.
 */

export type CampoPdv =
  | 'progressivo'
  | 'codice'
  | 'citta'
  | 'indirizzo'
  | 'ragione_sociale'
  | 'codice_deposito'
  | 'telefono'
  | 'email'
  | 'responsabile_nome';

/** Colonne obbligatorie: sono quelle dichiarate `not null` nello schema. */
const OBBLIGATORIE: CampoPdv[] = ['progressivo', 'codice', 'citta', 'indirizzo', 'ragione_sociale'];

/**
 * Nomi alternativi accettati nell'intestazione. La specifica al §10.2 parla di `insegna`
 * dove lo schema ha `ragione_sociale`: si accettano entrambi invece di far fallire
 * l'import per una parola.
 */
const SINONIMI: Record<string, CampoPdv> = {
  insegna: 'ragione_sociale',
  ragione_sociale: 'ragione_sociale',
  'ragione sociale': 'ragione_sociale',
  codice: 'codice',
  sigla: 'codice',
  citta: 'citta',
  città: 'citta',
  comune: 'citta',
  indirizzo: 'indirizzo',
  progressivo: 'progressivo',
  codice_deposito: 'codice_deposito',
  deposito: 'codice_deposito',
  dep: 'codice_deposito',
  telefono: 'telefono',
  email: 'email',
  responsabile_nome: 'responsabile_nome',
  responsabile: 'responsabile_nome',
};

export type VocePiano = {
  codice: string;
  citta: string;
  azione: 'nuovo' | 'aggiornato';
  valori: Partial<Record<CampoPdv, string | null>> & { attivo: boolean };
};

export type Piano = {
  voci: VocePiano[];
  scartate: { riga: number; motivo: string }[];
  /** Colonne del file che lo schema non prevede: vengono ignorate, non inventate. */
  colonneIgnorate: string[];
};

export async function leggiTuttiPdv(): Promise<Pdv[]> {
  const { data, error } = await supabase.from('pdv').select('*').order('codice');
  if (error) throw error;
  return (data ?? []) as Pdv[];
}

export async function salvaPdv(id: string, cambi: Partial<Pdv>): Promise<void> {
  const { error } = await supabase.from('pdv').update(cambi).eq('id', id);
  if (error) throw error;
}

export async function creaPdv(valori: Partial<Pdv>): Promise<void> {
  const { error } = await supabase.from('pdv').insert(valori);
  if (error) throw error;
}

/** Costruisce il piano di importazione senza scrivere nulla. */
export function preparaImport(contenuto: string, esistenti: Pdv[]): Piano {
  const { intestazione, righe } = leggiCsv(contenuto);

  const mappa = new Map<number, CampoPdv>();
  const colonneIgnorate: string[] = [];
  intestazione.forEach((nome, i) => {
    const campo = SINONIMI[nome];
    if (campo) mappa.set(i, campo);
    else if (nome && nome !== 'attivo') colonneIgnorate.push(nome);
  });

  const indiceAttivo = intestazione.indexOf('attivo');
  const perCodice = new Map(esistenti.map((p) => [p.codice.toUpperCase(), p]));

  const voci: VocePiano[] = [];
  const scartate: { riga: number; motivo: string }[] = [];
  const vistiNelFile = new Set<string>();

  righe.forEach((riga, i) => {
    const numeroRiga = i + 2; // +1 per l'intestazione, +1 perché i fogli contano da 1
    const valori: Partial<Record<CampoPdv, string | null>> = {};

    intestazione.forEach((nome, colonna) => {
      const campo = mappa.get(colonna);
      if (!campo) return;
      const valore = (riga as RigaCsv)[nome]?.trim() ?? '';
      valori[campo] = valore === '' ? null : valore;
    });

    const codice = (valori.codice ?? '').toUpperCase();
    if (!codice) {
      scartate.push({ riga: numeroRiga, motivo: 'manca il codice' });
      return;
    }
    if (vistiNelFile.has(codice)) {
      scartate.push({ riga: numeroRiga, motivo: `codice ${codice} ripetuto nel file` });
      return;
    }

    const esistente = perCodice.get(codice);
    const mancanti = OBBLIGATORIE.filter((c) => !valori[c] && !esistente);
    if (mancanti.length > 0) {
      scartate.push({ riga: numeroRiga, motivo: `nuovo punto vendita senza ${mancanti.join(', ')}` });
      return;
    }

    vistiNelFile.add(codice);
    voci.push({
      codice,
      citta: valori.citta ?? esistente?.citta ?? '',
      azione: esistente ? 'aggiornato' : 'nuovo',
      valori: {
        ...valori,
        codice,
        attivo: indiceAttivo >= 0 ? booleano((riga as RigaCsv).attivo) : (esistente?.attivo ?? true),
      },
    });
  });

  return { voci, scartate, colonneIgnorate };
}

/**
 * Applica il piano. `upsert` su `codice` aggiorna solo le colonne presenti nel file:
 * quelle assenti restano com'erano, così un CSV parziale non azzera i dati esistenti.
 */
export async function applicaImport(piano: Piano): Promise<number> {
  if (piano.voci.length === 0) return 0;

  const righe = piano.voci.map((v) => {
    const riga: Record<string, unknown> = { attivo: v.valori.attivo };
    for (const [campo, valore] of Object.entries(v.valori)) {
      if (campo !== 'attivo' && valore !== undefined) riga[campo] = valore;
    }
    return riga;
  });

  const { error } = await supabase.from('pdv').upsert(righe, { onConflict: 'codice' });
  if (error) throw error;
  return righe.length;
}
