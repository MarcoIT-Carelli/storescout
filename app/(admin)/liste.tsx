import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/Badge';
import { BannerStato, INATTIVO, type StatoOperazione } from '@/components/BannerStato';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfermaInLinea } from '@/components/ConfermaInLinea';
import { Schermata } from '@/components/Schermata';
import { TextField } from '@/components/TextField';
import { useListe } from '@/hooks/useListe';
import { messaggioErrore } from '@/lib/errori';
import {
  aggiornaVoce,
  creaVoce,
  emailPlausibile,
  ETICHETTE,
  leggiVoci,
  salvaOrdine,
  scambia,
  type Tabella,
  type Voce,
} from '@/lib/liste';
import { raggio, spazio, testo, TOCCO_MIN, useColori } from '@/theme';

const TABELLE: Tabella[] = ['destinatari', 'reparti', 'tipi_intervento'];

export default function ListeValori() {
  const c = useColori();
  const { aggiorna: aggiornaCacheListe } = useListe();

  const [tabella, setTabella] = useState<Tabella>('destinatari');
  const [voci, setVoci] = useState<Voce[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [stato, setStato] = useState<StatoOperazione>(INATTIVO);

  const [inModifica, setInModifica] = useState<string | null>(null);
  const [nuova, setNuova] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [confermaDisattiva, setConfermaDisattiva] = useState<string | null>(null);

  const conEmail = ETICHETTE[tabella].conEmail;

  const carica = useCallback(async () => {
    setCaricamento(true);
    try {
      setVoci(await leggiVoci(tabella));
      setStato(INATTIVO);
    } catch (e) {
      setStato({ tipo: 'fallito', messaggio: messaggioErrore(e) });
    } finally {
      setCaricamento(false);
    }
  }, [tabella]);

  useEffect(() => {
    void carica();
  }, [carica]);

  const chiudiForm = () => {
    setInModifica(null);
    setNuova(false);
    setNome('');
    setEmail('');
  };

  const apriModifica = (v: Voce) => {
    setNuova(false);
    setInModifica(v.id);
    setNome(v.nome);
    setEmail(v.email ?? '');
  };

  const emailNonValida = conEmail && email.trim().length > 0 && !emailPlausibile(email);
  const puoSalvare = nome.trim().length > 0 && !emailNonValida;

  const salva = async () => {
    setStato({ tipo: 'inCorso', messaggio: 'Salvataggio…' });
    try {
      if (nuova) {
        await creaVoce(tabella, nome, conEmail ? email : null, voci.length + 1);
      } else if (inModifica) {
        await aggiornaVoce(tabella, inModifica, { nome, email: conEmail ? email : undefined });
      }
      chiudiForm();
      await carica();
      await aggiornaCacheListe();
      setStato({ tipo: 'riuscito', messaggio: 'Elenco aggiornato. I tablet lo vedranno al prossimo avvio.' });
    } catch (e) {
      setStato({ tipo: 'fallito', messaggio: messaggioErrore(e) });
    }
  };

  const cambiaAttivo = async (v: Voce, attivo: boolean) => {
    setConfermaDisattiva(null);
    setStato({ tipo: 'inCorso', messaggio: attivo ? 'Riattivazione…' : 'Disattivazione…' });
    try {
      await aggiornaVoce(tabella, v.id, { attivo });
      await carica();
      await aggiornaCacheListe();
      setStato({
        tipo: 'riuscito',
        messaggio: attivo ? `"${v.nome}" è di nuovo selezionabile.` : `"${v.nome}" non è più selezionabile.`,
      });
    } catch (e) {
      setStato({ tipo: 'fallito', messaggio: messaggioErrore(e) });
    }
  };

  const sposta = async (indice: number, direzione: -1 | 1) => {
    const nuovoElenco = scambia(voci, indice, direzione);
    if (nuovoElenco === voci) return;
    setVoci(nuovoElenco.map((v, i) => ({ ...v, ordine: i + 1 })));
    try {
      setVoci(await salvaOrdine(tabella, nuovoElenco));
      await aggiornaCacheListe();
    } catch (e) {
      setStato({ tipo: 'fallito', messaggio: messaggioErrore(e) });
      await carica();
    }
  };

  const senzaEmail = conEmail && voci.filter((v) => v.attivo && !v.email).length;

  return (
    <Schermata titolo="Liste valori" sottotitolo="Modificabili senza rilasciare una nuova app" indietro>
      <View style={[stili.schede, { backgroundColor: c.superficie, borderBottomColor: c.bordo }]}>
        {TABELLE.map((t) => {
          const attiva = t === tabella;
          return (
            <Pressable
              key={t}
              onPress={() => {
                chiudiForm();
                setTabella(t);
              }}
              style={({ pressed }) => [
                stili.scheda,
                {
                  backgroundColor: attiva ? c.nero : pressed ? c.superficieAlt : 'transparent',
                  borderColor: attiva ? c.nero : c.bordo,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: attiva }}
            >
              <Text
                style={[
                  testo.piccolo,
                  { color: attiva ? '#FFFFFF' : c.testo, fontWeight: attiva ? '700' : '400' },
                ]}
              >
                {ETICHETTE[t].titolo}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={stili.corpo} keyboardShouldPersistTaps="handled">
        <BannerStato stato={stato} onRiprova={carica} onChiudi={() => setStato(INATTIVO)} />

        {senzaEmail ? (
          <View style={[stili.avviso, { backgroundColor: c.attenzioneSfondo, borderColor: c.attenzione }]}>
            <Text style={[testo.piccolo, { color: c.testo }]}>
              {senzaEmail === 1
                ? 'Un destinatario attivo non ha ancora un indirizzo email: le sue attività non verranno inoltrate.'
                : `${senzaEmail} destinatari attivi non hanno ancora un indirizzo email: le loro attività non verranno inoltrate.`}
            </Text>
          </View>
        ) : null}

        {caricamento ? (
          <ActivityIndicator color={c.testoSecondario} style={{ marginTop: spazio.xl }} />
        ) : (
          voci.map((v, i) => {
            const inEdit = inModifica === v.id;
            return (
              <Card key={v.id} style={{ opacity: v.attivo ? 1 : 0.6 }}>
                {inEdit ? (
                  <View style={{ gap: spazio.md }}>
                    <TextField etichetta="Nome" value={nome} onChangeText={setNome} autoCapitalize="characters" />
                    {conEmail ? (
                      <TextField
                        etichetta="Email"
                        value={email}
                        onChangeText={setEmail}
                        placeholder="indirizzo@carellidistribuzione.it"
                        autoCapitalize="none"
                        keyboardType="email-address"
                        errore={emailNonValida ? 'Indirizzo non valido.' : undefined}
                        aiuto="Lascia vuoto se il destinatario non deve ricevere email."
                      />
                    ) : null}
                    <View style={stili.azioni}>
                      <Button titolo="Annulla" variante="secondario" compatto onPress={chiudiForm} />
                      <Button
                        titolo="Salva"
                        compatto
                        onPress={salva}
                        disabilitato={!puoSalvare}
                        inCorso={stato.tipo === 'inCorso'}
                      />
                    </View>
                  </View>
                ) : (
                  <>
                    <View style={stili.riga}>
                      <View style={stili.frecce}>
                        <Freccia verso="su" attiva={i > 0} onPress={() => sposta(i, -1)} />
                        <Freccia verso="giu" attiva={i < voci.length - 1} onPress={() => sposta(i, 1)} />
                      </View>

                      <View style={stili.dati}>
                        <Text style={[testo.corpoForte, { color: c.testo }]}>{v.nome}</Text>
                        {conEmail ? (
                          <Text
                            style={[
                              testo.piccolo,
                              { color: v.email ? c.testoSecondario : c.attenzione },
                            ]}
                          >
                            {v.email ?? 'indirizzo non impostato'}
                          </Text>
                        ) : null}
                      </View>

                      {!v.attivo ? <Badge testo="Disattivato" /> : null}

                      <Pressable
                        onPress={() => apriModifica(v)}
                        style={({ pressed }) => [stili.azione, pressed && { opacity: 0.5 }]}
                        accessibilityRole="button"
                      >
                        <Text style={[testo.corpoForte, { color: c.testo }]}>Modifica</Text>
                      </Pressable>

                      <Pressable
                        onPress={() => (v.attivo ? setConfermaDisattiva(v.id) : cambiaAttivo(v, true))}
                        style={({ pressed }) => [stili.azione, pressed && { opacity: 0.5 }]}
                        accessibilityRole="button"
                      >
                        <Text style={[testo.corpoForte, { color: v.attivo ? c.errore : c.successo }]}>
                          {v.attivo ? 'Disattiva' : 'Riattiva'}
                        </Text>
                      </Pressable>
                    </View>

                    {confermaDisattiva === v.id ? (
                      <View style={{ marginTop: spazio.md }}>
                        <ConfermaInLinea
                          messaggio={`"${v.nome}" non sarà più selezionabile nelle nuove schede. Le ispezioni già archiviate restano invariate.`}
                          etichettaConferma="Disattiva"
                          onConferma={() => cambiaAttivo(v, false)}
                          onAnnulla={() => setConfermaDisattiva(null)}
                        />
                      </View>
                    ) : null}
                  </>
                )}
              </Card>
            );
          })
        )}

        {nuova ? (
          <Card inCorso>
            <View style={{ gap: spazio.md }}>
              <Text style={[testo.etichetta, { color: c.testoSecondario }]}>
                NUOVO {ETICHETTE[tabella].singolare.toUpperCase()}
              </Text>
              <TextField etichetta="Nome" value={nome} onChangeText={setNome} autoCapitalize="characters" />
              {conEmail ? (
                <TextField
                  etichetta="Email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="indirizzo@carellidistribuzione.it"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  errore={emailNonValida ? 'Indirizzo non valido.' : undefined}
                />
              ) : null}
              <View style={stili.azioni}>
                <Button titolo="Annulla" variante="secondario" compatto onPress={chiudiForm} />
                <Button
                  titolo="Aggiungi"
                  compatto
                  onPress={salva}
                  disabilitato={!puoSalvare}
                  inCorso={stato.tipo === 'inCorso'}
                />
              </View>
            </View>
          </Card>
        ) : (
          <Button
            titolo={`+  Aggiungi ${ETICHETTE[tabella].singolare}`}
            variante="secondario"
            larghezzaPiena
            onPress={() => {
              chiudiForm();
              setNuova(true);
            }}
          />
        )}
      </ScrollView>
    </Schermata>
  );
}

function Freccia({ verso, attiva, onPress }: { verso: 'su' | 'giu'; attiva: boolean; onPress: () => void }) {
  const c = useColori();
  return (
    <Pressable
      onPress={onPress}
      disabled={!attiva}
      hitSlop={6}
      style={({ pressed }) => [stili.freccia, { opacity: attiva ? (pressed ? 0.5 : 1) : 0.25 }]}
      accessibilityRole="button"
      accessibilityLabel={verso === 'su' ? 'Sposta in su' : 'Sposta in giù'}
    >
      <Text style={{ color: c.testo, fontSize: 15 }}>{verso === 'su' ? '▲' : '▼'}</Text>
    </Pressable>
  );
}

const stili = StyleSheet.create({
  schede: {
    flexDirection: 'row',
    gap: spazio.sm,
    padding: spazio.lg,
    borderBottomWidth: 1,
    flexWrap: 'wrap',
  },
  scheda: {
    minHeight: TOCCO_MIN,
    paddingHorizontal: spazio.lg,
    borderRadius: raggio.pill,
    borderWidth: 1,
    justifyContent: 'center',
  },
  corpo: { padding: spazio.lg, gap: spazio.md, paddingBottom: spazio.xxxl },
  avviso: { borderWidth: 1, borderRadius: raggio.md, padding: spazio.md },
  riga: { flexDirection: 'row', alignItems: 'center', gap: spazio.md, flexWrap: 'wrap' },
  frecce: { gap: 2 },
  freccia: { width: 30, height: 24, alignItems: 'center', justifyContent: 'center' },
  dati: { flex: 1, gap: 2, minWidth: 160 },
  azione: { minHeight: TOCCO_MIN, justifyContent: 'center', paddingHorizontal: spazio.sm },
  azioni: { flexDirection: 'row', gap: spazio.sm, justifyContent: 'flex-end' },
});
