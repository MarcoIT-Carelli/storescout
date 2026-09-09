import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Badge } from '@/components/Badge';
import { BannerStato, INATTIVO, type StatoOperazione } from '@/components/BannerStato';
import { Button } from '@/components/Button';
import { Schermata } from '@/components/Schermata';
import { leggiAssegnazioni, salvaAssegnazioni } from '@/lib/assegnazioni';
import { messaggioErrore } from '@/lib/errori';
import { leggiIspettori } from '@/lib/ispettori';
import { leggiTuttiPdv } from '@/lib/pdvAdmin';
import type { Pdv, Profilo } from '@/types/database';
import { raggio, spazio, testo, TOCCO_MIN, useColori } from '@/theme';

/**
 * Quali punti vendita può vedere un ispettore.
 *
 * Le modifiche restano in questa schermata finché non si preme «Salva»: assegnare
 * quaranta punti vendita a tocchi singoli, ognuno con la sua richiesta di rete, vuol
 * dire quaranta occasioni di fallire a metà senza sapere più a che punto si era.
 */
export default function Assegnazioni() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColori();

  const [ispettore, setIspettore] = useState<Profilo | null>(null);
  const [pdv, setPdv] = useState<Pdv[]>([]);
  const [scelti, setScelti] = useState<Set<string>>(new Set());
  const [iniziali, setIniziali] = useState<Set<string>>(new Set());
  const [ricerca, setRicerca] = useState('');
  const [caricamento, setCaricamento] = useState(true);
  const [stato, setStato] = useState<StatoOperazione>(INATTIVO);

  const carica = useCallback(async () => {
    if (!id) return;
    setCaricamento(true);
    try {
      const [ispettori, tutti, assegnati] = await Promise.all([
        leggiIspettori(),
        leggiTuttiPdv(),
        leggiAssegnazioni(id),
      ]);
      setIspettore(ispettori.find((p) => p.id === id) ?? null);
      setPdv(tutti);
      setScelti(new Set(assegnati));
      setIniziali(new Set(assegnati));
      setStato(INATTIVO);
    } catch (e) {
      setStato({ tipo: 'fallito', messaggio: messaggioErrore(e) });
    } finally {
      setCaricamento(false);
    }
  }, [id]);

  useEffect(() => {
    void carica();
  }, [carica]);

  const visibili = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    if (!q) return pdv;
    return pdv.filter(
      (p) =>
        p.codice.toLowerCase().includes(q) ||
        p.citta.toLowerCase().includes(q) ||
        p.indirizzo.toLowerCase().includes(q) ||
        p.ragione_sociale.toLowerCase().includes(q),
    );
  }, [pdv, ricerca]);

  const cambiate = scelti.size !== iniziali.size || [...scelti].some((x) => !iniziali.has(x));

  const commuta = (pdvId: string) =>
    setScelti((precedenti) => {
      const nuovi = new Set(precedenti);
      if (nuovi.has(pdvId)) nuovi.delete(pdvId);
      else nuovi.add(pdvId);
      return nuovi;
    });

  /** Agiscono su ciò che si sta guardando: con una ricerca attiva toccano solo quelli. */
  const assegnaVisibili = () => setScelti((p) => new Set([...p, ...visibili.map((v) => v.id)]));
  const togliVisibili = () =>
    setScelti((p) => {
      const nuovi = new Set(p);
      visibili.forEach((v) => nuovi.delete(v.id));
      return nuovi;
    });

  const salva = async () => {
    if (!id) return;
    setStato({ tipo: 'inCorso', messaggio: 'Salvataggio delle assegnazioni…' });
    try {
      await salvaAssegnazioni(id, [...scelti]);
      setIniziali(new Set(scelti));
      setStato({
        tipo: 'riuscito',
        messaggio:
          scelti.size === 0
            ? 'Nessun punto vendita assegnato: questo ispettore non potrà aprire schede.'
            : `${scelti.size} ${scelti.size === 1 ? 'punto vendita assegnato' : 'punti vendita assegnati'}. La modifica arriva sul tablet al prossimo avvio.`,
      });
    } catch (e) {
      setStato({ tipo: 'fallito', messaggio: messaggioErrore(e) });
    }
  };

  const nome = ispettore ? `${ispettore.nome} ${ispettore.cognome}`.trim() : '';

  return (
    <Schermata
      titolo="Punti vendita assegnati"
      sottotitolo={nome || undefined}
      indietro
      azioni={
        <Text style={[testo.etichetta, { color: c.suGiallo }]}>
          {scelti.size} / {pdv.length}
        </Text>
      }
    >
      <View style={[stili.testata, { backgroundColor: c.superficie, borderBottomColor: c.bordo }]}>
        <TextInput
          value={ricerca}
          onChangeText={setRicerca}
          placeholder="Cerca per sigla, città, indirizzo o insegna"
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
            titolo={ricerca.trim() ? 'Assegna i risultati' : 'Assegna tutti'}
            variante="secondario"
            compatto
            onPress={assegnaVisibili}
          />
          <Button
            titolo={ricerca.trim() ? 'Togli i risultati' : 'Togli tutti'}
            variante="secondario"
            compatto
            onPress={togliVisibili}
          />
        </View>
      </View>

      {caricamento ? (
        <View style={stili.attesa}>
          <ActivityIndicator color={c.testoSecondario} />
        </View>
      ) : (
        <FlatList
          data={visibili}
          keyExtractor={(p) => p.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={stili.elenco}
          ListHeaderComponent={
            <View style={{ gap: spazio.sm, marginBottom: spazio.md }}>
              <BannerStato stato={stato} onRiprova={carica} onChiudi={() => setStato(INATTIVO)} />
              {ispettore?.ruolo === 'admin' ? (
                <View
                  style={[
                    stili.nota,
                    { backgroundColor: c.attenzioneSfondo, borderColor: c.attenzione },
                  ]}
                >
                  <Text style={[testo.piccolo, { color: c.testo }]}>
                    È un amministratore: vede comunque tutti i punti vendita, qualunque cosa
                    scegli qui.
                  </Text>
                </View>
              ) : null}
            </View>
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
                  {
                    backgroundColor: pressed ? c.superficieAlt : c.superficie,
                    borderColor: attivo ? c.nero : c.bordo,
                    opacity: item.attivo ? 1 : 0.6,
                  },
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

                <View style={[stili.sigla, { backgroundColor: c.giallo }]}>
                  <Text style={[testo.sigla, { color: c.suGiallo }]}>{item.codice}</Text>
                </View>

                <View style={stili.dati}>
                  <Text style={[testo.corpoForte, { color: c.testo }]} numberOfLines={1}>
                    {item.citta}
                  </Text>
                  <Text style={[testo.piccolo, { color: c.testoSecondario }]} numberOfLines={1}>
                    {item.indirizzo}
                  </Text>
                </View>

                {!item.attivo ? <Badge testo="Disattivato" tono="errore" /> : null}
              </Pressable>
            );
          }}
        />
      )}

      <View style={[stili.barra, { backgroundColor: c.superficie, borderTopColor: c.bordo }]}>
        <Text
          style={[testo.piccolo, { color: cambiate ? c.attenzione : c.testoSecondario, flex: 1 }]}
        >
          {cambiate ? 'Modifiche non ancora salvate' : 'Nessuna modifica in sospeso'}
        </Text>
        <Button
          titolo="Salva assegnazioni"
          onPress={salva}
          disabilitato={!cambiate}
          inCorso={stato.tipo === 'inCorso'}
        />
      </View>
    </Schermata>
  );
}

const stili = StyleSheet.create({
  testata: { padding: spazio.lg, gap: spazio.md, borderBottomWidth: 1 },
  ricerca: {
    minHeight: TOCCO_MIN + 4,
    borderWidth: 1,
    borderRadius: raggio.md,
    paddingHorizontal: spazio.md,
  },
  massa: { flexDirection: 'row', gap: spazio.sm, flexWrap: 'wrap' },
  attesa: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  elenco: { padding: spazio.lg, paddingBottom: spazio.xxxl },
  nota: { borderWidth: 1, borderRadius: raggio.md, padding: spazio.md },
  voce: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazio.md,
    padding: spazio.md,
    borderWidth: 1,
    borderRadius: raggio.md,
    marginBottom: spazio.sm,
    minHeight: 72,
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
  sigla: {
    width: 54,
    height: 54,
    borderRadius: raggio.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dati: { flex: 1, gap: 2 },
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazio.md,
    padding: spazio.lg,
    borderTopWidth: 1,
  },
});
