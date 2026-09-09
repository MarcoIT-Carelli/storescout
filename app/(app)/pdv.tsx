import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Badge } from '@/components/Badge';
import { BannerStato } from '@/components/BannerStato';
import { Schermata } from '@/components/Schermata';
import { salvaBozza } from '@/db/bozze';
import { useAuth } from '@/hooks/useAuth';
import { useListe } from '@/hooks/useListe';
import { leggiRecenti, segnaVisitato } from '@/lib/recenti';
import { nuovaBozza } from '@/types/bozza';
import type { Pdv } from '@/types/database';
import { raggio, spazio, testo, TOCCO_MIN, useColori } from '@/theme';

const INSEGNE = ['Carelli', 'GestFood', 'Sapori della Murgia'];

type Elemento = { tipo: 'intestazione'; testo: string } | { tipo: 'pdv'; pdv: Pdv };

export default function SelezionePdv() {
  const c = useColori();
  const router = useRouter();
  const { profilo } = useAuth();
  const { liste, caricamento, daCache, pdvSelezionabili } = useListe();

  const [ricerca, setRicerca] = useState('');
  const [insegna, setInsegna] = useState<string | null>(null);
  const [recenti, setRecenti] = useState<string[]>([]);

  useEffect(() => {
    leggiRecenti().then(setRecenti).catch(() => setRecenti([]));
  }, []);

  const elementi = useMemo<Elemento[]>(() => {
    const q = ricerca.trim().toLowerCase();

    const corrisponde = (p: Pdv) =>
      !q ||
      p.codice.toLowerCase().includes(q) ||
      p.citta.toLowerCase().includes(q) ||
      p.indirizzo.toLowerCase().includes(q);

    const filtrati = pdvSelezionabili.filter(
      (p) => corrisponde(p) && (!insegna || p.ragione_sociale === insegna),
    );

    const out: Elemento[] = [];

    // I recenti compaiono solo sull'elenco non filtrato: con una ricerca attiva
    // ripeterli in cima confonde invece di aiutare.
    if (!q && !insegna) {
      const suRecenti = recenti
        .map((id) => pdvSelezionabili.find((p) => p.id === id))
        .filter((p): p is Pdv => Boolean(p));
      if (suRecenti.length > 0) {
        out.push({ tipo: 'intestazione', testo: 'RECENTI' });
        suRecenti.forEach((p) => out.push({ tipo: 'pdv', pdv: p }));
        out.push({ tipo: 'intestazione', testo: 'TUTTI I PUNTI VENDITA' });
      }
    }

    filtrati.forEach((p) => out.push({ tipo: 'pdv', pdv: p }));
    return out;
  }, [pdvSelezionabili, ricerca, insegna, recenti]);

  const apri = async (pdv: Pdv) => {
    if (!profilo) return;
    const bozza = nuovaBozza(profilo.id, pdv.id);
    await salvaBozza(bozza);
    await segnaVisitato(pdv.id);
    router.replace(`/ispezione/${bozza.id}`);
  };

  return (
    <Schermata titolo="Scegli il punto vendita" indietro>
      <View style={[stili.filtri, { backgroundColor: c.superficie, borderBottomColor: c.bordo }]}>
        <TextInput
          value={ricerca}
          onChangeText={setRicerca}
          placeholder="Cerca per sigla, città o indirizzo"
          placeholderTextColor={c.testoDisabilitato}
          autoCorrect={false}
          clearButtonMode="while-editing"
          style={[
            stili.ricerca,
            testo.corpo,
            { color: c.testo, borderColor: c.bordo, backgroundColor: c.superficieAlt },
          ]}
        />

        <View style={stili.insegne}>
          <Chip attivo={insegna === null} etichetta="Tutte" onPress={() => setInsegna(null)} />
          {INSEGNE.map((i) => (
            <Chip key={i} attivo={insegna === i} etichetta={i} onPress={() => setInsegna(i)} />
          ))}
        </View>
      </View>

      {caricamento ? (
        <View style={stili.attesa}>
          <ActivityIndicator color={c.testoSecondario} />
          <Text style={[testo.piccolo, { color: c.testoSecondario }]}>Caricamento dei punti vendita…</Text>
        </View>
      ) : (
        <FlatList
          data={elementi}
          keyExtractor={(e, i) => (e.tipo === 'pdv' ? e.pdv.id : `h${i}`)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={stili.elenco}
          ListHeaderComponent={
            daCache ? (
              <View style={{ marginBottom: spazio.md }}>
                <BannerStato
                  stato={{ tipo: 'fallito', messaggio: 'Elenco dalla copia locale: la rete non risponde.' }}
                />
              </View>
            ) : null
          }
          ListEmptyComponent={
            pdvSelezionabili.length === 0 ? (
              <View style={[stili.vuoto, { borderColor: c.bordo, backgroundColor: c.superficie }]}>
                <Text style={[testo.corpoForte, { color: c.testo, textAlign: 'center' }]}>
                  Nessun punto vendita assegnato
                </Text>
                <Text style={[testo.piccolo, { color: c.testoSecondario, textAlign: 'center' }]}>
                  Non puoi ancora aprire una scheda. Chiedi all’amministratore di assegnarti i
                  punti vendita di tua competenza: la modifica arriva senza aggiornare l’app.
                </Text>
              </View>
            ) : (
              <Text style={[testo.corpo, { color: c.testoSecondario, padding: spazio.lg }]}>
                Nessun punto vendita corrisponde alla ricerca.
              </Text>
            )
          }
          renderItem={({ item }) =>
            item.tipo === 'intestazione' ? (
              <Text style={[testo.etichetta, { color: c.testoSecondario, marginTop: spazio.md, marginBottom: spazio.sm }]}>
                {item.testo}
              </Text>
            ) : (
              <Pressable
                onPress={() => apri(item.pdv)}
                style={({ pressed }) => [
                  stili.voce,
                  {
                    backgroundColor: pressed ? c.superficieAlt : c.superficie,
                    borderColor: c.bordo,
                  },
                ]}
                accessibilityRole="button"
              >
                <View style={[stili.sigla, { backgroundColor: c.giallo, borderColor: c.giallo }]}>
                  <Text style={[testo.sigla, { color: c.suGiallo }]}>{item.pdv.codice}</Text>
                </View>
                <View style={stili.dati}>
                  <Text style={[testo.corpoForte, { color: c.testo }]} numberOfLines={1}>
                    {item.pdv.citta}
                  </Text>
                  <Text style={[testo.piccolo, { color: c.testoSecondario }]} numberOfLines={1}>
                    {item.pdv.indirizzo}
                  </Text>
                </View>
                <Badge testo={item.pdv.ragione_sociale} />
              </Pressable>
            )
          }
        />
      )}
    </Schermata>
  );
}

function Chip({ etichetta, attivo, onPress }: { etichetta: string; attivo: boolean; onPress: () => void }) {
  const c = useColori();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: attivo }}
      style={({ pressed }) => [
        stili.chip,
        {
          backgroundColor: attivo ? c.nero : pressed ? c.superficieAlt : c.superficie,
          borderColor: attivo ? c.nero : c.bordo,
        },
      ]}
    >
      <Text
        style={[
          testo.piccolo,
          { color: attivo ? '#FFFFFF' : c.testo, fontWeight: attivo ? '700' : '400' },
        ]}
      >
        {etichetta}
      </Text>
    </Pressable>
  );
}

const stili = StyleSheet.create({
  filtri: { padding: spazio.lg, gap: spazio.md, borderBottomWidth: 1 },
  ricerca: {
    minHeight: TOCCO_MIN + 4,
    borderWidth: 1,
    borderRadius: raggio.md,
    paddingHorizontal: spazio.md,
  },
  insegne: { flexDirection: 'row', flexWrap: 'wrap', gap: spazio.sm },
  chip: {
    minHeight: TOCCO_MIN,
    paddingHorizontal: spazio.lg,
    borderRadius: raggio.pill,
    borderWidth: 1,
    justifyContent: 'center',
  },
  attesa: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spazio.md },
  vuoto: {
    borderWidth: 1,
    borderRadius: raggio.lg,
    padding: spazio.xl,
    gap: spazio.sm,
    alignItems: 'center',
  },
  elenco: { padding: spazio.lg, paddingBottom: spazio.xxxl },
  voce: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazio.md,
    padding: spazio.md,
    borderWidth: 1,
    borderRadius: raggio.md,
    marginBottom: spazio.sm,
    minHeight: 76,
  },
  sigla: {
    width: 54,
    height: 54,
    borderRadius: raggio.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dati: { flex: 1, gap: 2 },
});
