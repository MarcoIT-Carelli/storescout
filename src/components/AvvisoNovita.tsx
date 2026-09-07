import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { REVISIONE } from '@/lib/versione';
import { raggio, spazio, testo, useColori } from '@/theme';

type Props = {
  voci: string[] | null;
  onChiudi: () => void;
};

/**
 * Che cosa è cambiato dopo un aggiornamento. Compare una volta sola.
 *
 * Qui la finestra al centro ci sta, a differenza delle conferme: non è una domanda a
 * cui rispondere di fretta col tablet in mano, è una notizia da leggere una volta e
 * archiviare. Si chiude solo dal pulsante, altrimenti un tocco distratto la farebbe
 * sparire prima di averla letta e non tornerebbe più.
 */
export function AvvisoNovita({ voci, onChiudi }: Props) {
  const c = useColori();
  if (!voci || voci.length === 0) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onChiudi}>
      <View style={stili.velo}>
        <View style={[stili.foglio, { backgroundColor: c.superficie, borderColor: c.bordo }]}>
          <View style={[stili.testata, { backgroundColor: c.giallo }]}>
            <Text style={[testo.sezione, { color: c.suGiallo }]}>Che cosa è cambiato</Text>
            <Text style={[testo.piccolo, { color: c.suGiallo, opacity: 0.75 }]}>
              StoreScout è stato aggiornato alla versione {REVISIONE}
            </Text>
          </View>

          <ScrollView contentContainerStyle={stili.corpo}>
            {voci.map((v, i) => (
              <View key={i} style={stili.voce}>
                <View style={[stili.punto, { backgroundColor: c.giallo }]} />
                <Text style={[testo.corpo, { color: c.testo, flex: 1 }]}>{v}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={[stili.piede, { borderTopColor: c.bordo }]}>
            <Button titolo="Ho capito" larghezzaPiena onPress={onChiudi} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const stili = StyleSheet.create({
  velo: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spazio.xl,
  },
  foglio: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '80%',
    borderRadius: raggio.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  testata: { paddingHorizontal: spazio.lg, paddingVertical: spazio.md, gap: 2 },
  corpo: { padding: spazio.lg, gap: spazio.md },
  voce: { flexDirection: 'row', alignItems: 'flex-start', gap: spazio.md },
  punto: { width: 8, height: 8, borderRadius: 4, marginTop: 7 },
  piede: { padding: spazio.lg, borderTopWidth: 1 },
});
