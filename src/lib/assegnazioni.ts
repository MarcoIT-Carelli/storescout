import { supabase } from './supabase';

/**
 * Punti vendita assegnati a ciascun ispettore.
 *
 * Un ispettore vede e può ispezionare soltanto i punti vendita che l'amministratore
 * gli ha assegnato. La regola vive nelle policy RLS (`04_visibilita_pdv.sql`): quanto
 * segue serve al pannello per leggerla e cambiarla, non a farla rispettare.
 */

/** Assegnazioni di un singolo ispettore. */
export async function leggiAssegnazioni(ispettoreId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('ispettore_pdv')
    .select('pdv_id')
    .eq('ispettore_id', ispettoreId);
  if (error) throw error;
  return (data ?? []).map((r) => (r as { pdv_id: string }).pdv_id);
}

/** Quanti punti vendita ha ciascun ispettore, per l'elenco del pannello. */
export async function contaAssegnazioni(): Promise<Map<string, number>> {
  const { data, error } = await supabase.from('ispettore_pdv').select('ispettore_id');
  if (error) throw error;

  const conteggi = new Map<string, number>();
  for (const riga of (data ?? []) as { ispettore_id: string }[]) {
    conteggi.set(riga.ispettore_id, (conteggi.get(riga.ispettore_id) ?? 0) + 1);
  }
  return conteggi;
}

/**
 * Porta le assegnazioni di un ispettore a coincidere con l'elenco scelto.
 *
 * Scrive solo la differenza invece di cancellare tutto e riscrivere: con
 * quarantasei punti vendita l'azzeramento-e-riscrittura funzionerebbe lo stesso, ma
 * lascerebbe l'ispettore senza nessun punto vendita per la frazione di secondo fra le
 * due operazioni — e se la rete cadesse in mezzo, per molto più di una frazione.
 */
export async function salvaAssegnazioni(ispettoreId: string, scelti: string[]): Promise<void> {
  const attuali = new Set(await leggiAssegnazioni(ispettoreId));
  const desiderati = new Set(scelti);

  const daAggiungere = scelti.filter((id) => !attuali.has(id));
  const daTogliere = [...attuali].filter((id) => !desiderati.has(id));

  if (daAggiungere.length > 0) {
    const { error } = await supabase
      .from('ispettore_pdv')
      .insert(daAggiungere.map((pdv_id) => ({ ispettore_id: ispettoreId, pdv_id })));
    if (error) throw error;
  }

  if (daTogliere.length > 0) {
    // `.select()` per sapere se il database ha tolto davvero qualcosa: senza policy
    // PostgREST risponde «fatto» senza toccare una riga, e un'assegnazione che resta
    // in piedi dopo essere stata revocata è peggio di un errore visibile.
    const { data, error } = await supabase
      .from('ispettore_pdv')
      .delete()
      .eq('ispettore_id', ispettoreId)
      .in('pdv_id', daTogliere)
      .select('pdv_id');
    if (error) throw error;
    if ((data ?? []).length === 0) {
      throw new Error('Il database ha rifiutato la revoca delle assegnazioni.');
    }
  }
}
