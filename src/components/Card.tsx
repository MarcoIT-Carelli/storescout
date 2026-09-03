import { StyleSheet, View, type ViewStyle } from 'react-native';

import { raggio, spazio, useColori } from '@/theme';

type Props = {
  children: React.ReactNode;
  /** Bordo giallo a sinistra: segnala l'ispezione in corso. Va usato con parsimonia. */
  inCorso?: boolean;
  spento?: boolean;
  style?: ViewStyle;
};

export function Card({ children, inCorso = false, spento = false, style }: Props) {
  const c = useColori();
  return (
    <View
      style={[
        stili.card,
        {
          backgroundColor: spento ? c.disabilitato : c.superficie,
          borderColor: c.bordo,
        },
        inCorso && { borderLeftWidth: 4, borderLeftColor: c.giallo },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const stili = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: raggio.lg,
    padding: spazio.lg,
  },
});
