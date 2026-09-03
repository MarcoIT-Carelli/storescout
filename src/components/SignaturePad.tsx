import { useMemo, useRef, useState } from 'react';
import {
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';

import { raggio, spazio, testo, TOCCO_MIN, useColori } from '@/theme';

import { Button } from './Button';
import { ConfermaInLinea } from './ConfermaInLinea';

/** Larghezza del PNG salvato, come da specifica §6.7. */
const LARGHEZZA_PNG = 800;

/**
 * Il riquadro di firma resta bianco con tratto nero anche in tema scuro: è il foglio su
 * cui si firma, e il PNG finisce su un PDF a fondo bianco. Un tratto chiaro sarebbe
 * invisibile nel documento stampato.
 */
const CARTA = '#FFFFFF';
const INCHIOSTRO = '#111111';

type Props = {
  etichetta: string;
  /** URI del PNG già confermato, oppure null se la firma va ancora raccolta. */
  valore: string | null;
  onConferma: (uri: string) => void;
  onCancella: () => void;
  altezza?: number;
};

export function SignaturePad({ etichetta, valore, onConferma, onCancella, altezza = 200 }: Props) {
  const c = useColori();
  const [tratti, setTratti] = useState<string[]>([]);
  const [corrente, setCorrente] = useState<string | null>(null);
  const [larghezza, setLarghezza] = useState(0);
  const [confermaRifai, setConfermaRifai] = useState(false);
  const [inCorso, setInCorso] = useState(false);

  const tela = useRef<View>(null);
  const puntoCorrente = useRef<string>('');

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          const { locationX, locationY } = e.nativeEvent;
          puntoCorrente.current = `M${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
          setCorrente(puntoCorrente.current);
        },
        onPanResponderMove: (e) => {
          const { locationX, locationY } = e.nativeEvent;
          puntoCorrente.current += ` L${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
          setCorrente(puntoCorrente.current);
        },
        onPanResponderRelease: () => {
          const finito = puntoCorrente.current;
          puntoCorrente.current = '';
          setCorrente(null);
          if (finito) setTratti((t) => [...t, finito]);
        },
      }),
    [],
  );

  const vuota = tratti.length === 0 && !corrente;

  const misura = (e: LayoutChangeEvent) => setLarghezza(e.nativeEvent.layout.width);

  const svuota = () => {
    setTratti([]);
    setCorrente(null);
    puntoCorrente.current = '';
  };

  const conferma = async () => {
    if (vuota || !tela.current) return;
    setInCorso(true);
    try {
      const uri = await captureRef(tela, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
        width: LARGHEZZA_PNG,
        height: Math.round((LARGHEZZA_PNG * altezza) / Math.max(larghezza, 1)),
      });
      onConferma(uri);
      svuota();
    } finally {
      setInCorso(false);
    }
  };

  return (
    <View style={{ gap: spazio.sm, flex: 1, minWidth: 260 }}>
      <Text style={[testo.etichetta, { color: c.testoSecondario }]}>{etichetta}</Text>

      {valore ? (
        <>
          <View style={[stili.riquadro, { borderColor: c.bordo, height: altezza, backgroundColor: CARTA }]}>
            <Image source={{ uri: valore }} style={stili.anteprima} resizeMode="contain" />
            <View style={[stili.nastro, { backgroundColor: c.successoSfondo }]}>
              <Text style={[testo.etichetta, { color: c.successo }]}>Firmato</Text>
            </View>
          </View>

          {confermaRifai ? (
            <ConfermaInLinea
              messaggio="La firma raccolta verrà cancellata."
              etichettaConferma="Rifai firma"
              onConferma={() => {
                setConfermaRifai(false);
                onCancella();
              }}
              onAnnulla={() => setConfermaRifai(false)}
            />
          ) : (
            <Button
              titolo="Rifai firma"
              variante="secondario"
              compatto
              larghezzaPiena
              onPress={() => setConfermaRifai(true)}
            />
          )}
        </>
      ) : (
        <>
          <View
            onLayout={misura}
            style={[stili.riquadro, { borderColor: c.bordo, height: altezza, backgroundColor: CARTA }]}
            {...responder.panHandlers}
          >
            <View ref={tela} collapsable={false} style={[StyleSheet.absoluteFill, stili.tela]}>
              <Svg width="100%" height="100%">
                {tratti.map((d, i) => (
                  <Path
                    key={i}
                    d={d}
                    stroke={INCHIOSTRO}
                    strokeWidth={2.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                ))}
                {corrente ? (
                  <Path
                    d={corrente}
                    stroke={INCHIOSTRO}
                    strokeWidth={2.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                ) : null}
              </Svg>
            </View>

            {vuota ? (
              <View style={stili.suggerimento} pointerEvents="none">
                <View style={stili.rigaFirma} />
                <Text style={[testo.piccolo, { color: '#9A9A93' }]}>Firma qui con il dito</Text>
              </View>
            ) : null}
          </View>

          <View style={stili.azioni}>
            <Pressable
              onPress={svuota}
              disabled={vuota}
              style={({ pressed }) => [
                stili.azione,
                { borderColor: c.bordo, opacity: vuota ? 0.4 : pressed ? 0.7 : 1 },
              ]}
              accessibilityRole="button"
            >
              <Text style={[testo.corpoForte, { color: c.testo }]}>Cancella</Text>
            </Pressable>
            <Button
              titolo="Conferma"
              compatto
              onPress={conferma}
              disabilitato={vuota}
              inCorso={inCorso}
              style={{ flex: 1 }}
            />
          </View>
        </>
      )}
    </View>
  );
}

const stili = StyleSheet.create({
  riquadro: {
    borderWidth: 1,
    borderRadius: raggio.md,
    overflow: 'hidden',
  },
  tela: { backgroundColor: 'transparent' },
  anteprima: { flex: 1, margin: spazio.sm },
  nastro: {
    position: 'absolute',
    top: spazio.sm,
    right: spazio.sm,
    paddingHorizontal: spazio.sm,
    paddingVertical: 2,
    borderRadius: raggio.pill,
  },
  suggerimento: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: spazio.lg,
    gap: spazio.sm,
  },
  rigaFirma: { width: '80%', height: 1, backgroundColor: '#D8D8D3' },
  azioni: { flexDirection: 'row', gap: spazio.sm },
  azione: {
    minHeight: TOCCO_MIN,
    paddingHorizontal: spazio.lg,
    borderRadius: raggio.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
