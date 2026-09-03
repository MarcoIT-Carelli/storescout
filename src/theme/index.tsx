import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { chiara, scura, type Palette } from './colors';

export * from './colors';
export * from './tokens';

export type Schema = 'chiaro' | 'scuro';
export type Preferenza = Schema | 'sistema';

const CHIAVE_PREFERENZA = 'storescout.tema.preferenza';
const CHIAVE_ULTIMO = 'storescout.tema.ultimo';

/**
 * L'ultimo tema effettivamente mostrato viene riscritto a ogni cambio, così all'avvio
 * successivo l'animazione di apertura parte già nella variante giusta: se l'app è stata
 * chiusa in modalità notturna riapre con il logo scuro, altrimenti con quello chiaro.
 */
export async function leggiTemaSalvato(): Promise<{ preferenza: Preferenza; ultimo: Schema }> {
  const [pref, ultimo] = await AsyncStorage.multiGet([CHIAVE_PREFERENZA, CHIAVE_ULTIMO]);
  const p = pref[1];
  return {
    preferenza: p === 'chiaro' || p === 'scuro' || p === 'sistema' ? p : 'sistema',
    ultimo: ultimo[1] === 'scuro' ? 'scuro' : 'chiaro',
  };
}

type Tema = {
  schema: Schema;
  scuro: boolean;
  colori: Palette;
  preferenza: Preferenza;
  impostaPreferenza: (p: Preferenza) => void;
};

const Contesto = createContext<Tema | null>(null);

export function ThemeProvider({
  children,
  preferenzaIniziale,
}: {
  children: ReactNode;
  preferenzaIniziale: Preferenza;
}) {
  const sistema = useColorScheme();
  const [preferenza, setPreferenza] = useState<Preferenza>(preferenzaIniziale);

  const schema: Schema =
    preferenza === 'sistema' ? (sistema === 'dark' ? 'scuro' : 'chiaro') : preferenza;

  useEffect(() => {
    AsyncStorage.setItem(CHIAVE_ULTIMO, schema).catch(() => {});
  }, [schema]);

  const impostaPreferenza = useCallback((p: Preferenza) => {
    setPreferenza(p);
    AsyncStorage.setItem(CHIAVE_PREFERENZA, p).catch(() => {});
  }, []);

  const valore = useMemo<Tema>(
    () => ({
      schema,
      scuro: schema === 'scuro',
      colori: schema === 'scuro' ? scura : chiara,
      preferenza,
      impostaPreferenza,
    }),
    [schema, preferenza, impostaPreferenza],
  );

  return <Contesto.Provider value={valore}>{children}</Contesto.Provider>;
}

export function useTema(): Tema {
  const t = useContext(Contesto);
  if (!t) throw new Error('useTema va usato dentro ThemeProvider');
  return t;
}

/** Scorciatoia per il caso più frequente: servono solo i colori. */
export function useColori(): Palette {
  return useTema().colori;
}
