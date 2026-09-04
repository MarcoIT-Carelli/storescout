import { File, Paths } from 'expo-file-system';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Linking,
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
import { Button } from '@/components/Button';
import { CampoData } from '@/components/CampoData';
import { Card } from '@/components/Card';
import { ConfermaInLinea } from '@/components/ConfermaInLinea';
import { Schermata } from '@/components/Schermata';
import { Select } from '@/components/Select';
import { useListe } from '@/hooks/useListe';
import { messaggioErrore } from '@/lib/errori';
import { dataBreve, daDataISO, ora } from '@/lib/format';
import { leggiIspettori } from '@/lib/ispettori';
import { inviaScheda, urlPdf } from '@/lib/ispezioni';
import {
  eliminaBozza,
  esportaCsv,
  FILTRI_VUOTI,
  LIMITE,
  leggiIspezioni,
  nomeFileExport,
  type Filtri,
} from '@/lib/ispezioniAdmin';
import type { Ispezione, Profilo, StatoIspezione } from '@/types/database';
import { raggio, SOGLIA_LARGA, spazio, testo, TOCCO_MIN, useColori } from '@/theme';

const ASPETTO: Record<StatoIspezione, { etichetta: string; tono: Tono }> = {
  bozza: { etichetta: 'Bozza', tono: 'corso' },
  conclusa: { etichetta: 'Da inviare', tono: 'attenzione' },
  inviata: { etichetta: 'Inviata', tono: 'successo' },
  errore_invio: { etichetta: 'Invio non riuscito', tono: 'errore' },
};

const STATI = (Object.keys(ASPETTO) as StatoIspezione[]).map((s) => ({
  id: s,
  nome: ASPETTO[s].etichetta,
}));

export default function IspezioniAdmin() {
  const c = useColori();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const stretto = width < SOGLIA_LARGA;
  const { liste, pdvPerId } = useListe();

  const [ispezioni, setIspezioni] = useState<Ispezione[]>([]);
  const [ispettori, setIspettori] = useState<Profilo[]>([]);
  const [filtri, setFiltri] = useState<Filtri>(FILTRI_VUOTI);
  const [ricerca, setRicerca] = useState('');
  const [aggiornando, setAggiornando] = useState(false);
  const [esportando, setEsportando] = useState(false);
  const [occupato, setOccupato] = useState<string | null>(null);
  const [daEliminare, setDaEliminare] = useState<string | null>(null);
  const [daRinviare, setDaRinviare] = useState<string | null>(null);
  const [stato, setStato] = useState<StatoOperazione>(INATTIVO);

  const cambia = <K extends keyof Filtri>(chiave: K, valore: Filtri[K]) =>
    setFiltri((f) => ({ ...f, [chiave]: valore }));

  const filtriAttivi =
    Boolean(ricerca.trim()) || Object.values(filtri).some((v) => v !== null);

  /** `silenzioso` tiene in vista l'esito dell'azione appena compiuta. */
  const carica = useCallback(
    async (silenzioso = false) => {
      setAggiornando(true);
      try {
        setIspezioni(await leggiIspezioni(filtri));
        if (!silenzioso) setStato(INATTIVO);
      } catch (e) {
        setStato({ tipo: 'fallito', messaggio: messaggioErrore(e) });
      } finally {
        setAggiornando(false);
      }
    },
    [filtri],
  );

  useEffect(() => {
    void carica();
  }, [carica]);

  // Gli ispettori servono al filtro e ai nomi in elenco: cambiano di rado, si leggono
  // una volta sola e non a ogni ritocco dei filtri.
  useEffect(() => {
    leggiIspettori()
      .then(setIspettori)
      .catch((e: unknown) => setStato({ tipo: 'fallito', messaggio: messaggioErrore(e) }));
  }, []);

  // Sigla, città e numero si cercano qui: stanno in due tabelle diverse e l'elenco è
  // già in memoria, quindi un altro giro sul server non aggiungerebbe niente.
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

  // Con l'email accanto: due account possono chiamarsi allo stesso modo, e scegliere
  // quello sbagliato darebbe un elenco vuoto senza spiegare perché.
  const opzioniIspettori = useMemo(
    () => ispettori.map((p) => ({ id: p.id, nome: `${p.cognome} ${p.nome} — ${p.email}` })),
    [ispettori],
  );

  const esporta = async () => {
    setEsportando(true);
    setStato({ tipo: 'inCorso', messaggio: 'Preparazione dell’export…' });
    try {
      const csv = await esportaCsv(visibili, pdvPerId, ispettori);
      const file = new File(Paths.cache, nomeFileExport(filtri));
      file.create({ overwrite: true });
      file.write(csv);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'text/csv',
          dialogTitle: 'Esporta le ispezioni',
          UTI: 'public.comma-separated-values-text',
        });
        setStato({
          tipo: 'riuscito',
          messaggio: `Export di ${visibili.length} ${visibili.length === 1 ? 'ispezione' : 'ispezioni'} pronto.`,
        });
      } else {
        setStato({ tipo: 'riuscito', messaggio: `File salvato in ${file.uri}` });
      }
    } catch (e) {
      setStato({ tipo: 'fallito', messaggio: messaggioErrore(e) });
    } finally {
      setEsportando(false);
    }
  };

  const apriPdf = async (percorso: string) => {
    setStato({ tipo: 'inCorso', messaggio: 'Apertura del PDF…' });
    try {
      await Linking.openURL(await urlPdf(percorso));
      setStato(INATTIVO);
    } catch (e) {
      setStato({ tipo: 'fallito', messaggio: messaggioErrore(e) });
    }
  };

  const riprova = async (id: string) => {
    setDaRinviare(null);
    setOccupato(id);
    setStato({ tipo: 'inCorso', messaggio: 'Invio in corso…' });
    const esito = await inviaScheda(id);
    setStato({ tipo: esito.inviata ? 'riuscito' : 'fallito', messaggio: esito.messaggio });
    setOccupato(null);
    await carica(true);
  };

  const elimina = async (id: string) => {
    setDaEliminare(null);
    setOccupato(id);
    try {
      const tolta = await eliminaBozza(id);
      setStato(
        tolta
          ? { tipo: 'riuscito', messaggio: 'Bozza eliminata.' }
          : {
              tipo: 'fallito',
              messaggio:
                'Il database ha rifiutato l’eliminazione: manca la policy di delete su «ispezioni».',
            },
      );
    } catch (e) {
      setStato({ tipo: 'fallito', messaggio: messaggioErrore(e) });
    } finally {
      setOccupato(null);
      await carica(true);
    }
  };

  return (
    <Schermata
      titolo="Ispezioni ed export"
      sottotitolo="Tutte le ispezioni, bozze comprese"
      indietro
      tinta="giallo"
      azioni={
        <Button
          titolo="Esporta CSV"
          variante="secondario"
          compatto
          inCorso={esportando}
          disabilitato={visibili.length === 0}
          onPress={esporta}
        />
      }
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

        <View style={[stili.riga, stretto && stili.colonna]}>
          <Select
            etichetta="Punto vendita"
            opzioni={opzioniPdv}
            valore={filtri.pdvId}
            onChange={(v) => cambia('pdvId', v)}
            segnaposto="Tutti"
          />
          <Select
            etichetta="Ispettore"
            opzioni={opzioniIspettori}
            valore={filtri.ispettoreId}
            onChange={(v) => cambia('ispettoreId', v)}
            segnaposto="Tutti"
          />
        </View>

        <View style={[stili.riga, stretto && stili.colonna]}>
          <Select
            etichetta="Stato"
            opzioni={STATI}
            valore={filtri.stato}
            onChange={(v) => cambia('stato', v as StatoIspezione | null)}
            segnaposto="Qualsiasi"
          />
          <CampoData etichetta="Dal" valore={filtri.da} onChange={(d) => cambia('da', d)} />
          <CampoData etichetta="Al" valore={filtri.a} onChange={(d) => cambia('a', d)} />
        </View>

        {filtriAttivi ? (
          <Pressable
            onPress={() => {
              setFiltri(FILTRI_VUOTI);
              setRicerca('');
            }}
            style={stili.azzera}
            accessibilityRole="button"
          >
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
          <RefreshControl
            refreshing={aggiornando}
            onRefresh={() => carica()}
            tintColor={c.testoSecondario}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: spazio.sm, marginBottom: spazio.md }}>
            <BannerStato
              stato={stato}
              onRiprova={() => carica()}
              onChiudi={() => setStato(INATTIVO)}
            />
            {visibili.length > 0 ? (
              <Text style={[testo.etichetta, { color: c.testoSecondario }]}>
                {visibili.length === 1 ? '1 ISPEZIONE' : `${visibili.length} ISPEZIONI`}
              </Text>
            ) : null}
            {ispezioni.length === LIMITE ? (
              <Text style={[testo.piccolo, { color: c.attenzione }]}>
                Sono mostrate le {LIMITE} ispezioni più recenti. Restringi il periodo per vederle
                tutte: anche l’export si ferma a queste.
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
                  : 'Nessuna ispezione registrata.'}
              </Text>
            </Card>
          )
        }
        renderItem={({ item }) => {
          const pdv = pdvPerId(item.pdv_id);
          const aspetto = ASPETTO[item.stato];
          const ispettore = ispettori.find((p) => p.id === item.ispettore_id);
          const bozza = item.stato === 'bozza';

          return (
            <Pressable
              onPress={() => !bozza && router.push(`/ispezione/${item.id}/esito`)}
              disabled={bozza}
              style={({ pressed }) => [
                { marginBottom: spazio.sm, opacity: pressed && !bozza ? 0.7 : 1 },
              ]}
            >
              <Card inCorso={occupato === item.id}>
                <View style={stili.voce}>
                  <View
                    style={[stili.sigla, { backgroundColor: c.superficieAlt, borderColor: c.bordo }]}
                  >
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
                    <Text style={[testo.piccolo, { color: c.testoSecondario }]} numberOfLines={1}>
                      {ispettore ? `${ispettore.cognome} ${ispettore.nome}` : 'Ispettore rimosso'}
                    </Text>
                  </View>
                  <Badge testo={aspetto.etichetta} tono={aspetto.tono} />
                </View>

                <View style={stili.azioni}>
                  {item.pdf_path ? (
                    <Button
                      titolo="Apri il PDF"
                      variante="testo"
                      compatto
                      onPress={() => apriPdf(item.pdf_path as string)}
                    />
                  ) : null}
                  {item.stato === 'conclusa' || item.stato === 'errore_invio' ? (
                    <Button
                      titolo="Riprova invio"
                      variante="testo"
                      compatto
                      disabilitato={occupato !== null}
                      onPress={() => riprova(item.id)}
                    />
                  ) : null}
                  {/* Una scheda già partita si rispedisce a mano: serve dopo aver
                      aggiunto un indirizzo destinatario che allora mancava. */}
                  {item.stato === 'inviata' ? (
                    <Button
                      titolo="Invia di nuovo"
                      variante="testo"
                      compatto
                      disabilitato={occupato !== null}
                      onPress={() => setDaRinviare(item.id)}
                    />
                  ) : null}
                  {bozza ? (
                    <Button
                      titolo="Elimina bozza"
                      variante="distruttivo"
                      compatto
                      disabilitato={occupato !== null}
                      onPress={() => setDaEliminare(item.id)}
                    />
                  ) : null}
                </View>

                {daEliminare === item.id ? (
                  <View style={{ marginTop: spazio.sm }}>
                    <ConfermaInLinea
                      messaggio={`Eliminare la bozza n. ${item.numero}? Le righe già inserite spariscono con lei.`}
                      onConferma={() => elimina(item.id)}
                      onAnnulla={() => setDaEliminare(null)}
                    />
                  </View>
                ) : null}

                {daRinviare === item.id ? (
                  <View style={{ marginTop: spazio.sm }}>
                    <ConfermaInLinea
                      messaggio={`La scheda n. ${item.numero} risulta già inviata. Spedirla di nuovo a tutti i destinatari previsti?`}
                      etichettaConferma="Invia di nuovo"
                      onConferma={() => riprova(item.id)}
                      onAnnulla={() => setDaRinviare(null)}
                    />
                  </View>
                ) : null}
              </Card>
            </Pressable>
          );
        }}
      />
    </Schermata>
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
  colonna: { flexDirection: 'column', alignItems: 'stretch' },
  azzera: { minHeight: TOCCO_MIN, justifyContent: 'center', alignSelf: 'flex-start' },
  elenco: { padding: spazio.lg, paddingBottom: spazio.xxxl },
  voce: { flexDirection: 'row', alignItems: 'center', gap: spazio.md },
  sigla: {
    width: 50,
    height: 50,
    borderRadius: raggio.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dati: { flex: 1, gap: 2 },
  azioni: { flexDirection: 'row', flexWrap: 'wrap', gap: spazio.sm, marginTop: spazio.sm },
});
