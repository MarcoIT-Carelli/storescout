import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Logo } from '@/components/Logo';
import type { Fase } from '@/hooks/useAggiornamenti';
import { spazio, testo, useColori } from '@/theme';

type Props = {
  fase: Fase;
  onRiprova: () => void;
};

/**
 * Lo sbarramento: finché c'è una versione più recente non si lavora.
 *
 * Copre tutto invece di stare in una schermata sola, perché il controllo parte
 * all'apertura e l'app potrebbe riaprirsi ovunque l'utente l'aveva lasciata. Non ha
 * una via d'uscita di proposito: se la si potesse chiudere non sarebbe uno
 * sbarramento, sarebbe un consiglio.
 *
 * Le bozze non corrono rischi: stanno in SQLite sul dispositivo e sopravvivono al
 * riavvio che l'aggiornamento comporta.
 */
export function SchermoAggiornamento({ fase, onRiprova }: Props) {
  const c = useColori();
  const fallito = fase === 'errore_scaricamento';

  return (
    <View style={[StyleSheet.absoluteFill, stili.pagina, { backgroundColor: c.sfondo }]}>
      <Logo larghezza={72} colore={c.marchio} />

      <View style={stili.testo}>
        <Text style={[testo.sezione, { color: c.testo, textAlign: 'center' }]}>
          {fallito ? 'Aggiornamento non riuscito' : 'Aggiornamento in corso'}
        </Text>
        <Text style={[testo.corpo, { color: c.testoSecondario, textAlign: 'center' }]}>
          {fallito
            ? 'Non è stato possibile scaricare la versione nuova. Controlla la rete e riprova: senza aggiornare non si può continuare.'
            : 'È uscita una versione più recente di StoreScout. Si installa da sola e l’app riparte fra pochi istanti.'}
        </Text>
      </View>

      {fallito ? (
        <Button titolo="Riprova" onPress={onRiprova} />
      ) : (
        <ActivityIndicator color={c.testoSecondario} />
      )}

      <Text style={[testo.piccolo, { color: c.testoDisabilitato, textAlign: 'center' }]}>
        Le schede lasciate a metà restano sul dispositivo: non si perde niente.
      </Text>
    </View>
  );
}

const stili = StyleSheet.create({
  pagina: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spazio.xl,
    padding: spazio.xxl,
  },
  testo: { gap: spazio.sm, maxWidth: 460 },
});
