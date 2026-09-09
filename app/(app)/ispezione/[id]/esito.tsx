import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';

import { Badge, type Tono } from '@/components/Badge';
import { BannerStato, INATTIVO, type StatoOperazione } from '@/components/BannerStato';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Schermata } from '@/components/Schermata';
import { GIUDIZIO, type Voto } from '@/components/SelettoreVoto';
import { useListe } from '@/hooks/useListe';
import { messaggioErrore } from '@/lib/errori';
import { dataBreve, daDataISO, durata, ora } from '@/lib/format';
import {
  caricaDettaglio,
  inviaScheda,
  urlPdf,
  type Dettaglio,
  type FotoArchiviata,
} from '@/lib/ispezioni';
import { urlFoto } from '@/lib/foto';
import { chiudiVerifica } from '@/lib/verifiche';
import type { StatoIspezione } from '@/types/database';
import { raggio, SOGLIA_LARGA, spazio, testo, useColori } from '@/theme';

const ASPETTO: Record<StatoIspezione, { etichetta: string; tono: Tono; spiegazione: string }> = {
  bozza: {
    etichetta: 'Bozza',
    tono: 'corso',
    spiegazione: 'La scheda non è ancora stata conclusa.',
  },
  conclusa: {
    etichetta: 'Da inviare',
    tono: 'attenzione',
    spiegazione: 'Scheda salvata e archiviata in PDF, ma non ancora spedita. Puoi inviarla adesso.',
  },
  inviata: {
    etichetta: 'Inviata',
    tono: 'successo',
    spiegazione: 'La scheda è stata inviata a tutti i destinatari previsti.',
  },
  errore_invio: {
    etichetta: 'Invio non riuscito',
    tono: 'errore',
    spiegazione:
      'La scheda è salvata e il PDF archiviato: l’invio può essere ripetuto senza ricompilare nulla.',
  },
};

/**
 * Scheda conclusa in sola lettura. È la stessa schermata che compare subito dopo l'invio
 * e quella che si apre dallo storico: una scheda firmata non si modifica più, quindi non
 * serve una seconda vista.
 */
export default function Esito() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColori();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const stretto = width < SOGLIA_LARGA;
  const { pdvPerId } = useListe();

  const [dettaglio, setDettaglio] = useState<Dettaglio | null>(null);
  const [caricamento, setCaricamento] = useState(true);
  const [stato, setStato] = useState<StatoOperazione>(INATTIVO);

  const carica = useCallback(async (silenzioso = false) => {
    if (!id) return;
    if (!silenzioso) setCaricamento(true);
    try {
      setDettaglio(await caricaDettaglio(id));
      if (!silenzioso) setStato(INATTIVO);
    } catch (e) {
      setStato({ tipo: 'fallito', messaggio: messaggioErrore(e) });
    } finally {
      if (!silenzioso) setCaricamento(false);
    }
  }, [id]);

  useEffect(() => {
    void carica();
  }, [carica]);

  const riprova = async () => {
    if (!id) return;
    setStato({ tipo: 'inCorso', messaggio: 'Invio della scheda…' });
    const esito = await inviaScheda(id);
    // Prima si rinfrescano i dati, poi si mostra l'esito: nell'ordine inverso il
    // ricaricamento cancellerebbe il messaggio appena scritto.
    await carica(true);
    setStato(
      esito.inviata
        ? { tipo: 'riuscito', messaggio: esito.messaggio }
        : { tipo: 'fallito', messaggio: esito.messaggio },
    );
  };

  const chiudi = async () => {
    if (!id) return;
    setStato({ tipo: 'inCorso', messaggio: 'Chiusura della verifica…' });
    try {
      const chiusa = await chiudiVerifica(id);
      await carica(true);
      setStato(
        chiusa
          ? { tipo: 'riuscito', messaggio: 'Verifica chiusa: la scheda esce dalle cose da fare.' }
          : {
              tipo: 'fallito',
              messaggio: 'La verifica risulta già chiusa, forse da un altro dispositivo.',
            },
      );
    } catch (e) {
      setStato({ tipo: 'fallito', messaggio: messaggioErrore(e) });
    }
  };

  const apriPdf = async () => {
    const percorso = dettaglio?.ispezione.pdf_path;
    if (!percorso) return;
    setStato({ tipo: 'inCorso', messaggio: 'Apertura del PDF…' });
    try {
      await Linking.openURL(await urlPdf(percorso));
      setStato(INATTIVO);
    } catch (e) {
      setStato({ tipo: 'fallito', messaggio: messaggioErrore(e) });
    }
  };

  if (caricamento) {
    return (
      <Schermata titolo="Scheda" indietro onIndietro={() => router.replace('/')}>
        <View style={stili.attesa}>
          <ActivityIndicator color={c.testoSecondario} />
        </View>
      </Schermata>
    );
  }

  if (!dettaglio) {
    return (
      <Schermata titolo="Scheda" indietro onIndietro={() => router.replace('/')}>
        <View style={stili.attesa}>
          <BannerStato stato={stato} onRiprova={carica} />
          <Button titolo="Torna alla home" variante="secondario" onPress={() => router.replace('/')} />
        </View>
      </Schermata>
    );
  }

  const { ispezione: i, attivita, svolte, foto } = dettaglio;
  const pdv = pdvPerId(i.pdv_id);
  const aspetto = ASPETTO[i.stato];
  const ingresso = new Date(i.ora_ingresso);
  const uscita = i.ora_uscita ? new Date(i.ora_uscita) : null;

  return (
    <Schermata
      titolo={`Ispezione n. ${i.numero}`}
      sottotitolo={pdv ? `${pdv.codice} — ${pdv.citta}` : undefined}
      indietro
      onIndietro={() => router.back()}
    >
      <ScrollView contentContainerStyle={stili.corpo}>
        <Card>
          <View style={stili.intestazione}>
            <Badge testo={aspetto.etichetta} tono={aspetto.tono} />
            <Text style={[testo.piccolo, { color: c.testoSecondario }]}>
              {dataBreve(daDataISO(i.data_ispezione))}
            </Text>
          </View>
          <Text style={[testo.piccolo, { color: c.testoSecondario, marginTop: spazio.sm }]}>
            {aspetto.spiegazione}
          </Text>
        </Card>

        {i.in_verifica ? (
          <Card inCorso>
            <Text style={[testo.etichetta, { color: c.testoSecondario }]}>DA CHIUDERE</Text>
            <Text style={[testo.corpo, { color: c.testo, marginTop: spazio.sm }]}>
              Questa scheda ha attività che restano da verificare. Quando sei tornato in negozio
              e hai controllato che l’intervento sia stato fatto, chiudila: sparisce dalle cose
              da fare in prima pagina.
            </Text>
            <Button
              titolo="Chiudi la verifica"
              larghezzaPiena
              onPress={chiudi}
              inCorso={stato.tipo === 'inCorso'}
              style={{ marginTop: spazio.md }}
            />
          </Card>
        ) : null}

        <Card>
          <Text style={[testo.etichetta, { color: c.testoSecondario, marginBottom: spazio.sm }]}>
            RIEPILOGO
          </Text>
          <Voce
            etichetta="Punto vendita"
            valore={pdv ? `${pdv.codice} — ${pdv.citta}, ${pdv.indirizzo}` : '—'}
          />
          <Voce etichetta="Ingresso" valore={ora(ingresso)} />
          <Voce etichetta="Uscita" valore={uscita ? ora(uscita) : '—'} />
          <Voce etichetta="Durata" valore={uscita ? durata(ingresso, uscita) : '—'} />
          {i.voto !== null ? (
            <Voce
              etichetta="Voto della visita"
              valore={`${i.voto} / 5 — ${GIUDIZIO[i.voto as Voto] ?? ''}`.trim()}
            />
          ) : null}
          {i.rotture_stock_promo !== null ? (
            <Voce etichetta="Rotture stock promo" valore={String(i.rotture_stock_promo)} />
          ) : null}
          {i.nome_responsabile ? <Voce etichetta="Firmato da" valore={i.nome_responsabile} /> : null}
          {i.motivo_assenza_firma ? (
            <Voce etichetta="Assenza firma" valore={i.motivo_assenza_firma} />
          ) : null}
        </Card>

        <View style={{ gap: spazio.md }}>
          <Text style={[testo.sezione, { color: c.testo }]}>Attività rilevate</Text>

          {i.niente_da_rilevare ? (
            <View style={[stili.niente, { borderColor: c.bordo, backgroundColor: c.superficieAlt }]}>
              <Text style={[testo.corpoForte, { color: c.testo, letterSpacing: 1 }]}>
                NIENTE DA RILEVARE
              </Text>
            </View>
          ) : attivita.length === 0 ? (
            <Card>
              <Text style={[testo.corpo, { color: c.testoSecondario }]}>
                Nessuna attività registrata su questa scheda.
              </Text>
            </Card>
          ) : (
            attivita.map((a) => (
              <Card key={a.id}>
                <View style={[stili.tendine, stretto && { flexDirection: 'column' }]}>
                  <Voce contenitore={stretto ? undefined : { flex: 1, minWidth: 140 }} etichetta="Destinatario" valore={a.destinatari?.nome ?? '—'} compatta />
                  <Voce contenitore={stretto ? undefined : { flex: 1, minWidth: 140 }} etichetta="Reparto" valore={a.reparti?.nome ?? '—'} compatta />
                  <Voce contenitore={stretto ? undefined : { flex: 1, minWidth: 140 }} etichetta="Tipo di intervento" valore={a.tipi_intervento?.nome ?? '—'} compatta />
                </View>
                {a.note ? (
                  <Text style={[testo.corpo, { color: c.testo, marginTop: spazio.md }]}>{a.note}</Text>
                ) : null}
                <Text style={[testo.piccolo, { color: c.testoSecondario, marginTop: spazio.sm }]}>
                  Scadenza:{' '}
                  {a.scadenza_data ? dataBreve(daDataISO(a.scadenza_data)) : a.scadenza_testo ?? '—'}
                  {a.scadenza_note ? ` (${a.scadenza_note})` : ''}
                </Text>
                <FotoDellaRiga tutte={foto} attivitaId={a.id} />
              </Card>
            ))
          )}
        </View>

        {svolte.length > 0 ? (
          <View style={{ gap: spazio.md }}>
            <Text style={[testo.sezione, { color: c.testo }]}>Ho svolto le seguenti attività</Text>
            <Card>
              {svolte.map((s) => (
                <View key={s.ordine} style={stili.rigaSvolta}>
                  <Text style={[testo.corpo, { color: c.testoSecondario, width: 22 }]}>
                    {s.ordine + 1}.
                  </Text>
                  <Text style={[testo.corpo, { color: c.testo, flex: 1 }]}>{s.descrizione}</Text>
                </View>
              ))}
            </Card>
          </View>
        ) : null}

        <BannerStato stato={stato} onChiudi={() => setStato(INATTIVO)} />

        {i.pdf_path && (i.stato === 'conclusa' || i.stato === 'errore_invio') ? (
          <Button
            titolo={i.stato === 'errore_invio' ? 'Riprova invio' : 'Invia la scheda'}
            larghezzaPiena
            onPress={riprova}
            inCorso={stato.tipo === 'inCorso'}
          />
        ) : null}

        {i.pdf_path ? (
          <Button titolo="Apri il PDF della scheda" variante="secondario" larghezzaPiena onPress={apriPdf} />
        ) : null}

        <Button titolo="Nuova ispezione" larghezzaPiena onPress={() => router.replace('/pdv')} />
        <Button titolo="Torna alla home" variante="testo" larghezzaPiena onPress={() => router.replace('/')} />
      </ScrollView>
    </Schermata>
  );
}

/**
 * Le foto di una rilevazione, in miniatura.
 *
 * Lo Storage è privato, quindi ogni miniatura ha bisogno di un link firmato che dura
 * pochi minuti: si chiedono all'apertura della scheda e si aprono a schermo intero nel
 * browser di sistema, che sa già ingrandire e ruotare.
 */
function FotoDellaRiga({ tutte, attivitaId }: { tutte: FotoArchiviata[]; attivitaId: string }) {
  const c = useColori();
  const [url, setUrl] = useState<Record<string, string>>({});

  // Il filtro sta qui dentro e passa da useMemo: calcolato nel corpo del genitore
  // produrrebbe un array nuovo a ogni render, e l'effetto qui sotto — che ha proprio
  // quell'array fra le dipendenze — ripartirebbe all'infinito, chiedendo link firmati
  // senza mai fermarsi.
  const percorsi = useMemo(
    () => tutte.filter((f) => f.attivita_id === attivitaId),
    [tutte, attivitaId],
  );

  useEffect(() => {
    let vivo = true;
    Promise.all(
      percorsi.map(async (f) => [f.path, await urlFoto(f.path)] as const),
    )
      .then((coppie) => vivo && setUrl(Object.fromEntries(coppie)))
      .catch(() => {
        // Una miniatura che non si carica non deve rovinare la lettura della scheda.
      });
    return () => {
      vivo = false;
    };
  }, [percorsi]);

  if (percorsi.length === 0) return null;

  return (
    <View style={stili.foto}>
      {percorsi.map((f) => (
        <Pressable
          key={f.path}
          onPress={() => url[f.path] && Linking.openURL(url[f.path])}
          accessibilityRole="button"
          accessibilityLabel={`Apri la foto ${f.ordine + 1}`}
          style={({ pressed }) => [
            stili.miniatura,
            { borderColor: c.bordo, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          {url[f.path] ? (
            <Image source={{ uri: url[f.path] }} style={stili.immagine} resizeMode="cover" />
          ) : (
            <ActivityIndicator color={c.testoSecondario} />
          )}
        </Pressable>
      ))}
    </View>
  );
}

function Voce({
  etichetta,
  valore,
  compatta = false,
  contenitore,
}: {
  etichetta: string;
  valore: string;
  compatta?: boolean;
  /** Vedi `Select`: affiancate si dividono la larghezza, incolonnate il flex le schiaccia. */
  contenitore?: ViewStyle;
}) {
  const c = useColori();
  if (compatta) {
    return (
      <View style={[{ gap: 2 }, contenitore]}>
        <Text style={[testo.etichetta, { color: c.testoSecondario }]}>{etichetta.toUpperCase()}</Text>
        <Text style={[testo.corpoForte, { color: c.testo }]}>{valore}</Text>
      </View>
    );
  }
  return (
    <View style={stili.voce}>
      <Text style={[testo.piccolo, { color: c.testoSecondario, width: 130 }]}>{etichetta}</Text>
      <Text style={[testo.corpo, { color: c.testo, flex: 1 }]}>{valore}</Text>
    </View>
  );
}

const stili = StyleSheet.create({
  attesa: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spazio.lg, padding: spazio.xl },
  corpo: { padding: spazio.lg, gap: spazio.lg, paddingBottom: spazio.xxl },
  intestazione: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  voce: { flexDirection: 'row', alignItems: 'flex-start', gap: spazio.md, paddingVertical: 4 },
  tendine: { flexDirection: 'row', gap: spazio.lg },
  rigaSvolta: { flexDirection: 'row', alignItems: 'flex-start', gap: spazio.sm, paddingVertical: 3 },
  foto: { flexDirection: 'row', flexWrap: 'wrap', gap: spazio.sm, marginTop: spazio.md },
  miniatura: {
    width: 88,
    height: 88,
    borderRadius: raggio.md,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  immagine: { width: '100%', height: '100%' },
  niente: {
    borderWidth: 1,
    borderRadius: raggio.md,
    paddingVertical: spazio.xl,
    alignItems: 'center',
  },
});
