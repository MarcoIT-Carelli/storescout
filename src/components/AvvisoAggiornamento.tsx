import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import type { StatoAggiornamento } from '@/hooks/useAggiornamenti';
import { raggio, spazio, testo, useColori } from '@/theme';

type Props = {
  stato: StatoAggiornamento;
  onAggiorna: () => void;
};

/**
 * Avviso che c'è una versione più recente. Banner nel flusso della pagina, non una
 * finestra: chi apre l'app sta per entrare in un punto vendita, e una domanda che
 * blocca lo schermo nel momento sbagliato si risponde a caso pur di toglierla.
 */
export function AvvisoAggiornamento({ stato, onAggiorna }: Props) {
  const c = useColori();
  if (stato === 'assente') return null;

  const fallito = stato === 'fallito';

  return (
    <View
      style={[
        stili.banner,
        {
          backgroundColor: fallito ? c.erroreSfondo : c.superficieAlt,
          borderColor: fallito ? c.errore : c.bordo,
        },
      ]}
    >
      <Text style={[testo.corpo, { color: c.testo, flex: 1, minWidth: 200 }]}>
        {fallito
          ? 'Non è riuscito a scaricare l’aggiornamento. Controlla la rete e riprova.'
          : stato === 'scaricamento'
            ? 'Sto scaricando la versione nuova. L’app si riavvia da sola quando ha finito.'
            : 'C’è una versione più recente di StoreScout.'}
      </Text>

      <Button
        titolo={fallito ? 'Riprova' : 'Aggiorna'}
        compatto
        inCorso={stato === 'scaricamento'}
        onPress={onAggiorna}
      />
    </View>
  );
}

const stili = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spazio.md,
    borderWidth: 1,
    borderRadius: raggio.md,
    padding: spazio.md,
  },
});
