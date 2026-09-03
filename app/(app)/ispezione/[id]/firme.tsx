import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/Button';
import { Schermata } from '@/components/Schermata';
import { SignaturePad } from '@/components/SignaturePad';
import { TextField } from '@/components/TextField';
import { useBozza } from '@/hooks/useBozza';
import { useListe } from '@/hooks/useListe';
import { SOGLIA_LARGA, raggio, spazio, testo, useColori } from '@/theme';

export default function Firme() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColori();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const stretto = width < SOGLIA_LARGA;

  const { pdvPerId } = useListe();
  const { bozza, caricamento, modifica, salvaSubito } = useBozza(id);

  if (caricamento || !bozza) {
    return (
      <Schermata titolo="Firme" indietro>
        <View style={stili.attesa}>
          {caricamento ? (
            <ActivityIndicator color={c.testoSecondario} />
          ) : (
            <Text style={[testo.corpo, { color: c.testoSecondario }]}>Bozza non trovata.</Text>
          )}
        </View>
      </Schermata>
    );
  }

  const pdv = pdvPerId(bozza.pdv_id);
  const senzaFirmaResponsabile = !bozza.firma_responsabile_uri;

  const avanti = async () => {
    await salvaSubito();
    router.push(`/ispezione/${bozza.id}/riepilogo`);
  };

  return (
    <Schermata
      titolo="Firme"
      sottotitolo={pdv ? `${pdv.codice} — ${pdv.citta}` : undefined}
      indietro
    >
      <ScrollView contentContainerStyle={stili.corpo} keyboardShouldPersistTaps="handled">
        <Text style={[testo.piccolo, { color: c.testoSecondario }]}>
          Raccogli la firma dell’ispettore e quella del responsabile del punto vendita. Se il
          responsabile non è presente, indica il motivo: la scheda resta valida.
        </Text>

        <View style={[stili.riquadri, stretto && { flexDirection: 'column' }]}>
          <SignaturePad
            etichetta="FIRMA ISPETTORE"
            valore={bozza.firma_ispettore_uri}
            onConferma={(uri) => modifica((b) => ({ ...b, firma_ispettore_uri: uri }))}
            onCancella={() => modifica((b) => ({ ...b, firma_ispettore_uri: null }))}
          />

          <View style={stili.colonna}>
            <SignaturePad
              etichetta="FIRMA RESPONSABILE PUNTO VENDITA"
              valore={bozza.firma_responsabile_uri}
              onConferma={(uri) => modifica((b) => ({ ...b, firma_responsabile_uri: uri }))}
              onCancella={() => modifica((b) => ({ ...b, firma_responsabile_uri: null }))}
            />
            <TextField
              etichetta="Nome e cognome del responsabile"
              value={bozza.nome_responsabile}
              onChangeText={(v) => modifica((b) => ({ ...b, nome_responsabile: v }))}
              placeholder="Chi firma per il punto vendita"
              autoCapitalize="words"
            />
          </View>
        </View>

        {senzaFirmaResponsabile ? (
          <View style={[stili.motivo, { borderColor: c.bordo, backgroundColor: c.superficieAlt }]}>
            <TextField
              etichetta="Motivo dell’assenza della firma"
              value={bozza.motivo_assenza_firma}
              onChangeText={(v) => modifica((b) => ({ ...b, motivo_assenza_firma: v }))}
              placeholder="es. responsabile assente, punto vendita chiuso"
              righe={2}
              aiuto="Compila solo se il responsabile non può firmare."
            />
          </View>
        ) : null}
      </ScrollView>

      <View style={[stili.barra, { backgroundColor: c.superficie, borderTopColor: c.bordo }]}>
        <Button titolo="Indietro" variante="secondario" onPress={() => router.back()} style={{ flex: 1 }} />
        <Button titolo="Vai al riepilogo" onPress={avanti} style={{ flex: 2 }} />
      </View>
    </Schermata>
  );
}

const stili = StyleSheet.create({
  attesa: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  corpo: { padding: spazio.lg, gap: spazio.lg, paddingBottom: spazio.xxl },
  riquadri: { flexDirection: 'row', gap: spazio.lg },
  colonna: { flex: 1, gap: spazio.md, minWidth: 260 },
  motivo: { borderWidth: 1, borderRadius: raggio.md, padding: spazio.md },
  barra: { flexDirection: 'row', gap: spazio.md, padding: spazio.lg, borderTopWidth: 1 },
});
