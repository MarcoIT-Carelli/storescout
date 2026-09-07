import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { useCallback, useEffect, useState } from 'react';

import { NOVITA, REVISIONE } from '@/lib/versione';

/**
 * Aggiornamenti dell'app senza reinstallare niente.
 *
 * Gli aggiornamenti si scaricano da soli all'apertura e si applicano al riavvio
 * successivo: e' `expo-updates` a farlo, senza chiedere niente. Il banner qui sotto
 * non e' una richiesta di permesso, e' una scorciatoia — permette di applicare subito
 * quello che altrimenti arriverebbe alla prossima apertura.
 *
 * Vive solo nella schermata iniziale perche' applicare un aggiornamento riavvia
 * l'app, e riavviarla mentre si compila una scheda sarebbe un ottimo modo per farsi
 * odiare. Quello che l'ispettore vede sempre, invece, e' il riepilogo delle novita'
 * dopo il riavvio: e' li' che si accorge che qualcosa e' cambiato.
 */

const CHIAVE_VISTA = 'storescout.revisione.vista';

export type StatoAggiornamento =
  | 'assente'
  | 'verifica'
  | 'disponibile'
  | 'aggiornato'
  | 'scaricamento'
  | 'fallito';

export function useAggiornamenti() {
  const [stato, setStato] = useState<StatoAggiornamento>('assente');

  /**
   * `manuale` distingue i due modi di arrivare qui. All'apertura si tace se non c'è
   * niente da dire; se invece è l'utente ad aver chiesto, una risposta la merita —
   * anche quando la risposta è «sei già aggiornato».
   */
  const cerca = useCallback(async (manuale = false) => {
    // In sviluppo e nelle build compilate a mano il modulo è spento: senza questo
    // controllo ogni avvio finirebbe in un errore che non riguarda l'utente.
    if (!Updates.isEnabled) {
      if (manuale) setStato('aggiornato');
      return;
    }

    if (manuale) setStato('verifica');
    try {
      const esito = await Updates.checkForUpdateAsync();
      setStato(esito.isAvailable ? 'disponibile' : manuale ? 'aggiornato' : 'assente');
    } catch {
      // All'apertura si tace: nessuna rete non è un errore da mostrare a chi sta per
      // entrare in un punto vendita. Se invece l'ha chiesto lui, va detto.
      setStato(manuale ? 'fallito' : 'assente');
    }
  }, []);

  useEffect(() => {
    void cerca();
  }, [cerca]);

  const scarica = useCallback(async () => {
    setStato('scaricamento');
    try {
      await Updates.fetchUpdateAsync();
      // Da qui in poi l'app riparte con il contenuto nuovo: quello che viene dopo
      // questa riga non viene eseguito.
      await Updates.reloadAsync();
    } catch {
      setStato('fallito');
    }
  }, []);

  return {
    stato,
    scarica,
    cerca: () => void cerca(true),
    chiudi: () => setStato('assente'),
  };
}

/**
 * Il riepilogo delle novità, una volta sola per versione.
 *
 * Confronta la revisione in esecuzione con l'ultima già annunciata. Al primo avvio in
 * assoluto non mostra niente: chi installa l'app per la prima volta non ha bisogno di
 * sapere che cosa è cambiato rispetto a una versione che non ha mai visto.
 */
export function useNovita() {
  const [voci, setVoci] = useState<string[] | null>(null);

  useEffect(() => {
    let vivo = true;

    AsyncStorage.getItem(CHIAVE_VISTA)
      .then((vista) => {
        if (!vivo) return;
        if (vista !== REVISIONE) {
          const elenco = NOVITA[REVISIONE];
          if (vista !== null && elenco?.length) setVoci(elenco);
          void AsyncStorage.setItem(CHIAVE_VISTA, REVISIONE);
        }
      })
      .catch(() => {
        // Se la memoria locale non risponde si rinuncia all'avviso: è un di più,
        // non deve impedire di lavorare.
      });

    return () => {
      vivo = false;
    };
  }, []);

  return { voci, chiudi: () => setVoci(null) };
}
