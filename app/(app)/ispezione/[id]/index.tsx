import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { BannerStato, INATTIVO, type StatoOperazione } from '@/components/BannerStato';
import { Button } from '@/components/Button';
import { Checkbox } from '@/components/Checkbox';
import { ConfermaInLinea } from '@/components/ConfermaInLinea';
import { SchedaAttivita } from '@/components/SchedaAttivita';
import { Schermata } from '@/components/Schermata';
import { TextField } from '@/components/TextField';
import { useBozza } from '@/hooks/useBozza';
import { useListe } from '@/hooks/useListe';
import { messaggioErrore } from '@/lib/errori';
import { dataEstesa, ora } from '@/lib/format';
import { salvaRighe, salvaTestata } from '@/lib/ispezioni';
import {
  rigaAttivitaVuota,
  rigaCompilata,
  righeSvolteVuote,
  nuovoId,
  type RigaAttivita,
} from '@/types/bozza';
import { raggio, spazio, testo, TOCCO_MIN, SOGLIA_LARGA, useColori } from '@/theme';

export default function Scheda() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColori();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const stretto = width < SOGLIA_LARGA;

  const { liste, pdvPerId } = useListe();
  const { bozza, caricamento, salvataAlle, modifica, salvaSubito, scarta } = useBozza(id);

  const [stato, setStato] = useState<StatoOperazione>(INATTIVO);
  const [confermaNiente, setConfermaNiente] = useState(false);
  const [confermaSvolte, setConfermaSvolte] = useState(false);
  const [confermaScarto, setConfermaScarto] = useState(false);

  if (caricamento) {
    return (
      <Schermata titolo="Scheda ispezione" indietro>
        <View style={stili.attesa}>
          <ActivityIndicator color={c.testoSecondario} />
        </View>
      </Schermata>
    );
  }

  if (!bozza) {
    return (
      <Schermata titolo="Scheda ispezione" indietro onIndietro={() => router.replace('/')}>
        <View style={stili.attesa}>
          <Text style={[testo.corpo, { color: c.testoSecondario, textAlign: 'center' }]}>
            Questa bozza non è più disponibile sul dispositivo.
          </Text>
          <Button titolo="Torna alla home" variante="secondario" onPress={() => router.replace('/')} />
        </View>
      </Schermata>
    );
  }

  const pdv = pdvPerId(bozza.pdv_id);
  const ingresso = new Date(bozza.ora_ingresso);
  const righeCompilate = bozza.attivita.filter(rigaCompilata);
  const svolteCompilate = bozza.svolte.filter((s) => s.descrizione.trim().length > 0);

  const cambiaOrario = () => {
    if (Platform.OS !== 'android') return;
    DateTimePickerAndroid.open({
      value: ingresso,
      mode: 'time',
      is24Hour: true,
      onChange: (evento, scelta) => {
        if (evento.type === 'set' && scelta) {
          const aggiornata = new Date(ingresso);
          aggiornata.setHours(scelta.getHours(), scelta.getMinutes(), 0, 0);
          modifica((b) => ({ ...b, ora_ingresso: aggiornata.toISOString() }));
        }
      },
    });
  };

  const spuntaNiente = (v: boolean) => {
    if (v && righeCompilate.length > 0) {
      setConfermaNiente(true);
      return;
    }
    modifica((b) => ({ ...b, niente_da_rilevare: v, attivita: v ? [] : b.attivita }));
  };

  const attivaSvolte = (v: boolean) => {
    if (!v && svolteCompilate.length > 0) {
      setConfermaSvolte(true);
      return;
    }
    modifica((b) => ({
      ...b,
      ha_svolto_attivita: v,
      svolte: v ? (b.svolte.length > 0 ? b.svolte : righeSvolteVuote()) : [],
    }));
  };

  const aggiornaRiga = (r: RigaAttivita) =>
    modifica((b) => ({ ...b, attivita: b.attivita.map((x) => (x.id === r.id ? r : x)) }));

  const salvaBozzaRemota = async () => {
    setStato({ tipo: 'inCorso', messaggio: 'Salvataggio della bozza…' });
    await salvaSubito();
    try {
      await salvaTestata(bozza);
      await salvaRighe(bozza);
      setStato({ tipo: 'riuscito', messaggio: 'Bozza salvata sul dispositivo e sul server.' });
    } catch (e) {
      setStato({
        tipo: 'fallito',
        messaggio: `Bozza salvata sul dispositivo, ma non sul server: ${messaggioErrore(e)}`,
      });
    }
  };

  const vaiAlleFirme = async () => {
    await salvaSubito();
    router.push(`/ispezione/${bozza.id}/firme`);
  };

  const spento = bozza.niente_da_rilevare;

  return (
    <Schermata
      titolo="Scheda ispezione"
      indietro
      onIndietro={async () => {
        await salvaSubito();
        router.replace('/');
      }}
      azioni={
        salvataAlle ? (
          <Text style={[testo.etichetta, { color: c.testoSecondario, fontWeight: '400' }]}>
            Salvata {ora(salvataAlle)}
          </Text>
        ) : null
      }
    >
      <View style={[stili.testataPdv, { backgroundColor: c.superficie, borderBottomColor: c.bordo }]}>
        <View style={[stili.sigla, { backgroundColor: c.giallo }]}>
          <Text style={[testo.sigla, { color: c.suGiallo }]}>{pdv?.codice ?? '··'}</Text>
        </View>

        <View style={stili.datiPdv}>
          <Text style={[testo.sezione, { color: c.testo }]} numberOfLines={1}>
            {pdv?.citta ?? 'Punto vendita'}
          </Text>
          <Text style={[testo.piccolo, { color: c.testoSecondario }]} numberOfLines={1}>
            {pdv ? `${pdv.indirizzo} · ${pdv.ragione_sociale}` : '—'}
          </Text>
          <Text style={[testo.piccolo, { color: c.testoSecondario }]}>{dataEstesa(ingresso)}</Text>
        </View>

        <Pressable
          onPress={cambiaOrario}
          style={({ pressed }) => [
            stili.orario,
            { borderColor: c.bordo, backgroundColor: pressed ? c.superficieAlt : 'transparent' },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Modifica ora di ingresso"
        >
          <Text style={[testo.etichetta, { color: c.testoSecondario }]}>INGRESSO</Text>
          <Text style={[testo.sezione, { color: c.testo }]}>{ora(ingresso)}</Text>
          <Text style={[testo.etichetta, { color: c.testoSecondario, fontWeight: '400' }]}>tocca per modificare</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={stili.corpo}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Checkbox
          etichetta="Niente da rilevare"
          descrizione="Nessuna attività da segnalare in questo punto vendita."
          valore={bozza.niente_da_rilevare}
          onChange={spuntaNiente}
        />

        {confermaNiente ? (
          <ConfermaInLinea
            messaggio={`Sono presenti ${righeCompilate.length} attività. Confermi la cancellazione?`}
            etichettaConferma="Svuota il blocco"
            onConferma={() => {
              setConfermaNiente(false);
              modifica((b) => ({ ...b, niente_da_rilevare: true, attivita: [] }));
            }}
            onAnnulla={() => setConfermaNiente(false)}
          />
        ) : null}

        <View style={[stili.blocco, spento && { opacity: 0.45 }]} pointerEvents={spento ? 'none' : 'auto'}>
          <Text style={[testo.sezione, { color: c.testo }]}>Attività rilevate</Text>

          {bozza.attivita.length === 0 ? (
            <View style={[stili.vuoto, { borderColor: c.bordo, backgroundColor: c.superficieAlt }]}>
              <Text style={[testo.piccolo, { color: c.testoSecondario, textAlign: 'center' }]}>
                Nessuna attività inserita. Aggiungine una per ogni segnalazione da inoltrare.
              </Text>
            </View>
          ) : (
            bozza.attivita.map((r, i) => (
              <SchedaAttivita
                key={r.id}
                riga={r}
                indice={i}
                stretto={stretto}
                destinatari={liste.destinatari}
                reparti={liste.reparti}
                tipiIntervento={liste.tipiIntervento}
                disabilitato={spento}
                onChange={aggiornaRiga}
                onElimina={() =>
                  modifica((b) => ({ ...b, attivita: b.attivita.filter((x) => x.id !== r.id) }))
                }
              />
            ))
          )}

          <Button
            titolo="+  Aggiungi attività"
            variante="secondario"
            larghezzaPiena
            disabilitato={spento}
            onPress={() => modifica((b) => ({ ...b, attivita: [...b.attivita, rigaAttivitaVuota()] }))}
          />
        </View>

        <View style={[stili.separatore, { backgroundColor: c.bordo }]} />

        <Checkbox
          etichetta="Ho svolto le seguenti attività"
          valore={bozza.ha_svolto_attivita}
          onChange={attivaSvolte}
        />

        {confermaSvolte ? (
          <ConfermaInLinea
            messaggio={`Sono presenti ${svolteCompilate.length} righe compilate. Confermi la cancellazione?`}
            etichettaConferma="Svuota il blocco"
            onConferma={() => {
              setConfermaSvolte(false);
              modifica((b) => ({ ...b, ha_svolto_attivita: false, svolte: [] }));
            }}
            onAnnulla={() => setConfermaSvolte(false)}
          />
        ) : null}

        {bozza.ha_svolto_attivita ? (
          <View style={stili.blocco}>
            {bozza.svolte.map((s, i) => (
              <View key={s.id} style={stili.rigaSvolta}>
                <Text style={[testo.corpo, { color: c.testoSecondario, width: 22 }]}>{i + 1}.</Text>
                <TextField
                  contenitore={{ flex: 1 }}
                  value={s.descrizione}
                  onChangeText={(v) =>
                    modifica((b) => ({
                      ...b,
                      svolte: b.svolte.map((x) => (x.id === s.id ? { ...x, descrizione: v } : x)),
                    }))
                  }
                  placeholder={`Attività svolta ${i + 1}`}
                />
                <Pressable
                  onPress={() => modifica((b) => ({ ...b, svolte: b.svolte.filter((x) => x.id !== s.id) }))}
                  hitSlop={8}
                  style={({ pressed }) => [stili.eliminaRiga, pressed && { opacity: 0.5 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Elimina riga ${i + 1}`}
                >
                  <Text style={{ color: c.testoSecondario, fontSize: 20 }}>✕</Text>
                </Pressable>
              </View>
            ))}

            <Button
              titolo="+  Aggiungi riga"
              variante="secondario"
              compatto
              onPress={() =>
                modifica((b) => ({ ...b, svolte: [...b.svolte, { id: nuovoId(), descrizione: '' }] }))
              }
            />
          </View>
        ) : null}

        <View style={[stili.separatore, { backgroundColor: c.bordo }]} />

        <BannerStato stato={stato} onChiudi={() => setStato(INATTIVO)} onRiprova={salvaBozzaRemota} />

        {confermaScarto ? (
          <ConfermaInLinea
            messaggio="L’intera scheda verrà eliminata dal dispositivo."
            etichettaConferma="Elimina la bozza"
            onConferma={async () => {
              setConfermaScarto(false);
              await scarta();
              router.replace('/');
            }}
            onAnnulla={() => setConfermaScarto(false)}
          />
        ) : (
          <Pressable
            onPress={() => setConfermaScarto(true)}
            style={({ pressed }) => [stili.scarta, pressed && { opacity: 0.5 }]}
            accessibilityRole="button"
          >
            <Text style={[testo.piccolo, { color: c.errore }]}>Elimina questa bozza</Text>
          </Pressable>
        )}
      </ScrollView>

      <View style={[stili.barra, { backgroundColor: c.superficie, borderTopColor: c.bordo }]}>
        <Button
          titolo="Salva bozza"
          variante="secondario"
          onPress={salvaBozzaRemota}
          inCorso={stato.tipo === 'inCorso'}
          style={{ flex: 1 }}
        />
        <Button titolo="Concludi ispezione" onPress={vaiAlleFirme} style={{ flex: 2 }} />
      </View>
    </Schermata>
  );
}

const stili = StyleSheet.create({
  attesa: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spazio.lg, padding: spazio.xl },
  testataPdv: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spazio.md,
    paddingHorizontal: spazio.lg,
    paddingVertical: spazio.md,
    borderBottomWidth: 1,
  },
  sigla: { width: 58, height: 58, borderRadius: raggio.md, alignItems: 'center', justifyContent: 'center' },
  datiPdv: { flex: 1, gap: 2 },
  orario: {
    borderWidth: 1,
    borderRadius: raggio.md,
    paddingHorizontal: spazio.md,
    paddingVertical: spazio.sm,
    alignItems: 'center',
    minHeight: TOCCO_MIN + 12,
    justifyContent: 'center',
  },
  corpo: { padding: spazio.lg, gap: spazio.lg, paddingBottom: spazio.xxl },
  blocco: { gap: spazio.md },
  vuoto: { borderWidth: 1, borderStyle: 'dashed', borderRadius: raggio.md, padding: spazio.xl },
  separatore: { height: 1 },
  rigaSvolta: { flexDirection: 'row', alignItems: 'center', gap: spazio.sm },
  eliminaRiga: { width: TOCCO_MIN, height: TOCCO_MIN, alignItems: 'center', justifyContent: 'center' },
  scarta: { minHeight: TOCCO_MIN, justifyContent: 'center', alignItems: 'center' },
  barra: {
    flexDirection: 'row',
    gap: spazio.md,
    padding: spazio.lg,
    borderTopWidth: 1,
  },
});
