import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

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
      <KeyboardAvoidingView
        style={stili.pieno}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={stili.centro}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={stili.marchio}>
            <Logo larghezza={132} colore={c.marchio} conScritta />
          </View>

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

          <Text style={[testo.etichetta, { color: c.testoSecondario, fontWeight: '400' }]}>
            Carelli Distribuzione — Area Vendite
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Schermata>
  );
}

const stili = StyleSheet.create({
  pieno: { flex: 1 },
  centro: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spazio.xl,
    gap: spazio.xl,
  },
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
