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
export const REVISIONE = '0.0.8';

/**
 * Che cosa è cambiato, per revisione. Compare una volta sola dopo l'aggiornamento.
 *
 * Va scritto per chi usa l'app, non per chi la scrive: l'ispettore vuole sapere che
 * cosa cambia sotto le sue dita, non quali file sono stati toccati. Una revisione
 * senza voci non mostra niente.
 */
export const NOVITA: Record<string, string[]> = {
  '0.0.8': [
    'Sugli schermi stretti i filtri delle ispezioni ora si vedono incolonnati e leggibili: prima si accavallavano. La correzione precedente non aveva funzionato.',
    'Le ispezioni si aprono solo da Amministrazione: erano raggiungibili anche dal menu, ed era la stessa porta due volte.',
  ],
  '0.0.7': [
    'Sui telefoni e sugli schermi stretti i filtri delle ispezioni non si accavallano più: prima le caselle finivano una sopra l’altra e le scritte sparivano sotto.',
  ],
  '0.0.6': [
    'Quando esce una versione nuova l’app la installa da sé all’apertura, e fino ad allora non si può lavorare: così nessuna scheda parte da una versione superata.',
    'Le schede lasciate a metà restano sul dispositivo anche durante l’aggiornamento.',
  ],
  '0.0.5': [
    'Nei campi password c’è un occhio per vedere quello che stai scrivendo.',
    'Quando scegli una password nuova, tre tacche sotto il campo dicono se è debole, discreta o robusta.',
    'Nelle liste valori le voci si riordinano trascinandole dalla maniglia a sinistra, invece che con le frecce.',
  ],
  '0.0.4': [
    'Le schermate hanno tutte la stessa barra gialla in alto, invece di cambiare aspetto da una all’altra.',
    'I riquadri con la sigla del punto vendita sono gialli ovunque compaiano: nella home, nella scelta del negozio e nello storico.',
  ],
  '0.0.3': [
    'I pulsanti in fondo allo schermo — «Concludi ispezione», «Salva bozza» — non finiscono più sotto la barra del telefono.',
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
