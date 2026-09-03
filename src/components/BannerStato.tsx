import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { raggio, spazio, testo, TOCCO_MIN, useColori } from '@/theme';

export type StatoOperazione =
  | { tipo: 'inattivo' }
  | { tipo: 'inCorso'; messaggio: string }
  | { tipo: 'riuscito'; messaggio: string }
  | { tipo: 'fallito'; messaggio: string };

export const INATTIVO: StatoOperazione = { tipo: 'inattivo' };

/**
 * Rende visibili tutti e tre gli esiti di un'operazione di rete. Un'operazione che
 * fallisce in silenzio è il modo più veloce per far perdere fiducia in un'app da campo.
 */
export function BannerStato({
  stato,
  onRiprova,
  onChiudi,
}: {
  stato: StatoOperazione;
  onRiprova?: () => void;
  onChiudi?: () => void;
}) {
  const c = useColori();
  if (stato.tipo === 'inattivo') return null;

  const aspetto = {
    inCorso: { sfondo: c.superficieAlt, bordo: c.bordo, colore: c.testoSecondario, segno: '' },
    riuscito: { sfondo: c.successoSfondo, bordo: c.successo, colore: c.successo, segno: '✓' },
    fallito: { sfondo: c.erroreSfondo, bordo: c.errore, colore: c.errore, segno: '!' },
  }[stato.tipo];

  return (
    <View style={[stili.banner, { backgroundColor: aspetto.sfondo, borderColor: aspetto.bordo }]}>
      {stato.tipo === 'inCorso' ? (
        <ActivityIndicator size="small" color={aspetto.colore} />
      ) : (
        <Text style={[stili.segno, { color: aspetto.colore }]}>{aspetto.segno}</Text>
      )}

      <Text style={[testo.piccolo, { color: c.testo, flex: 1 }]}>{stato.messaggio}</Text>

      {stato.tipo === 'fallito' && onRiprova ? (
        <Pressable onPress={onRiprova} style={stili.azione} accessibilityRole="button">
          <Text style={[testo.corpoForte, { color: c.errore }]}>Riprova</Text>
        </Pressable>
      ) : null}

      {stato.tipo !== 'inCorso' && onChiudi ? (
        <Pressable onPress={onChiudi} style={stili.azione} hitSlop={8} accessibilityRole="button">
          <Text style={[testo.corpoForte, { color: c.testoSecondario }]}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const stili = StyleSheet.create({
  banner: {
    borderWidth: 1,
    borderRadius: raggio.md,
    paddingHorizontal: spazio.md,
    paddingVertical: spazio.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazio.md,
    minHeight: TOCCO_MIN,
  },
  segno: { fontSize: 17, fontWeight: '900', width: 18, textAlign: 'center' },
  azione: { minHeight: TOCCO_MIN, justifyContent: 'center', paddingHorizontal: spazio.sm },
});
