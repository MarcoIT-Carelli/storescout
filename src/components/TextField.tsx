import { forwardRef, useRef, useState, type MutableRefObject } from 'react';
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
  /**
   * Campo da compilare con la S Pen: al tocco la tastiera non compare, così la penna
   * scrive su un campo che resta visibile per intero invece di finire sopra la metà
   * di schermo che la tastiera si prende. Un pulsante la richiama quando serve digitare.
   */
  penna?: boolean;
};

/** Il tipo dell'evento cambia fra versioni di React Native: si ricava dalle props. */
type EventoBlur = Parameters<NonNullable<TextInputProps['onBlur']>>[0];

/** Larghezza riservata al pulsante quando il campo è a riga singola. */
const SPAZIO_PULSANTE = 88;

export const TextField = forwardRef<TextInput, Props>(function TextField(
  {
    etichetta,
    aiuto,
    errore,
    righe = 1,
    contenitore,
    penna = false,
    style,
    editable = true,
    secureTextEntry,
    onBlur,
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

  const [tastiera, setTastiera] = useState(false);
  const interno = useRef<TextInput | null>(null);
  /** Il blur che serve a riaprire la tastiera non deve essere scambiato per un'uscita dal campo. */
  const inApertura = useRef(false);

  const assegnaRiferimento = (nodo: TextInput | null) => {
    interno.current = nodo;
    if (typeof ref === 'function') ref(nodo);
    else if (ref) (ref as MutableRefObject<TextInput | null>).current = nodo;
  };

  // Su un campo già a fuoco cambiare `showSoftInputOnFocus` non basta a far comparire
  // la tastiera: Android la valuta al momento del fuoco, quindi va tolto e rimesso.
  const apriTastiera = () => {
    setTastiera(true);
    const campo = interno.current;
    if (!campo) return;
    inApertura.current = true;
    campo.blur();
    setTimeout(() => {
      campo.focus();
      inApertura.current = false;
    }, 60);
  };

  // Uscendo dal campo si torna alla penna: il tocco successivo non deve ritrovarsi
  // la tastiera aperta per una scelta fatta su un altro campo, mezz'ora prima.
  const gestisciBlur = (e: EventoBlur) => {
    if (penna && !inApertura.current) setTastiera(false);
    onBlur?.(e);
  };

  const conPulsante = penna && editable;

  return (
    <View style={[{ gap: spazio.xs }, contenitore]}>
      {etichetta ? (
        <Text style={[testo.etichetta, { color: c.testoSecondario }]}>{etichetta}</Text>
      ) : null}

      <View style={stili.riga}>
        <TextInput
          ref={assegnaRiferimento}
          editable={editable}
          multiline={multilinea}
          secureTextEntry={conOcchio && !svelata}
          showSoftInputOnFocus={penna ? tastiera : undefined}
          onBlur={gestisciBlur}
          textAlignVertical={multilinea ? 'top' : 'center'}
          placeholderTextColor={c.testoDisabilitato}
          style={[
            stili.input,
            testo.corpo,
            {
              color: editable ? c.testo : c.testoDisabilitato,
              backgroundColor: editable ? c.superficie : c.disabilitato,
              borderColor: errore ? c.errore : c.bordo,
              minHeight: multilinea
                ? 24 * righe + spazio.lg * 2 + (conPulsante ? TOCCO_MIN : 0)
                : TOCCO_MIN,
              paddingTop: multilinea ? spazio.md : undefined,
              paddingRight: conOcchio
                ? TOCCO_MIN
                : conPulsante && !multilinea
                  ? SPAZIO_PULSANTE
                  : spazio.md,
              paddingBottom: conPulsante && multilinea ? TOCCO_MIN : undefined,
            },
            style,
          ]}
          {...resto}
        />

        {conPulsante ? (
          <Pressable
            onPress={apriTastiera}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Apri la tastiera per scrivere questo campo"
            style={({ pressed }) => [
              stili.tastiera,
              multilinea ? stili.tastieraInBasso : stili.tastieraAlLato,
              {
                borderColor: c.bordo,
                backgroundColor: tastiera ? c.superficieAlt : c.superficie,
                opacity: pressed ? 0.6 : 1,
              },
            ]}
          >
            <Text style={[testo.etichetta, { color: c.testoSecondario, fontWeight: '600' }]}>
              Tastiera
            </Text>
          </Pressable>
        ) : null}

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
  tastiera: {
    position: 'absolute',
    right: spazio.xs,
    height: 40,
    paddingHorizontal: spazio.md,
    borderWidth: 1,
    borderRadius: raggio.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tastieraInBasso: { bottom: spazio.xs },
  tastieraAlLato: { top: 0, bottom: 0, marginVertical: 'auto' },
});
