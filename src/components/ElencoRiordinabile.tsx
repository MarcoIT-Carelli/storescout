import { useRef, useState, type ReactNode } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native';

import { raggio, spazio, TOCCO_MIN, useColori } from '@/theme';

type Props<T> = {
  dati: T[];
  chiave: (voce: T) => string;
  /** `da` e `a` sono indici nell'elenco ricevuto. */
  onRiordina: (da: number, a: number) => void;
  /** Serve al genitore per bloccare lo scorrimento mentre si trascina. */
  onTrascinamento?: (attivo: boolean) => void;
  bloccato?: boolean;
  children: (voce: T, indice: number) => ReactNode;
};

/**
 * Riordino per trascinamento, scritto con `PanResponder`.
 *
 * Le librerie fatte apposta dipendono da `react-native-gesture-handler` e
 * `react-native-reanimated`, escluse dall'autolinking perché i loro file oggetto
 * sforano i 260 caratteri di percorso ammessi da Windows e fanno fallire la build
 * locale. Riammetterle costringerebbe anche a distribuire un APK nuovo, mentre così
 * il riordino viaggia come aggiornamento via rete.
 *
 * Durante il trascinamento le altre righe non si spostano: con voci di altezza
 * diversa — un destinatario con l'indirizzo email è più alto di uno senza — le
 * animazioni mentirebbero sulla posizione finale. Al posto loro una linea gialla
 * mostra dove la voce andrà a finire, che è l'unica cosa che serve sapere.
 */
export function ElencoRiordinabile<T>({
  dati,
  chiave,
  onRiordina,
  onTrascinamento,
  bloccato = false,
  children,
}: Props<T>) {
  const c = useColori();

  const altezze = useRef<number[]>([]);
  const [attivo, setAttivo] = useState<number | null>(null);
  const [bersaglio, setBersaglio] = useState<number | null>(null);
  const scorrimento = useRef(new Animated.Value(0)).current;

  // Rileggerlo dentro il PanResponder: chiuderebbe sul valore del primo render.
  const stato = useRef({ attivo: null as number | null, bersaglio: null as number | null });

  const inizioDi = (indice: number) =>
    altezze.current.slice(0, indice).reduce((s, h) => s + h, 0);

  const bersaglioDa = (partenza: number, dy: number) => {
    const centro = inizioDi(partenza) + dy + (altezze.current[partenza] ?? 0) / 2;
    let i = 0;
    while (i < dati.length && centro > inizioDi(i) + (altezze.current[i] ?? 0) / 2) i++;
    return Math.max(0, Math.min(dati.length - 1, i > partenza ? i - 1 : i));
  };

  const creaResponder = (indice: number) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => !bloccato,
      onMoveShouldSetPanResponder: (_, g) => !bloccato && Math.abs(g.dy) > 4,
      onPanResponderGrant: () => {
        stato.current = { attivo: indice, bersaglio: indice };
        setAttivo(indice);
        setBersaglio(indice);
        onTrascinamento?.(true);
      },
      onPanResponderMove: (_, g) => {
        scorrimento.setValue(g.dy);
        const b = bersaglioDa(indice, g.dy);
        if (b !== stato.current.bersaglio) {
          stato.current.bersaglio = b;
          setBersaglio(b);
        }
      },
      onPanResponderRelease: () => {
        const { bersaglio: b } = stato.current;
        stato.current = { attivo: null, bersaglio: null };
        scorrimento.setValue(0);
        setAttivo(null);
        setBersaglio(null);
        onTrascinamento?.(false);
        if (b !== null && b !== indice) onRiordina(indice, b);
      },
      onPanResponderTerminate: () => {
        stato.current = { attivo: null, bersaglio: null };
        scorrimento.setValue(0);
        setAttivo(null);
        setBersaglio(null);
        onTrascinamento?.(false);
      },
    });

  return (
    <View>
      {dati.map((voce, i) => {
        const inMano = attivo === i;
        return (
          <View key={chiave(voce)}>
            {bersaglio === i && attivo !== null && attivo !== i ? (
              <View style={[stili.linea, { backgroundColor: c.giallo }]} />
            ) : null}

            <Animated.View
              onLayout={(e) => {
                altezze.current[i] = e.nativeEvent.layout.height;
              }}
              style={[
                stili.riga,
                inMano && {
                  transform: [{ translateY: scorrimento }],
                  zIndex: 10,
                  elevation: 8,
                  opacity: 0.95,
                },
              ]}
            >
              <View
                {...creaResponder(i).panHandlers}
                style={stili.maniglia}
                accessibilityRole="adjustable"
                accessibilityLabel="Trascina per riordinare"
              >
                <Text style={{ color: inMano ? c.testo : c.testoSecondario, fontSize: 20 }}>⠿</Text>
              </View>

              <View style={{ flex: 1 }}>{children(voce, i)}</View>
            </Animated.View>
          </View>
        );
      })}
    </View>
  );
}

const stili = StyleSheet.create({
  riga: { flexDirection: 'row', alignItems: 'center', gap: spazio.sm },
  maniglia: {
    width: TOCCO_MIN,
    minHeight: TOCCO_MIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linea: { height: 3, borderRadius: raggio.pill, marginVertical: spazio.xs },
});
