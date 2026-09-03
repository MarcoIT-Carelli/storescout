import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Badge } from '@/components/Badge';
import { Card } from '@/components/Card';
import { Schermata } from '@/components/Schermata';
import { raggio, SOGLIA_LARGA, spazio, testo, useColori } from '@/theme';

type Sezione = {
  titolo: string;
  descrizione: string;
  percorso?: string;
  /** Motivo per cui la sezione non è ancora apribile. */
  bloccata?: string;
};

const SEZIONI: Sezione[] = [
  {
    titolo: 'Liste valori',
    descrizione:
      'Destinatari attività con i relativi indirizzi email, reparti e tipi di intervento. Le modifiche arrivano subito sui tablet, senza rilasciare una nuova app.',
    percorso: '/liste',
  },
  {
    titolo: 'Ispettori',
    descrizione:
      'Creazione, rinomina, reset password e disattivazione. Nessuna eliminazione: lo storico delle ispezioni deve restare leggibile.',
    bloccata:
      'Creare un utente richiede la chiave service_role, che non può stare nell’app: serve prima la Edge Function del passo 12 della guida Supabase.',
  },
  {
    titolo: 'Punti vendita',
    descrizione: 'Anagrafica completa e importazione da CSV, con aggiornamento dei record esistenti per codice.',
    bloccata: 'In lavorazione.',
  },
  {
    titolo: 'Ispezioni ed export',
    descrizione: 'Elenco filtrabile di tutte le ispezioni, download del PDF, reinvio email ed export in CSV.',
    bloccata: 'In lavorazione.',
  },
];

export default function Amministrazione() {
  const c = useColori();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const dueColonne = width >= SOGLIA_LARGA;

  return (
    <Schermata titolo="Amministrazione" sottotitolo="Configurazione dell’app" indietro>
      <ScrollView contentContainerStyle={stili.corpo}>
        <View style={[stili.griglia, !dueColonne && { flexDirection: 'column' }]}>
          {SEZIONI.map((s) => {
            const apribile = Boolean(s.percorso);
            return (
              <Pressable
                key={s.titolo}
                onPress={() => s.percorso && router.push(s.percorso as never)}
                disabled={!apribile}
                style={({ pressed }) => [
                  stili.cella,
                  dueColonne && { width: '48%' },
                  pressed && apribile && { opacity: 0.7 },
                ]}
                accessibilityRole="button"
                accessibilityState={{ disabled: !apribile }}
              >
                <Card style={{ opacity: apribile ? 1 : 0.55 }}>
                  <View style={stili.testataCella}>
                    <Text style={[testo.sezione, { color: c.testo, flex: 1 }]}>{s.titolo}</Text>
                    {apribile ? (
                      <Text style={[testo.sezione, { color: c.testoSecondario }]}>›</Text>
                    ) : (
                      <Badge testo="Non disponibile" />
                    )}
                  </View>
                  <Text style={[testo.piccolo, { color: c.testoSecondario, marginTop: spazio.sm }]}>
                    {s.descrizione}
                  </Text>
                  {s.bloccata ? (
                    <View style={[stili.motivo, { backgroundColor: c.attenzioneSfondo, borderColor: c.attenzione }]}>
                      <Text style={[testo.etichetta, { color: c.testo, fontWeight: '400' }]}>{s.bloccata}</Text>
                    </View>
                  ) : null}
                </Card>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </Schermata>
  );
}

const stili = StyleSheet.create({
  corpo: { padding: spazio.lg, paddingBottom: spazio.xxxl },
  griglia: { flexDirection: 'row', flexWrap: 'wrap', gap: spazio.lg },
  cella: { width: '100%' },
  testataCella: { flexDirection: 'row', alignItems: 'center', gap: spazio.sm },
  motivo: { marginTop: spazio.md, borderWidth: 1, borderRadius: raggio.md, padding: spazio.md },
});
