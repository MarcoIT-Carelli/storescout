import { StyleSheet, Text, View } from 'react-native';

import { LUNGHEZZA_MINIMA_PASSWORD } from '@/lib/ispettori';
import { raggio, spazio, testo, useColori } from '@/theme';

export type Forza = 'bassa' | 'media' | 'alta';

/**
 * Quanto è robusta la password scritta.
 *
 * Non blocca niente: il minimo di caratteri lo impone già chi salva. Questo serve a
 * far vedere la differenza fra una password che si indovina e una che non si
 * indovina, a chi sta per sceglierne una da dettare a voce a un ispettore.
 *
 * Il conto è volutamente semplice e spiegabile: quante famiglie di caratteri usi
 * (minuscole, maiuscole, cifre, simboli) più un premio per la lunghezza. Nessuna
 * libreria e nessun dizionario: servirebbero a stimare meglio un numero che qui
 * nessuno legge, perché quello che conta è il colore.
 */
export function valutaForza(password: string): Forza | null {
  if (password.length === 0) return null;

  const famiglie =
    (/[a-z]/.test(password) ? 1 : 0) +
    (/[A-Z]/.test(password) ? 1 : 0) +
    (/[0-9]/.test(password) ? 1 : 0) +
    (/[^a-zA-Z0-9]/.test(password) ? 1 : 0);

  const punteggio =
    famiglie + (password.length >= 12 ? 1 : 0) + (password.length >= 16 ? 1 : 0);

  // Sotto il minimo consentito resta rossa comunque: dire «media» a una password
  // che il salvataggio rifiuterà sarebbe una presa in giro.
  if (password.length < LUNGHEZZA_MINIMA_PASSWORD || punteggio <= 2) return 'bassa';
  return punteggio <= 4 ? 'media' : 'alta';
}

const TACCHE: Record<Forza, number> = { bassa: 1, media: 2, alta: 3 };
const ETICHETTE: Record<Forza, string> = {
  bassa: 'Password debole',
  media: 'Password discreta',
  alta: 'Password robusta',
};

export function ForzaPassword({ password }: { password: string }) {
  const c = useColori();
  const forza = valutaForza(password);
  if (!forza) return null;

  const colore = { bassa: c.errore, media: c.attenzione, alta: c.successo }[forza];
  const accese = TACCHE[forza];

  return (
    <View style={stili.blocco}>
      <View style={stili.tacche}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={[stili.tacca, { backgroundColor: i < accese ? colore : c.superficieAlt }]}
          />
        ))}
      </View>
      <Text style={[testo.etichetta, { color: colore, fontWeight: '400' }]}>
        {ETICHETTE[forza]}
      </Text>
    </View>
  );
}

const stili = StyleSheet.create({
  blocco: { gap: spazio.xs },
  tacche: { flexDirection: 'row', gap: spazio.xs },
  tacca: { flex: 1, height: 6, borderRadius: raggio.pill },
});
