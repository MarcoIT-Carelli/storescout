import { File } from 'expo-file-system';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

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
  applicaImport,
  creaPdv,
  leggiTuttiPdv,
  preparaImport,
  salvaPdv,
  type Piano,
} from '@/lib/pdvAdmin';
import type { Pdv } from '@/types/database';
import { raggio, spazio, testo, TOCCO_MIN, useColori } from '@/theme';

type Modulo = {
  progressivo: string;
  codice: string;
  citta: string;
  indirizzo: string;
  ragione_sociale: string;
  codice_deposito: string;
  telefono: string;
  email: string;
  responsabile_nome: string;
};

const VUOTO: Modulo = {
  progressivo: '',
  codice: '',
  citta: '',
  indirizzo: '',
  ragione_sociale: '',
  codice_deposito: '',
  telefono: '',
  email: '',
  responsabile_nome: '',
};

const daPdv = (p: Pdv): Modulo => ({
  progressivo: p.progressivo,
  codice: p.codice,
  citta: p.citta,
  indirizzo: p.indirizzo,
  ragione_sociale: p.ragione_sociale,
  codice_deposito: p.codice_deposito ?? '',
  telefono: p.telefono ?? '',
  email: p.email ?? '',
  responsabile_nome: p.responsabile_nome ?? '',
});

const perDatabase = (m: Modulo) => ({
  progressivo: m.progressivo.trim(),
  codice: m.codice.trim().toUpperCase(),
  citta: m.citta.trim(),
  indirizzo: m.indirizzo.trim(),
  ragione_sociale: m.ragione_sociale.trim(),
  codice_deposito: m.codice_deposito.trim() || null,
  telefono: m.telefono.trim() || null,
  email: m.email.trim() || null,
  responsabile_nome: m.responsabile_nome.trim() || null,
});

export default function PuntiVendita() {
  const c = useColori();
  const { aggiorna: aggiornaCacheListe } = useListe();

  const [pdv, setPdv] = useState<Pdv[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [stato, setStato] = useState<StatoOperazione>(INATTIVO);
  const [ricerca, setRicerca] = useState('');

  const [inModifica, setInModifica] = useState<string | null>(null);
  const [nuovo, setNuovo] = useState(false);
  const [modulo, setModulo] = useState<Modulo>(VUOTO);
  const [confermaDisattiva, setConfermaDisattiva] = useState<string | null>(null);

  const [piano, setPiano] = useState<Piano | null>(null);

  const carica = useCallback(async () => {
    setCaricamento(true);
    try {
      setPdv(await leggiTuttiPdv());
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

  const chiudi = () => {
    setInModifica(null);
    setNuovo(false);
    setModulo(VUOTO);
  };

  const completo =
    modulo.progressivo.trim() &&
    modulo.codice.trim() &&
    modulo.citta.trim() &&
    modulo.indirizzo.trim() &&
    modulo.ragione_sociale.trim();

  const salva = async () => {
    setStato({ tipo: 'inCorso', messaggio: 'Salvataggio…' });
    try {
      if (nuovo) await creaPdv(perDatabase(modulo));
      else if (inModifica) await salvaPdv(inModifica, perDatabase(modulo));
      chiudi();
      await carica();
      await aggiornaCacheListe();
      setStato({ tipo: 'riuscito', messaggio: 'Anagrafica aggiornata.' });
    } catch (e) {
      setStato({ tipo: 'fallito', messaggio: messaggioErrore(e) });
    }
  };

  const cambiaAttivo = async (p: Pdv, attivo: boolean) => {
    setConfermaDisattiva(null);
    setStato({ tipo: 'inCorso', messaggio: attivo ? 'Riattivazione…' : 'Disattivazione…' });
    try {
      await salvaPdv(p.id, { attivo });
      await carica();
      await aggiornaCacheListe();
      setStato({
        tipo: 'riuscito',
        messaggio: attivo
          ? `${p.codice} è di nuovo selezionabile.`
          : `${p.codice} non è più selezionabile per le nuove ispezioni.`,
      });
    } catch (e) {
      setStato({ tipo: 'fallito', messaggio: messaggioErrore(e) });
    }
  };

  const scegliFile = async () => {
    try {
      const scelta = await File.pickFileAsync();
      if (scelta.canceled || !scelta.result) return;
      const contenuto = await scelta.result.text();
      const preparato = preparaImport(contenuto, pdv);
      if (preparato.voci.length === 0 && preparato.scartate.length === 0) {
        setStato({ tipo: 'fallito', messaggio: 'Il file non contiene righe leggibili.' });
        return;
      }
      setPiano(preparato);
      setStato(INATTIVO);
    } catch (e) {
      setStato({ tipo: 'fallito', messaggio: messaggioErrore(e) });
    }
  };

  const confermaImport = async () => {
    if (!piano) return;
    setStato({ tipo: 'inCorso', messaggio: 'Importazione in corso…' });
    try {
      const quante = await applicaImport(piano);
      setPiano(null);
      await carica();
      await aggiornaCacheListe();
      setStato({ tipo: 'riuscito', messaggio: `${quante} punti vendita importati.` });
    } catch (e) {
      setStato({ tipo: 'fallito', messaggio: messaggioErrore(e) });
    }
  };

  const nuoviNelPiano = piano?.voci.filter((v) => v.azione === 'nuovo').length ?? 0;
  const aggiornatiNelPiano = piano?.voci.filter((v) => v.azione === 'aggiornato').length ?? 0;

  return (
    <Schermata
      titolo="Punti vendita"
      sottotitolo={`${pdv.filter((p) => p.attivo).length} attivi su ${pdv.length}`}
      indietro
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
      </View>

      <ScrollView contentContainerStyle={stili.corpo} keyboardShouldPersistTaps="handled">
        <BannerStato stato={stato} onRiprova={carica} onChiudi={() => setStato(INATTIVO)} />

        {piano ? (
          <Card inCorso>
            <Text style={[testo.sezione, { color: c.testo }]}>Anteprima dell’importazione</Text>
            <Text style={[testo.piccolo, { color: c.testoSecondario, marginTop: spazio.xs }]}>
              Niente è ancora stato scritto. Controlla i numeri prima di confermare.
            </Text>

            <View style={stili.numeri}>
              <Numero valore={nuoviNelPiano} etichetta="da aggiungere" />
              <Numero valore={aggiornatiNelPiano} etichetta="da aggiornare" tono="attenzione" />
              <Numero valore={piano.scartate.length} etichetta="scartate" tono="errore" />
            </View>

            {piano.colonneIgnorate.length > 0 ? (
              <Text style={[testo.piccolo, { color: c.attenzione, marginTop: spazio.md }]}>
                Colonne non previste dallo schema, ignorate: {piano.colonneIgnorate.join(', ')}.
              </Text>
            ) : null}

            {piano.scartate.length > 0 ? (
              <View style={{ marginTop: spazio.md, gap: 2 }}>
                {piano.scartate.slice(0, 6).map((s) => (
                  <Text key={s.riga} style={[testo.piccolo, { color: c.errore }]}>
                    riga {s.riga}: {s.motivo}
                  </Text>
                ))}
                {piano.scartate.length > 6 ? (
                  <Text style={[testo.piccolo, { color: c.testoSecondario }]}>
                    …e altre {piano.scartate.length - 6}.
                  </Text>
                ) : null}
              </View>
            ) : null}

            {aggiornatiNelPiano > 0 ? (
              <Text style={[testo.piccolo, { color: c.testoSecondario, marginTop: spazio.md }]}>
                L’aggiornamento tocca solo le colonne presenti nel file: quelle assenti restano
                come sono adesso.
              </Text>
            ) : null}

            <View style={stili.azioni}>
              <Button titolo="Annulla" variante="secondario" compatto onPress={() => setPiano(null)} />
              <Button
                titolo={`Importa ${piano.voci.length}`}
                compatto
                onPress={confermaImport}
                disabilitato={piano.voci.length === 0}
                inCorso={stato.tipo === 'inCorso'}
              />
            </View>
          </Card>
        ) : null}

        {caricamento ? (
          <ActivityIndicator color={c.testoSecondario} style={{ marginTop: spazio.xl }} />
        ) : (
          visibili.map((p) => {
            const modifica = inModifica === p.id;
            return (
              <Card key={p.id} style={{ opacity: p.attivo ? 1 : 0.6 }}>
                {modifica ? (
                  <ModuloPdv
                    modulo={modulo}
                    setModulo={setModulo}
                    completo={Boolean(completo)}
                    inCorso={stato.tipo === 'inCorso'}
                    onAnnulla={chiudi}
                    onSalva={salva}
                  />
                ) : (
                  <>
                    <View style={stili.riga}>
                      <View style={[stili.sigla, { backgroundColor: c.superficieAlt, borderColor: c.bordo }]}>
                        <Text style={[testo.sigla, { color: c.testo }]}>{p.codice}</Text>
                      </View>

                      <View style={stili.dati}>
                        <Text style={[testo.corpoForte, { color: c.testo }]}>{p.citta}</Text>
                        <Text style={[testo.piccolo, { color: c.testoSecondario }]}>{p.indirizzo}</Text>
                        <Text
                          style={[testo.piccolo, { color: p.email ? c.testoSecondario : c.attenzione }]}
                        >
                          {p.email ?? 'nessun indirizzo email: non riceverà le schede'}
                        </Text>
                      </View>

                      <Badge testo={p.ragione_sociale} />
                      {!p.attivo ? <Badge testo="Disattivato" tono="errore" /> : null}

                      <Pressable
                        onPress={() => {
                          chiudi();
                          setInModifica(p.id);
                          setModulo(daPdv(p));
                        }}
                        style={({ pressed }) => [stili.azione, pressed && { opacity: 0.5 }]}
                        accessibilityRole="button"
                      >
                        <Text style={[testo.corpoForte, { color: c.testo }]}>Modifica</Text>
                      </Pressable>

                      <Pressable
                        onPress={() => (p.attivo ? setConfermaDisattiva(p.id) : cambiaAttivo(p, true))}
                        style={({ pressed }) => [stili.azione, pressed && { opacity: 0.5 }]}
                        accessibilityRole="button"
                      >
                        <Text style={[testo.corpoForte, { color: p.attivo ? c.errore : c.successo }]}>
                          {p.attivo ? 'Disattiva' : 'Riattiva'}
                        </Text>
                      </Pressable>
                    </View>

                    {confermaDisattiva === p.id ? (
                      <View style={{ marginTop: spazio.md }}>
                        <ConfermaInLinea
                          messaggio={`${p.codice} — ${p.citta} non sarà più selezionabile per le nuove ispezioni. Lo storico resta invariato.`}
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
            <Text style={[testo.etichetta, { color: c.testoSecondario, marginBottom: spazio.md }]}>
              NUOVO PUNTO VENDITA
            </Text>
            <ModuloPdv
              modulo={modulo}
              setModulo={setModulo}
              completo={Boolean(completo)}
              inCorso={stato.tipo === 'inCorso'}
              onAnnulla={chiudi}
              onSalva={salva}
              etichettaSalva="Aggiungi"
            />
          </Card>
        ) : (
          <View style={stili.pulsanti}>
            <Button
              titolo="+  Nuovo punto vendita"
              variante="secondario"
              onPress={() => {
                chiudi();
                setNuovo(true);
              }}
              style={{ flex: 1 }}
            />
            <Button titolo="Importa da CSV" variante="secondario" onPress={scegliFile} style={{ flex: 1 }} />
          </View>
        )}

        <Text style={[testo.piccolo, { color: c.testoSecondario }]}>
          Il file CSV deve avere una riga di intestazione con i nomi delle colonne. I punti
          vendita già presenti vengono riconosciuti dalla sigla e aggiornati, gli altri aggiunti.
        </Text>
      </ScrollView>
    </Schermata>
  );
}

function ModuloPdv({
  modulo,
  setModulo,
  completo,
  inCorso,
  onAnnulla,
  onSalva,
  etichettaSalva = 'Salva',
}: {
  modulo: Modulo;
  setModulo: (m: Modulo) => void;
  completo: boolean;
  inCorso: boolean;
  onAnnulla: () => void;
  onSalva: () => void;
  etichettaSalva?: string;
}) {
  const campo = (chiave: keyof Modulo, etichetta: string, extra?: object) => (
    <TextField
      contenitore={{ flex: 1, minWidth: 150 }}
      etichetta={etichetta}
      value={modulo[chiave]}
      onChangeText={(v) => setModulo({ ...modulo, [chiave]: v })}
      {...extra}
    />
  );

  return (
    <View style={{ gap: spazio.md }}>
      <View style={stili.colonne}>
        {campo('codice', 'Sigla', { autoCapitalize: 'characters', maxLength: 4 })}
        {campo('progressivo', 'Progressivo')}
        {campo('ragione_sociale', 'Insegna')}
      </View>
      <View style={stili.colonne}>
        {campo('citta', 'Città', { autoCapitalize: 'words' })}
        {campo('indirizzo', 'Indirizzo')}
      </View>
      <View style={stili.colonne}>
        {campo('email', 'Email', { autoCapitalize: 'none', keyboardType: 'email-address' })}
        {campo('telefono', 'Telefono', { keyboardType: 'phone-pad' })}
      </View>
      <View style={stili.colonne}>
        {campo('responsabile_nome', 'Responsabile', { autoCapitalize: 'words' })}
        {campo('codice_deposito', 'Codice deposito')}
      </View>
      <View style={stili.azioni}>
        <Button titolo="Annulla" variante="secondario" compatto onPress={onAnnulla} />
        <Button titolo={etichettaSalva} compatto onPress={onSalva} disabilitato={!completo} inCorso={inCorso} />
      </View>
    </View>
  );
}

function Numero({
  valore,
  etichetta,
  tono = 'neutro',
}: {
  valore: number;
  etichetta: string;
  tono?: 'neutro' | 'attenzione' | 'errore';
}) {
  const c = useColori();
  const colore = tono === 'errore' ? c.errore : tono === 'attenzione' ? c.attenzione : c.testo;
  return (
    <View style={{ alignItems: 'center', minWidth: 90 }}>
      <Text style={[testo.titolo, { color: valore === 0 ? c.testoDisabilitato : colore }]}>{valore}</Text>
      <Text style={[testo.piccolo, { color: c.testoSecondario }]}>{etichetta}</Text>
    </View>
  );
}

const stili = StyleSheet.create({
  testata: { padding: spazio.lg, borderBottomWidth: 1 },
  ricerca: {
    minHeight: TOCCO_MIN + 4,
    borderWidth: 1,
    borderRadius: raggio.md,
    paddingHorizontal: spazio.md,
  },
  corpo: { padding: spazio.lg, gap: spazio.md, paddingBottom: spazio.xxxl },
  riga: { flexDirection: 'row', alignItems: 'center', gap: spazio.md, flexWrap: 'wrap' },
  sigla: {
    width: 54,
    height: 54,
    borderRadius: raggio.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dati: { flex: 1, gap: 2, minWidth: 200 },
  azione: { minHeight: TOCCO_MIN, justifyContent: 'center', paddingHorizontal: spazio.sm },
  azioni: { flexDirection: 'row', gap: spazio.sm, justifyContent: 'flex-end', flexWrap: 'wrap' },
  colonne: { flexDirection: 'row', gap: spazio.md, flexWrap: 'wrap' },
  pulsanti: { flexDirection: 'row', gap: spazio.md, flexWrap: 'wrap' },
  numeri: { flexDirection: 'row', gap: spazio.xl, marginTop: spazio.lg, flexWrap: 'wrap' },
});
