import { useMemo, useRef, useState, type ReactNode } from 'react';
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
 * mostra dove la voce andrà a finire.
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

  /**
   * Tutto ciò che il gesto legge passa da un ref, non dalle props.
   *
   * I responder si creano una volta sola (vedi sotto) e resterebbero agganciati ai
   * valori del primo render. E lo stato del trascinamento sta qui perché `setState`
   * è asincrono: fra un movimento del dito e il successivo il valore aggiornato non
   * sarebbe ancora visibile.
   */
  const vivo = useRef({
    bloccato,
    lunghezza: dati.length,
    attivo: null as number | null,
    bersaglio: null as number | null,
    onRiordina,
    onTrascinamento,
  });
  vivo.current.bloccato = bloccato;
  vivo.current.lunghezza = dati.length;
  vivo.current.onRiordina = onRiordina;
  vivo.current.onTrascinamento = onTrascinamento;

  const inizioDi = (indice: number) =>
    altezze.current.slice(0, indice).reduce((s, h) => s + (h ?? 0), 0);

  const bersaglioDa = (partenza: number, dy: number) => {
    const centro = inizioDi(partenza) + dy + (altezze.current[partenza] ?? 0) / 2;
    let i = 0;
    while (i < vivo.current.lunghezza && centro > inizioDi(i) + (altezze.current[i] ?? 0) / 2) i++;
    const grezzo = i > partenza ? i - 1 : i;
    return Math.max(0, Math.min(vivo.current.lunghezza - 1, grezzo));
  };

  /**
   * Un responder per riga, creato una volta sola.
   *
   * Ricrearli a ogni render romperebbe il trascinamento a metà: `PanResponder`
   * tiene il proprio conto dello spostamento a partire dal tocco iniziale, e
   * un'istanza nuova, che quel tocco non l'ha mai ricevuto, riparte da zero
   * facendo saltare la riga sotto il dito.
   */
  const responder = useMemo(
    () =>
      dati.map((_, indice) =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => !vivo.current.bloccato,
          onMoveShouldSetPanResponder: (_e, g) =>
            !vivo.current.bloccato && Math.abs(g.dy) > 4,
          onPanResponderGrant: () => {
            vivo.current.attivo = indice;
            vivo.current.bersaglio = indice;
            scorrimento.setValue(0);
            setAttivo(indice);
            setBersaglio(indice);
            vivo.current.onTrascinamento?.(true);
          },
          onPanResponderMove: (_e, g) => {
            scorrimento.setValue(g.dy);
            const b = bersaglioDa(indice, g.dy);
            if (b !== vivo.current.bersaglio) {
              vivo.current.bersaglio = b;
              setBersaglio(b);
            }
          },
          onPanResponderRelease: () => {
            const b = vivo.current.bersaglio;
            vivo.current.attivo = null;
            vivo.current.bersaglio = null;
            scorrimento.setValue(0);
            setAttivo(null);
            setBersaglio(null);
            vivo.current.onTrascinamento?.(false);
            if (b !== null && b !== indice) vivo.current.onRiordina(indice, b);
          },
          onPanResponderTerminate: () => {
            vivo.current.attivo = null;
            vivo.current.bersaglio = null;
            scorrimento.setValue(0);
            setAttivo(null);
            setBersaglio(null);
            vivo.current.onTrascinamento?.(false);
          },
        }),
      ),
    // Solo il numero di righe cambia quali responder servono: il resto passa dai ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dati.length],
  );

  return (
    <View>
      {dati.map((voce, i) => {
        const inMano = attivo === i;
        // Trascinando in giù la voce finisce *dopo* la riga di arrivo, trascinando
        // in su *prima*: la linea va disegnata dal lato giusto, altrimenti indica
        // una posizione e la voce ne prende un'altra.
        const lineaSopra = attivo !== null && bersaglio === i && bersaglio < attivo;
        const lineaSotto = attivo !== null && bersaglio === i && bersaglio > attivo;

        return (
          // zIndex qui e non sulla riga: fra fratelli diversi non avrebbe effetto,
          // e la voce trascinata scivolerebbe sotto le altre.
          <View key={chiave(voce)} style={inMano ? stili.inCima : undefined}>
            {lineaSopra ? <View style={[stili.linea, { backgroundColor: c.giallo }]} /> : null}

            <Animated.View
              onLayout={(e) => {
                altezze.current[i] = e.nativeEvent.layout.height;
              }}
              style={[
                stili.riga,
                inMano && { transform: [{ translateY: scorrimento }], opacity: 0.95 },
              ]}
            >
              <View
                {...responder[i].panHandlers}
                style={stili.maniglia}
                accessibilityRole="adjustable"
                accessibilityLabel="Trascina per riordinare"
              >
                <Text style={{ color: inMano ? c.testo : c.testoSecondario, fontSize: 20 }}>⠿</Text>
              </View>

              <View style={{ flex: 1 }}>{children(voce, i)}</View>
            </Animated.View>

            {lineaSotto ? <View style={[stili.linea, { backgroundColor: c.giallo }]} /> : null}
          </View>
        );
      })}
    </View>
  );
}

const stili = StyleSheet.create({
  riga: { flexDirection: 'row', alignItems: 'center', gap: spazio.sm },
  inCima: { zIndex: 10, elevation: 8 },
  maniglia: {
    width: TOCCO_MIN,
    minHeight: TOCCO_MIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linea: { height: 3, borderRadius: raggio.pill, marginVertical: spazio.xs },
});
