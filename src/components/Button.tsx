import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { raggio, spazio, testo, TOCCO_MIN, useColori } from '@/theme';

type Variante = 'primario' | 'secondario' | 'testo' | 'distruttivo';

type Props = {
  titolo: string;
  onPress: () => void;
  variante?: Variante;
  disabilitato?: boolean;
  inCorso?: boolean;
  larghezzaPiena?: boolean;
  compatto?: boolean;
  style?: ViewStyle;
};

export function Button({
  titolo,
  onPress,
  variante = 'primario',
  disabilitato = false,
  inCorso = false,
  larghezzaPiena = false,
  compatto = false,
  style,
}: Props) {
  const c = useColori();
  const bloccato = disabilitato || inCorso;

  const sfondo = (premuto: boolean) => {
    if (bloccato) return variante === 'primario' ? c.disabilitato : 'transparent';
    switch (variante) {
      case 'primario':
        return premuto ? c.gialloPremuto : c.giallo;
      case 'secondario':
        return premuto ? c.superficieAlt : c.superficie;
      default:
        return premuto ? c.superficieAlt : 'transparent';
    }
  };

  const coloreTesto = bloccato
    ? c.testoDisabilitato
    : variante === 'primario'
      ? c.suGiallo
      : variante === 'distruttivo'
        ? c.errore
        : c.testo;

  return (
    <Pressable
      onPress={onPress}
      disabled={bloccato}
      accessibilityRole="button"
      accessibilityState={{ disabled: bloccato, busy: inCorso }}
      style={({ pressed }) => [
        stili.base,
        {
          backgroundColor: sfondo(pressed),
          borderColor: variante === 'secondario' ? c.bordo : 'transparent',
          borderWidth: variante === 'secondario' ? 1 : 0,
          minHeight: compatto ? TOCCO_MIN : 56,
          paddingHorizontal: compatto ? spazio.md : spazio.xl,
          alignSelf: larghezzaPiena ? 'stretch' : 'flex-start',
        },
        style,
      ]}
    >
      <View style={stili.contenuto}>
        {inCorso && <ActivityIndicator size="small" color={coloreTesto} />}
        <Text style={[compatto ? testo.piccolo : testo.corpoForte, { color: coloreTesto, fontWeight: '700' }]}>
          {titolo}
        </Text>
      </View>
    </Pressable>
  );
}

const stili = StyleSheet.create({
  base: {
    borderRadius: raggio.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contenuto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazio.sm,
  },
});
