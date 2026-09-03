import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/Badge';
import { BannerStato, INATTIVO, type StatoOperazione } from '@/components/BannerStato';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfermaInLinea } from '@/components/ConfermaInLinea';
import { Schermata } from '@/components/Schermata';
import { Select } from '@/components/Select';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/hooks/useAuth';
import { messaggioErrore } from '@/lib/errori';
import {
  aggiornaIspettore,
  creaIspettore,
  leggiIspettori,
  LUNGHEZZA_MINIMA_PASSWORD,
  passwordCasuale,
  reimpostaPassword,
} from '@/lib/ispettori';
import type { Profilo, RuoloUtente } from '@/types/database';
import { raggio, spazio, testo, TOCCO_MIN, useColori } from '@/theme';

const RUOLI = [
  { id: 'ispettore', nome: 'Ispettore' },
  { id: 'admin', nome: 'Amministratore' },
];

type Modulo = { nome: string; cognome: string; email: string; ruolo: RuoloUtente; password: string };

const MODULO_VUOTO: Modulo = { nome: '', cognome: '', email: '', ruolo: 'ispettore', password: '' };

export default function Ispettori() {
  const c = useColori();
  const { profilo: io } = useAuth();

  const [ispettori, setIspettori] = useState<Profilo[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [stato, setStato] = useState<StatoOperazione>(INATTIVO);
  const [credenziali, setCredenziali] = useState<{ email: string; password: string } | null>(null);

  const [nuovo, setNuovo] = useState(false);
  const [modulo, setModulo] = useState<Modulo>(MODULO_VUOTO);
  const [inModifica, setInModifica] = useState<string | null>(null);
  const [inReset, setInReset] = useState<string | null>(null);
  const [confermaDisattiva, setConfermaDisattiva] = useState<string | null>(null);

  const carica = useCallback(async () => {
    setCaricamento(true);
    try {
      setIspettori(await leggiIspettori());
      setStato(INATTIVO);
    } catch (e) {
      setStato({ tipo: 'fallito', messaggio: messaggioErrore(e) });
    } finally {
      setCaricamento(false);
    }
  }, []);

  useEffect(() => {
    void carica();
  }, [carica]);

  const chiudi = () => {
    setNuovo(false);
    setInModifica(null);
    setInReset(null);
    setModulo(MODULO_VUOTO);
  };

  const emailValida = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(modulo.email.trim());
  const puoCreare =
    modulo.nome.trim() &&
    modulo.cognome.trim() &&
    emailValida &&
    modulo.password.length >= LUNGHEZZA_MINIMA_PASSWORD;

  const crea = async () => {
    setStato({ tipo: 'inCorso', messaggio: 'Creazione dell’account…' });
    try {
      await creaIspettore({
        nome: modulo.nome,
        cognome: modulo.cognome,
        email: modulo.email,
        ruolo: modulo.ruolo,
        password: modulo.password,
      });
      setCredenziali({ email: modulo.email.trim().toLowerCase(), password: modulo.password });
      chiudi();
      await carica();
      setStato(INATTIVO);
    } catch (e) {
      setStato({ tipo: 'fallito', messaggio: messaggioErrore(e) });
    }
  };

  const salvaModifica = async (p: Profilo) => {
    setStato({ tipo: 'inCorso', messaggio: 'Salvataggio…' });
    try {
      await aggiornaIspettore(p.id, {
        nome: modulo.nome.trim(),
        cognome: modulo.cognome.trim(),
        ruolo: modulo.ruolo,
      });
      chiudi();
      await carica();
      setStato({ tipo: 'riuscito', messaggio: 'Dati aggiornati.' });
    } catch (e) {
      setStato({ tipo: 'fallito', messaggio: messaggioErrore(e) });
    }
  };

  const reset = async (p: Profilo) => {
    setStato({ tipo: 'inCorso', messaggio: 'Reimpostazione della password…' });
    try {
      await reimpostaPassword(p.id, modulo.password);
      setCredenziali({ email: p.email, password: modulo.password });
      chiudi();
      await carica();
      setStato(INATTIVO);
    } catch (e) {
      setStato({ tipo: 'fallito', messaggio: messaggioErrore(e) });
    }
  };

  const cambiaAttivo = async (p: Profilo, attivo: boolean) => {
    setConfermaDisattiva(null);
    setStato({ tipo: 'inCorso', messaggio: attivo ? 'Riattivazione…' : 'Disattivazione…' });
    try {
      await aggiornaIspettore(p.id, { attivo });
      await carica();
      setStato({
        tipo: 'riuscito',
        messaggio: attivo
          ? `${p.nome} ${p.cognome} può accedere di nuovo.`
          : `${p.nome} ${p.cognome} non può più accedere. Le sue ispezioni restano nello storico.`,
      });
    } catch (e) {
      setStato({ tipo: 'fallito', messaggio: messaggioErrore(e) });
    }
  };

  return (
    <Schermata titolo="Ispettori" sottotitolo="Chi può accedere all’app" indietro>
      <ScrollView contentContainerStyle={stili.corpo} keyboardShouldPersistTaps="handled">
        <BannerStato stato={stato} onRiprova={carica} onChiudi={() => setStato(INATTIVO)} />

        {credenziali ? (
          <View style={[stili.credenziali, { backgroundColor: c.successoSfondo, borderColor: c.successo }]}>
            <Text style={[testo.corpoForte, { color: c.testo }]}>Credenziali da consegnare</Text>
            <Text style={[testo.corpo, { color: c.testo, marginTop: spazio.sm }]}>{credenziali.email}</Text>
            <Text style={[testo.corpo, { color: c.testo, fontWeight: '700', letterSpacing: 1 }]}>
              {credenziali.password}
            </Text>
            <Text style={[testo.piccolo, { color: c.testoSecondario, marginTop: spazio.sm }]}>
              Annotala adesso: non sarà più visibile. Al primo accesso l’app chiederà di
              sostituirla.
            </Text>
            <Button
              titolo="Ho annotato"
              variante="secondario"
              compatto
              onPress={() => setCredenziali(null)}
              style={{ marginTop: spazio.md, alignSelf: 'flex-start' }}
            />
          </View>
        ) : null}

        {caricamento ? (
          <ActivityIndicator color={c.testoSecondario} style={{ marginTop: spazio.xl }} />
        ) : (
          ispettori.map((p) => {
            const sonoIo = p.id === io?.id;
            const modifica = inModifica === p.id;
            const resetta = inReset === p.id;

            return (
              <Card key={p.id} style={{ opacity: p.attivo ? 1 : 0.6 }}>
                {modifica ? (
                  <View style={{ gap: spazio.md }}>
                    <View style={stili.duecolonne}>
                      <TextField
                        contenitore={{ flex: 1, minWidth: 160 }}
                        etichetta="Nome"
                        value={modulo.nome}
                        onChangeText={(v) => setModulo((m) => ({ ...m, nome: v }))}
                        autoCapitalize="words"
                      />
                      <TextField
                        contenitore={{ flex: 1, minWidth: 160 }}
                        etichetta="Cognome"
                        value={modulo.cognome}
                        onChangeText={(v) => setModulo((m) => ({ ...m, cognome: v }))}
                        autoCapitalize="words"
                      />
                    </View>
                    <Select
                      etichetta="Ruolo"
                      opzioni={RUOLI}
                      valore={modulo.ruolo}
                      onChange={(v) => setModulo((m) => ({ ...m, ruolo: (v as RuoloUtente) ?? 'ispettore' }))}
                      disabilitato={sonoIo}
                    />
                    {sonoIo ? (
                      <Text style={[testo.piccolo, { color: c.testoSecondario }]}>
                        Non puoi cambiare il tuo stesso ruolo: rischieresti di restare senza
                        amministratori.
                      </Text>
                    ) : null}
                    <View style={stili.azioni}>
                      <Button titolo="Annulla" variante="secondario" compatto onPress={chiudi} />
                      <Button
                        titolo="Salva"
                        compatto
                        onPress={() => salvaModifica(p)}
                        disabilitato={!modulo.nome.trim() || !modulo.cognome.trim()}
                        inCorso={stato.tipo === 'inCorso'}
                      />
                    </View>
                  </View>
                ) : resetta ? (
                  <View style={{ gap: spazio.md }}>
                    <Text style={[testo.corpoForte, { color: c.testo }]}>
                      Nuova password per {p.nome} {p.cognome}
                    </Text>
                    <TextField
                      etichetta="Password iniziale"
                      value={modulo.password}
                      onChangeText={(v) => setModulo((m) => ({ ...m, password: v }))}
                      autoCapitalize="none"
                      aiuto={`Almeno ${LUNGHEZZA_MINIMA_PASSWORD} caratteri. Verrà richiesto di cambiarla al primo accesso.`}
                    />
                    <View style={stili.azioni}>
                      <Button
                        titolo="Genera"
                        variante="secondario"
                        compatto
                        onPress={() => setModulo((m) => ({ ...m, password: passwordCasuale() }))}
                      />
                      <Button titolo="Annulla" variante="secondario" compatto onPress={chiudi} />
                      <Button
                        titolo="Reimposta"
                        compatto
                        onPress={() => reset(p)}
                        disabilitato={modulo.password.length < LUNGHEZZA_MINIMA_PASSWORD}
                        inCorso={stato.tipo === 'inCorso'}
                      />
                    </View>
                  </View>
                ) : (
                  <>
                    <View style={stili.riga}>
                      <View style={stili.dati}>
                        <Text style={[testo.corpoForte, { color: c.testo }]}>
                          {p.nome} {p.cognome}
                          {sonoIo ? ' · tu' : ''}
                        </Text>
                        <Text style={[testo.piccolo, { color: c.testoSecondario }]}>{p.email}</Text>
                      </View>

                      {p.ruolo === 'admin' ? <Badge testo="Amministratore" tono="attenzione" /> : null}
                      {p.deve_cambiare_password ? <Badge testo="Password da cambiare" /> : null}
                      {!p.attivo ? <Badge testo="Disattivato" tono="errore" /> : null}

                      <Pressable
                        onPress={() => {
                          chiudi();
                          setInModifica(p.id);
                          setModulo({ ...MODULO_VUOTO, nome: p.nome, cognome: p.cognome, ruolo: p.ruolo });
                        }}
                        style={({ pressed }) => [stili.azione, pressed && { opacity: 0.5 }]}
                        accessibilityRole="button"
                      >
                        <Text style={[testo.corpoForte, { color: c.testo }]}>Modifica</Text>
                      </Pressable>

                      <Pressable
                        onPress={() => {
                          chiudi();
                          setInReset(p.id);
                          setModulo({ ...MODULO_VUOTO, password: passwordCasuale() });
                        }}
                        style={({ pressed }) => [stili.azione, pressed && { opacity: 0.5 }]}
                        accessibilityRole="button"
                      >
                        <Text style={[testo.corpoForte, { color: c.testo }]}>Password</Text>
                      </Pressable>

                      {sonoIo ? null : (
                        <Pressable
                          onPress={() => (p.attivo ? setConfermaDisattiva(p.id) : cambiaAttivo(p, true))}
                          style={({ pressed }) => [stili.azione, pressed && { opacity: 0.5 }]}
                          accessibilityRole="button"
                        >
                          <Text style={[testo.corpoForte, { color: p.attivo ? c.errore : c.successo }]}>
                            {p.attivo ? 'Disattiva' : 'Riattiva'}
                          </Text>
                        </Pressable>
                      )}
                    </View>

                    {confermaDisattiva === p.id ? (
                      <View style={{ marginTop: spazio.md }}>
                        <ConfermaInLinea
                          messaggio={`${p.nome} ${p.cognome} non potrà più accedere. Le ispezioni già fatte restano nello storico.`}
                          etichettaConferma="Disattiva"
                          onConferma={() => cambiaAttivo(p, false)}
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

        {nuovo ? (
          <Card inCorso>
            <View style={{ gap: spazio.md }}>
              <Text style={[testo.etichetta, { color: c.testoSecondario }]}>NUOVO ISPETTORE</Text>
              <View style={stili.duecolonne}>
                <TextField
                  contenitore={{ flex: 1, minWidth: 160 }}
                  etichetta="Nome"
                  value={modulo.nome}
                  onChangeText={(v) => setModulo((m) => ({ ...m, nome: v }))}
                  autoCapitalize="words"
                />
                <TextField
                  contenitore={{ flex: 1, minWidth: 160 }}
                  etichetta="Cognome"
                  value={modulo.cognome}
                  onChangeText={(v) => setModulo((m) => ({ ...m, cognome: v }))}
                  autoCapitalize="words"
                />
              </View>
              <TextField
                etichetta="Email"
                value={modulo.email}
                onChangeText={(v) => setModulo((m) => ({ ...m, email: v }))}
                placeholder="nome.cognome@carellidistribuzione.it"
                autoCapitalize="none"
                keyboardType="email-address"
                errore={modulo.email.length > 0 && !emailValida ? 'Indirizzo non valido.' : undefined}
              />
              <Select
                etichetta="Ruolo"
                opzioni={RUOLI}
                valore={modulo.ruolo}
                onChange={(v) => setModulo((m) => ({ ...m, ruolo: (v as RuoloUtente) ?? 'ispettore' }))}
              />
              <TextField
                etichetta="Password iniziale"
                value={modulo.password}
                onChangeText={(v) => setModulo((m) => ({ ...m, password: v }))}
                autoCapitalize="none"
                aiuto={`Almeno ${LUNGHEZZA_MINIMA_PASSWORD} caratteri. L’app ne chiederà il cambio al primo accesso.`}
              />
              <View style={stili.azioni}>
                <Button
                  titolo="Genera"
                  variante="secondario"
                  compatto
                  onPress={() => setModulo((m) => ({ ...m, password: passwordCasuale() }))}
                />
                <Button titolo="Annulla" variante="secondario" compatto onPress={chiudi} />
                <Button
                  titolo="Crea ispettore"
                  compatto
                  onPress={crea}
                  disabilitato={!puoCreare}
                  inCorso={stato.tipo === 'inCorso'}
                />
              </View>
            </View>
          </Card>
        ) : (
          <Button
            titolo="+  Nuovo ispettore"
            variante="secondario"
            larghezzaPiena
            onPress={() => {
              chiudi();
              setNuovo(true);
              setModulo({ ...MODULO_VUOTO, password: passwordCasuale() });
            }}
          />
        )}

        <Text style={[testo.piccolo, { color: c.testoSecondario, marginTop: spazio.md }]}>
          Gli ispettori non si eliminano, si disattivano: cancellarli renderebbe illeggibile lo
          storico delle loro ispezioni.
        </Text>
      </ScrollView>
    </Schermata>
  );
}

const stili = StyleSheet.create({
  corpo: { padding: spazio.lg, gap: spazio.md, paddingBottom: spazio.xxxl },
  credenziali: { borderWidth: 1, borderRadius: raggio.md, padding: spazio.lg },
  riga: { flexDirection: 'row', alignItems: 'center', gap: spazio.md, flexWrap: 'wrap' },
  dati: { flex: 1, gap: 2, minWidth: 180 },
  duecolonne: { flexDirection: 'row', gap: spazio.md, flexWrap: 'wrap' },
  azione: { minHeight: TOCCO_MIN, justifyContent: 'center', paddingHorizontal: spazio.sm },
  azioni: { flexDirection: 'row', gap: spazio.sm, justifyContent: 'flex-end', flexWrap: 'wrap' },
});
