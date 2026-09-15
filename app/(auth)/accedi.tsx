import { useEffect, useState } from 'react';
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { BannerStato, INATTIVO, type StatoOperazione } from '@/components/BannerStato';
import { Button } from '@/components/Button';
import { Logo } from '@/components/Logo';
import { Schermata } from '@/components/Schermata';
import { TextField } from '@/components/TextField';
import { supabaseConfigurato } from '@/lib/env';
import { messaggioErrore } from '@/lib/errori';
import { useAuth } from '@/hooks/useAuth';
import { raggio, spazio, testo, useColori } from '@/theme';

export default function Accedi() {
  const c = useColori();
  const { accedi, disattivato } = useAuth();

  const { height } = useWindowDimensions();

  /**
   * Con la tastiera aperta il contenuto non può più stare centrato.
   *
   * Android restringe la finestra, e un contenitore centrato ricentra quel poco che
   * resta: in orizzontale il campo password finiva sotto la tastiera, irraggiungibile
   * perché non c'era niente da scorrere. Ancorandolo in alto, lo scorrimento torna a
   * funzionare e il campo si raggiunge.
   *
   * `KeyboardAvoidingView` qui non serviva: il suo `behavior` era condizionato a iOS,
   * e questa app esiste solo per Android.
   */
  const [tastieraAperta, setTastieraAperta] = useState(false);

  useEffect(() => {
    const su = Keyboard.addListener('keyboardDidShow', () => setTastieraAperta(true));
    const giu = Keyboard.addListener('keyboardDidHide', () => setTastieraAperta(false));
    return () => {
      su.remove();
      giu.remove();
    };
  }, []);

  // Sotto i 500 punti ci si sta in piedi soltanto: è il tablet in orizzontale, dove il
  // marchio è la prima cosa a cui rinunciare per fare spazio ai campi.
  const schermoBasso = height < 500;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [stato, setStato] = useState<StatoOperazione>(INATTIVO);

  const pronto = email.trim().length > 3 && password.length > 0;

  const entra = async () => {
    setStato({ tipo: 'inCorso', messaggio: 'Accesso in corso…' });
    try {
      await accedi(email, password);
      setStato(INATTIVO);
    } catch (e) {
      setStato({
        tipo: 'fallito',
        messaggio:
          messaggioErrore(e) === 'account disattivato'
            ? 'Questo account è stato disattivato. Rivolgiti all’amministratore.'
            : messaggioErrore(e),
      });
    }
  };

  return (
    <Schermata>
      <ScrollView
        contentContainerStyle={[stili.centro, tastieraAperta && stili.ancorato]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {tastieraAperta && schermoBasso ? null : (
          <View style={stili.marchio}>
            <Logo larghezza={schermoBasso ? 96 : 132} colore={c.marchio} conScritta />
          </View>
        )}

          <View style={[stili.pannello, { backgroundColor: c.superficie, borderColor: c.bordo }]}>
            <Text style={[testo.sezione, { color: c.testo }]}>Accedi</Text>
            <Text style={[testo.piccolo, { color: c.testoSecondario, marginBottom: spazio.sm }]}>
              Usa le credenziali che ti ha fornito l’amministratore.
            </Text>

            <TextField
              etichetta="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="nome.cognome@carellidistribuzione.it"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
            />

            <TextField
              etichetta="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="La tua password"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={() => pronto && entra()}
            />

            <BannerStato stato={stato} onChiudi={() => setStato(INATTIVO)} />

            {disattivato ? (
              <Text style={[testo.piccolo, { color: c.errore }]}>
                L’account risulta disattivato: lo storico resta intatto, ma l’accesso è sospeso.
              </Text>
            ) : null}

            <Button
              titolo="Accedi"
              onPress={entra}
              larghezzaPiena
              disabilitato={!pronto || !supabaseConfigurato}
              inCorso={stato.tipo === 'inCorso'}
            />

            <Text style={[testo.piccolo, { color: c.testoSecondario, textAlign: 'center' }]}>
              Password dimenticata? Chiedila all’amministratore: te ne assegna una
              provvisoria e l’app ti chiede di sostituirla al primo accesso.
            </Text>
          </View>

          {!supabaseConfigurato ? (
            <View style={[stili.avviso, { backgroundColor: c.erroreSfondo, borderColor: c.errore }]}>
              <Text style={[testo.piccolo, { color: c.testo }]}>
                Collegamento a Supabase non configurato: compila `.env` con
                EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY, poi riavvia l’app.
              </Text>
            </View>
          ) : null}

        {tastieraAperta ? null : (
          <Text style={[testo.etichetta, { color: c.testoSecondario, fontWeight: '400' }]}>
            Carelli Distribuzione — Area Vendite
          </Text>
        )}
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
  /** Con la tastiera aperta il contenuto parte dall'alto, così si può scorrere. */
  ancorato: { justifyContent: 'flex-start', paddingBottom: spazio.xxxl },
  marchio: { alignItems: 'center' },
  pannello: {
    width: '100%',
    maxWidth: 460,
    borderWidth: 1,
    borderRadius: raggio.lg,
    padding: spazio.xl,
    gap: spazio.lg,
  },
  avviso: {
    width: '100%',
    maxWidth: 460,
    borderWidth: 1,
    borderRadius: raggio.md,
    padding: spazio.md,
  },
});
