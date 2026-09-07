import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { NOVITA, REVISIONE } from '@/lib/versione';

/**
 * Aggiornamenti dell'app senza reinstallare niente.
 *
 * Quando ne esiste uno **si smette di lavorare finché non è applicato**: una scheda
 * compilata con una versione vecchia potrebbe non avere i campi che l'ufficio si
 * aspetta, e accorgersene a firma raccolta non serve a nessuno.
 *
 * Lo sbarramento scatta solo quando l'aggiornamento è stato trovato davvero, cioè
 * quando la rete c'era. Se la ricerca fallisce si tace e si riprova alla prossima
 * apertura: bloccare un ispettore appena entrato in un magazzino senza campo
 * sarebbe il modo peggiore di applicare questa regola.
 */

const CHIAVE_VISTA = 'storescout.revisione.vista';

export type Fase =
  | 'assente'
  | 'verifica'
  | 'aggiornato'
  | 'errore_verifica'
  | 'obbligatorio'
  | 'scaricamento'
  | 'errore_scaricamento';

type Stato = {
  fase: Fase;
  /** Vero quando l'app non deve lasciar fare altro. */
  bloccante: boolean;
  cerca: () => void;
  scarica: () => void;
  chiudi: () => void;
};

const Contesto = createContext<Stato | null>(null);

export function AggiornamentiProvider({ children }: { children: ReactNode }) {
  const [fase, setFase] = useState<Fase>('assente');
  const inCorso = useRef(false);

  const scarica = useCallback(async () => {
    if (inCorso.current) return;
    inCorso.current = true;
    setFase('scaricamento');
    try {
      await Updates.fetchUpdateAsync();
      // Da qui in poi l'app riparte con il contenuto nuovo: quello che segue questa
      // riga non viene eseguito.
      await Updates.reloadAsync();
    } catch {
      inCorso.current = false;
      setFase('errore_scaricamento');
    }
  }, []);

  /**
   * `manuale` distingue i due modi di arrivare qui. All'apertura si tace se non c'è
   * niente da dire; se invece è l'utente ad aver chiesto, una risposta la merita —
   * anche quando la risposta è «sei già aggiornato».
   */
  const cerca = useCallback(
    async (manuale = false) => {
      if (!Updates.isEnabled) {
        if (manuale) setFase('aggiornato');
        return;
      }
      if (manuale) setFase('verifica');
      try {
        const esito = await Updates.checkForUpdateAsync();
        if (esito.isAvailable) {
          setFase('obbligatorio');
          void scarica();
        } else {
          setFase(manuale ? 'aggiornato' : 'assente');
        }
      } catch {
        setFase(manuale ? 'errore_verifica' : 'assente');
      }
    },
    [scarica],
  );

  useEffect(() => {
    void cerca();
  }, [cerca]);

  const bloccante =
    fase === 'obbligatorio' || fase === 'scaricamento' || fase === 'errore_scaricamento';

  return (
    <Contesto.Provider
      value={{
        fase,
        bloccante,
        cerca: () => void cerca(true),
        scarica: () => void scarica(),
        chiudi: () => setFase('assente'),
      }}
    >
      {children}
    </Contesto.Provider>
  );
}

export function useAggiornamenti(): Stato {
  const s = useContext(Contesto);
  if (!s) throw new Error('useAggiornamenti va usato dentro AggiornamentiProvider');
  return s;
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
