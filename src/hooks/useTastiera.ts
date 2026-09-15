import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

/**
 * Quanto spazio si sta prendendo la tastiera, in punti. Zero quando è chiusa.
 *
 * Serve perché **su Android 15 la finestra non si restringe più** all'apertura della
 * tastiera: con il disegno a tutto schermo che questa app usa, la tastiera si sovrappone
 * al contenuto e basta. Uno `ScrollView` non ha quindi niente in più da scorrere, e i
 * campi che finiscono sotto restano irraggiungibili — è successo sul campo password
 * dell'accesso, dove in orizzontale non c'era modo di scrivere.
 *
 * `KeyboardAvoidingView` non risolve: il suo `behavior` presuppone il vecchio
 * ridimensionamento. L'unica strada che funziona è misurare la tastiera e restituire
 * altrettanto spazio al contenuto:
 *
 * ```tsx
 * const tastiera = useTastiera();
 * <ScrollView contentContainerStyle={[stili.corpo, { paddingBottom: spazio.xxl + tastiera }]}>
 * ```
 *
 * Va aggiunto a ogni schermata con campi di testo che possano trovarsi in basso.
 */
export function useTastiera(): number {
  const [altezza, setAltezza] = useState(0);

  useEffect(() => {
    const su = Keyboard.addListener('keyboardDidShow', (evento) =>
      setAltezza(evento.endCoordinates.height),
    );
    const giu = Keyboard.addListener('keyboardDidHide', () => setAltezza(0));
    return () => {
      su.remove();
      giu.remove();
    };
  }, []);

  return altezza;
}
