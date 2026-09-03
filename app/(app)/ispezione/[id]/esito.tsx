import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { Badge, type Tono } from '@/components/Badge';
import { BannerStato, INATTIVO, type StatoOperazione } from '@/components/BannerStato';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Schermata } from '@/components/Schermata';
import { useListe } from '@/hooks/useListe';
import { messaggioErrore } from '@/lib/errori';
import { dataBreve, daDataISO, durata, ora } from '@/lib/format';
import { caricaDettaglio, urlPdf, type Dettaglio } from '@/lib/ispezioni';
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
    spiegazione:
      'Scheda salvata e archiviata in PDF. L’invio automatico via email si attiverà quando saranno disponibili le credenziali SMTP e gli indirizzi dei destinatari.',
  },
  inviata: {
    etichetta: 'Inviata',
    tono: 'successo',
    spiegazione: 'La scheda è stata inviata a tutti i destinatari previsti.',
  },
  errore_invio: {
    etichetta: 'Invio non riuscito',
    tono: 'errore',
    spiegazione: 'La scheda è salvata: l’invio può essere ripetuto senza ricompilare nulla.',
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

  const carica = useCallback(async () => {
    if (!id) return;
    setCaricamento(true);
    try {
      setDettaglio(await caricaDettaglio(id));
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

  const { ispezione: i, attivita, svolte } = dettaglio;
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
              <Card key={a.ordine}>
                <View style={[stili.tendine, stretto && { flexDirection: 'column' }]}>
                  <Voce etichetta="Destinatario" valore={a.destinatari?.nome ?? '—'} compatta />
                  <Voce etichetta="Reparto" valore={a.reparti?.nome ?? '—'} compatta />
                  <Voce etichetta="Tipo di intervento" valore={a.tipi_intervento?.nome ?? '—'} compatta />
                </View>
                {a.note ? (
                  <Text style={[testo.corpo, { color: c.testo, marginTop: spazio.md }]}>{a.note}</Text>
                ) : null}
                <Text style={[testo.piccolo, { color: c.testoSecondario, marginTop: spazio.sm }]}>
                  Scadenza:{' '}
                  {a.scadenza_data ? dataBreve(daDataISO(a.scadenza_data)) : a.scadenza_testo ?? '—'}
                  {a.scadenza_note ? ` (${a.scadenza_note})` : ''}
                </Text>
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

        {i.pdf_path ? (
          <Button titolo="Apri il PDF della scheda" variante="secondario" larghezzaPiena onPress={apriPdf} />
        ) : null}

        <Button titolo="Nuova ispezione" larghezzaPiena onPress={() => router.replace('/pdv')} />
        <Button titolo="Torna alla home" variante="testo" larghezzaPiena onPress={() => router.replace('/')} />
      </ScrollView>
    </Schermata>
  );
}

function Voce({
  etichetta,
  valore,
  compatta = false,
}: {
  etichetta: string;
  valore: string;
  compatta?: boolean;
}) {
  const c = useColori();
  if (compatta) {
    return (
      <View style={{ flex: 1, gap: 2, minWidth: 140 }}>
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
  niente: {
    borderWidth: 1,
    borderRadius: raggio.md,
    paddingVertical: spazio.xl,
    alignItems: 'center',
  },
});
