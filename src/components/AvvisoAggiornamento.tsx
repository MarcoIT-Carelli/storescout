import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import type { StatoAggiornamento } from '@/hooks/useAggiornamenti';
import { raggio, spazio, testo, TOCCO_MIN, useColori } from '@/theme';

type Props = {
  stato: StatoAggiornamento;
  onAggiorna: () => void;
  onChiudi: () => void;
};

const MESSAGGI: Record<Exclude<StatoAggiornamento, 'assente'>, string> = {
  verifica: 'Sto controllando se c’è una versione più recente…',
  disponibile: 'C’è una versione più recente di StoreScout.',
  aggiornato: 'StoreScout è già aggiornato all’ultima versione.',
  scaricamento: 'Sto scaricando la versione nuova. L’app si riavvia da sola quando ha finito.',
  fallito: 'Non è riuscito a scaricare l’aggiornamento. Controlla la rete e riprova.',
};

/**
 * Avviso che c'è una versione più recente. Banner nel flusso della pagina, non una
 * finestra: chi apre l'app sta per entrare in un punto vendita, e una domanda che
 * blocca lo schermo nel momento sbagliato si risponde a caso pur di toglierla.
 */
export function AvvisoAggiornamento({ stato, onAggiorna, onChiudi }: Props) {
  const c = useColori();
  if (stato === 'assente') return null;

  const fallito = stato === 'fallito';
  const riuscito = stato === 'aggiornato';
  const conPulsante = stato === 'disponibile' || stato === 'scaricamento' || fallito;

  return (
    <View
      style={[
        stili.banner,
        {
          backgroundColor: fallito ? c.erroreSfondo : riuscito ? c.successoSfondo : c.superficieAlt,
          borderColor: fallito ? c.errore : riuscito ? c.successo : c.bordo,
        },
      ]}
    >
      <Text style={[testo.corpo, { color: c.testo, flex: 1, minWidth: 200 }]}>
        {MESSAGGI[stato]}
      </Text>

      {conPulsante ? (
        <Button
          titolo={fallito ? 'Riprova' : 'Aggiorna'}
          compatto
          inCorso={stato === 'scaricamento'}
          onPress={onAggiorna}
        />
      ) : null}

      {/* Solo gli esiti si chiudono: mentre sta lavorando non c'è niente da togliere. */}
      {riuscito || fallito ? (
        <Pressable
          onPress={onChiudi}
          hitSlop={8}
          style={stili.chiudi}
          accessibilityRole="button"
          accessibilityLabel="Chiudi l’avviso"
        >
          <Text style={{ color: c.testoSecondario, fontSize: 18 }}>✕</Text>
        </Pressable>
      ) : null}
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
  chiudi: {
    width: TOCCO_MIN,
    height: TOCCO_MIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
