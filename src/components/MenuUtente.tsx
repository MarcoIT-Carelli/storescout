import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/hooks/useAuth';
import { iniziali } from '@/lib/format';
import { raggio, spazio, testo, TOCCO_MIN, useColori, useTema, type Preferenza } from '@/theme';

const TEMI: { valore: Preferenza; etichetta: string }[] = [
  { valore: 'sistema', etichetta: 'Sistema' },
  { valore: 'chiaro', etichetta: 'Chiaro' },
  { valore: 'scuro', etichetta: 'Scuro' },
];

export function MenuUtente() {
  const c = useColori();
  const { preferenza, impostaPreferenza } = useTema();
  const { profilo, esci } = useAuth();
  const router = useRouter();
  const [aperto, setAperto] = useState(false);

  const nome = profilo ? `${profilo.nome} ${profilo.cognome}`.trim() : '';

  return (
    <>
      <Pressable
        onPress={() => setAperto(true)}
        accessibilityRole="button"
        accessibilityLabel="Menu utente"
        style={({ pressed }) => [
          stili.avatar,
          { backgroundColor: c.superficieAlt, borderColor: c.bordo, opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <Text style={[testo.corpoForte, { color: c.testo }]}>
          {profilo ? iniziali(profilo.nome, profilo.cognome) : '—'}
        </Text>
      </Pressable>

      <Modal visible={aperto} transparent animationType="fade" onRequestClose={() => setAperto(false)}>
        <Pressable style={stili.velo} onPress={() => setAperto(false)}>
          <Pressable
            style={[stili.foglio, { backgroundColor: c.superficie, borderColor: c.bordo }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{ gap: 2 }}>
              <Text style={[testo.corpoForte, { color: c.testo }]}>{nome || profilo?.email}</Text>
              <Text style={[testo.piccolo, { color: c.testoSecondario }]}>
                {profilo?.ruolo === 'admin' ? 'Amministratore' : 'Ispettore'}
              </Text>
            </View>

            <View style={[stili.separatore, { backgroundColor: c.bordo }]} />

            <Text style={[testo.etichetta, { color: c.testoSecondario }]}>Aspetto</Text>
            <View style={[stili.segmenti, { borderColor: c.bordo }]}>
              {TEMI.map((t) => {
                const attivo = preferenza === t.valore;
                return (
                  <Pressable
                    key={t.valore}
                    onPress={() => impostaPreferenza(t.valore)}
                    style={[
                      stili.segmento,
                      { backgroundColor: attivo ? c.giallo : 'transparent' },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: attivo }}
                  >
                    <Text
                      style={[
                        testo.piccolo,
                        { color: attivo ? c.suGiallo : c.testo, fontWeight: attivo ? '700' : '400' },
                      ]}
                    >
                      {t.etichetta}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={[stili.separatore, { backgroundColor: c.bordo }]} />

            {/* Per un admin lo storico e l'elenco del pannello mostrerebbero la stessa cosa:
                l'admin ha una voce sola, quella che può anche filtrare, esportare e
                intervenire. Lo storico in sola lettura resta agli ispettori. */}
            {profilo?.ruolo === 'admin' ? (
              <>
                <Voce
                  etichetta="Ispezioni ed export"
                  onPress={() => {
                    setAperto(false);
                    router.push('/ispezioni');
                  }}
                />
                <Voce
                  etichetta="Amministrazione"
                  onPress={() => {
                    setAperto(false);
                    router.push('/amministrazione');
                  }}
                />
              </>
            ) : (
              <Voce
                etichetta="Storico ispezioni"
                onPress={() => {
                  setAperto(false);
                  router.push('/storico');
                }}
              />
            )}
            <Voce
              etichetta="Cambia password"
              onPress={() => {
                setAperto(false);
                router.push('/nuova-password');
              }}
            />
            <Voce
              etichetta="Esci"
              distruttivo
              onPress={() => {
                setAperto(false);
                void esci();
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function Voce({
  etichetta,
  onPress,
  distruttivo = false,
}: {
  etichetta: string;
  onPress: () => void;
  distruttivo?: boolean;
}) {
  const c = useColori();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [stili.voce, { backgroundColor: pressed ? c.superficieAlt : 'transparent' }]}
      accessibilityRole="button"
    >
      <Text style={[testo.corpo, { color: distruttivo ? c.errore : c.testo }]}>{etichetta}</Text>
    </Pressable>
  );
}

const stili = StyleSheet.create({
  avatar: {
    width: TOCCO_MIN,
    height: TOCCO_MIN,
    borderRadius: raggio.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  velo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-start', alignItems: 'flex-end', padding: spazio.lg },
  foglio: {
    marginTop: 60,
    width: 280,
    borderWidth: 1,
    borderRadius: raggio.lg,
    padding: spazio.lg,
    gap: spazio.sm,
  },
  separatore: { height: 1, marginVertical: spazio.xs },
  segmenti: { flexDirection: 'row', borderWidth: 1, borderRadius: raggio.md, overflow: 'hidden' },
  segmento: { flex: 1, minHeight: TOCCO_MIN, alignItems: 'center', justifyContent: 'center' },
  voce: { minHeight: TOCCO_MIN, justifyContent: 'center', paddingHorizontal: spazio.sm, borderRadius: raggio.sm },
});
