import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spazio, testo, TOCCO_MIN, useColori } from '@/theme';

type Props = {
  titolo?: string;
  sottotitolo?: string;
  /** Mostra la freccia di ritorno. Usa `onIndietro` per un comportamento diverso dal pop. */
  indietro?: boolean;
  onIndietro?: () => void;
  azioni?: ReactNode;
  children: ReactNode;
};

export function Schermata({ titolo, sottotitolo, indietro, onIndietro, azioni, children }: Props) {
  const c = useColori();
  const router = useRouter();

  const conTestata = Boolean(titolo || indietro || azioni);

  // Testata gialla ovunque: riempimento con testo nero sopra. Una schermata sola con
  // la barra scura si noterebbe come un errore, non come una distinzione.
  const inchiostro = c.suGiallo;

  return (
    // `bottom` fra i bordi protetti: senza, la barra di sistema — i tre tasti o la
    // riga dei gesti — si sovrappone a tutto ciò che sta in fondo allo schermo, e in
    // questa app in fondo ci stanno «Concludi ispezione» e «Salva bozza». Nasconderla
    // non basterebbe: su Android moderno la zona del gesto resta sensibile anche
    // quando la barra non si vede, e intercetterebbe il tocco al posto del pulsante.
    <SafeAreaView
      style={[stili.pagina, { backgroundColor: c.sfondo }]}
      edges={['top', 'left', 'right', 'bottom']}
    >
      {conTestata ? (
        <View
          style={[
            stili.testata,
            { borderBottomColor: c.gialloPremuto, backgroundColor: c.giallo },
          ]}
        >
          {indietro ? (
            <Pressable
              // Una schermata aperta da deep link non ha cronologia alle spalle:
              // senza questo controllo la freccia resterebbe inerte.
              onPress={() => {
                if (onIndietro) onIndietro();
                else if (router.canGoBack()) router.back();
                else router.replace('/');
              }}
              style={({ pressed }) => [stili.indietro, pressed && { opacity: 0.5 }]}
              accessibilityRole="button"
              accessibilityLabel="Torna indietro"
              hitSlop={8}
            >
              <Text style={[stili.freccia, { color: inchiostro }]}>‹</Text>
            </Pressable>
          ) : null}

          <View style={stili.titoli}>
            {titolo ? (
              <Text style={[testo.sezione, { color: inchiostro }]} numberOfLines={1}>
                {titolo}
              </Text>
            ) : null}
            {sottotitolo ? (
              <Text
                style={[
                  testo.piccolo,
                  { color: c.suGiallo, opacity: 0.75 },
                ]}
                numberOfLines={1}
              >
                {sottotitolo}
              </Text>
            ) : null}
          </View>

          {azioni ? <View style={stili.azioni}>{azioni}</View> : null}
        </View>
      ) : null}

      {children}
    </SafeAreaView>
  );
}

const stili = StyleSheet.create({
  pagina: { flex: 1 },
  testata: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazio.sm,
    paddingHorizontal: spazio.md,
    paddingVertical: spazio.sm,
    borderBottomWidth: 1,
    minHeight: 64,
  },
  indietro: {
    width: TOCCO_MIN,
    height: TOCCO_MIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  freccia: { fontSize: 34, lineHeight: 38, fontWeight: '300' },
  titoli: { flex: 1, gap: 1, paddingHorizontal: spazio.xs },
  azioni: { flexDirection: 'row', alignItems: 'center', gap: spazio.sm },
});
