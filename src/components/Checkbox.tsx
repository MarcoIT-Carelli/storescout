import { Pressable, StyleSheet, Text, View } from 'react-native';

import { raggio, spazio, testo, TOCCO_MIN, useColori } from '@/theme';

type Props = {
  etichetta: string;
  descrizione?: string;
  valore: boolean;
  onChange: (v: boolean) => void;
  disabilitato?: boolean;
};

export function Checkbox({ etichetta, descrizione, valore, onChange, disabilitato = false }: Props) {
  const c = useColori();

  return (
    <Pressable
      onPress={() => onChange(!valore)}
      disabled={disabilitato}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: valore, disabled: disabilitato }}
      style={({ pressed }) => [
        stili.riga,
        {
          backgroundColor: pressed && !disabilitato ? c.superficieAlt : 'transparent',
          opacity: disabilitato ? 0.5 : 1,
        },
      ]}
    >
      <View
        style={[
          stili.quadro,
          {
            borderColor: valore ? c.nero : c.bordo,
            backgroundColor: valore ? c.giallo : c.superficie,
          },
        ]}
      >
        {valore ? <Text style={stili.segno}>✓</Text> : null}
      </View>
      <View style={stili.testi}>
        <Text style={[testo.corpoForte, { color: c.testo }]}>{etichetta}</Text>
        {descrizione ? (
          <Text style={[testo.piccolo, { color: c.testoSecondario }]}>{descrizione}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const stili = StyleSheet.create({
  riga: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazio.md,
    minHeight: TOCCO_MIN,
    paddingVertical: spazio.sm,
    paddingHorizontal: spazio.sm,
    borderRadius: raggio.md,
  },
  quadro: {
    width: 28,
    height: 28,
    borderRadius: raggio.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segno: { fontSize: 18, fontWeight: '900', color: '#111111', lineHeight: 20 },
  testi: { flex: 1, gap: 2 },
});
