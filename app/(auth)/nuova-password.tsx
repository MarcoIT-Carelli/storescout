import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BannerStato, INATTIVO, type StatoOperazione } from '@/components/BannerStato';
import { Button } from '@/components/Button';
import { Schermata } from '@/components/Schermata';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/hooks/useAuth';
import { messaggioErrore } from '@/lib/errori';
import { raggio, spazio, testo, useColori } from '@/theme';

const LUNGHEZZA_MINIMA = 8;

export default function NuovaPassword() {
  const c = useColori();
  const router = useRouter();
  const { cambiaPassword, profilo, esci } = useAuth();

  const [nuova, setNuova] = useState('');
  const [ripeti, setRipeti] = useState('');
  const [stato, setStato] = useState<StatoOperazione>(INATTIVO);

  const corta = nuova.length > 0 && nuova.length < LUNGHEZZA_MINIMA;
  const diverse = ripeti.length > 0 && nuova !== ripeti;
  const pronto = nuova.length >= LUNGHEZZA_MINIMA && nuova === ripeti;

  const salva = async () => {
    setStato({ tipo: 'inCorso', messaggio: 'Aggiornamento della password…' });
    try {
      await cambiaPassword(nuova);
      setStato({ tipo: 'riuscito', messaggio: 'Password aggiornata.' });
      router.replace('/');
    } catch (e) {
      setStato({ tipo: 'fallito', messaggio: messaggioErrore(e) });
    }
  };

  return (
    <Schermata>
      <ScrollView contentContainerStyle={stili.centro} keyboardShouldPersistTaps="handled">
        <View style={[stili.pannello, { backgroundColor: c.superficie, borderColor: c.bordo }]}>
          <Text style={[testo.sezione, { color: c.testo }]}>Scegli una nuova password</Text>
          <Text style={[testo.piccolo, { color: c.testoSecondario }]}>
            {profilo?.deve_cambiare_password
              ? 'La password attuale è temporanea: prima di usare l’app devi sostituirla.'
              : 'Imposta una nuova password per il tuo accesso.'}
          </Text>

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

          <BannerStato stato={stato} onChiudi={() => setStato(INATTIVO)} />

          <Button
            titolo="Salva password"
            onPress={salva}
            larghezzaPiena
            disabilitato={!pronto}
            inCorso={stato.tipo === 'inCorso'}
          />

          <Button titolo="Esci" variante="testo" larghezzaPiena onPress={esci} />
        </View>
      </ScrollView>
    </Schermata>
  );
}

const stili = StyleSheet.create({
  centro: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: spazio.xl },
  pannello: {
    width: '100%',
    maxWidth: 460,
    borderWidth: 1,
    borderRadius: raggio.lg,
    padding: spazio.xl,
    gap: spazio.lg,
  },
});
