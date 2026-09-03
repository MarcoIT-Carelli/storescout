import { supabase } from './supabase';

/**
 * Gestione delle liste valori dal pannello admin.
 *
 * Le voci non si eliminano mai, si disattivano: un'ispezione già archiviata deve restare
 * leggibile con i nomi che aveva quando è stata compilata, e la riga figlia punta all'id.
 */

export type Tabella = 'destinatari' | 'reparti' | 'tipi_intervento';

export type Voce = {
  id: string;
  nome: string;
  ordine: number;
  attivo: boolean;
  /** Solo per `destinatari`: indirizzo a cui inoltrare le attività assegnate. */
  email?: string | null;
};

export const ETICHETTE: Record<Tabella, { titolo: string; singolare: string; conEmail: boolean }> = {
  destinatari: { titolo: 'Destinatari', singolare: 'destinatario', conEmail: true },
  reparti: { titolo: 'Reparti', singolare: 'reparto', conEmail: false },
  tipi_intervento: { titolo: 'Tipi di intervento', singolare: 'tipo di intervento', conEmail: false },
};

const colonne = (t: Tabella) => (t === 'destinatari' ? 'id, nome, ordine, attivo, email' : 'id, nome, ordine, attivo');

/** Legge tutte le voci, comprese quelle disattivate: l'admin le deve poter riattivare. */
export async function leggiVoci(tabella: Tabella): Promise<Voce[]> {
  const { data, error } = await supabase.from(tabella).select(colonne(tabella)).order('ordine');
  if (error) throw error;
  return (data ?? []) as unknown as Voce[];
}

export async function creaVoce(
  tabella: Tabella,
  nome: string,
  email: string | null,
  ordine: number,
): Promise<void> {
  const riga: Record<string, unknown> = { nome: nome.trim(), ordine, attivo: true };
  if (ETICHETTE[tabella].conEmail) riga.email = email?.trim() || null;

  const { error } = await supabase.from(tabella).insert(riga);
  if (error) throw error;
}

export async function aggiornaVoce(
  tabella: Tabella,
  id: string,
  cambi: { nome?: string; email?: string | null; attivo?: boolean },
): Promise<void> {
  const riga: Record<string, unknown> = {};
  if (cambi.nome !== undefined) riga.nome = cambi.nome.trim();
  if (cambi.attivo !== undefined) riga.attivo = cambi.attivo;
  if (cambi.email !== undefined && ETICHETTE[tabella].conEmail) riga.email = cambi.email?.trim() || null;

  const { error } = await supabase.from(tabella).update(riga).eq('id', id);
  if (error) throw error;
}

/**
 * Rinumera l'elenco da 1 a n e scrive solo le righe il cui ordine è cambiato.
 * I valori di partenza possono avere buchi o duplicati: rinumerare evita di doverli sanare.
 */
export async function salvaOrdine(tabella: Tabella, elenco: Voce[]): Promise<Voce[]> {
  const rinumerato = elenco.map((v, i) => ({ ...v, ordine: i + 1 }));
  const cambiate = rinumerato.filter((v, i) => v.ordine !== elenco[i].ordine);

  for (const v of cambiate) {
    const { error } = await supabase.from(tabella).update({ ordine: v.ordine }).eq('id', v.id);
    if (error) throw error;
  }
  return rinumerato;
}

/** Scambia una voce con quella accanto, restituendo il nuovo elenco già rinumerato. */
export function scambia(elenco: Voce[], indice: number, direzione: -1 | 1): Voce[] {
  const altro = indice + direzione;
  if (altro < 0 || altro >= elenco.length) return elenco;
  const copia = [...elenco];
  [copia[indice], copia[altro]] = [copia[altro], copia[indice]];
  return copia;
}

/** Controllo volutamente permissivo: serve a intercettare i refusi, non a validare la casella. */
export const emailPlausibile = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());
