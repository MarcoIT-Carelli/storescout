import { Pressable, StyleSheet, Text, View } from 'react-native';

import { raggio, spazio, testo, TOCCO_MIN, useColori } from '@/theme';

/**
 * Voto dell’ispezione, da 1 a 5.
 *
 * Il numero è il fulcro: è quello che finisce nel PDF e nelle statistiche, ed è
 * abbastanza grande da premerlo con il tablet in una mano sola. Il giudizio a parole
 * compare sotto, colorato, solo per la scelta fatta — serve a confermare a colpo d'occhio
 * di aver premuto il riquadro giusto, non a sostituire la cifra.
 */

export const VOTI = [1, 2, 3, 4, 5] as const;

export type Voto = (typeof VOTI)[number];

/** Giudizio a parole. Nel documento non compare: il PDF porta solo il numero. */
export const GIUDIZIO: Record<Voto, string> = {
  1: 'Insufficiente',
  2: 'Scarso',
  3: 'Sufficiente',
  4: 'Buono',
  5: 'Ottimo',
};

type Props = {
  valore: number | null;
  onChange: (voto: Voto) => void;
  disabilitato?: boolean;
};

export function SelettoreVoto({ valore, onChange, disabilitato = false }: Props) {
  const c = useColori();

  // Rosso fino alla sufficienza, ambra sulla soglia, verde sopra.
  const coloreDi = (voto: Voto) => (voto <= 2 ? c.errore : voto === 3 ? c.attenzione : c.successo);
  const scelto = VOTI.find((v) => v === valore) ?? null;

  return (
    <View style={{ gap: spazio.md }}>
      <View style={stili.riga}>
        {VOTI.map((voto) => {
          const attivo = voto === scelto;
          return (
            <Pressable
              key={voto}
              onPress={() => !disabilitato && onChange(voto)}
              disabled={disabilitato}
              accessibilityRole="button"
              accessibilityState={{ selected: attivo, disabled: disabilitato }}
              accessibilityLabel={`Voto ${voto}: ${GIUDIZIO[voto].toLowerCase()}`}
              style={({ pressed }) => [
                stili.riquadro,
                {
                  // La scelta attiva è gialla con la cifra nera, come ogni altra
                  // selezione dell'app: il colore del giudizio sta nella parola sotto.
                  backgroundColor: attivo
                    ? c.giallo
                    : pressed && !disabilitato
                      ? c.superficieAlt
                      : c.superficie,
                  borderColor: attivo ? c.gialloPremuto : c.bordo,
                  opacity: disabilitato ? 0.5 : 1,
                },
              ]}
            >
              <Text
                style={[
                  stili.cifra,
                  { color: attivo ? c.suGiallo : disabilitato ? c.testoDisabilitato : c.testo },
                ]}
              >
                {voto}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {scelto ? (
        <Text style={[testo.corpoForte, { color: coloreDi(scelto), textAlign: 'center' }]}>
          {GIUDIZIO[scelto]}
        </Text>
      ) : (
        <Text style={[testo.piccolo, { color: c.testoSecondario, textAlign: 'center' }]}>
          Tocca un numero per dare il voto all’ispezione.
        </Text>
      )}
    </View>
  );
}

const stili = StyleSheet.create({
  riga: { flexDirection: 'row', gap: spazio.sm },
  riquadro: {
    flex: 1,
    minHeight: TOCCO_MIN + 24,
    borderWidth: 2,
    borderRadius: raggio.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cifra: { fontSize: 30, fontWeight: '800', lineHeight: 36 },
});
