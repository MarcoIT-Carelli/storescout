import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { LOGO_PATH } from '@/lib/logo';

/** Proporzioni del riquadro completo (segno + scritta), da logo-storescout-statico.svg. */
const VB = { x: 16, y: 16, w: 268, h: 334 };
/** Riquadro del solo segno grafico, ritagliato sopra la scritta. */
const VB_SEGNO = { x: 16, y: 16, w: 268, h: 262 };

/**
 * Corpo della scritta rispetto alla larghezza del marchio: nell'originale è 44 unità
 * su un riquadro largo 268.
 */
const CORPO_SCRITTA = 44 / VB.w;
/** Stacco fra segno e scritta, ricavato dalle stesse proporzioni. */
const STACCO_SCRITTA = 9 / VB.w;

type Props = {
  /** Larghezza in px. L'altezza segue le proporzioni. */
  larghezza: number;
  colore: string;
  coloreScritta?: string;
  conScritta?: boolean;
};

export function Logo({ larghezza, colore, coloreScritta, conScritta = true }: Props) {
  const altezzaSegno = (larghezza * VB_SEGNO.h) / VB_SEGNO.w;

  return (
    <View style={[stili.colonna, { width: larghezza }]}>
      <Svg
        width={larghezza}
        height={altezzaSegno}
        viewBox={`${VB_SEGNO.x} ${VB_SEGNO.y} ${VB_SEGNO.w} ${VB_SEGNO.h}`}
      >
        <Path d={LOGO_PATH} fill={colore} fillRule="evenodd" />
      </Svg>
      {conScritta ? (
        <Wordmark
          larghezza={larghezza}
          colore={coloreScritta ?? colore}
          style={{ marginTop: larghezza * STACCO_SCRITTA }}
        />
      ) : null}
    </View>
  );
}

/**
 * La scritta è testo nativo e non SVG: react-native-svg applica `textAnchor` al primo
 * `tspan` anziché all'intera riga, e con due pesi di carattere la scritta finisce
 * spostata a destra e tagliata.
 */
export function Wordmark({
  larghezza,
  colore,
  style,
}: {
  larghezza: number;
  colore: string;
  style?: { marginTop?: number };
}) {
  const corpo = larghezza * CORPO_SCRITTA;
  return (
    <Text
      style={[{ fontSize: corpo, lineHeight: corpo * 1.2, color: colore }, style]}
      numberOfLines={1}
      allowFontScaling={false}
    >
      <Text style={stili.leggera}>Store</Text>
      <Text style={stili.forte}>Scout</Text>
    </Text>
  );
}

const stili = StyleSheet.create({
  colonna: { alignItems: 'center' },
  leggera: { fontWeight: '400' },
  forte: { fontWeight: '700' },
});

export const LOGO_VB = VB;
export const LOGO_VB_SEGNO = VB_SEGNO;
