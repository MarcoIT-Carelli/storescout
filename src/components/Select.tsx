import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { raggio, spazio, testo, TOCCO_MIN, useColori } from '@/theme';

export type Opzione = { id: string; nome: string };

type Props = {
  etichetta: string;
  opzioni: Opzione[];
  valore: string | null;
  onChange: (id: string | null) => void;
  segnaposto?: string;
  disabilitato?: boolean;
  errore?: boolean;
  /** Sopra questa soglia compare il campo di ricerca dentro l'elenco. */
  sogliaRicerca?: number;
};

export function Select({
  etichetta,
  opzioni,
  valore,
  onChange,
  segnaposto = 'Seleziona…',
  disabilitato = false,
  errore = false,
  sogliaRicerca = 12,
}: Props) {
  const c = useColori();
  const [aperto, setAperto] = useState(false);
  const [filtro, setFiltro] = useState('');

  const scelta = opzioni.find((o) => o.id === valore) ?? null;
  const conRicerca = opzioni.length > sogliaRicerca;

  const visibili = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    return q ? opzioni.filter((o) => o.nome.toLowerCase().includes(q)) : opzioni;
  }, [opzioni, filtro]);

  const chiudi = () => {
    setAperto(false);
    setFiltro('');
  };

  return (
    <View style={{ gap: spazio.xs, flex: 1 }}>
      <Text style={[testo.etichetta, { color: c.testoSecondario }]}>{etichetta}</Text>

      <Pressable
        onPress={() => !disabilitato && setAperto(true)}
        disabled={disabilitato}
        accessibilityRole="button"
        accessibilityLabel={`${etichetta}: ${scelta?.nome ?? 'nessuna scelta'}`}
        style={({ pressed }) => [
          stili.campo,
          {
            borderColor: errore ? c.errore : c.bordo,
            backgroundColor: disabilitato ? c.disabilitato : pressed ? c.superficieAlt : c.superficie,
          },
        ]}
      >
        <Text
          numberOfLines={1}
          style={[
            testo.corpo,
            { color: disabilitato ? c.testoDisabilitato : scelta ? c.testo : c.testoDisabilitato, flex: 1 },
          ]}
        >
          {scelta?.nome ?? segnaposto}
        </Text>
        <Text style={{ color: disabilitato ? c.testoDisabilitato : c.testoSecondario, fontSize: 14 }}>▾</Text>
      </Pressable>

      <Modal visible={aperto} transparent animationType="fade" onRequestClose={chiudi}>
        <Pressable style={stili.velo} onPress={chiudi}>
          <Pressable
            style={[stili.foglio, { backgroundColor: c.superficie, borderColor: c.bordo }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[stili.testataFoglio, { borderBottomColor: c.bordo }]}>
              <Text style={[testo.sezione, { color: c.testo }]}>{etichetta}</Text>
              <Pressable onPress={chiudi} hitSlop={12} style={stili.chiudi}>
                <Text style={[testo.corpoForte, { color: c.testoSecondario }]}>Chiudi</Text>
              </Pressable>
            </View>

            {conRicerca ? (
              <TextInput
                value={filtro}
                onChangeText={setFiltro}
                placeholder="Cerca…"
                placeholderTextColor={c.testoDisabilitato}
                autoCorrect={false}
                style={[
                  stili.ricerca,
                  testo.corpo,
                  { color: c.testo, borderColor: c.bordo, backgroundColor: c.superficieAlt },
                ]}
              />
            ) : null}

            <FlatList
              data={visibili}
              keyExtractor={(o) => o.id}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={
                valore ? (
                  <Pressable
                    onPress={() => {
                      onChange(null);
                      chiudi();
                    }}
                    style={({ pressed }) => [
                      stili.voce,
                      { backgroundColor: pressed ? c.superficieAlt : 'transparent' },
                    ]}
                  >
                    <Text style={[testo.corpo, { color: c.testoSecondario }]}>Nessuna scelta</Text>
                  </Pressable>
                ) : null
              }
              ListEmptyComponent={
                <Text style={[testo.corpo, { color: c.testoSecondario, padding: spazio.lg }]}>
                  Nessuna voce corrisponde alla ricerca.
                </Text>
              }
              renderItem={({ item }) => {
                const attiva = item.id === valore;
                return (
                  <Pressable
                    onPress={() => {
                      onChange(item.id);
                      chiudi();
                    }}
                    style={({ pressed }) => [
                      stili.voce,
                      { backgroundColor: pressed || attiva ? c.superficieAlt : 'transparent' },
                    ]}
                  >
                    <Text style={[testo.corpo, { color: c.testo, flex: 1 }]}>{item.nome}</Text>
                    {attiva ? <Text style={{ color: c.testo, fontSize: 16 }}>✓</Text> : null}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const stili = StyleSheet.create({
  campo: {
    minHeight: TOCCO_MIN,
    borderWidth: 1,
    borderRadius: raggio.md,
    paddingHorizontal: spazio.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazio.sm,
  },
  velo: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spazio.xl,
  },
  foglio: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '80%',
    borderRadius: raggio.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  testataFoglio: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spazio.lg,
    paddingVertical: spazio.md,
    borderBottomWidth: 1,
  },
  chiudi: { minHeight: TOCCO_MIN, justifyContent: 'center', paddingHorizontal: spazio.sm },
  ricerca: {
    margin: spazio.md,
    borderWidth: 1,
    borderRadius: raggio.md,
    paddingHorizontal: spazio.md,
    minHeight: TOCCO_MIN,
  },
  voce: {
    minHeight: 56,
    paddingHorizontal: spazio.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazio.sm,
  },
});
