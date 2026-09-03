import type { Bozza } from '@/types/bozza';
import { rigaCompilata } from '@/types/bozza';

export type Problema = {
  /** Schermata da aprire per correggere. */
  dove: 'scheda' | 'firme';
  messaggio: string;
};

/**
 * Controlli richiesti prima di concludere un'ispezione (§6.8 della specifica).
 * Restituisce l'elenco completo dei problemi, non solo il primo: chi compila deve
 * poter sistemare tutto in un passaggio invece di scoprire un errore alla volta.
 */
export function validaBozza(bozza: Bozza): Problema[] {
  const problemi: Problema[] = [];

  if (!bozza.pdv_id) {
    problemi.push({ dove: 'scheda', messaggio: 'Manca il punto vendita.' });
  }

  const righe = bozza.attivita.filter(rigaCompilata);

  if (!bozza.niente_da_rilevare && righe.length === 0) {
    problemi.push({
      dove: 'scheda',
      messaggio: 'Inserisci almeno un’attività rilevata oppure spunta "Niente da rilevare".',
    });
  }

  if (!bozza.niente_da_rilevare) {
    righe.forEach((r, i) => {
      const n = i + 1;
      const mancanti: string[] = [];
      if (!r.destinatario_id) mancanti.push('destinatario');
      if (!r.reparto_id) mancanti.push('reparto');
      if (!r.tipo_intervento_id) mancanti.push('tipo di intervento');
      if (!r.scadenza_data && !r.scadenza_testo.trim()) mancanti.push('scadenza');

      if (mancanti.length > 0) {
        problemi.push({
          dove: 'scheda',
          messaggio: `Attività ${n}: manca ${elenco(mancanti)}.`,
        });
      }

      if (r.scadenza_data && r.scadenza_testo.trim()) {
        problemi.push({
          dove: 'scheda',
          messaggio: `Attività ${n}: scegli una data oppure una scadenza generica, non entrambe.`,
        });
      }
    });
  }

  if (!bozza.firma_ispettore_uri) {
    problemi.push({ dove: 'firme', messaggio: 'Manca la firma dell’ispettore.' });
  }

  if (!bozza.firma_responsabile_uri && !bozza.motivo_assenza_firma.trim()) {
    problemi.push({
      dove: 'firme',
      messaggio: 'Manca la firma del responsabile: raccoglila oppure indica il motivo dell’assenza.',
    });
  }

  if (bozza.firma_responsabile_uri && !bozza.nome_responsabile.trim()) {
    problemi.push({ dove: 'firme', messaggio: 'Manca il nome del responsabile che ha firmato.' });
  }

  if (bozza.ora_uscita && new Date(bozza.ora_uscita) < new Date(bozza.ora_ingresso)) {
    problemi.push({ dove: 'scheda', messaggio: 'L’ora di uscita precede quella di ingresso.' });
  }

  return problemi;
}

function elenco(voci: string[]): string {
  if (voci.length === 1) return `il ${voci[0]}`;
  return `${voci.slice(0, -1).map((v) => `il ${v}`).join(', ')} e ${`il ${voci[voci.length - 1]}`}`;
}
