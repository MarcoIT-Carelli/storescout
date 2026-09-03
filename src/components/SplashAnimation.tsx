import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { LOGO_PATH } from '@/lib/logo';
import { APERTURA, type Schema } from '@/theme';

import { LOGO_VB, Wordmark } from './Logo';

/**
 * Animazione di apertura, ricavata da `animazione per code/anteprima.html`.
 *
 * L'originale è SVG con animazioni CSS, che react-native-svg non interpreta. È ricostruita
 * qui con viste native: il fascio di luce è una `Animated.View` circolare con `overflow`
 * nascosto, dentro cui una copia del logo viene contro-traslata della stessa quantità. Il
 * risultato è una finestra circolare che scorre sul disegno, come il `clipPath` animato
 * dell'originale, ma con trasformazioni che il thread nativo sa gestire da solo.
 */

/** Fotogrammi chiave del movimento, in unità del viewBox originale. */
const PASSI = [
  { t: 0, x: 0, y: 0 },
  { t: 0.16, x: 55, y: -38 },
  { t: 0.3, x: -40, y: 52 },
  { t: 0.4, x: -124, y: 185 },
  { t: 0.58, x: 157, y: 185 },
  { t: 0.7, x: 0, y: 0 },
  { t: 1, x: 0, y: 0 },
];

/** Centro e raggio del fascio, sempre in unità del viewBox. */
const FASCIO = { cx: 133.5, cy: 126.5, r: 59 };

/** Fascia occupata dalla scritta, dalla maschera dell'SVG originale. */
const BANDA_SCRITTA = { y: 285, h: 65 };

const DURATA_MOVIMENTO = 1500;
const DURATA_LUCE = 300;
const ATTESA = 100;
const DURATA_USCITA = 250;

export const DURATA_SPLASH = DURATA_MOVIMENTO + DURATA_LUCE + ATTESA + DURATA_USCITA;

type Props = {
  schema: Schema;
  /** Chiamata quando l'animazione è finita e la schermata sottostante può comparire. */
  onFine: () => void;
};

export function SplashAnimation({ schema, onFine }: Props) {
  const { width, height } = useWindowDimensions();
  const { sfondo, inchiostro } = APERTURA[schema];

  const larghezza = Math.min(width * 0.62, height * 0.42, 320);
  const k = larghezza / LOGO_VB.w;
  const altezza = LOGO_VB.h * k;

  const avanzamento = useRef(new Animated.Value(0)).current;
  const luce = useRef(new Animated.Value(0)).current;
  const uscita = useRef(new Animated.Value(1)).current;
  const sfarfallio = useRef(new Animated.Value(0)).current;

  const [motoRidotto, setMotoRidotto] = useState<boolean | null>(null);

  useEffect(() => {
    let vivo = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => vivo && setMotoRidotto(v))
      .catch(() => vivo && setMotoRidotto(false));
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    if (motoRidotto === null) return;

    if (motoRidotto) {
      // Con il moto ridotto attivo resta solo una comparsa, senza traslazioni.
      avanzamento.setValue(1);
      luce.setValue(1);
      const t = setTimeout(() => {
        Animated.timing(uscita, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => onFine());
      }, 700);
      return () => clearTimeout(t);
    }

    const pulsazione = Animated.loop(
      Animated.sequence([
        Animated.timing(sfarfallio, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(sfarfallio, {
          toValue: 0,
          duration: 800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    pulsazione.start();

    Animated.sequence([
      Animated.timing(avanzamento, {
        toValue: 1,
        duration: DURATA_MOVIMENTO,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.timing(luce, {
        toValue: 1,
        duration: DURATA_LUCE,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.delay(ATTESA),
      Animated.timing(uscita, { toValue: 0, duration: DURATA_USCITA, useNativeDriver: true }),
    ]).start(() => {
      pulsazione.stop();
      onFine();
    });

    return () => pulsazione.stop();
  }, [motoRidotto, avanzamento, luce, uscita, sfarfallio, onFine]);

  const { spostamentoX, spostamentoY, tendina } = useMemo(() => {
    const t = PASSI.map((p) => p.t);
    const bordoSinistro = (FASCIO.cx - 124 - LOGO_VB.x) * k;
    const bordoDestro = (FASCIO.cx + 157 - LOGO_VB.x) * k;
    return {
      spostamentoX: avanzamento.interpolate({ inputRange: t, outputRange: PASSI.map((p) => p.x * k) }),
      spostamentoY: avanzamento.interpolate({ inputRange: t, outputRange: PASSI.map((p) => p.y * k) }),
      // La tendina che copre la scritta segue il centro del fascio: la scritta si accende
      // esattamente mentre il fascio la attraversa, come nell'originale.
      tendina: avanzamento.interpolate({
        inputRange: [0, 0.4, 0.58, 1],
        outputRange: [bordoSinistro, bordoSinistro, bordoDestro, bordoDestro],
      }),
    };
  }, [avanzamento, k]);

  const raggio = FASCIO.r * k;
  const fascioSinistra = (FASCIO.cx - LOGO_VB.x - FASCIO.r) * k;
  const fascioAlto = (FASCIO.cy - LOGO_VB.y - FASCIO.r) * k;
  const viewBox = `${LOGO_VB.x} ${LOGO_VB.y} ${LOGO_VB.w} ${LOGO_VB.h}`;

  // La tendina va confinata alla fascia della scritta: a tutta altezza coprirebbe anche
  // il logo spento. Sono le stesse coordinate della maschera nell'SVG originale.
  const bandaAlto = (BANDA_SCRITTA.y - LOGO_VB.y) * k;
  const bandaAltezza = BANDA_SCRITTA.h * k;

  const opacitaBase = luce.interpolate({ inputRange: [0, 1], outputRange: [0.16, 1] });
  const opacitaFascio = Animated.multiply(
    sfarfallio.interpolate({ inputRange: [0, 1], outputRange: [0.42, 0.68] }),
    luce.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
  );
  const opacitaAnello = luce.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] });

  const traslazione = { transform: [{ translateX: spostamentoX }, { translateY: spostamentoY }] };
  const cerchio = {
    left: fascioSinistra,
    top: fascioAlto,
    width: raggio * 2,
    height: raggio * 2,
    borderRadius: raggio,
  };

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, stili.pagina, { backgroundColor: sfondo, opacity: uscita }]}
      pointerEvents="none"
    >
      <View style={{ width: larghezza, height: altezza }}>
        {/* La scritta e la tendina che la scopre stanno sotto a tutto il resto. La tendina
            è un rettangolo pieno del colore di sfondo, non una vera maschera: se stesse
            sopra all'alone gli taglierebbe via la metà destra con un bordo netto. */}
        <View style={[stili.ritaglio, { top: bandaAlto, height: bandaAltezza }]}>
          <View style={stili.scritta}>
            <Wordmark larghezza={larghezza} colore={inchiostro} />
          </View>
          <Animated.View
            style={[
              stili.tendina,
              { backgroundColor: sfondo, width: larghezza * 2, transform: [{ translateX: tendina }] },
            ]}
          />
        </View>

        <Animated.View
          style={[
            stili.cerchio,
            cerchio,
            traslazione,
            { backgroundColor: '#F5D53F', opacity: opacitaFascio },
          ]}
        />

        <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacitaBase }]}>
          <Svg width={larghezza} height={altezza} viewBox={viewBox}>
            <Path d={LOGO_PATH} fill={inchiostro} fillRule="evenodd" />
          </Svg>
        </Animated.View>

        <Animated.View style={[stili.cerchio, cerchio, traslazione, stili.finestra]}>
          <Animated.View
            style={{
              position: 'absolute',
              left: -fascioSinistra,
              top: -fascioAlto,
              width: larghezza,
              height: altezza,
              transform: [
                { translateX: Animated.multiply(spostamentoX, -1) },
                { translateY: Animated.multiply(spostamentoY, -1) },
              ],
            }}
          >
            <Svg width={larghezza} height={altezza} viewBox={viewBox}>
              <Path d={LOGO_PATH} fill={inchiostro} fillRule="evenodd" />
            </Svg>
            <View style={[stili.ritaglio, stili.scritta, { top: bandaAlto, height: bandaAltezza }]}>
              <Wordmark larghezza={larghezza} colore="#F9BA2E" />
            </View>
          </Animated.View>
        </Animated.View>

        <Animated.View
          style={[
            stili.cerchio,
            cerchio,
            traslazione,
            { borderWidth: 2.9 * k, borderColor: '#F9BA2E', opacity: opacitaAnello },
          ]}
        />
      </View>
    </Animated.View>
  );
}

const stili = StyleSheet.create({
  pagina: { alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  cerchio: { position: 'absolute' },
  finestra: { overflow: 'hidden' },
  ritaglio: { position: 'absolute', left: 0, right: 0, overflow: 'hidden' },
  scritta: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  tendina: { position: 'absolute', top: 0, bottom: 0, left: 0 },
});
