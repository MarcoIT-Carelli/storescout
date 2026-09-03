# Prompt per Claude Design

Copia tutto il testo sotto la linea e incollalo in Claude Design.

Due note prima di farlo:

**Sul logo.** Carica `logo-ispettore-statico.svg` in Claude Design insieme al prompt: la
sezione "Identità visiva" gli dice come usarlo. Senza il file allegato userà un segnaposto.

**Su come usarlo.** Chiedi tutte le schermate in una volta sola: Claude Design mantiene
coerenza migliore all'interno di una singola generazione. Le modifiche le chiedi dopo, una
schermata alla volta.

---

Costruisci il layout HTML completo di **StoreScout**, un'applicazione Android per tablet
destinata agli ispettori di area vendita di una catena di supermercati. L'app sostituisce un modulo Excel
compilato a mano durante le visite nei punti vendita.

## Contesto d'uso

Chi la usa sta **in piedi dentro un supermercato**, con il tablet in una mano e spesso l'altra
occupata. Non è seduto a una scrivania. Compila la scheda mentre cammina tra i reparti, a volte
in magazzino con poca luce, a volte davanti al responsabile del punto vendita. Vuole finire in
pochi minuti. Non è un utente tecnico: viene dall'Excel e dalla carta.

Questo significa: aree toccabili grandi, testo leggibile a distanza di braccio, nessun campo
stretto, nessuna azione distruttiva senza conferma, e la possibilità di capire in ogni momento
su quale punto vendita si sta lavorando.

## Formato

- Tablet, **1280×800 in orizzontale** come riferimento principale
- Il layout deve reggere anche in verticale (800×1280) senza rompersi
- HTML e CSS in un unico file, nessun framework
- Tutte le schermate in un'unica pagina, separate da un titolo, così sono confrontabili

## Schermate richieste

**1. Login**
Logo e nome StoreScout, campo email, campo password, pulsante Accedi, link "Password
dimenticata". Sobrio, centrato, nulla di superfluo.

**2. Home**
Saluto con nome dell'ispettore. Pulsante grande e prominente "Nuova ispezione".
Sotto, l'elenco delle ultime ispezioni con punto vendita, data e stato.
Prevedi tre stati visivamente distinti: inviata, bozza in corso, invio non riuscito.
Quest'ultimo deve avere un pulsante "Riprova invio".

**3. Selezione punto vendita**
Campo di ricerca in alto. Filtro per insegna (Carelli, GestFood, Sapori della Murgia).
Sezione "Recenti" con gli ultimi tre punti vendita visitati, poi l'elenco completo.
Ogni voce mostra: sigla di due lettere in evidenza, città, indirizzo, insegna.
L'indirizzo è obbligatorio perché alcuni punti vendita condividono la stessa città.

**4. Scheda ispezione** — la schermata principale, curala più delle altre

Testata fissa in alto con sigla e nome del punto vendita, indirizzo, ora di ingresso.
L'ora deve essere modificabile con un tocco.

Casella "Niente da rilevare". Quando è spuntata, tutto il blocco delle attività sottostante
diventa grigio e non interattivo: mostra anche questo stato in una variante della schermata.

Blocco "Attività rilevate", composto da schede indipendenti anziché da righe di tabella.
Ogni scheda contiene:
- tre tendine affiancate: Destinatario, Reparto, Tipo di intervento
- un campo note su due righe, ampio
- un campo scadenza che accetta sia una data sia un testo libero (esempio: "prossimo ordine"),
  con accanto un pulsante Note che apre un box per annotazioni aggiuntive sulla scadenza
- un'icona per eliminare la scheda

Sotto le schede, un pulsante a tutta larghezza "Aggiungi attività".

Blocco "Ho svolto le seguenti attività" con la sua casella di attivazione. Quando attivo mostra
cinque righe di testo vuote e un pulsante "Aggiungi riga".

In fondo due pulsanti: "Salva bozza" secondario e "Concludi ispezione" primario, quest'ultimo
visibilmente più importante.

**5. Firme**
Due riquadri affiancati per firmare con il dito: "Firma ispettore" e "Firma responsabile punto
vendita". Ognuno ha i pulsanti Conferma e Cancella. Accanto al secondo, un campo per il nome
del responsabile. Mostra un riquadro vuoto in attesa di firma e uno già firmato, per far vedere
entrambi gli stati.

**6. Conferma e invio**
Riepilogo con ora di ingresso e ora di uscita, entrambe modificabili, e durata calcolata.
Elenco dei destinatari a cui verrà inviata la scheda. Pulsante finale "Conferma e invia".

## Identità visiva

L'applicazione si chiama **StoreScout**. Il nome compare nella schermata di login e nella
testata della home, sempre in tondo e mai in maiuscolo.

Il logo è una silhouette monocromatica di un investigatore con lente d'ingrandimento, fornita
come SVG a percorso unico. Nel layout inseriscilo come `<svg>` in linea con `fill` impostato da
variabile, così da poterlo colorare di nero su fondo chiaro e di giallo su fondo nero. Se non
disponi del file, usa un cerchio nero pieno come segnaposto delle stesse proporzioni.

Palette in variabili CSS dichiarate in cima al foglio di stile:

```css
:root {
  --nero:            #111111;
  --giallo:          #FFC72C;
  --giallo-premuto:  #E5A800;
  --superficie:      #FFFFFF;
  --superficie-alt:  #F7F7F5;
  --bordo:           #E3E3E0;
  --testo:           #111111;
  --testo-secondario:#6B6B66;
  --successo:        #1D9E75;
  --attenzione:      #BA7517;
  --errore:          #C0392B;
}
```

**Regola vincolante sul giallo.** Il giallo non va mai usato come colore di testo su fondo
chiaro: sarebbe illeggibile su un tablet in magazzino. Il giallo è ammesso solo come
riempimento, con testo nero sopra, oppure come colore del marchio su fondo nero. Ogni testo
resta nero o grigio.

Il giallo va dosato. Usalo per il pulsante primario di ciascuna schermata, per la barra o il
bordo che segnala l'ispezione in corso, e per il marchio. Tutto il resto è nero, bianco e
grigio. Un'interfaccia gialla per metà stanca l'occhio in pochi minuti di uso continuativo.

Registro sobrio, da strumento di lavoro: superfici chiare, bordi sottili, nessuna ombra
pronunciata, nessun gradiente. Deve somigliare a un'applicazione gestionale curata, non a
un'app di consumo.

Tipografia di sistema. Corpo del testo non inferiore a 15px, etichette dei campi non inferiori
a 13px. Aree toccabili di almeno 48 pixel per lato.

## Cosa evitare

Niente icone decorative che non servono a capire l'azione. Niente testo in maiuscolo per interi
paragrafi. Niente tabelle a cinque o più colonne: su tablet costringono a campi troppo stretti.
Nessun elemento che dipenda dal passaggio del mouse, perché non esiste il puntatore.
Nessuna finestra modale per le conferme distruttive: usa un banner in linea nella schermata.

## Cosa consegnare

Un unico file HTML con tutte le schermate impilate verticalmente, ciascuna preceduta dal
proprio titolo. Deve essere statico e non richiedere JavaScript per essere valutato: serve come
riferimento visivo da cui ricavare i componenti React Native, non come prototipo funzionante.
