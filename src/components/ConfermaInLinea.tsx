import { Pressable, StyleSheet, Text, View } from 'react-native';

import { raggio, spazio, testo, TOCCO_MIN, useColori } from '@/theme';

type Props = {
  messaggio: string;
  etichettaConferma?: string;
  onConferma: () => void;
  onAnnulla: () => void;
};

/**
 * Conferma per le azioni distruttive. È un banner nel flusso della pagina, non una
 * finestra modale: su tablet in piedi una modale copre il contesto e si tocca a vuoto.
 */
export function ConfermaInLinea({
  messaggio,
  etichettaConferma = 'Elimina',
  onConferma,
  onAnnulla,
}: Props) {
  const c = useColori();

  return (
    <View style={[stili.banner, { backgroundColor: c.erroreSfondo, borderColor: c.errore }]}>
      <Text style={[testo.piccolo, { color: c.testo, flex: 1, minWidth: 180 }]}>{messaggio}</Text>
      <View style={stili.azioni}>
        <Pressable
          onPress={onAnnulla}
          style={({ pressed }) => [stili.azione, pressed && { opacity: 0.6 }]}
          accessibilityRole="button"
        >
          <Text style={[testo.corpoForte, { color: c.testo }]}>Annulla</Text>
        </Pressable>
        <Pressable
          onPress={onConferma}
          style={({ pressed }) => [
            stili.azione,
            { backgroundColor: c.errore },
            pressed && { opacity: 0.85 },
          ]}
          accessibilityRole="button"
        >
          <Text style={[testo.corpoForte, { color: '#FFFFFF' }]}>{etichettaConferma}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const stili = StyleSheet.create({
  banner: {
    borderWidth: 1,
    borderRadius: raggio.md,
    padding: spazio.md,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spazio.md,
  },
  azioni: { flexDirection: 'row', gap: spazio.sm, marginLeft: 'auto' },
  azione: {
    minHeight: TOCCO_MIN,
    paddingHorizontal: spazio.lg,
    borderRadius: raggio.sm,
    justifyContent: 'center',
  },
});
