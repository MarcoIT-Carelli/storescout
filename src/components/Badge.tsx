import { StyleSheet, Text, View } from 'react-native';

import { raggio, spazio, testo, useColori } from '@/theme';

export type Tono = 'neutro' | 'successo' | 'attenzione' | 'errore' | 'corso';

export function Badge({ testo: etichetta, tono = 'neutro' }: { testo: string; tono?: Tono }) {
  const c = useColori();

  const { sfondo, colore } = {
    neutro: { sfondo: c.superficieAlt, colore: c.testoSecondario },
    successo: { sfondo: c.successoSfondo, colore: c.successo },
    attenzione: { sfondo: c.attenzioneSfondo, colore: c.attenzione },
    errore: { sfondo: c.erroreSfondo, colore: c.errore },
    corso: { sfondo: c.giallo, colore: c.suGiallo },
  }[tono];

  return (
    <View style={[stili.badge, { backgroundColor: sfondo }]}>
      <Text style={[testo.etichetta, { color: colore }]} numberOfLines={1}>
        {etichetta}
      </Text>
    </View>
  );
}

const stili = StyleSheet.create({
  badge: {
    paddingHorizontal: spazio.md,
    paddingVertical: spazio.xs + 2,
    borderRadius: raggio.pill,
    alignSelf: 'flex-start',
  },
});
