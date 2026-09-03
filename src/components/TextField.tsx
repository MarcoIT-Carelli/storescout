import { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';

import { raggio, spazio, testo, TOCCO_MIN, useColori } from '@/theme';

type Props = TextInputProps & {
  etichetta?: string;
  aiuto?: string;
  errore?: string;
  righe?: number;
  contenitore?: ViewStyle;
};

export const TextField = forwardRef<TextInput, Props>(function TextField(
  { etichetta, aiuto, errore, righe = 1, contenitore, style, editable = true, ...resto },
  ref,
) {
  const c = useColori();
  const multilinea = righe > 1;

  return (
    <View style={[{ gap: spazio.xs }, contenitore]}>
      {etichetta ? (
        <Text style={[testo.etichetta, { color: c.testoSecondario }]}>{etichetta}</Text>
      ) : null}
      <TextInput
        ref={ref}
        editable={editable}
        multiline={multilinea}
        textAlignVertical={multilinea ? 'top' : 'center'}
        placeholderTextColor={c.testoDisabilitato}
        style={[
          stili.input,
          testo.corpo,
          {
            color: editable ? c.testo : c.testoDisabilitato,
            backgroundColor: editable ? c.superficie : c.disabilitato,
            borderColor: errore ? c.errore : c.bordo,
            minHeight: multilinea ? 24 * righe + spazio.lg * 2 : TOCCO_MIN,
            paddingTop: multilinea ? spazio.md : undefined,
          },
          style,
        ]}
        {...resto}
      />
      {errore ? (
        <Text style={[testo.etichetta, { color: c.errore, fontWeight: '400' }]}>{errore}</Text>
      ) : aiuto ? (
        <Text style={[testo.etichetta, { color: c.testoSecondario, fontWeight: '400' }]}>{aiuto}</Text>
      ) : null}
    </View>
  );
});

const stili = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: raggio.md,
    paddingHorizontal: spazio.md,
  },
});
