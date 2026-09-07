/**
 * Revisione del contenuto, da alzare a ogni pubblicazione con `eas update`.
 *
 * Non è la `version` di `app.json`, che resta `1.0.0` e non va toccata alla leggera:
 * con il criterio `runtimeVersion: appVersion` è quel numero a far incontrare un
 * aggiornamento con le installazioni esistenti. Alzarlo per una correzione al solo
 * JavaScript taglierebbe fuori i tablet già in mano agli ispettori, che resterebbero
 * a cercare aggiornamenti per una versione che nessuno pubblica più.
 *
 * La regola quindi è: `version` si alza solo quando si distribuisce un APK nuovo,
 * `REVISIONE` a ogni aggiornamento via rete.
 */
export const REVISIONE = '0.0.3';

/**
 * Che cosa è cambiato, per revisione. Compare una volta sola dopo l'aggiornamento.
 *
 * Va scritto per chi usa l'app, non per chi la scrive: l'ispettore vuole sapere che
 * cosa cambia sotto le sue dita, non quali file sono stati toccati. Una revisione
 * senza voci non mostra niente.
 */
export const NOVITA: Record<string, string[]> = {
  '0.0.3': [
    'Il numero di versione resta sempre visibile in fondo allo schermo, anche mentre scorri l’elenco delle ispezioni.',
  ],
  '0.0.2': [
    'Nel menu in alto a destra c’è «Cerca aggiornamenti»: prima bisognava chiudere e riaprire l’app per sapere se ce n’era uno.',
    'Adesso l’app risponde anche quando non c’è niente da scaricare, invece di restare muta.',
  ],
  '0.0.1': [
    'In fondo alla prima schermata ora si vede il numero di versione dell’app.',
    'Quando esce una versione nuova, l’app te lo segnala appena la apri, con il pulsante per installarla.',
    'Dopo ogni aggiornamento compare un riepilogo come questo, per sapere che cosa è cambiato.',
  ],
};
