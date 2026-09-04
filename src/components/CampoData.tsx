import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { dataBreve } from '@/lib/format';
import { raggio, spazio, testo, TOCCO_MIN, useColori } from '@/theme';

type Props = {
  etichetta: string;
  valore: Date | null;
  onChange: (d: Date | null) => void;
};

/** Estremo di un intervallo di date. Vuoto significa «nessun limite», non «oggi». */
export function CampoData({ etichetta, valore, onChange }: Props) {
  const c = useColori();

  const apri = () => {
    if (Platform.OS !== 'android') return;
    DateTimePickerAndroid.open({
      value: valore ?? new Date(),
      mode: 'date',
      onChange: (evento, scelta) => {
        if (evento.type !== 'set' || !scelta) return;
        onChange(scelta);
      },
    });
  };

  return (
    <View style={{ flex: 1, gap: spazio.xs }}>
      <Text style={[testo.etichetta, { color: c.testoSecondario }]}>{etichetta}</Text>
      <View style={stili.campo}>
        <Pressable
          onPress={apri}
          style={({ pressed }) => [
            stili.premibile,
            { borderColor: c.bordo, backgroundColor: pressed ? c.superficieAlt : c.superficie },
          ]}
          accessibilityRole="button"
        >
          <Text style={[testo.corpo, { color: valore ? c.testo : c.testoDisabilitato }]}>
            {valore ? dataBreve(valore) : 'Qualsiasi'}
          </Text>
        </Pressable>
        {valore ? (
          <Pressable
            onPress={() => onChange(null)}
            hitSlop={8}
            style={stili.pulisci}
            accessibilityRole="button"
            accessibilityLabel={`Rimuovi il filtro ${etichetta}`}
          >
            <Text style={{ color: c.testoSecondario, fontSize: 18 }}>✕</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const stili = StyleSheet.create({
  campo: { flexDirection: 'row', alignItems: 'center', gap: spazio.xs },
  premibile: {
    flex: 1,
    minHeight: TOCCO_MIN,
    borderWidth: 1,
    borderRadius: raggio.md,
    paddingHorizontal: spazio.md,
    justifyContent: 'center',
  },
  pulisci: { width: TOCCO_MIN, height: TOCCO_MIN, alignItems: 'center', justifyContent: 'center' },
});
