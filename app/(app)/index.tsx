import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Badge, type Tono } from '@/components/Badge';
import { BannerStato, INATTIVO, type StatoOperazione } from '@/components/BannerStato';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Logo } from '@/components/Logo';
import { MenuUtente } from '@/components/MenuUtente';
import { Schermata } from '@/components/Schermata';
import { useAuth } from '@/hooks/useAuth';
import { useListe } from '@/hooks/useListe';
import { leggiBozze } from '@/db/bozze';
import { messaggioErrore } from '@/lib/errori';
import { dataRelativa, ora } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Bozza } from '@/types/bozza';
import type { Ispezione, StatoIspezione } from '@/types/database';
import { raggio, spazio, testo, useColori } from '@/theme';

type Voce =
  | { chiave: string; tipo: 'bozza'; bozza: Bozza; quando: Date }
  | { chiave: string; tipo: 'remota'; ispezione: Ispezione; quando: Date };

const saluto = () => {
  const h = new Date().getHours();
  if (h < 13) return 'Buongiorno';
  if (h < 18) return 'Buon pomeriggio';
  return 'Buonasera';
};

const ASPETTO: Record<StatoIspezione, { etichetta: string; tono: Tono }> = {
  bozza: { etichetta: 'Bozza', tono: 'corso' },
  conclusa: { etichetta: 'Da inviare', tono: 'attenzione' },
  inviata: { etichetta: 'Inviata', tono: 'successo' },
  errore_invio: { etichetta: 'Invio non riuscito', tono: 'errore' },
};

export default function Home() {
  const c = useColori();
  const router = useRouter();
  const { profilo } = useAuth();
  const { pdvPerId, daCache } = useListe();

  const [voci, setVoci] = useState<Voce[]>([]);
  const [aggiornando, setAggiornando] = useState(false);
  const [stato, setStato] = useState<StatoOperazione>(INATTIVO);

  const carica = useCallback(async () => {
    if (!profilo) return;
    setAggiornando(true);

    // Le bozze locali si leggono comunque: senza rete restano l'unica cosa visibile.
    const bozze = await leggiBozze(profilo.id);
    const daBozze: Voce[] = bozze.map((b) => ({
      chiave: `b:${b.id}`,
      tipo: 'bozza',
      bozza: b,
      quando: new Date(b.aggiornata),
    }));

    let daRemoto: Voce[] = [];
    try {
      const { data, error } = await supabase
        .from('ispezioni')
        .select('*')
        .eq('ispettore_id', profilo.id)
        .neq('stato', 'bozza')
        .order('data_ispezione', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;

      daRemoto = ((data ?? []) as Ispezione[]).map((i) => ({
        chiave: `r:${i.id}`,
        tipo: 'remota',
        ispezione: i,
        quando: new Date(i.ora_uscita ?? i.ora_ingresso),
      }));
      setStato(INATTIVO);
    } catch (e) {
      setStato({ tipo: 'fallito', messaggio: messaggioErrore(e) });
    }

    setVoci([...daBozze, ...daRemoto].sort((a, b) => b.quando.getTime() - a.quando.getTime()));
    setAggiornando(false);
  }, [profilo]);

  useFocusEffect(
    useCallback(() => {
      void carica();
    }, [carica]),
  );

  const nome = profilo?.nome?.trim() || '';

  return (
    <Schermata>
      <View style={[stili.testata, { borderBottomColor: c.bordo, backgroundColor: c.superficie }]}>
        <Logo larghezza={34} colore={c.marchio} conScritta={false} />
        <View style={{ flex: 1 }}>
          <Text style={[testo.corpoForte, { color: c.testo }]}>StoreScout</Text>
          <Text style={[testo.etichetta, { color: c.testoSecondario, fontWeight: '400' }]}>
            Schede attività ispettore
          </Text>
        </View>
        <MenuUtente />
      </View>

      <FlatList
        data={voci}
        keyExtractor={(v) => v.chiave}
        contentContainerStyle={stili.elenco}
        refreshControl={
          <RefreshControl refreshing={aggiornando} onRefresh={carica} tintColor={c.testoSecondario} />
        }
        ListHeaderComponent={
          <View style={{ gap: spazio.lg, marginBottom: spazio.lg }}>
            <View>
              <Text style={[testo.titolo, { color: c.testo }]}>
                {saluto()}
                {nome ? `, ${nome}` : ''}
              </Text>
              <Text style={[testo.corpo, { color: c.testoSecondario }]}>
                Apri una nuova scheda o riprendi quella che hai lasciato a metà.
              </Text>
            </View>

            <Button
              titolo="Nuova ispezione"
              larghezzaPiena
              onPress={() => router.push('/pdv')}
              style={stili.principale}
            />

            {daCache ? (
              <BannerStato
                stato={{
                  tipo: 'fallito',
                  messaggio: 'Elenchi caricati dalla copia locale: la rete non risponde.',
                }}
              />
            ) : null}

            <BannerStato stato={stato} onRiprova={carica} onChiudi={() => setStato(INATTIVO)} />

            <Text style={[testo.etichetta, { color: c.testoSecondario }]}>ULTIME ISPEZIONI</Text>
          </View>
        }
        ListEmptyComponent={
          aggiornando ? null : (
            <Card>
              <Text style={[testo.corpo, { color: c.testoSecondario }]}>
                Non hai ancora nessuna ispezione. Tocca "Nuova ispezione" per cominciare.
              </Text>
            </Card>
          )
        }
        renderItem={({ item }) => {
          if (item.tipo === 'bozza') {
            const pdv = pdvPerId(item.bozza.pdv_id);
            return (
              <Pressable
                onPress={() => router.push(`/ispezione/${item.bozza.id}`)}
                style={({ pressed }) => [{ marginBottom: spazio.md, opacity: pressed ? 0.7 : 1 }]}
              >
                <Card inCorso>
                  <View style={stili.riga}>
                    <View style={[stili.sigla, { backgroundColor: c.giallo }]}>
                      <Text style={[testo.sigla, { color: c.suGiallo }]}>{pdv?.codice ?? '··'}</Text>
                    </View>
                    <View style={stili.centro}>
                      <Text style={[testo.corpoForte, { color: c.testo }]} numberOfLines={1}>
                        {pdv ? `${pdv.citta} — ${pdv.indirizzo}` : 'Punto vendita non disponibile'}
                      </Text>
                      <Text style={[testo.piccolo, { color: c.testoSecondario }]}>
                        Ingresso {ora(new Date(item.bozza.ora_ingresso))} ·{' '}
                        {dataRelativa(new Date(item.bozza.ora_ingresso))}
                      </Text>
                    </View>
                    <View style={stili.destra}>
                      <Badge testo="In corso" tono="corso" />
                      <Text style={[testo.piccolo, { color: c.testoSecondario }]}>Riprendi ›</Text>
                    </View>
                  </View>
                </Card>
              </Pressable>
            );
          }

          const i = item.ispezione;
          const pdv = pdvPerId(i.pdv_id);
          const aspetto = ASPETTO[i.stato];

          return (
            <Pressable
              onPress={() => router.push(`/ispezione/${i.id}/esito`)}
              style={({ pressed }) => [{ marginBottom: spazio.md, opacity: pressed ? 0.7 : 1 }]}
            >
              <Card>
                <View style={stili.riga}>
                  <View style={[stili.sigla, { backgroundColor: c.superficieAlt, borderColor: c.bordo }]}>
                    <Text style={[testo.sigla, { color: c.testo }]}>{pdv?.codice ?? '··'}</Text>
                  </View>
                  <View style={stili.centro}>
                    <Text style={[testo.corpoForte, { color: c.testo }]} numberOfLines={1}>
                      {pdv ? `${pdv.citta} — ${pdv.indirizzo}` : 'Punto vendita non disponibile'}
                    </Text>
                    <Text style={[testo.piccolo, { color: c.testoSecondario }]}>
                      {dataRelativa(item.quando)} · n. {i.numero}
                    </Text>
                  </View>
                  <View style={stili.destra}>
                    <Badge testo={aspetto.etichetta} tono={aspetto.tono} />
                    {i.stato === 'errore_invio' ? (
                      <Text style={[testo.piccolo, { color: c.errore }]}>Riprova invio ›</Text>
                    ) : null}
                  </View>
                </View>
              </Card>
            </Pressable>
          );
        }}
      />
    </Schermata>
  );
}

const stili = StyleSheet.create({
  testata: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazio.md,
    paddingHorizontal: spazio.lg,
    paddingVertical: spazio.sm,
    borderBottomWidth: 1,
  },
  elenco: { padding: spazio.lg, paddingBottom: spazio.xxxl },
  principale: { minHeight: 68 },
  riga: { flexDirection: 'row', alignItems: 'center', gap: spazio.md },
  sigla: {
    width: 56,
    height: 56,
    borderRadius: raggio.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  centro: { flex: 1, gap: 2 },
  destra: { alignItems: 'flex-end', gap: spazio.xs },
});
