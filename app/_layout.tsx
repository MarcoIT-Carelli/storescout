import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SplashAnimation } from '@/components/SplashAnimation';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { ListeProvider } from '@/hooks/useListe';
import { APERTURA, leggiTemaSalvato, ThemeProvider, useTema, type Preferenza, type Schema } from '@/theme';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [avvio, setAvvio] = useState<{ preferenza: Preferenza; ultimo: Schema } | null>(null);
  const [splashFinita, setSplashFinita] = useState(false);

  useEffect(() => {
    leggiTemaSalvato()
      .then(setAvvio)
      .catch(() => setAvvio({ preferenza: 'sistema', ultimo: 'chiaro' }));
  }, []);

  // La splash nativa resta visibile finché non si sa con quale tema l'app è stata chiusa:
  // così l'animazione parte già nella variante giusta, senza un lampo di colore sbagliato.
  // Il fondo della finestra viene allineato prima di scoprirla, altrimenti fra le due
  // schermate comparirebbe per un istante il nero predefinito di Android.
  useEffect(() => {
    if (!avvio) return;
    void SystemUI.setBackgroundColorAsync(APERTURA[avvio.ultimo].sfondo)
      .catch(() => {})
      .finally(() => SplashScreen.hideAsync());
  }, [avvio]);

  const fineSplash = useCallback(() => setSplashFinita(true), []);

  if (!avvio) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider preferenzaIniziale={avvio.preferenza}>
        <AuthProvider>
          <Contenuto />
        </AuthProvider>
        {splashFinita ? null : <SplashAnimation schema={avvio.ultimo} onFine={fineSplash} />}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function Contenuto() {
  const { colori, scuro } = useTema();
  const { caricamento, sessione, profilo } = useAuth();
  const segmenti = useSegments() as string[];
  const router = useRouter();

  const autenticato = Boolean(sessione && profilo?.attivo);
  const deveCambiare = Boolean(profilo?.deve_cambiare_password);

  useEffect(() => {
    if (caricamento) return;
    const gruppo = segmenti[0];

    // La reimpostazione via email gestisce da sé il proprio stato: apre una sessione di
    // recupero e poi rimanda dove serve. Se la guardia intervenisse, porterebbe l'utente
    // altrove proprio mentre sta scegliendo la nuova password.
    if (segmenti[1] === 'reimposta-password') return;

    if (!autenticato && gruppo !== '(auth)') {
      router.replace('/accedi');
    } else if (autenticato && deveCambiare && segmenti[1] !== 'nuova-password') {
      router.replace('/nuova-password');
    } else if (autenticato && !deveCambiare && gruppo === '(auth)') {
      router.replace('/');
    }
  }, [caricamento, autenticato, deveCambiare, segmenti, router]);

  return (
    <ListeProvider attivo={autenticato}>
      <StatusBar style={scuro ? 'light' : 'dark'} />
      {/* Lo Stack resta sempre montato: expo-router non accetta una navigazione
          richiesta prima che il navigatore radice esista. L'attesa è una velatura sopra. */}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colori.sfondo },
          animation: 'fade',
        }}
      />
      {caricamento ? (
        <View style={[StyleSheet.absoluteFill, stili.attesa, { backgroundColor: colori.sfondo }]}>
          <ActivityIndicator color={colori.testoSecondario} />
        </View>
      ) : null}
    </ListeProvider>
  );
}

const stili = StyleSheet.create({
  attesa: { alignItems: 'center', justifyContent: 'center' },
});
