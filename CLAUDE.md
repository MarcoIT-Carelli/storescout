# StoreScout — Istruzioni per Claude Code

Leggi anche `SPEC_APP_ISPETTORI.md`, che contiene la specifica funzionale completa, lo schema
del database e i flussi delle schermate. Questo file contiene le regole di lavoro.

## Il progetto

App Android per tablet che sostituisce un modulo Excel usato dagli ispettori di area vendita
di Carelli Distribuzione. L'ispettore compila la scheda dentro il punto vendita, raccoglie due
firme e invia il PDF via email a più destinatari.

Chi la usa è **in piedi in un supermercato, con il tablet in una mano**. Non è un utente
tecnico: viene dall'Excel e dalla carta. Ogni scelta di interfaccia deve tenerne conto.

## Stack

React Native con Expo (managed) e TypeScript · expo-router · Supabase per database,
autenticazione, storage ed Edge Functions · expo-sqlite per le bozze locali ·
expo-print per il PDF · EAS Build e EAS Update · distribuzione APK diretta, non Google Play.

## Regole di lavoro

**Fermati quando serve un'azione che solo l'utente può fare.** Non hai accesso al dashboard
Supabase, ai secret di GitHub, all'account Expo né alle credenziali Aruba. Quando
un'implementazione dipende da una di queste, interrompi il lavoro, spiega in una riga cosa
serve e rimanda al passo preciso della guida. Non proseguire con valori inventati, segnaposto
o credenziali scritte nel codice in attesa di sostituzione.

I punti in cui questo succede sono noti in anticipo:

| Quando | Cosa deve fare l'utente | Dove |
|---|---|---|
| Milestone 1, dopo il primo push | attivare il keep-alive: creare i secret `SUPABASE_URL` e `SUPABASE_ANON_KEY` e copiare `keep-alive.yml` | guida Supabase, passo 10 |
| Milestone 1, dopo il primo push | attivare il backup: quattro secret, fra cui la stringa Session pooler e la chiave `service_role` | guida Supabase, passo 11 |
| Milestone 8, prima di scrivere la Edge Function | `supabase login`, `supabase link` e impostare i secret SMTP Aruba | guida Supabase, passo 12 |
| Milestone 8 | fornire le email dei sette destinatari attività e l'indirizzo mittente | specifica, §14 |

Quando arrivi a uno di questi punti, dillo esplicitamente e aspetta conferma che sia stato
fatto prima di continuare.

**Una milestone alla volta.** Al termine fermati e aspetta la verifica prima di proseguire.
Non anticipare milestone successive anche se sembra efficiente.

**Non inventare campi né tabelle.** Lo schema è quello in `SPEC_APP_ISPETTORI.md`, già
applicato su Supabase. Se serve una colonna che non c'è, fermati e chiedi invece di aggiungerla.

**Le liste valori arrivano dal database**, mai scritte nel codice. Destinatari, reparti e tipi
di intervento sono modificabili dall'admin a runtime.

**Nessun segreto nel codice.** Solo `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY`
dal `.env`. La chiave `service_role` e le credenziali SMTP vivono esclusivamente nelle Edge
Function Secrets. Se un'implementazione sembra richiedere un segreto nell'app, l'approccio è
sbagliato: fermati e segnalalo.

**Ogni operazione di rete ha tre stati** — in corso, riuscita, fallita — e tutti e tre visibili
all'utente. Un errore di rete non deve mai far perdere dati inseriti.

**Ogni azione distruttiva chiede conferma**: eliminare una riga, cancellare una firma, svuotare
un blocco. La conferma è un banner in linea, non una finestra modale.

## Interfaccia

Nome dell'app: **StoreScout**.

```
nero            #111111
giallo          #FFC72C
giallo premuto  #E5A800
superficie      #FFFFFF
superficie alt  #F7F7F5
bordo           #E3E3E0
testo           #111111
testo secondario#6B6B66
successo        #1D9E75
attenzione      #BA7517
errore          #C0392B
```

Definisci questi valori una volta in `src/theme/` e riferisciti sempre a quelli.

### `flex: 1` dentro un componente: il difetto che si ripete

Un componente non sa se lo stanno mettendo in una riga o in una colonna, quindi **non deve
darsi `flex: 1` da solo**. In riga è giusto, i campi si dividono la larghezza. In colonna fa
dividere l'altezza di un contenitore che altezza propria non ne ha: il contenitore collassa a
zero e i figli continuano a disegnarsi, accavallandosi.

Sotto `SOGLIA_LARGA` (900) parecchie righe diventano colonne, e **un tablet in verticale è
800 punti**: non è un caso di nicchia, è il dispositivo vero nell'orientamento che la
specifica richiede. Il difetto è stato trovato in `Select`, `CampoData`, `SignaturePad` e
nelle voci del riepilogo — cioè anche nella schermata delle firme, la peggiore in cui
sbagliare.

La dimensione la dichiara chi dispone i campi, con un prop `contenitore`. Quando si aggiunge
una schermata con dei filtri o una griglia, va pensata **anche stretta**.

### I campi di testo si scrivono con la S Pen

I tablet in campo hanno una S Pen, e la tastiera software si prende metà schermo proprio
mentre serve vedere il campo che si sta compilando. I campi di testo libero compilati in
punto vendita portano quindi `penna` su `TextField`: la tastiera non compare al tocco e un
pulsante **Tastiera** dentro il campo la richiama per chi preferisce digitare.

Sono i campi della scheda (note, scadenza generica, note sulla scadenza, attività svolte) e
quelli delle firme (nome del responsabile, motivo dell'assenza). **Login, cambio password e
pannello admin restano con la tastiera normale**: lì si digita e basta, e nasconderla
sarebbe un ostacolo.

Riaprire la tastiera richiede un `blur()` seguito da `focus()`: Android valuta
`showSoftInputOnFocus` al momento del fuoco, quindi cambiarlo su un campo già attivo non
ha alcun effetto. Il `blur()` intermedio non va scambiato per un'uscita dal campo, altrimenti
la modalità penna si riattiva un istante dopo averla tolta.

**Il giallo non è mai colore di testo su fondo chiaro.** Solo riempimento con testo nero sopra,
o marchio su fondo nero. Gli usi ammessi sono cinque, e non se ne aggiungono altri senza
motivo: pulsante primario, indicatore di ispezione in corso, marchio, **testata delle
schermate di amministrazione** e **sigla del punto vendita nella sua anagrafica**.

Gli ultimi due servono a separare a colpo d'occhio la configurazione dal lavoro sul campo:
l'ispettore in negozio non deve confondere una schermata di impostazioni con la scheda che
sta compilando. La testata gialla si chiede con `tinta="giallo"` su `Schermata`, che porta
titolo, sottotitolo e freccia a nero da soli.

`Badge` ha `alignSelf: 'flex-start'`, che serve quando sta in colonna ma dentro una riga
vince sull'`alignItems: 'center'` e lo incolla in alto. In una riga con dei pulsanti accanto
va avvolto in un contenitore (`stili.pillole`), altrimenti resta disallineato.

Aree toccabili di almeno 48dp. Corpo del testo da 15px in su, etichette da 13px in su.
Layout funzionante sia in orizzontale sia in verticale. Nessun effetto legato al passaggio del
mouse, perché non esiste il puntatore.

## Da evitare

- Tabelle a cinque o più colonne: su tablet costringono a campi troppo stretti. Usa schede.
- Eliminazione fisica degli ispettori: solo disattivazione, altrimenti si perde lo storico.
- Modifica di ispezioni già concluse: sono documenti firmati e inviati.
- Librerie aggiuntive senza motivo. Se ne serve una, spiega perché prima di installarla.
- Commenti che ripetono il codice. Commenta solo il non ovvio.

## Convenzioni

Interfaccia e messaggi all'utente in **italiano**. Nomi di variabili, funzioni e file in
inglese, tranne i termini di dominio già definiti nello schema (`ispezione`, `pdv`,
`destinatario`, `reparto`), che restano in italiano per coerenza con il database.

Componenti funzionali con hook. Tipi generati da Supabase in `src/types/`. Nessun `any`.

## Stato

Aggiornato all’8 settembre 2026.

**Milestone 1 — setup.** Completata. Progetto Expo SDK 57 con TypeScript ed expo-router creato
nella cartella; Supabase configurato con schema, policy RLS e dati di seed (47 punti vendita,
liste valori). Emulatore Android tablet `StoreScout_Tablet` (1280x800, Android 15) creato in
`%LOCALAPPDATA%\Android\Sdk`; istruzioni di avvio in fondo al `README.md`.

**Milestone 2 — autenticazione.** Completata. Login, sessione persistente con refresh
automatico, blocco degli account disattivati, cambio password obbligatorio, reset password.

**Milestone 3 — anagrafiche.** Completata. Selezione punto vendita con ricerca su sigla, città
e indirizzo, filtro per insegna e sezione recenti. Liste valori lette dal database con copia
locale per l'uso senza rete.

**Milestone 4 — form ispezione.** Completata. Testata con ora di ingresso modificabile, blocco
attività rilevate a schede, blocco attività svolte, ingrigimento e conferme in linea.

**Milestone 5 — bozze locali.** Completata. SQLite con salvataggio ritardato di 800 ms e
ripristino della scheda dalla home.

**Milestone 6 — firme.** Completata. Canvas con PanResponder e react-native-svg, esportazione
PNG a 800 px con react-native-view-shot, caricamento su Storage.

**Milestone 7 — PDF.** Completata. Template HTML in `src/pdf/template.ts` reso con expo-print e
archiviato in `schede/{anno}/{mese}/{numero}_{codice}.pdf`. Le misure della pagina vanno passate
a `printToFileAsync`: expo-print ignora `@page size` e senza quelle produce US Letter al posto
di A4.

**Collaudo end-to-end.** Fatto piu' volte, prima sull'emulatore e poi sui dispositivi veri.
I dati di prova sono stati eliminati e il progressivo delle ispezioni riazzerato con
`alter sequence ispezioni_numero_seq restart with 1`: cancellare le righe non basta, il
contatore e' una sequenza separata.

**Milestone 8 — invio email.** Completata. `supabase/functions/invia-scheda` compone i
destinatari secondo §8.1, scarica il PDF da Storage, spedisce via SMTP Aruba e registra
l'esito in `invii_email` portando l'ispezione a `inviata` o `errore_invio`. L'app la chiama
al termine della conclusione e dal pulsante "Riprova invio".

Tre trappole emerse collaudando, da non reintrodurre:

- **Un invio fallito risponde `200`**, non `502`. È un esito previsto, non un errore di
  trasporto: con un codice non-2xx il client Supabase avvolge la risposta in un errore
  generico e il messaggio vero non arriva mai a schermo. Restano non-2xx solo gli errori
  di autorizzazione.
- **Il corpo della risposta d'errore va clonato prima di leggerlo**: il client può averlo
  già consumato, e `context.json()` fallisce in silenzio.
- **Il PDF si codifica con `encodeBase64` di `@std/encoding`**, mai concatenando carattere
  per carattere: su un allegato da un centinaio di KB la Edge Function esaurisce le risorse.

Restano da inserire cinque dei sette indirizzi dei destinatari, dal pannello admin. Quelli
senza indirizzo non ricevono, e il riepilogo lo segnala prima di concludere.

**Milestone 9 — storico.** Completata. Elenco con ricerca testuale, filtro per punto vendita e
per intervallo di date; punto vendita e periodo filtrano sul server, la ricerca resta locale.
La scheda conclusa si riapre in sola lettura con attività rilevate, attività svolte e link al
PDF: è la stessa schermata che compare dopo l'invio, perché un documento firmato non si
modifica e non serve una seconda vista.

**Milestone 10 — pannello admin.** Completata, in `app/(admin)/`. L'accesso è riservato al ruolo
admin sia dal menu utente sia dal layout della rotta.

- *Liste valori*: fatta. Destinatari con indirizzo email, reparti e tipi di intervento;
  aggiunta, rinomina, riordino con frecce e disattivazione. Le voci non si eliminano mai:
  le ispezioni archiviate puntano all'id e devono restare leggibili. Un avviso conta i
  destinatari attivi ancora senza indirizzo, che è il dato che blocca la milestone 8.
- *Ispettori*: fatta. Creare un utente richiede la chiave `service_role`, che non può stare
  nell'app: ci pensa la Edge Function `gestisci-ispettori`, che verifica il chiamante e poi
  chiama `auth.admin.createUser`. È deployata e risponde 401 a chi non è admin attivo.
  Rinomina, cambio ruolo e attiva/disattiva passano invece dalla sola chiave anon, perché su
  `profili` la policy di update per gli admin c'è già.
- *Punti vendita*: fatta. Anagrafica completa e importazione CSV. L'import **non scrive mai
  al primo colpo**: produce un'anteprima con quante righe sono nuove, quante aggiornano e
  quali sono scartate e perché, e solo dopo conferma tocca il database — un file sbagliato
  riscriverebbe altrimenti quarantasei anagrafiche in silenzio. L'aggiornamento tocca solo
  le colonne presenti nel file, così un CSV parziale non azzera i dati che non contiene.
  L'intestazione accetta sia `ragione_sociale` sia `insegna`; una colonna `provincia` viene
  ignorata e segnalata, perché nello schema non esiste e non serve.
- *Ispezioni ed export*: fatta. Per un admin questa sostituisce lo storico anche nel menu
  utente: erano due schermate che facevano la stessa cosa. Lo storico in sola lettura resta
  agli ispettori. Tutte le ispezioni di tutti gli ispettori, filtrabili per
  punto vendita, ispettore, stato e periodo, con ricerca locale su sigla, città e numero.
  Apertura del PDF, riprova dell'invio e reinvio di una scheda già partita — che chiede
  conferma, perché rispedisce davvero a tutti. Export CSV di quello che si vede.

  È l'unica schermata che mostra le **bozze rimaste sul server**, e l'unica da cui si
  eliminano: lo storico le esclude e l'elenco dell'ispettore viene da SQLite. Nascono da una
  conclusione interrotta a metà — testata e righe salvate, firme no — ed è esattamente il
  caso riprodotto in collaudo togliendo la rete un secondo dopo «Concludi». Eliminando la
  bozza si tolgono anche le eventuali firme orfane su Storage.

**Milestone 11 — build e OTA.** Completata. Progetto Expo `@carelli-distribuzione/storescout`,
intestato a un'organizzazione e non a una persona: là dentro vive la chiave di firma, e un
account personale irraggiungibile bloccherebbe per sempre gli aggiornamenti dell'app già
installata. APK distribuito a mano dalla pagina della build, aggiornamenti del solo
JavaScript via `eas update`.

Quattro cose imparate a caro prezzo, tutte da non rifare:

- **Il profilo di produzione forza `buildType: apk`.** Il valore predefinito di EAS per
  Android è `.aab`, che serve al Play Store e **non si installa su un tablet**.
- **`node` è fissato a 24.16.0 in `eas.json`.** EAS gira su Node 22 con npm 10, questo PC su
  Node 24 con npm 11, e i due risolvono diversamente un conflitto vero fra dipendenze
  indirette: `expo-modules-core` vuole `react-native-worklets` fino alla `^0.10`, mentre
  `@expo/ui` e reanimated pretendono la `0.12`. npm 11 issa la 0.12 e la marca invalid, npm
  10 pretende una copia annidata che nel lockfile non c'è, e `npm ci` — che EAS usa e che non
  perdona — si rifiuta. Nessuna delle due librerie viene usata: reanimated è esclusa
  dall'autolinking e l'app monta solo `Stack`.
- **Le variabili `EXPO_PUBLIC_*` non stanno nel repository**: vivono sul progetto Expo
  (`eas env:list --environment production`). Il server di build non legge il `.env` locale.
- **`platforms: ["android"]` va dichiarato**, altrimenti `eas update` prova a compilare anche
  il web e si ferma chiedendo `react-native-web`.

**Modifiche di settembre 2026.** Otto richieste del committente, affrontate a gruppi.
Fatto finora, revisione `0.0.10`:

- *Campi per la S Pen*: note dell'attività a quattro righe, righe delle attività svolte a
  due, tastiera che non compare da sola e pulsante per richiamarla. Vedi la sezione
  sull'interfaccia. **Da collaudare sul tablet con la penna vera**: che la scrittura a mano
  resti attiva con `showSoftInputOnFocus={false}` è quanto ci si aspetta dal comportamento
  di sistema, non qualcosa che sia stato visto funzionare.
- *Orari non modificabili*: ingresso e uscita li registra l'app. L'uscita è ora l'istante in
  cui si preme «Concludi ispezione», non quello in cui compare il riepilogo: fra i due passa
  il tempo di far firmare, e senza la correzione a mano quel divario sarebbe finito nel
  documento senza rimedio. Contraddice il §6.4 della specifica, aggiornato di conseguenza.

- *Voto e rotture di stock* (revisione `0.0.11`): due colonne nuove su `ispezioni`, `voto`
  (1–5) e `rotture_stock_promo`. Entrambe nullable sul database, perché le ispezioni già
  archiviate non le hanno e inventare un valore per una scheda firmata mesi fa sarebbe
  peggio di lasciarla vuota; il voto è obbligatorio nell'app, che blocca la conclusione
  finché manca. Il selettore sta nel riepilogo, sulla stessa schermata del pulsante che
  blocca: farlo tornare indietro di una schermata per una cifra sarebbe stato un attrito
  gratuito. **Nel PDF compare solo la cifra**, senza il giudizio a parole: quello vive
  nell'app per confermare la scelta a chi la fa, mentre in un documento che gira per
  uffici aggiungerebbe un'interpretazione dove serve un dato.

Una bozza salvata da una versione precedente arriva senza i campi aggiunti dopo, quindi
`leggiBozza` la fa passare da `normalizzaBozza`: senza, quei campi resterebbero `undefined`,
e un `undefined` al posto di `null` fa fallire la conclusione di una scheda già firmata.

- *Visibilità dei punti vendita* (revisione `0.0.12`): tabella `ispettore_pdv` e policy in
  `04_visibilita_pdv.sql`. Un ispettore senza assegnazioni non vede niente e non può aprire
  schede: la visibilità si apre con un atto esplicito, non per dimenticanza.

  La restrizione è **vera, non di facciata**: sta nelle policy RLS, non nel filtro
  dell'elenco. Un elenco filtrato lato app è una comodità che chi sa parlare con le API
  aggira, quindi anche la insert su `ispezioni` verifica l'assegnazione.

  Lettura e scelta però non coincidono, ed è voluto. La policy di select su `pdv` lascia
  leggere anche i punti vendita **su cui l'ispettore ha già delle ispezioni**: senza quella
  eccezione, revocare un'assegnazione renderebbe illeggibile il suo storico, che mostrerebbe
  «punto vendita non disponibile» al posto di sigla e città su schede già firmate e spedite.
  Per aprire una scheda nuova serve invece l'assegnazione, e la differenza fra i due insiemi
  vive in `useListe`: `liste.pdv` è ciò che si legge, `pdvSelezionabili` ciò su cui si può
  cominciare. **Chi aggiunge una schermata che sceglie un punto vendita usi il secondo.**

- *Verifica delle attività CN* (revisione `0.0.13`): `05_verifica_cn.sql`. Una scheda con
  attività assegnate a un destinatario marcato `richiede_verifica` non si considera chiusa
  quando parte la mail: resta in carico all'ispettore, in prima pagina sotto «Da chiudere»,
  finché non è lui a dichiararla conclusa.

  **Il destinatario si riconosce da un flag, non dal nome.** Le liste valori si modificano
  a runtime, quindi un `nome === 'CN'` nel codice si romperebbe in silenzio alla prima
  rinomina, e non permetterebbe di aggiungerne un secondo. Il flag si accende dal pannello
  liste, e il seed lo mette su CN.

  `in_verifica` è una colonna a parte e non un valore di `stato_ispezione`: una scheda può
  essere insieme «inviata» e «da chiudere», e schiacciare i due significati in un enum solo
  farebbe perdere la traccia di un invio fallito mentre è in verifica.

  Chiudere la verifica passa dalla funzione `chiudi_verifica`, non da un update: la policy
  di `ispezioni` si ferma alle bozze — una scheda firmata non si tocca — e allargarla per
  un solo campo aprirebbe l'intera riga, perché **le policy non distinguono fra colonne**.

  Il promemoria arriva in due modi perché le scadenze sono di due tipi. Con una data si
  aspetta che arrivi e lo si dice in home. Una scadenza scritta a parole non ha niente da
  confrontare, quindi si aggancia al luogo invece che al tempo e ricompare all'ispezione
  successiva su quel punto vendita: «al prossimo ordine» si verifica quando si rientra in
  quel negozio, non a una data che nessuno ha fissato.

- *Foto sulle attività* (versione `1.1.0`): `06_foto_attivita.sql`, bucket `foto` da creare
  a mano, e le librerie `expo-image-picker` ed `expo-image-manipulator`.

  **Questo gruppo è l'unico che non viaggia via `eas update`**: porta due moduli nativi e
  il permesso `CAMERA`, quindi richiede un APK nuovo. Per questo `version` in `app.json`
  è salita a `1.1.0`: con il criterio `appVersion` è quel numero a fare da `runtimeVersion`,
  e lasciarlo fermo servirebbe aggiornamenti JavaScript che chiamano un modulo nativo
  assente a installazioni che non ce l'hanno — cioè un crash all'apertura della fotocamera.

  La foto viene ridotta a 1600 px di lato lungo **sul dispositivo, prima di essere
  salvata**: il vincolo non è lo spazio su Storage ma il peso massimo di un messaggio di
  posta, e dodici megapixel appena usciti dalla fotocamera sono tre megabyte l'uno. Ridotta
  pesa circa 400 KB e mostra comunque uno scaffale o una scadenza sull'etichetta. Il tetto
  di 15 MB per scheda resta come rete di sicurezza — Aruba accetta 25 MB, ma il base64
  aggiunge un terzo — e con questi numeri non dovrebbe scattare quasi mai.

  Il controllo sta in due punti e non è una ripetizione inutile: `validaBozza` blocca la
  conclusione con le foto ancora togliibili, mentre la Edge Function si difende da sola
  perché una scheda vecchia rispedita a mano non passa da quella validazione. Là il
  comportamento è diverso: allega finché sta nel limite e scrive nel corpo quante foto ha
  lasciato fuori, perché un documento firmato deve arrivare comunque e chi lo riceve deve
  sapere che cosa manca.

  `ispezione_foto` tiene anche il peso in byte. Chiederlo allo Storage foto per foto al
  momento dell'invio vorrebbe dire scoprire il problema quando è troppo tardi.

Resta da fare: nulla dei gruppi richiesti. Prima del rilascio — che richiedono un APK nuovo, non un `eas update`, perché portano un modulo
nativo e il permesso `CAMERA`. Il rilascio è previsto per la settimana del 15 settembre
2026, e le foto entrano in quell'APK: distribuirlo a mano su ogni tablet è un giro che
conviene fare una volta sola.

### La chiave di firma

Generata da EAS e custodita là. È l'unica cosa irreversibile del progetto: senza, nessuno può
più pubblicare un aggiornamento che si installi sopra l'app già sui tablet — Android rifiuta
un APK con firma diversa, e l'unica via sarebbe disinstallare, perdendo le bozze locali.

Una copia scaricata sta in `@carelli-distribuzione__storescout.jks`, coperta da `*.jks` in
`.gitignore`. **Il file da solo non basta**: servono anche password del keystore, alias e
password della chiave, che si leggono con `eas credentials` e vanno conservate a parte.

### Aggiornamenti: due numeri diversi, e non vanno confusi

`version` in `app.json` (oggi `1.0.0`) determina la `runtimeVersion` con il criterio
`appVersion`: è quel numero a far incontrare un aggiornamento con le installazioni esistenti.
**Si alza solo quando si distribuisce un APK nuovo.** Alzarlo per una correzione al solo
JavaScript taglierebbe fuori i tablet già in mano agli ispettori, che resterebbero a cercare
aggiornamenti per una versione che nessuno pubblica più.

`REVISIONE` in `src/lib/versione.ts` è il contenuto, si alza a ogni `eas update` e compare in
fondo alla schermata iniziale. Accanto, `NOVITA` elenca che cosa è cambiato per revisione: il
riepilogo compare una volta sola dopo l'aggiornamento, e mai a chi installa l'app per la prima
volta.

Con una versione vecchia **non si lavora**: lo sbarramento sta nella radice dell'app, scarica
da sé e non ha via d'uscita. Scatta però solo se l'aggiornamento è stato trovato davvero, cioè
se la rete c'era: bloccare un ispettore appena entrato in un magazzino senza campo sarebbe il
modo peggiore di applicare la regola.

Il canale è **scritto dentro l'APK** al momento della compilazione: quell'APK cercherà
aggiornamenti sul canale `production` per sempre, e non è modificabile dopo.

Solo JavaScript e immagini viaggiano via rete. Una libreria nuova, un permesso, un cambio di
SDK richiedono un APK nuovo e il giro a mano su ogni tablet.

### Il formato dell'export

**Punto e virgola, non virgola.** Excel in italiano apre un CSV separato da virgole tutto
dentro la prima colonna, e chi lo riceve pensa che l'export sia rotto. Per lo stesso motivo
il file comincia con il BOM: senza, gli accenti arrivano storpiati.

**Una riga per attività rilevata**, con i dati dell'ispezione ripetuti accanto: è la forma
che le tabelle pivot si aspettano. Un'ispezione senza rilievi produce comunque la sua riga,
con le colonne dell'attività vuote, così dall'export non sparisce nessuna visita.

L'export riguarda **quello che si vede**, filtri compresi, e si ferma alle 500 ispezioni più
recenti come l'elenco. Quando le tocca, la schermata lo dice: un export che tronca in
silenzio sarebbe peggio di uno che non c'è.

### Eliminare le ispezioni: la policy che la specifica non elenca

Il §4.2 elenca per `ispezioni` solo le policy di select, insert e update. Sul database vero
**una policy di delete c'è** — verificato eliminando una bozza dal pannello — e non è
documentata da nessuna parte. È servita a suo tempo per ripulire i dati di collaudo.

L'app non ci si appoggia: `eliminaBozza` aggiunge `.eq('stato','bozza')` alla richiesta, così
una scheda firmata non è cancellabile dall'app anche se il database lo permettesse. E ogni
delete chiede indietro le righe toccate con `.select()`: senza policy PostgREST risponde
«fatto» senza togliere niente, e un'eliminazione che non elimina deve dirlo invece di far
sparire la voce fino al prossimo aggiornamento. Stesso inciampo già visto su
`storage.objects`.

Se un domani si vuole che nemmeno un admin possa cancellare un documento firmato, la policy
va ristretta sul database: dal client non si può garantire.

### Altro da fornire

- Nomi dei responsabili di punto vendita (`pdv.responsabile_nome`, oggi vuoto).
- Elenco degli ispettori con le rispettive email.
- Le email di cinque destinatari attività su sette: CN, CATEGORY, UFFICIO MKTG,
  UFFICIO TECNICO, UFFICIO HACCP. Si inseriscono dal pannello.

### Il punto vendita EC

L'ultima riga di `pdv_seed.csv` è `EC` (e-commerce): non ha indirizzo né email, e lo schema
richiede `indirizzo not null`. L'importazione lo scarta con il motivo scritto in chiaro,
invece di far fallire l'intero file. Nel database non c'è: i punti vendita sono 46, non 47.
Se un domani va gestito davvero, serve decidere che indirizzo dargli — non aggiungere una
colonna nullable, perché ogni altra scheda un indirizzo ce l'ha.

### Note sul logo del PDF

La testata della scheda usa il logo aziendale (NegoziOk / PrimoPrezzo), incorporato come
data URI in `src/pdf/logoAziendale.ts` e generato da `logo.jpg` nella cartella di progetto.
Il file va rigenerato, non modificato a mano. Serve un data URI perché expo-print rende
l'HTML sul dispositivo, spesso senza rete: un riferimento a file o a URL non verrebbe
risolto. Il marchio StoreScout resta l'identità dell'app, non del documento.

### Password: si gestiscono nell'app, non per email

**La posta serve a consegnare le schede, non a far entrare le persone.** Le due strade
sono entrambe dentro l'app:

1. **Cambio volontario** — menu utente, *Cambia password*: attuale, nuova, ripeti.
   La password attuale viene verificata rientrando con le vecchie credenziali, perché
   Supabase non la richiede per sostituirla e la sessione da sola non basta su un tablet
   che gira per il negozio.
2. **Password dimenticata** — l'admin la riassegna dal pannello ispettori, la comunica a
   voce, e l'app obbliga a sostituirla al primo accesso. Nessuna casella di posta
   coinvolta: gli ispettori sul tablet la posta non ce l'hanno.

La schermata `(auth)/reimposta-password` resta ma **non è raggiungibile dall'app**: copre
il solo caso in cui l'unico amministratore resti fuori e non ci sia nessuno che possa
riassegnargli la password. In quel caso si manda un link di recupero dalla dashboard
Supabase, e perché arrivi a destinazione il Site URL deve essere
`storescout://reimposta-password`.

Le password non stanno in `profili`: vivono in `auth.users` come hash bcrypt e non sono
leggibili da nessuno, nemmeno con la chiave `service_role`. L'unica password che un
amministratore vede è quella che ha appena generato lui per un nuovo ispettore.

### Moduli nativi esclusi dall'autolinking

`react-native-gesture-handler` e `react-native-reanimated` sono esclusi in `package.json`
sotto `expo.autolinking.exclude`. Arrivano come dipendenze transitive di `expo-router`,
non vengono usati — l'app monta solo `Stack`, niente Drawer né Tabs — e il percorso dei
loro file oggetto supera i 260 caratteri ammessi da Windows, il che blocca la build locale.
Non è un capriccio: abilitare i percorsi lunghi nel registro non risolve, perché il `ninja`
incluso in CMake dell'SDK Android non dichiara la compatibilità nel proprio manifest
(verificato sui binari di 3.22.1 e 3.31.0). Su EAS Build, che compila su Linux, il problema
non esiste: se un giorno servissero davvero, l'esclusione va tolta solo lì.

### Rotte: un solo `index` per tutta l'app

I gruppi fra parentesi di expo-router **non compaiono nell'URL**. Due file `index.tsx` in
gruppi diversi finiscono quindi sullo stesso percorso `/`, e il router non ha modo di
sapere quale si intenda. È già successo con `(app)/index.tsx` e `(admin)/index.tsx`: l'app
ripartiva nell'area sbagliata e dopo il login entrava in ciclo di rimandi fino al crash,
ma solo da installazione pulita — con una sessione già salvata non si vedeva.

Per questo la schermata dell'area admin si chiama `amministrazione.tsx` e non `index.tsx`.
Regola: **un solo `index` in tutta `app/`**, quello della home.

Vale anche il principio che ne è emerso: di ogni rimando ci deve essere **un solo
responsabile**. La guardia del layout radice decide per chi non è autenticato; il layout
admin interviene solo su chi è autenticato ma non è amministratore. Due componenti che
rimandano insieme si rincorrono.

### Collaudo: l'emulatore non c'è più

Da settembre le prove le fa l'utente sui dispositivi veri — un telefono e un tablet — e le
correzioni arrivano come aggiornamenti via rete. Chi lavora al progetto scrive e rilegge, ma
**non dichiari fatto ciò che non ha visto funzionare**: lo dica, invece.

L'emulatore `StoreScout_Tablet` esiste ancora e le istruzioni sono in fondo al `README.md`.
Se torna in uso, la prima cosa da rifare è un giro di tutte le schermate a larghezza ridotta:
era il lato non collaudato, e ha nascosto difetti per mesi.

### Collaudo prima del rilascio

Provare l'app **da installazione pulita**, non solo su una già avviata:

```
adb shell pm clear it.carellidistribuzione.storescout
adb shell am start -n it.carellidistribuzione.storescout/.MainActivity
```

poi fare il login. È il percorso di un ispettore che riceve l'APK per la prima volta, ed è
l'unico in cui si è manifestato il crash da collisione di rotte.

### Policy mancanti su Storage

Il passo 6 della guida crea su `storage.objects` solo le policy di lettura e inserimento.
Senza quelle di `update` e `delete`, un caricamento ripetuto con `upsert: true` — cioè un
secondo tentativo dopo una conclusione fallita a metà — viene rifiutato, e nessuno può
eliminare firme o PDF. Le quattro policy da aggiungere sono nel passo corrispondente della
conversazione; vanno lanciate nel SQL Editor prima del rilascio.

### Limite noto sulle bozze

Una bozza salvata anche sul server e poi eliminata dal dispositivo lascia una riga
`ispezioni` in stato `bozza` che l'app non mostra più: l'elenco delle bozze viene solo da
SQLite. Ripescare una bozza dal server, per esempio su un altro tablet, non è previsto
in v1. Da tenere presente per il pannello admin della milestone 10, che dovrà poterle
vedere ed eliminare.
