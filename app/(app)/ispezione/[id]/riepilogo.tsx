import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/Badge';
import { BannerStato, INATTIVO, type StatoOperazione } from '@/components/BannerStato';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Schermata } from '@/components/Schermata';
import { SelettoreVoto } from '@/components/SelettoreVoto';
import { useAuth } from '@/hooks/useAuth';
import { useBozza } from '@/hooks/useBozza';
import { useListe } from '@/hooks/useListe';
import { messaggioErrore } from '@/lib/errori';
import { dataEstesa, durata, ora } from '@/lib/format';
import { concludiIspezione } from '@/lib/ispezioni';
import { validaBozza } from '@/lib/validazione';
import { rigaCompilata } from '@/types/bozza';
import { raggio, spazio, testo, TOCCO_MIN, useColori } from '@/theme';

/** Destinatari fissi in copia, da §8.1 della specifica. */
const COPIA_FISSA = ['contact2@carellidistribuzione.it', 'a.andriani@carellidistribuzione.it'];

export default function Riepilogo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColori();
  const router = useRouter();
  const { profilo } = useAuth();
  const { liste, pdvPerId } = useListe();
  const { bozza, caricamento, modifica, salvaSubito, scarta } = useBozza(id);

  const [stato, setStato] = useState<StatoOperazione>(INATTIVO);
  const [inCorso, setInCorso] = useState(false);

  /**
   * L'uscita è l'istante in cui si conclude, non quello in cui compare questo riepilogo:
   * fra i due passa il tempo di far firmare, e con gli orari non più correggibili a mano
   * fissarla qui vorrebbe dire archiviare un orario sbagliato senza rimedio. Qui si mostra
   * soltanto l'ora corrente, riallineata ogni mezzo minuto perché il numero a schermo sia
   * quello che verrà davvero salvato.
   */
  const [adesso, setAdesso] = useState(() => new Date());
  useEffect(() => {
    const battito = setInterval(() => setAdesso(new Date()), 30_000);
    return () => clearInterval(battito);
  }, []);

  const problemi = useMemo(() => (bozza ? validaBozza(bozza) : []), [bozza]);

  const destinatariEmail = useMemo(() => {
    if (!bozza) return [] as { nome: string; email: string | null }[];
    const usati = new Set(
      bozza.attivita.filter(rigaCompilata).map((r) => r.destinatario_id).filter(Boolean) as string[],
    );
    return liste.destinatari
      .filter((d) => usati.has(d.id))
      .map((d) => ({ nome: d.nome, email: d.email }));
  }, [bozza, liste.destinatari]);

  const senzaIndirizzo = destinatariEmail.filter((d) => !d.email).length;

  if (caricamento || !bozza) {
    return (
      <Schermata titolo="Riepilogo" indietro>
        <View style={stili.attesa}>
          {caricamento ? (
            <ActivityIndicator color={c.testoSecondario} />
          ) : (
            <Text style={[testo.corpo, { color: c.testoSecondario }]}>Bozza non trovata.</Text>
          )}
        </View>
      </Schermata>
    );
  }

  const pdv = pdvPerId(bozza.pdv_id);
  const ingresso = new Date(bozza.ora_ingresso);
  const uscita = bozza.ora_uscita ? new Date(bozza.ora_uscita) : adesso;

  const concludi = async () => {
    if (!pdv || !profilo) return;
    setInCorso(true);
    await salvaSubito();
    // L'orario di uscita nasce qui, non quando la schermata si è aperta.
    const daConcludere = { ...bozza, ora_uscita: new Date().toISOString() };
    try {
      await concludiIspezione(
        daConcludere,
        pdv,
        profilo,
        {
          destinatari: liste.destinatari,
          reparti: liste.reparti,
          tipiIntervento: liste.tipiIntervento,
        },
        (a) => setStato({ tipo: 'inCorso', messaggio: a.messaggio }),
      );
      // La bozza locale si elimina solo ora, a salvataggio remoto confermato.
      await scarta();
      router.replace(`/ispezione/${bozza.id}/esito`);
    } catch (e) {
      setStato({ tipo: 'fallito', messaggio: messaggioErrore(e) });
    } finally {
      setInCorso(false);
    }
  };

  return (
    <Schermata titolo="Conferma e conclusione" sottotitolo={pdv ? `${pdv.codice} — ${pdv.citta}` : undefined} indietro>
      <ScrollView contentContainerStyle={stili.corpo}>
        <Card>
          <Text style={[testo.etichetta, { color: c.testoSecondario, marginBottom: spazio.md }]}>
            ORARI DELLA VISITA · {dataEstesa(ingresso).toUpperCase()}
          </Text>
          <View style={stili.orari}>
            <Orario etichetta="Ingresso" valore={ora(ingresso)} />
            <Orario etichetta="Uscita" valore={ora(uscita)} />
            <View style={stili.durata}>
              <Text style={[testo.etichetta, { color: c.testoSecondario }]}>DURATA</Text>
              <Text style={[testo.sezione, { color: c.testo }]}>{durata(ingresso, uscita)}</Text>
            </View>
          </View>
        </Card>

        <Card>
          <Text style={[testo.etichetta, { color: c.testoSecondario, marginBottom: spazio.sm }]}>CONTENUTO</Text>
          {bozza.niente_da_rilevare ? (
            <Text style={[testo.corpoForte, { color: c.testo }]}>Niente da rilevare</Text>
          ) : (
            <Text style={[testo.corpo, { color: c.testo }]}>
              {bozza.attivita.filter(rigaCompilata).length} attività rilevate
            </Text>
          )}
          {bozza.ha_svolto_attivita ? (
            <Text style={[testo.corpo, { color: c.testo }]}>
              {bozza.svolte.filter((s) => s.descrizione.trim()).length} attività svolte dall’ispettore
            </Text>
          ) : null}
          {bozza.rotture_stock_promo !== null ? (
            <Text style={[testo.corpo, { color: c.testo }]}>
              {bozza.rotture_stock_promo === 1
                ? '1 rottura di stock promo sala'
                : `${bozza.rotture_stock_promo} rotture di stock promo sala`}
            </Text>
          ) : null}
          <View style={stili.firmeStato}>
            <Badge
              testo={bozza.firma_ispettore_uri ? 'Firma ispettore ✓' : 'Firma ispettore mancante'}
              tono={bozza.firma_ispettore_uri ? 'successo' : 'errore'}
            />
            <Badge
              testo={
                bozza.firma_responsabile_uri
                  ? 'Firma responsabile ✓'
                  : bozza.motivo_assenza_firma.trim()
                    ? 'Assenza motivata'
                    : 'Firma responsabile mancante'
              }
              tono={
                bozza.firma_responsabile_uri
                  ? 'successo'
                  : bozza.motivo_assenza_firma.trim()
                    ? 'attenzione'
                    : 'errore'
              }
            />
          </View>
        </Card>

        <Card>
          <Text style={[testo.etichetta, { color: c.testoSecondario, marginBottom: spazio.md }]}>
            VOTO ISPEZIONE
          </Text>
          <SelettoreVoto
            valore={bozza.voto}
            onChange={(voto) => modifica((b) => ({ ...b, voto }))}
          />
        </Card>

        <Card>
          <Text style={[testo.etichetta, { color: c.testoSecondario, marginBottom: spazio.sm }]}>
            DESTINATARI DELLA SCHEDA
          </Text>
          <Riga etichetta="A" valore={pdv?.email ?? 'indirizzo del punto vendita non presente in anagrafica'} />
          {COPIA_FISSA.map((e) => (
            <Riga key={e} etichetta="Cc" valore={e} />
          ))}
          {profilo ? <Riga etichetta="Cc" valore={profilo.email} /> : null}
          {destinatariEmail.map((d) => (
            <Riga
              key={d.nome}
              etichetta="Cc"
              valore={d.email ?? `${d.nome} — indirizzo non ancora impostato`}
              mancante={!d.email}
            />
          ))}

          {senzaIndirizzo > 0 ? (
            <View style={[stili.nota, { backgroundColor: c.attenzioneSfondo, borderColor: c.attenzione }]}>
              <Text style={[testo.piccolo, { color: c.testo }]}>
                {senzaIndirizzo === 1
                  ? 'Un destinatario non ha un indirizzo impostato e non riceverà la scheda. Puoi aggiungerlo dal pannello di amministrazione.'
                  : `${senzaIndirizzo} destinatari non hanno un indirizzo impostato e non riceveranno la scheda. Puoi aggiungerli dal pannello di amministrazione.`}
              </Text>
            </View>
          ) : (
            <Text style={[testo.piccolo, { color: c.testoSecondario, marginTop: spazio.md }]}>
              Alla conferma la scheda viene spedita automaticamente, con il PDF in allegato.
              Se l’invio non riesce resta in elenco e si può ripetere: nulla va perso.
            </Text>
          )}
        </Card>

        {problemi.length > 0 ? (
          <View style={[stili.problemi, { backgroundColor: c.erroreSfondo, borderColor: c.errore }]}>
            <Text style={[testo.corpoForte, { color: c.testo }]}>
              Prima di concludere va sistemato quanto segue:
            </Text>
            {problemi.map((p, i) => (
              <Text key={i} style={[testo.piccolo, { color: c.testo }]}>
                • {p.messaggio}
              </Text>
            ))}
            <View style={stili.scorciatoie}>
              <Button
                titolo="Torna alla scheda"
                variante="secondario"
                compatto
                onPress={() => router.replace(`/ispezione/${bozza.id}`)}
              />
              <Button
                titolo="Vai alle firme"
                variante="secondario"
                compatto
                onPress={() => router.replace(`/ispezione/${bozza.id}/firme`)}
              />
            </View>
          </View>
        ) : null}

        <BannerStato stato={stato} onRiprova={concludi} onChiudi={() => setStato(INATTIVO)} />
      </ScrollView>

      <View style={[stili.barra, { backgroundColor: c.superficie, borderTopColor: c.bordo }]}>
        <Button titolo="Indietro" variante="secondario" onPress={() => router.back()} style={{ flex: 1 }} />
        <Button
          titolo="Concludi ispezione"
          onPress={concludi}
          disabilitato={problemi.length > 0}
          inCorso={inCorso}
          style={{ flex: 2 }}
        />
      </View>
    </Schermata>
  );
}

/** Gli orari li registra l'app: qui si leggono soltanto. */
function Orario({ etichetta, valore }: { etichetta: string; valore: string }) {
  const c = useColori();
  return (
    <View style={[stili.orario, { borderColor: c.bordo }]}>
      <Text style={[testo.etichetta, { color: c.testoSecondario }]}>{etichetta.toUpperCase()}</Text>
      <Text style={[testo.titolo, { color: c.testo }]}>{valore}</Text>
    </View>
  );
}

function Riga({ etichetta, valore, mancante = false }: { etichetta: string; valore: string; mancante?: boolean }) {
  const c = useColori();
  return (
    <View style={stili.rigaDestinatario}>
      <Text style={[testo.etichetta, { color: c.testoSecondario, width: 28 }]}>{etichetta}</Text>
      <Text style={[testo.piccolo, { color: mancante ? c.attenzione : c.testo, flex: 1 }]}>{valore}</Text>
    </View>
  );
}

const stili = StyleSheet.create({
  attesa: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  corpo: { padding: spazio.lg, gap: spazio.lg, paddingBottom: spazio.xxl },
  orari: { flexDirection: 'row', gap: spazio.md, flexWrap: 'wrap' },
  orario: {
    flex: 1,
    minWidth: 130,
    borderWidth: 1,
    borderRadius: raggio.md,
    padding: spazio.md,
    alignItems: 'center',
    minHeight: TOCCO_MIN + 24,
  },
  durata: { flex: 1, minWidth: 110, alignItems: 'center', justifyContent: 'center', gap: spazio.xs },
  firmeStato: { flexDirection: 'row', gap: spazio.sm, flexWrap: 'wrap', marginTop: spazio.md },
  rigaDestinatario: { flexDirection: 'row', alignItems: 'center', gap: spazio.sm, paddingVertical: 3 },
  nota: { marginTop: spazio.md, borderWidth: 1, borderRadius: raggio.md, padding: spazio.md },
  problemi: { borderWidth: 1, borderRadius: raggio.md, padding: spazio.lg, gap: spazio.sm },
  scorciatoie: { flexDirection: 'row', gap: spazio.sm, marginTop: spazio.sm, flexWrap: 'wrap' },
  barra: { flexDirection: 'row', gap: spazio.md, padding: spazio.lg, borderTopWidth: 1 },
});
