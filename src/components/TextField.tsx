import { forwardRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { raggio, spazio, testo, TOCCO_MIN, useColori } from '@/theme';

type Props = TextInputProps & {
  etichetta?: string;
  aiuto?: string;
  errore?: string;
  righe?: number;
  contenitore?: ViewStyle;
};

export const TextField = forwardRef<TextInput, Props>(function TextField(
  {
    etichetta,
    aiuto,
    errore,
    righe = 1,
    contenitore,
    style,
    editable = true,
    secureTextEntry,
    ...resto
  },
  ref,
) {
  const c = useColori();
  const multilinea = righe > 1;

  /**
   * L'occhio compare da solo sui campi password. Su un tablet in piedi, con una
   * password generata dall'amministratore e letta da un foglietto, digitare alla
   * cieca è il modo più rapido per sbagliare tre volte e chiamare l'assistenza.
   */
  const [svelata, setSvelata] = useState(false);
  const conOcchio = Boolean(secureTextEntry);

  return (
    <View style={[{ gap: spazio.xs }, contenitore]}>
      {etichetta ? (
        <Text style={[testo.etichetta, { color: c.testoSecondario }]}>{etichetta}</Text>
      ) : null}

      <View style={stili.riga}>
        <TextInput
          ref={ref}
          editable={editable}
          multiline={multilinea}
          secureTextEntry={conOcchio && !svelata}
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
              paddingRight: conOcchio ? TOCCO_MIN : spazio.md,
            },
            style,
          ]}
          {...resto}
        />

        {conOcchio ? (
          <Pressable
            onPress={() => setSvelata((v) => !v)}
            style={({ pressed }) => [stili.occhio, pressed && { opacity: 0.5 }]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={svelata ? 'Nascondi la password' : 'Mostra la password'}
          >
            <Text style={{ fontSize: 20, color: c.testoSecondario }}>{svelata ? '🙈' : '👁'}</Text>
          </Pressable>
        ) : null}
      </View>

      {errore ? (
        <Text style={[testo.etichetta, { color: c.errore, fontWeight: '400' }]}>{errore}</Text>
      ) : aiuto ? (
        <Text style={[testo.etichetta, { color: c.testoSecondario, fontWeight: '400' }]}>{aiuto}</Text>
      ) : null}
    </View>
  );
});

const stili = StyleSheet.create({
  riga: { justifyContent: 'center' },
  input: {
    borderWidth: 1,
    borderRadius: raggio.md,
    paddingHorizontal: spazio.md,
  },
  occhio: {
    position: 'absolute',
    right: 0,
    width: TOCCO_MIN,
    height: TOCCO_MIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
