import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Logo } from '@/components/Logo';
import { Schermata } from '@/components/Schermata';
import { TextField } from '@/components/TextField';
import { parametriDaUrl } from '@/lib/collegamenti';
import { messaggioErrore } from '@/lib/errori';
import { supabase } from '@/lib/supabase';
import { raggio, spazio, testo, TOCCO_MIN, useColori } from '@/theme';

/**
 * Reimpostazione da link email. **Non è un percorso dell'app**: dentro StoreScout la
 * password si cambia dal menu, e chi l'ha dimenticata la fa riassegnare dall'admin.
 *
 * Questa schermata esiste per un solo caso: l'unico amministratore resta fuori e non ha
 * nessuno che possa riassegnargliela. In quella situazione si manda un link di recupero
 * dalla dashboard Supabase, e serve qualcosa che lo raccolga. Perché funzioni, il Site URL
 * del progetto deve essere `storescout://reimposta-password`.
 */

const LUNGHEZZA_MINIMA = 8;

type Stato =
  | { fase: 'attesa' }
  | { fase: 'verifica' }
  | { fase: 'pronta'; email: string | null }
  | { fase: 'errore'; messaggio: string; riprovabile: boolean }
  | { fase: 'fatta' };

/**
 * Traduce gli errori che Supabase restituisce nel link stesso.
 * Sono gli unici casi che l'utente incontra davvero: link vecchio, link già usato,
 * link tagliato dal client di posta.
 */
function messaggioDaLink(codice: string, descrizione: string): string {
  switch (codice) {
    case 'otp_expired':
      return 'Il link è scaduto. Torna all’accesso e richiedi un nuovo messaggio: quello vecchio non è più valido.';
    case 'access_denied':
      return 'Il link non è più valido: probabilmente è già stato usato, oppure ne è stato richiesto uno più recente.';
    case 'validation_failed':
      return 'Il link è incompleto. Alcuni programmi di posta lo spezzano su più righe: riaprilo dal messaggio originale, senza copiarlo a mano.';
    default:
      return descrizione || 'Il link non è utilizzabile. Richiedi un nuovo messaggio di reimpostazione.';
  }
}

export default function ReimpostaPassword() {
  const c = useColori();
  const router = useRouter();
  const url = Linking.useURL();

  const [stato, setStato] = useState<Stato>({ fase: 'attesa' });
  const [nuova, setNuova] = useState('');
  const [ripeti, setRipeti] = useState('');
  const [inCorso, setInCorso] = useState(false);
  // Un rifiuto della password non è un problema del link: il modulo deve restare
  // a schermo con l'errore accanto, altrimenti l'utente non sa cosa correggere.
  const [erroreSalvataggio, setErroreSalvataggio] = useState<string | null>(null);

  // Un link va consumato una volta sola: `useURL` continua a restituire lo stesso
  // valore, e senza questo controllo la schermata ripartirebbe a ogni render.
  const giaVisto = useRef<string | null>(null);

  const apriSessione = useCallback(async (collegamento: string) => {
    setStato({ fase: 'verifica' });
    const p = parametriDaUrl(collegamento);

    if (p.error || p.error_code) {
      setStato({
        fase: 'errore',
        messaggio: messaggioDaLink(p.error_code ?? p.error ?? '', p.error_description ?? ''),
        riprovabile: true,
      });
      return;
    }

    try {
      if (p.access_token && p.refresh_token) {
        const { error } = await supabase.auth.setSession({
          access_token: p.access_token,
          refresh_token: p.refresh_token,
        });
        if (error) throw error;
      } else if (p.code) {
        // Presente solo se il progetto passa al flusso PKCE.
        const { error } = await supabase.auth.exchangeCodeForSession(p.code);
        if (error) throw error;
      } else {
        setStato({
          fase: 'errore',
          messaggio:
            'Il link non contiene i dati necessari. Aprilo direttamente dal messaggio email, senza copiarlo e incollarlo.',
          riprovabile: true,
        });
        return;
      }

      const { data } = await supabase.auth.getUser();
      setStato({ fase: 'pronta', email: data.user?.email ?? null });
    } catch (e) {
      setStato({ fase: 'errore', messaggio: messaggioErrore(e), riprovabile: true });
    }
  }, []);

  useEffect(() => {
    if (!url || giaVisto.current === url) return;
    giaVisto.current = url;
    void apriSessione(url);
  }, [url, apriSessione]);

  // Se la schermata viene aperta senza link — per esempio tornandoci dalla cronologia —
  // ma una sessione di recupero è già attiva, si può comunque procedere.
  useEffect(() => {
    if (url) return;
    let vivo = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!vivo) return;
      if (data.session?.user) setStato({ fase: 'pronta', email: data.session.user.email ?? null });
      else
        setStato({
          fase: 'errore',
          messaggio: 'Apri il link che hai ricevuto per email: da solo questo passaggio non può partire.',
          riprovabile: true,
        });
    });
    return () => {
      vivo = false;
    };
  }, [url]);

  const corta = nuova.length > 0 && nuova.length < LUNGHEZZA_MINIMA;
  const diverse = ripeti.length > 0 && nuova !== ripeti;
  const pronto = nuova.length >= LUNGHEZZA_MINIMA && nuova === ripeti;

  const salva = async () => {
    setInCorso(true);
    setErroreSalvataggio(null);
    try {
      const { data, error } = await supabase.auth.updateUser({ password: nuova });
      if (error) throw error;

      // Se la password era temporanea, l'obbligo di cambiarla è appena stato assolto.
      if (data.user) {
        await supabase
          .from('profili')
          .update({ deve_cambiare_password: false })
          .eq('id', data.user.id);
      }
      setStato({ fase: 'fatta' });
    } catch (e) {
      setErroreSalvataggio(messaggioErrore(e));
    } finally {
      setInCorso(false);
    }
  };

  const tornaAllAccesso = async () => {
    await supabase.auth.signOut();
    router.replace('/accedi');
  };

  return (
    <Schermata>
      <ScrollView contentContainerStyle={stili.centro} keyboardShouldPersistTaps="handled">
        <Logo larghezza={110} colore={c.marchio} conScritta />

        <View style={[stili.pannello, { backgroundColor: c.superficie, borderColor: c.bordo }]}>
          {stato.fase === 'attesa' || stato.fase === 'verifica' ? (
            <View style={stili.attesa}>
              <ActivityIndicator color={c.testoSecondario} />
              <Text style={[testo.piccolo, { color: c.testoSecondario }]}>Verifica del link…</Text>
            </View>
          ) : null}

          {stato.fase === 'errore' ? (
            <View style={{ gap: spazio.lg }}>
              <Text style={[testo.sezione, { color: c.testo }]}>Link non utilizzabile</Text>
              <View style={[stili.avviso, { backgroundColor: c.erroreSfondo, borderColor: c.errore }]}>
                <Text style={[testo.piccolo, { color: c.testo }]}>{stato.messaggio}</Text>
              </View>
              {stato.riprovabile ? (
                <Text style={[testo.piccolo, { color: c.testoSecondario }]}>
                  Dalla schermata di accesso tocca "Password dimenticata" per riceverne uno nuovo.
                  In alternativa chiedi all’amministratore di reimpostarla dal pannello.
                </Text>
              ) : null}
              <Button titolo="Torna all’accesso" larghezzaPiena onPress={tornaAllAccesso} />
            </View>
          ) : null}

          {stato.fase === 'pronta' ? (
            <View style={{ gap: spazio.lg }}>
              <View>
                <Text style={[testo.sezione, { color: c.testo }]}>Scegli la nuova password</Text>
                {stato.email ? (
                  <Text style={[testo.piccolo, { color: c.testoSecondario }]}>{stato.email}</Text>
                ) : null}
              </View>

              <TextField
                etichetta="Nuova password"
                value={nuova}
                onChangeText={setNuova}
                secureTextEntry
                autoCapitalize="none"
                aiuto={`Almeno ${LUNGHEZZA_MINIMA} caratteri.`}
                errore={corta ? `Servono almeno ${LUNGHEZZA_MINIMA} caratteri.` : undefined}
              />
              <TextField
                etichetta="Ripeti la password"
                value={ripeti}
                onChangeText={setRipeti}
                secureTextEntry
                autoCapitalize="none"
                errore={diverse ? 'Le due password non coincidono.' : undefined}
              />

              {erroreSalvataggio ? (
                <View style={[stili.avviso, { backgroundColor: c.erroreSfondo, borderColor: c.errore }]}>
                  <Text style={[testo.piccolo, { color: c.testo }]}>{erroreSalvataggio}</Text>
                </View>
              ) : null}

              <Button
                titolo="Salva password"
                larghezzaPiena
                onPress={salva}
                disabilitato={!pronto}
                inCorso={inCorso}
              />
            </View>
          ) : null}

          {stato.fase === 'fatta' ? (
            <View style={{ gap: spazio.lg }}>
              <Text style={[testo.sezione, { color: c.testo }]}>Password aggiornata</Text>
              <View style={[stili.avviso, { backgroundColor: c.successoSfondo, borderColor: c.successo }]}>
                <Text style={[testo.piccolo, { color: c.testo }]}>
                  Da adesso usa la nuova password per accedere. Il link ricevuto per email non è
                  più valido.
                </Text>
              </View>
              <Button titolo="Entra nell’app" larghezzaPiena onPress={() => router.replace('/')} />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </Schermata>
  );
}

const stili = StyleSheet.create({
  centro: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spazio.xl,
    gap: spazio.xl,
  },
  pannello: {
    width: '100%',
    maxWidth: 460,
    borderWidth: 1,
    borderRadius: raggio.lg,
    padding: spazio.xl,
  },
  attesa: { alignItems: 'center', gap: spazio.md, minHeight: TOCCO_MIN * 2, justifyContent: 'center' },
  avviso: { borderWidth: 1, borderRadius: raggio.md, padding: spazio.md },
});
