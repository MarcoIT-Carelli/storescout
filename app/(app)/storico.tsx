import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { Badge, type Tono } from '@/components/Badge';
import { BannerStato, INATTIVO, type StatoOperazione } from '@/components/BannerStato';
import { Card } from '@/components/Card';
import { Schermata } from '@/components/Schermata';
import { Select } from '@/components/Select';
import { useAuth } from '@/hooks/useAuth';
import { useListe } from '@/hooks/useListe';
import { messaggioErrore } from '@/lib/errori';
import { dataBreve, dataISO, daDataISO, ora } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { Ispezione, StatoIspezione } from '@/types/database';
import { raggio, SOGLIA_LARGA, spazio, testo, TOCCO_MIN, useColori } from '@/theme';

const ASPETTO: Record<StatoIspezione, { etichetta: string; tono: Tono }> = {
  bozza: { etichetta: 'Bozza', tono: 'corso' },
  conclusa: { etichetta: 'Da inviare', tono: 'attenzione' },
  inviata: { etichetta: 'Inviata', tono: 'successo' },
  errore_invio: { etichetta: 'Invio non riuscito', tono: 'errore' },
};

export default function Storico() {
  const c = useColori();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const stretto = width < SOGLIA_LARGA;
  const { profilo } = useAuth();
  const { liste, pdvPerId } = useListe();

  const [ispezioni, setIspezioni] = useState<Ispezione[]>([]);
  const [ricerca, setRicerca] = useState('');
  const [pdvId, setPdvId] = useState<string | null>(null);
  const [da, setDa] = useState<Date | null>(null);
  const [a, setA] = useState<Date | null>(null);
  const [aggiornando, setAggiornando] = useState(false);
  const [stato, setStato] = useState<StatoOperazione>(INATTIVO);

  const admin = profilo?.ruolo === 'admin';
  const filtriAttivi = Boolean(pdvId || da || a || ricerca.trim());

  const carica = useCallback(async () => {
    setAggiornando(true);
    try {
      // Punto vendita e periodo si filtrano sul server: lo storico può crescere molto,
      // e scaricarlo tutto per poi scartarlo sul tablet non ha senso.
      let query = supabase
        .from('ispezioni')
        .select('*')
        .neq('stato', 'bozza')
        .order('data_ispezione', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(200);

      if (!admin && profilo) query = query.eq('ispettore_id', profilo.id);
      if (pdvId) query = query.eq('pdv_id', pdvId);
      if (da) query = query.gte('data_ispezione', dataISO(da));
      if (a) query = query.lte('data_ispezione', dataISO(a));

      const { data, error } = await query;
      if (error) throw error;
      setIspezioni((data ?? []) as Ispezione[]);
      setStato(INATTIVO);
    } catch (e) {
      setStato({ tipo: 'fallito', messaggio: messaggioErrore(e) });
    } finally {
      setAggiornando(false);
    }
  }, [admin, profilo, pdvId, da, a]);

  useEffect(() => {
    void carica();
  }, [carica]);

  // La ricerca testuale resta locale: agisce su codice e città, che stanno in un'altra
  // tabella, e sul numero, che si legge a colpo d'occhio senza tornare sul server.
  const visibili = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    if (!q) return ispezioni;
    return ispezioni.filter((i) => {
      const pdv = pdvPerId(i.pdv_id);
      return (
        pdv?.codice.toLowerCase().includes(q) ||
        pdv?.citta.toLowerCase().includes(q) ||
        String(i.numero).includes(q)
      );
    });
  }, [ispezioni, ricerca, pdvPerId]);

  const opzioniPdv = useMemo(
    () => liste.pdv.map((p) => ({ id: p.id, nome: `${p.codice} — ${p.citta}` })),
    [liste.pdv],
  );

  const scegliData = (quale: 'da' | 'a') => {
    if (Platform.OS !== 'android') return;
    const attuale = (quale === 'da' ? da : a) ?? new Date();
    DateTimePickerAndroid.open({
      value: attuale,
      mode: 'date',
      onChange: (evento, scelta) => {
        if (evento.type !== 'set' || !scelta) return;
        if (quale === 'da') setDa(scelta);
        else setA(scelta);
      },
    });
  };

  const azzera = () => {
    setPdvId(null);
    setDa(null);
    setA(null);
    setRicerca('');
  };

  return (
    <Schermata
      titolo="Storico ispezioni"
      sottotitolo={admin ? 'Tutte le ispezioni' : 'Le tue ispezioni'}
      indietro
    >
      <View style={[stili.filtri, { backgroundColor: c.superficie, borderBottomColor: c.bordo }]}>
        <TextInput
          value={ricerca}
          onChangeText={setRicerca}
          placeholder="Cerca per sigla, città o numero"
          placeholderTextColor={c.testoDisabilitato}
          autoCorrect={false}
          style={[
            stili.ricerca,
            testo.corpo,
            { color: c.testo, borderColor: c.bordo, backgroundColor: c.superficieAlt },
          ]}
        />

        <View style={[stili.riga, stretto && { flexDirection: 'column', alignItems: 'stretch' }]}>
          <Select
            etichetta="Punto vendita"
            opzioni={opzioniPdv}
            valore={pdvId}
            onChange={setPdvId}
            segnaposto="Tutti"
          />
          <CampoData etichetta="Dal" valore={da} onPress={() => scegliData('da')} onPulisci={() => setDa(null)} />
          <CampoData etichetta="Al" valore={a} onPress={() => scegliData('a')} onPulisci={() => setA(null)} />
        </View>

        {filtriAttivi ? (
          <Pressable onPress={azzera} style={stili.azzera} accessibilityRole="button">
            <Text style={[testo.piccolo, { color: c.testo, textDecorationLine: 'underline' }]}>
              Azzera i filtri
            </Text>
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={visibili}
        keyExtractor={(i) => i.id}
        contentContainerStyle={stili.elenco}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={aggiornando} onRefresh={carica} tintColor={c.testoSecondario} />
        }
        ListHeaderComponent={
          <View style={{ gap: spazio.sm, marginBottom: spazio.md }}>
            <BannerStato stato={stato} onRiprova={carica} onChiudi={() => setStato(INATTIVO)} />
            {visibili.length > 0 ? (
              <Text style={[testo.etichetta, { color: c.testoSecondario }]}>
                {visibili.length === 1 ? '1 ISPEZIONE' : `${visibili.length} ISPEZIONI`}
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          aggiornando ? null : (
            <Card>
              <Text style={[testo.corpo, { color: c.testoSecondario }]}>
                {filtriAttivi
                  ? 'Nessuna ispezione corrisponde ai filtri impostati.'
                  : 'Nessuna ispezione conclusa da mostrare.'}
              </Text>
            </Card>
          )
        }
        renderItem={({ item }) => {
          const pdv = pdvPerId(item.pdv_id);
          const aspetto = ASPETTO[item.stato];
          return (
            <Pressable
              onPress={() => router.push(`/ispezione/${item.id}/esito`)}
              style={({ pressed }) => [{ marginBottom: spazio.sm, opacity: pressed ? 0.7 : 1 }]}
            >
              <Card>
                <View style={stili.vocElenco}>
                  <View style={[stili.sigla, { backgroundColor: c.superficieAlt, borderColor: c.bordo }]}>
                    <Text style={[testo.sigla, { color: c.testo }]}>{pdv?.codice ?? '··'}</Text>
                  </View>
                  <View style={stili.dati}>
                    <Text style={[testo.corpoForte, { color: c.testo }]} numberOfLines={1}>
                      {pdv ? pdv.citta : 'Punto vendita non disponibile'}
                    </Text>
                    <Text style={[testo.piccolo, { color: c.testoSecondario }]}>
                      n. {item.numero} · {dataBreve(daDataISO(item.data_ispezione))} ·{' '}
                      {ora(new Date(item.ora_ingresso))}
                      {item.ora_uscita ? `–${ora(new Date(item.ora_uscita))}` : ''}
                    </Text>
                  </View>
                  <Badge testo={aspetto.etichetta} tono={aspetto.tono} />
                </View>
              </Card>
            </Pressable>
          );
        }}
      />
    </Schermata>
  );
}

function CampoData({
  etichetta,
  valore,
  onPress,
  onPulisci,
}: {
  etichetta: string;
  valore: Date | null;
  onPress: () => void;
  onPulisci: () => void;
}) {
  const c = useColori();
  return (
    <View style={{ flex: 1, gap: spazio.xs }}>
      <Text style={[testo.etichetta, { color: c.testoSecondario }]}>{etichetta}</Text>
      <View style={stili.campoData}>
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [
            stili.dataPremibile,
            { borderColor: c.bordo, backgroundColor: pressed ? c.superficieAlt : c.superficie },
          ]}
          accessibilityRole="button"
        >
          <Text style={[testo.corpo, { color: valore ? c.testo : c.testoDisabilitato }]}>
            {valore ? dataBreve(valore) : 'Qualsiasi'}
          </Text>
        </Pressable>
        {valore ? (
          <Pressable
            onPress={onPulisci}
            hitSlop={8}
            style={stili.pulisci}
            accessibilityRole="button"
            accessibilityLabel={`Rimuovi il filtro ${etichetta}`}
          >
            <Text style={{ color: c.testoSecondario, fontSize: 18 }}>✕</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
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
  riga: { flexDirection: 'row', gap: spazio.md, alignItems: 'flex-end' },
  campoData: { flexDirection: 'row', alignItems: 'center', gap: spazio.xs },
  dataPremibile: {
    flex: 1,
    minHeight: TOCCO_MIN,
    borderWidth: 1,
    borderRadius: raggio.md,
    paddingHorizontal: spazio.md,
    justifyContent: 'center',
  },
  pulisci: { width: TOCCO_MIN, height: TOCCO_MIN, alignItems: 'center', justifyContent: 'center' },
  azzera: { minHeight: TOCCO_MIN, justifyContent: 'center', alignSelf: 'flex-start' },
  elenco: { padding: spazio.lg, paddingBottom: spazio.xxxl },
  vocElenco: { flexDirection: 'row', alignItems: 'center', gap: spazio.md },
  sigla: {
    width: 50,
    height: 50,
    borderRadius: raggio.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dati: { flex: 1, gap: 2 },
});
