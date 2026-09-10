import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { raggio, spazio, testo, TOCCO_MIN, useColori } from '@/theme';

import { Button } from './Button';

/**
 * Scelta di più voci da un elenco lungo.
 *
 * A differenza di `Select`, che si chiude a ogni scelta, qui la finestra resta aperta e
 * si spunta quello che serve: con quarantacinque punti vendita da assegnare, aprire e
 * richiudere una tendina per ciascuno è un lavoro che nessuno fa volentieri.
 *
 * Le spunte agiscono subito su chi ci sta sopra — non c'è un secondo livello di conferma,
 * perché il salvataggio vero è quello del modulo che contiene questo campo.
 */

export type VoceScelta = {
  id: string;
  nome: string;
  /** Riga secondaria, per distinguere voci dal nome simile. */
  dettaglio?: string;
};

type Props = {
  etichettaPulsante: string;
  titolo: string;
  voci: VoceScelta[];
  selezionati: string[];
  onChange: (ids: string[]) => void;
  disabilitato?: boolean;
};

export function SceltaMultipla({
  etichettaPulsante,
  titolo,
  voci,
  selezionati,
  onChange,
  disabilitato = false,
}: Props) {
  const c = useColori();
  const [aperto, setAperto] = useState(false);
  const [filtro, setFiltro] = useState('');

  const scelti = useMemo(() => new Set(selezionati), [selezionati]);

  const visibili = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    if (!q) return voci;
    return voci.filter(
      (v) => v.nome.toLowerCase().includes(q) || (v.dettaglio ?? '').toLowerCase().includes(q),
    );
  }, [voci, filtro]);

  const commuta = (id: string) =>
    onChange(scelti.has(id) ? selezionati.filter((x) => x !== id) : [...selezionati, id]);

  /** Agiscono su ciò che si sta guardando: con una ricerca attiva toccano solo quelli. */
  const tuttiVisibili = () =>
    onChange([...new Set([...selezionati, ...visibili.map((v) => v.id)])]);
  const nessunoVisibile = () => {
    const daTogliere = new Set(visibili.map((v) => v.id));
    onChange(selezionati.filter((id) => !daTogliere.has(id)));
  };

  const chiudi = () => {
    setAperto(false);
    setFiltro('');
  };

  return (
    <>
      <Pressable
        onPress={() => !disabilitato && setAperto(true)}
        disabled={disabilitato}
        accessibilityRole="button"
        style={({ pressed }) => [
          stili.apri,
          {
            borderColor: c.bordo,
            backgroundColor: disabilitato ? c.disabilitato : pressed ? c.superficieAlt : c.superficie,
          },
        ]}
      >
        <Text
          style={[testo.corpoForte, { color: disabilitato ? c.testoDisabilitato : c.testo }]}
        >
          {etichettaPulsante}
        </Text>
      </Pressable>

      <Modal visible={aperto} transparent animationType="fade" onRequestClose={chiudi}>
        <View style={stili.velo}>
          <View style={[stili.foglio, { backgroundColor: c.superficie, borderColor: c.bordo }]}>
            <View style={[stili.testata, { borderBottomColor: c.bordo }]}>
              <View style={{ flex: 1 }}>
                <Text style={[testo.sezione, { color: c.testo }]}>{titolo}</Text>
                <Text style={[testo.piccolo, { color: c.testoSecondario }]}>
                  {selezionati.length} su {voci.length} selezionati
                </Text>
              </View>
            </View>

            <View style={stili.strumenti}>
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
              <View style={stili.massa}>
                <Button
                  titolo={filtro.trim() ? 'Segna i risultati' : 'Segna tutti'}
                  variante="secondario"
                  compatto
                  onPress={tuttiVisibili}
                />
                <Button
                  titolo={filtro.trim() ? 'Togli i risultati' : 'Togli tutti'}
                  variante="secondario"
                  compatto
                  onPress={nessunoVisibile}
                />
              </View>
            </View>

            <FlatList
              data={visibili}
              keyExtractor={(v) => v.id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={[testo.corpo, { color: c.testoSecondario, padding: spazio.lg }]}>
                  Nessuna voce corrisponde alla ricerca.
                </Text>
              }
              renderItem={({ item }) => {
                const attivo = scelti.has(item.id);
                return (
                  <Pressable
                    onPress={() => commuta(item.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: attivo }}
                    style={({ pressed }) => [
                      stili.voce,
                      { backgroundColor: pressed ? c.superficieAlt : 'transparent' },
                    ]}
                  >
                    <View
                      style={[
                        stili.quadro,
                        {
                          borderColor: attivo ? c.nero : c.bordo,
                          backgroundColor: attivo ? c.giallo : c.superficie,
                        },
                      ]}
                    >
                      {attivo ? <Text style={stili.segno}>✓</Text> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[testo.corpo, { color: c.testo }]} numberOfLines={1}>
                        {item.nome}
                      </Text>
                      {item.dettaglio ? (
                        <Text style={[testo.piccolo, { color: c.testoSecondario }]} numberOfLines={1}>
                          {item.dettaglio}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              }}
            />

            <View style={[stili.piede, { borderTopColor: c.bordo }]}>
              <Button titolo="Fatto" larghezzaPiena onPress={chiudi} />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const stili = StyleSheet.create({
  apri: {
    minHeight: TOCCO_MIN,
    borderWidth: 1,
    borderRadius: raggio.md,
    paddingHorizontal: spazio.md,
    alignItems: 'center',
    justifyContent: 'center',
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
    maxHeight: '85%',
    borderRadius: raggio.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  testata: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spazio.lg,
    paddingVertical: spazio.md,
    borderBottomWidth: 1,
  },
  strumenti: { padding: spazio.md, gap: spazio.sm },
  ricerca: {
    minHeight: TOCCO_MIN,
    borderWidth: 1,
    borderRadius: raggio.md,
    paddingHorizontal: spazio.md,
  },
  massa: { flexDirection: 'row', gap: spazio.sm, flexWrap: 'wrap' },
  voce: {
    minHeight: 60,
    paddingHorizontal: spazio.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazio.md,
  },
  quadro: {
    width: 28,
    height: 28,
    borderRadius: raggio.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segno: { fontSize: 18, fontWeight: '900', color: '#111111', lineHeight: 20 },
  piede: { padding: spazio.lg, borderTopWidth: 1 },
});
