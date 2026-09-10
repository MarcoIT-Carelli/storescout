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
export const REVISIONE = '1.1.3';

/**
 * Che cosa è cambiato, per revisione. Compare una volta sola dopo l'aggiornamento.
 *
 * Va scritto per chi usa l'app, non per chi la scrive: l'ispettore vuole sapere che
 * cosa cambia sotto le sue dita, non quali file sono stati toccati. Una revisione
 * senza voci non mostra niente.
 */
export const NOVITA: Record<string, string[]> = {
  '1.1.3': [
    'Ogni ufficio riceve ora una mail con le sole attività assegnate a lui: l’ufficio tecnico non legge più le righe del marketing.',
    'Il punto vendita, gli indirizzi in copia fissa e tu continuate a ricevere la scheda completa, con tutte le righe e le firme.',
    'Alla conclusione l’app prepara una copia per ogni ufficio coinvolto: se la scheda ne tocca parecchi, il salvataggio dura qualche secondo in più.',
  ],
  '1.1.2': [
    'Creando un ispettore, l’indirizzo email parte già con @carellidistribuzione.it: basta scrivere il nome davanti.',
  ],
  '1.1.1': [
    'Assegnare i punti vendita a un ispettore ora si fa da una sola finestra con le caselle da spuntare, invece di aggiungerli uno alla volta.',
  ],
  '1.1.0': [
    'Su ogni attività rilevata c’è il pulsante giallo con la fotocamera: fino a tre foto per attività, che partono allegate alla mail insieme al PDF.',
    'Le foto vengono rimpicciolite da sole prima di essere salvate, così la mail non diventa troppo pesante per il server.',
    'Nella scheda già conclusa le foto si rivedono toccando la miniatura.',
  ],
  '0.0.13': [
    'Le schede con attività assegnate a CN non si chiudono con l’invio: restano in prima pagina sotto «Da chiudere» finché non confermi di aver verificato l’intervento.',
    'Quando la scadenza di una di queste attività arriva, la prima pagina te lo segnala.',
    'Se invece la scadenza è scritta a parole («al prossimo ordine»), il promemoria ricompare quando apri una nuova ispezione su quel punto vendita.',
  ],
  '0.0.12': [
    'Ogni ispettore vede soltanto i punti vendita di sua competenza: li assegna l’amministratore, e cambiano senza aggiornare l’app.',
    'Le ispezioni già fatte restano visibili nello storico anche se un punto vendita non è più fra i tuoi.',
  ],
  '0.0.11': [
    'Prima di concludere devi dare un voto alla visita, da 1 a 5: lo trovi nel riepilogo, sopra i destinatari. Senza voto la scheda non si chiude.',
    'In fondo alla scheda puoi indicare quante rotture di stock hai trovato sulla promo in sala.',
    'Il voto e le rotture finiscono nel PDF e nell’export delle ispezioni.',
  ],
  '0.0.10': [
    'Il campo delle note è più grande e la tastiera non compare più da sola: puoi scrivere direttamente con la penna. Se preferisci digitare, il tasto «Tastiera» dentro il campo la richiama.',
    'Stessa cosa per le righe delle attività svolte, per la scadenza generica e per i campi delle firme.',
    'Gli orari di ingresso e uscita non si modificano più a mano: li registra l’app. L’uscita è ora l’istante in cui premi «Concludi ispezione», non quello in cui apri il riepilogo.',
  ],
  '0.0.9': [
    'Con il tablet in verticale le due firme ora si vedono una sotto l’altra: prima si schiacciavano una sull’altra ed era difficile firmare.',
    'Stessa correzione per destinatario, reparto e tipo di intervento nella scheda, e per il riepilogo dell’ispezione conclusa.',
  ],
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
