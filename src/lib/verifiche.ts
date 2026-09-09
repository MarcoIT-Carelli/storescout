import type { Ispezione } from '@/types/database';

import { daDataISO } from './format';
import { supabase } from './supabase';

/**
 * Ispezioni che restano in carico all'ispettore dopo l'invio.
 *
 * Quando una scheda contiene attività assegnate a un destinatario marcato
 * `richiede_verifica` — oggi CN — spedirla non basta a considerarla chiusa: qualcuno deve
 * tornare a controllare che l'intervento sia stato fatto. La scheda resta quindi «da
 * chiudere» in home finché non è l'ispettore a dichiararla conclusa.
 *
 * Il promemoria arriva in due modi diversi, a seconda di come è scritta la scadenza:
 *
 * - **scadenza con data**: quando la data è arrivata, l'avviso compare in home;
 * - **scadenza generica** («prossimo ordine»): nessuna data da confrontare, quindi il
 *   promemoria si aggancia al luogo invece che al tempo, e riappare alla prima ispezione
 *   successiva su quel punto vendita.
 */

export type AttivitaDaVerificare = {
  destinatario: string;
  scadenzaData: string | null;
  scadenzaTesto: string | null;
  note: string | null;
};

export type Verifica = {
  ispezione: Ispezione;
  attivita: AttivitaDaVerificare[];
  /** Almeno una scadenza a data è arrivata: l'avviso va mostrato adesso. */
  scaduta: boolean;
  /** Almeno una scadenza è generica: il promemoria torna sul punto vendita. */
  conScadenzaGenerica: boolean;
  /** La più vicina fra le scadenze a data, per ordinare ciò che urge. */
  prossimaScadenza: Date | null;
};

type RigaLetta = {
  scadenza_data: string | null;
  scadenza_testo: string | null;
  note: string | null;
  destinatari: { nome: string; richiede_verifica: boolean } | null;
};

const oggiAMezzanotte = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Le ispezioni ancora da chiudere.
 *
 * Senza `ispettoreId` legge tutte quelle visibili, che per un amministratore sono quelle
 * di tutti: è la vista che serve al pannello.
 */
export async function leggiVerifiche(ispettoreId?: string): Promise<Verifica[]> {
  let query = supabase
    .from('ispezioni')
    .select(
      '*, ispezione_attivita(scadenza_data, scadenza_testo, note, destinatari(nome, richiede_verifica))',
    )
    .eq('in_verifica', true)
    .order('data_ispezione', { ascending: false });

  if (ispettoreId) query = query.eq('ispettore_id', ispettoreId);

  const { data, error } = await query;
  if (error) throw error;

  const oggi = oggiAMezzanotte();

  return ((data ?? []) as unknown as (Ispezione & { ispezione_attivita: RigaLetta[] })[]).map(
    ({ ispezione_attivita, ...ispezione }) => {
      // Solo le righe assegnate a un destinatario da verificare: sono quelle che
      // hanno tenuto aperta la scheda, e le altre qui non c'entrano.
      const righe = (ispezione_attivita ?? []).filter((r) => r.destinatari?.richiede_verifica);

      const date = righe
        .map((r) => (r.scadenza_data ? daDataISO(r.scadenza_data) : null))
        .filter((d): d is Date => d !== null)
        .sort((a, b) => a.getTime() - b.getTime());

      return {
        ispezione: ispezione as Ispezione,
        attivita: righe.map((r) => ({
          destinatario: r.destinatari?.nome ?? '',
          scadenzaData: r.scadenza_data,
          scadenzaTesto: r.scadenza_testo,
          note: r.note,
        })),
        scaduta: date.some((d) => d <= oggi),
        conScadenzaGenerica: righe.some((r) => !r.scadenza_data && Boolean(r.scadenza_testo)),
        prossimaScadenza: date[0] ?? null,
      };
    },
  );
}

/**
 * Dichiara conclusa la verifica di una scheda.
 *
 * Passa da una funzione sul database e non da un update: la policy di `ispezioni` si
 * ferma alle bozze, e allargarla per un solo campo aprirebbe l'intera riga, perché le
 * policy non distinguono fra colonne.
 *
 * Restituisce `false` quando non ha chiuso niente — scheda già chiusa da un altro
 * dispositivo, oppure non propria.
 */
export async function chiudiVerifica(ispezioneId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('chiudi_verifica', { id_ispezione: ispezioneId });
  if (error) throw error;
  return data === true;
}

/**
 * Le verifiche aperte su un punto vendita la cui scadenza è scritta a parole.
 *
 * È il promemoria che non ha una data a cui agganciarsi: torna quando l'ispettore
 * rimette piede in quel negozio, che è l'unico momento in cui può controllare davvero.
 */
export function verificheDelPdv(verifiche: Verifica[], pdvId: string, escludi?: string): Verifica[] {
  return verifiche.filter(
    (v) => v.ispezione.pdv_id === pdvId && v.ispezione.id !== escludi && v.conScadenzaGenerica,
  );
}
