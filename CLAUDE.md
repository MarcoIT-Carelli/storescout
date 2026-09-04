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
| Milestone 11 | account Expo, `eas login` e configurazione della build | guida progetto Expo, passo 7 |

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

Aggiornato al 4 settembre 2026.

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

**Collaudo end-to-end.** Fatto sull'emulatore con la build di rilascio: due ispezioni concluse
(n. 1 con attività rilevate, n. 2 con "Niente da rilevare"), firme caricate su Storage, PDF
generati in A4 e verificati nel contenuto. Sono dati veri sul progetto Supabase: vanno
eliminati quando non servono più.

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

**Milestone 11 — build e OTA.** Non iniziata. `app.json` è già predisposto (package
`it.carellidistribuzione.storescout`, icone, splash chiara e scura, `backgroundColor`), ma
manca `eas.json` e la configurazione dell'account Expo.

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
