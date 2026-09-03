# App Schede Attività Ispettori — Specifica Funzionale e Tecnica

**Committente:** Carelli Distribuzione — Area Vendite
**Documento:** specifica di progetto per implementazione con Claude Code
**Versione:** 1.0
**Stato:** bozza operativa — le sezioni marcate `[DA DEFINIRE]` vanno completate prima del rilascio

---

## 1. Obiettivo

Sostituire il file Excel "SCHEDE ATTIVITA ISPETTORE" con un'app Android per tablet che consenta
agli ispettori dell'area vendite di compilare la scheda di ispezione direttamente in punto vendita,
raccogliere le firme, e inviare automaticamente via email il modulo compilato in PDF ai
destinatari previsti.

L'app deve replicare fedelmente la logica del modulo cartaceo/Excel attuale, senza aggiungere
attriti: un'ispezione completa deve poter essere compilata e chiusa in pochi minuti, con una mano
sola, su un tablet, spesso in piedi.

---

## 2. Stack tecnologico

| Ambito | Scelta |
|---|---|
| App | React Native con **Expo** (SDK managed) + **TypeScript** |
| IDE | Visual Studio Code + Claude Code |
| Backend / DB | **Supabase** (PostgreSQL, Auth, Storage, Edge Functions) |
| Stato locale / bozze | `expo-sqlite` o AsyncStorage (vedi §9) |
| Firme | `react-native-signature-canvas` (o canvas WebView) → PNG |
| PDF | `expo-print` (HTML → PDF lato client) |
| Invio email | Supabase Edge Function (Deno) + **SMTP Aruba** |
| Build | **EAS Build** → APK firmato |
| Aggiornamenti | **EAS Update** (OTA, senza reinstallare l'APK) |
| Distribuzione | APK diretto via link / MDM aziendale — **non** Google Play |

### Vincoli di piattaforma
- Target: **Android 9+**, tablet, orientamento **landscape e portrait** (layout responsive).
- L'app non deve richiedere permessi non necessari. Permessi previsti: rete, storage (scrittura PDF temporaneo).
- Nessuna credenziale SMTP, API key privilegiata o segreto deve essere presente nel bundle
  dell'app. L'APK è ispezionabile da chiunque lo riceva. Tutti i segreti stanno nelle
  Supabase Edge Function Secrets.

---

## 3. Ruoli e autenticazione

### 3.1 Ruoli

**Ispettore**
- Accede con email + password.
- Crea, compila e conclude ispezioni.
- Vede lo storico delle **proprie** ispezioni.
- Non può modificare un'ispezione già conclusa e inviata.

**Admin**
- Tutto quanto sopra, più:
  - creazione, rinomina e disattivazione ispettori
  - reset password ispettori
  - gestione anagrafica punti vendita
  - gestione liste valori (destinatari, reparti, tipi intervento) — modificabili **senza rilasciare una nuova app**
  - consultazione ed export di tutte le ispezioni
  - reinvio manuale di una email fallita

### 3.2 Regole
- Autenticazione tramite **Supabase Auth** (provider email/password).
- Sessione persistente: l'ispettore non deve rifare login ogni giorno. Refresh token automatico.
- Logout esplicito disponibile nel menu.
- Un ispettore **disattivato** non può più accedere ma i suoi dati storici restano integri.
  **Non implementare l'eliminazione fisica degli ispettori**: la disattivazione (`attivo = false`)
  è l'unica operazione consentita, altrimenti si perde la tracciabilità delle ispezioni passate.
- Reset password: l'admin genera un reset dal pannello; l'utente riceve email di reimpostazione.
  In alternativa l'admin può impostare una password temporanea con flag `deve_cambiare_password`.

---

## 4. Modello dati (PostgreSQL / Supabase)

### 4.1 Schema SQL

```sql
-- ============ ENUM ============
create type ruolo_utente as enum ('admin', 'ispettore');
create type stato_ispezione as enum ('bozza', 'conclusa', 'inviata', 'errore_invio');
create type stato_invio as enum ('in_coda', 'inviata', 'errore');

-- ============ PROFILI ============
create table profili (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  cognome text not null,
  email text not null unique,
  ruolo ruolo_utente not null default 'ispettore',
  attivo boolean not null default true,
  deve_cambiare_password boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ PUNTI VENDITA ============
create table pdv (
  id uuid primary key default gen_random_uuid(),
  progressivo text not null,            -- "Centrale" nel file origine, es. "10"
  codice text not null unique,          -- sigla a 2 lettere, es. "PU"
  citta text not null,                  -- es. "Palo del Colle"
  indirizzo text not null,              -- es. "via Cesare Cantù, 135"
  ragione_sociale text not null,        -- Carelli | GestFood | Sapori della Murgia
  codice_deposito text,                 -- "dep" nel file origine
  telefono text,
  email text,                           -- destinatario principale della scheda
  responsabile_nome text,
  attivo boolean not null default true,
  created_at timestamptz not null default now()
);

-- un PDV senza email non può ricevere la scheda: va escluso dalla selezione
create index idx_pdv_selezionabili on pdv(codice) where attivo = true;

-- ============ LISTE VALORI ============
create table destinatari (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,            -- es. "UFFICIO TECNICO"
  email text,                           -- email a cui inoltrare le attività assegnate
  ordine integer not null default 0,
  attivo boolean not null default true
);

create table reparti (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ordine integer not null default 0,
  attivo boolean not null default true
);

create table tipi_intervento (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ordine integer not null default 0,
  attivo boolean not null default true
);

-- ============ ISPEZIONI ============
create table ispezioni (
  id uuid primary key default gen_random_uuid(),
  numero serial,                         -- progressivo leggibile, usato nel PDF e nell'oggetto mail
  pdv_id uuid not null references pdv(id),
  ispettore_id uuid not null references profili(id),
  data_ispezione date not null default current_date,
  ora_ingresso timestamptz not null,
  ora_uscita timestamptz,
  niente_da_rilevare boolean not null default false,
  ha_svolto_attivita boolean not null default false,
  firma_ispettore_path text,             -- path in Storage
  firma_responsabile_path text,
  nome_responsabile text,                -- chi firma per il PDV
  pdf_path text,
  stato stato_ispezione not null default 'bozza',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ora_uscita_dopo_ingresso
    check (ora_uscita is null or ora_uscita >= ora_ingresso)
);

-- ============ RIGHE ATTIVITÀ RILEVATE ============
create table ispezione_attivita (
  id uuid primary key default gen_random_uuid(),
  ispezione_id uuid not null references ispezioni(id) on delete cascade,
  ordine integer not null default 0,
  destinatario_id uuid references destinatari(id),
  reparto_id uuid references reparti(id),
  tipo_intervento_id uuid references tipi_intervento(id),
  note text,
  scadenza_data date,                    -- alternativa 1: data precisa
  scadenza_testo text,                   -- alternativa 2: es. "PROSSIMO ORDINE"
  scadenza_note text,                    -- note aggiuntive sulla scadenza
  created_at timestamptz not null default now()
);

-- ============ ATTIVITÀ SVOLTE DALL'ISPETTORE ============
create table ispezione_svolte (
  id uuid primary key default gen_random_uuid(),
  ispezione_id uuid not null references ispezioni(id) on delete cascade,
  ordine integer not null default 0,
  descrizione text not null
);

-- ============ LOG INVII EMAIL ============
create table invii_email (
  id uuid primary key default gen_random_uuid(),
  ispezione_id uuid not null references ispezioni(id) on delete cascade,
  destinatari jsonb not null,            -- {"to": [...], "cc": [...]}
  oggetto text not null,
  stato stato_invio not null default 'in_coda',
  errore text,
  tentativi integer not null default 0,
  inviata_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_ispezioni_ispettore on ispezioni(ispettore_id, data_ispezione desc);
create index idx_ispezioni_pdv on ispezioni(pdv_id, data_ispezione desc);
create index idx_attivita_ispezione on ispezione_attivita(ispezione_id, ordine);
create index idx_svolte_ispezione on ispezione_svolte(ispezione_id, ordine);
```

### 4.2 Row Level Security

Attivare RLS su **tutte** le tabelle. Policy richieste:

```sql
-- funzione helper
create or replace function is_admin() returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from profili
    where id = auth.uid() and ruolo = 'admin' and attivo = true
  );
$$;

alter table ispezioni enable row level security;

create policy "ispettore vede le proprie ispezioni"
  on ispezioni for select
  using (ispettore_id = auth.uid() or is_admin());

create policy "ispettore crea le proprie ispezioni"
  on ispezioni for insert
  with check (ispettore_id = auth.uid());

create policy "modifica solo bozze proprie"
  on ispezioni for update
  using ((ispettore_id = auth.uid() and stato = 'bozza') or is_admin());
```

Applicare la stessa logica a `ispezione_attivita` e `ispezione_svolte` (tramite join su
`ispezioni`). Le tabelle di lista (`pdv`, `destinatari`, `reparti`, `tipi_intervento`) sono in
**lettura per tutti gli utenti autenticati** e in **scrittura solo per admin**.

### 4.3 Storage

Bucket privati (mai pubblici):
- `firme/` — `{ispezione_id}/ispettore.png`, `{ispezione_id}/responsabile.png`
- `schede/` — `{anno}/{mese}/{numero}_{codice_pdv}.pdf`

Accesso tramite signed URL a scadenza breve.

---

## 5. Liste valori iniziali

Da caricare in seed. Sono **modificabili dall'admin a runtime**: l'app le legge dal database,
non le contiene hardcoded.

### Destinatari attività
| Nome | Email |
|---|---|
| CN | `[DA DEFINIRE]` |
| CATEGORY | `[DA DEFINIRE]` |
| UFFICIO MKTG | `[DA DEFINIRE]` |
| UFFICIO TECNICO | `[DA DEFINIRE]` |
| UFFICIO HACCP | `[DA DEFINIRE]` |
| EDP | `[DA DEFINIRE]` |
| SICUREZZA | `[DA DEFINIRE]` |

### Reparti
ESTERNO PDV · MAGAZZINO · ORTOFRUTTA · SALUMERIA · SURGELATI · DEPERIBILI · MACELLERIA ·
SALA VANO TECNICO · BARRIERA CASSE · BOX UFFICIO · GENERICO

### Tipi di intervento
COMUNICAZIONE · ROTTURE/ECCESSI · NON IDONEI · PULIZIE · GUASTO/MALFUNZIONAMENTO ·
RIPRISTINO (ES. PITTURAZIONE) · TECNICO · MKTG · EDP · SICUREZZA · **HACCP**

> **Nota di bonifica dati.** Nel foglio "ESEMPIO COMPILAZIONE" del file originale compare il
> tipo intervento `HACCP`, assente dalla lista del foglio "REPARTI": è stato aggiunto sopra.
> Sempre nell'esempio il destinatario è scritto `HACCP` mentre in lista è `UFFICIO HACCP`:
> si adotta la forma della lista. **Confermare entrambe le scelte prima del seed.**
>
> **Collisione di sigla.** `CN` è contemporaneamente un destinatario attività e il codice del
> punto vendita di Conversano. Sono tabelle distinte, quindi non c'è alcun problema tecnico, ma
> nel PDF e nelle interfacce le due voci vanno etichettate in modo inequivocabile
> ("Destinatario: CN" vs "PDV: CN — Conversano") per evitare fraintendimenti in lettura.

---

## 6. Schermate e flussi

### 6.1 Mappa delle schermate

```
Login
 └── Home (elenco ispezioni recenti + tasto NUOVA ISPEZIONE)
      ├── Selezione PDV
      │    └── Ispezione
      │         ├── 1. Testata (PDV, orari, ispettore)
      │         ├── 2. Attività rilevate
      │         ├── 3. Attività svolte
      │         ├── 4. Firme
      │         └── 5. Riepilogo e conclusione
      ├── Storico ispezioni
      └── Admin (solo ruolo admin)
           ├── Ispettori
           ├── Punti vendita
           ├── Liste valori
           └── Ispezioni / export
```

### 6.2 Login
- Campi email e password, tasto "Accedi", link "Password dimenticata".
- Messaggio esplicito se l'account è disattivato.
- Se `deve_cambiare_password = true`, forza la schermata di cambio password.

### 6.3 Selezione PDV

- **47 punti vendita** in anagrafica (vedi `03_seed_pdv.sql`), su tre ragioni sociali:
  Carelli, GestFood, Sapori della Murgia.
- Lista dei PDV **attivi** con **ricerca testuale** su codice, città e indirizzo.
- Ogni voce mostra: `{CODICE}` in evidenza, città, indirizzo, badge ragione sociale.
- Filtro rapido per ragione sociale.
- Ordinamento predefinito: per codice. Prevedere una sezione "Recenti" in cima con gli ultimi
  3 PDV visitati dall'ispettore: nella pratica un ispettore ruota su poche unità e questo
  elimina quasi sempre la ricerca.
- Alla selezione si crea immediatamente l'ispezione in stato `bozza` con
  `ora_ingresso = now()` del dispositivo.

### 6.4 Testata ispezione
| Campo | Comportamento |
|---|---|
| PDV | Preselezionato, modificabile solo finché non ci sono righe compilate |
| Ora ingresso | Auto-popolata all'apertura, **editabile** con time picker |
| Ora uscita | Vuota, si popola alla conclusione, **editabile** |
| Ispettore | Auto-popolato dal profilo loggato, non editabile |
| Data | Data corrente, editabile solo da admin |

### 6.5 Attività rilevate

Blocco principale della scheda. È una tabella a righe dinamiche.

**Checkbox "Niente da rilevare"**
- Se spuntata: l'intero blocco attività rilevate diventa **grigio e non interattivo**, e le righe
  eventualmente inserite vengono svuotate previa conferma esplicita
  ("Sono presenti N attività. Confermi la cancellazione?").
- Se ci sono righe compilate e l'utente spunta la casella, **chiedere conferma prima** di cancellare.

**Riga attività** — campi:
1. **Destinatario attività** — dropdown da tabella `destinatari`
2. **Reparto** — dropdown da tabella `reparti`
3. **Tipo di intervento** — dropdown da tabella `tipi_intervento`
4. **Note** — testo libero multilinea
5. **Scadenza attività** — vedi sotto

**Campo scadenza** — tre modalità in un unico controllo:
- selettore data (calendario) → valorizza `scadenza_data`
- opzione "Scadenza generica" → campo testo libero (es. "PROSSIMO ORDINE") → `scadenza_testo`
- pulsante **"Note"** che apre un box aggiuntivo → `scadenza_note`
  (esempi: "entro apertura", "prima del prossimo ordine", "urgente")

Vincolo: `scadenza_data` e `scadenza_testo` sono mutuamente esclusivi; almeno uno dei due deve
essere valorizzato se la riga è compilata.

**Gestione righe**
- Nessuna riga vuota all'apertura; tasto **"+ Aggiungi attività"** in fondo.
- Ogni riga ha un'azione **elimina** (swipe o icona) con conferma.
- Riordinamento non richiesto in v1.

### 6.6 Attività svolte

**Checkbox "Ho svolto le seguenti attività"**
- Se spuntata: abilita il box note diviso in **5 righe di default**, vuote.
- Tasto **"+"** aggiunge una riga oltre le 5.
- Ogni riga è testo libero su una singola linea, con azione elimina.
- Le righe lasciate vuote non vengono salvate né stampate nel PDF.
- Se deselezionata: il blocco si ingrigisce e le righe si svuotano previa conferma.

### 6.7 Firme
- Due canvas separati: **Firma ispettore** e **Firma responsabile punto vendita**.
- Ogni canvas ha i tasti **Conferma** e **Cancella**.
- Campo testo "Nome e cognome del responsabile" accanto alla seconda firma.
- Una firma confermata mostra l'anteprima e può essere rifatta ("Rifai firma").
- Salvataggio come PNG a fondo trasparente, larghezza max 800px.

### 6.8 Conclusione ispezione

Tasto **"CONCLUDI ISPEZIONE"**. Sequenza:

1. **Validazione** (blocca se fallita):
   - PDV selezionato
   - almeno una riga attività **oppure** "Niente da rilevare" spuntato
   - ogni riga attività ha destinatario, reparto, tipo intervento e una scadenza
   - firma ispettore presente
   - firma responsabile presente **oppure** motivazione esplicita per l'assenza (campo testo)
2. **Popolamento** `ora_uscita = now()`.
3. **Schermata di conferma orari**: mostra ora ingresso e ora uscita, entrambe editabili,
   con durata calcolata. Tasti "Modifica" e "Conferma e invia".
4. **Salvataggio** su Supabase, upload firme, stato → `conclusa`.
5. **Generazione PDF** e upload su Storage.
6. **Invio email** tramite Edge Function; stato → `inviata` o `errore_invio`.
7. Schermata di esito con riepilogo destinatari e tasto "Nuova ispezione".

Se l'invio fallisce, l'ispezione resta salvata e compare in Home con badge
"Invio non riuscito" e tasto **"Riprova invio"**. Nessun dato va mai perso per un errore di rete.

### 6.9 Storico
- Elenco ispezioni dell'ispettore (admin: tutte), filtrabile per PDV e intervallo date.
- Apertura in sola lettura, con tasto per riscaricare o rinviare il PDF.

---

## 7. Generazione PDF

Il PDF deve **replicare il modulo Excel attuale**, con:
- intestazione con **logo aziendale** `[LOGO DA FORNIRE]` e titolo "SCHEDA ATTIVITÀ ISPETTORE"
- riga di testata: PDV · Data · Ora ingresso · Ora uscita · Ispettore
- tabella attività rilevate con colonne: Destinatario · Reparto · Tipo intervento · Note · Scadenza
  (la scadenza stampa la data in formato `gg/mm/aaaa` oppure il testo generico, seguita dalle note
  di scadenza tra parentesi se presenti)
- se "Niente da rilevare": in luogo della tabella, la dicitura **NIENTE DA RILEVARE** ben visibile
- blocco "Ho svolto le seguenti attività" con l'elenco puntato
- in fondo: le due firme come immagini, con nome ispettore e nome responsabile sotto
- piè di pagina con numero ispezione e data/ora di generazione

Implementazione: template HTML+CSS in `src/pdf/template.ts`, reso con `expo-print`.
Formato A4, margini 15mm. Font di sistema, nessun font esterno da scaricare.

---

## 8. Invio email

### 8.1 Destinatari

**A (To):**
- email del PDV (dal record `pdv.email`)

**CC:**
- `contact2@carellidistribuzione.it`
- `a.andriani@carellidistribuzione.it`
- email di **ogni destinatario attività** presente nella scheda (deduplicato)
- email dell'ispettore che ha effettuato l'ispezione

**Oggetto:** `Scheda Attività Ispettore — {CODICE_PDV} — {gg/mm/aaaa}`

**Corpo:** testo breve con PDV, data, ispettore, orari, numero di attività rilevate.
PDF in allegato.

### 8.2 Configurazione SMTP Aruba

```
Host:     smtps.aruba.it
Porta:    465  (SSL/TLS implicito)   — in alternativa 587 con STARTTLS
Utente:   [ACCOUNT ARUBA DA DEFINIRE]
Password: [DA DEFINIRE — inserire in Supabase Secrets]
From:     [INDIRIZZO MITTENTE DA DEFINIRE]
```

> **Nota.** Per l'invio serve **solo SMTP**. Il protocollo POP3 serve unicamente a *leggere* la
> posta e non è richiesto da questa applicazione.
> Le credenziali vanno impostate come **Supabase Edge Function Secrets**
> (`supabase secrets set SMTP_USER=... SMTP_PASS=...`) e non devono comparire nel codice
> dell'app né nel repository.

### 8.3 Edge Function

`supabase/functions/invia-scheda/index.ts`

- Input: `{ ispezione_id }`
- Verifica il JWT del chiamante e che l'ispezione gli appartenga (o sia admin).
- Legge i dati, scarica il PDF da Storage, compone i destinatari.
- Invia con `denomailer`.
- Scrive il record in `invii_email` e aggiorna `ispezioni.stato`.
- In caso di errore, restituisce il messaggio all'app e lascia l'ispezione riprovabile.

---

## 9. Bozze locali

Non è richiesta una sincronizzazione offline completa. È richiesto che **un'ispezione in corso non
vada mai persa**:

- Ogni modifica al form viene persistita localmente (debounce ~1s) in `expo-sqlite`.
- Riaprendo l'app dopo una chiusura imprevista, l'ispezione in corso viene ripristinata
  ("Hai un'ispezione non conclusa presso {PDV}. Riprendi / Elimina").
- Le bozze si sincronizzano su Supabase quando c'è rete; senza rete restano locali e la
  conclusione viene bloccata con messaggio chiaro ("Connessione assente: la scheda è salvata sul
  dispositivo e sarà inviata al ripristino della rete").
- Una bozza locale viene eliminata solo dopo conferma di salvataggio remoto riuscito.

---

## 10. Pannello admin

### 10.1 Ispettori
Elenco con stato attivo/disattivo. Azioni: crea (nome, cognome, email, ruolo, password iniziale),
modifica nome, reset password, attiva/disattiva. Nessuna eliminazione fisica.

### 10.2 Punti vendita
CRUD completo + **import CSV** con colonne `codice, insegna, indirizzo, citta, provincia, email,
responsabile_nome`. L'import deve gestire l'aggiornamento dei record esistenti per `codice`.

### 10.3 Liste valori
CRUD su destinatari (con relativa email), reparti, tipi di intervento. Riordinamento tramite campo
`ordine`. Disattivazione anziché eliminazione, così le ispezioni storiche restano leggibili.

### 10.4 Ispezioni
Elenco filtrabile per ispettore, PDV, periodo, stato. Download PDF. Reinvio email.
**Export CSV/Excel** delle attività rilevate per analisi (una riga per attività, con colonne di
testata ripetute).

---

## 11. Struttura del progetto

```
app-ispettori/
├── app/                        # expo-router
│   ├── (auth)/login.tsx
│   ├── (app)/index.tsx         # home
│   ├── (app)/pdv.tsx
│   ├── (app)/ispezione/[id]/...
│   ├── (app)/storico.tsx
│   └── (admin)/...
├── src/
│   ├── components/             # DropdownLista, RigaAttivita, FirmaCanvas, ...
│   ├── db/                     # sqlite locale, bozze
│   ├── lib/supabase.ts
│   ├── pdf/template.ts
│   ├── hooks/
│   ├── types/                  # tipi generati da Supabase
│   └── theme/                  # colori, spaziature, tipografia
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   └── functions/invia-scheda/
├── assets/                     # logo, icone
├── app.json
├── eas.json
└── README.md
```

---

## 12. Linee guida UI

- Ottimizzato per **tablet in mano**, non per desktop: target touch minimo 48×48dp,
  campi ampi, tipografia leggibile a distanza di braccio.
- Blocco disabilitato = opacità ridotta + sfondo grigio + input non focalizzabili (replica del
  comportamento "ingrigito" richiesto per "Niente da rilevare").
- Ogni azione distruttiva (elimina riga, cancella firma, svuota blocco) chiede conferma.
- Salvataggio sempre implicito: niente tasto "Salva" tranne la conclusione.
- Feedback visibile a ogni operazione di rete (spinner, toast di esito).
- Palette e logo: `[DA DEFINIRE — attendere output Claude Design]`.

---

## 13. Roadmap implementativa

| # | Milestone | Contenuto |
|---|---|---|
| 1 | Setup | Progetto Expo + TS, Supabase, migrazioni, seed liste valori |
| 2 | Auth | Login, sessione persistente, ruoli, RLS verificata |
| 3 | Anagrafiche | Selezione PDV con ricerca, dropdown da DB |
| 4 | Form ispezione | Testata, attività rilevate, attività svolte, checkbox e ingrigimento |
| 5 | Bozze locali | SQLite, ripristino ispezione interrotta |
| 6 | Firme | Canvas, conferma/cancella, upload Storage |
| 7 | PDF | Template HTML, generazione, upload |
| 8 | Email | Edge Function, SMTP Aruba, log invii, retry |
| 9 | Storico | Elenco, filtri, riapertura in lettura |
| 10 | Admin | Ispettori, PDV, liste valori, export |
| 11 | Build & OTA | EAS Build APK, EAS Update, test su tablet reale |
| 12 | Collaudo | Test con ispettori, correzioni, rollout |

**Test sul tablet reale già dalla milestone 2.** Rimandare la prima build a fine progetto è il
modo più affidabile per scoprire tardi problemi di layout e di prestazioni.

---

## 14. Dati e materiali ancora da fornire

- [x] ~~Anagrafica completa punti vendita~~ — **ricevuta**. 47 PDV in `03_seed_pdv.sql`;
      **BV**, **BJ** e **SE** esclusi su indicazione del committente.
- [ ] Decidere se **EC** (e-commerce) va escluso: non ha email ed è caricato come
      `attivo = false`, quindi oggi non è selezionabile.
- [ ] Nomi dei responsabili di punto vendita (campo `responsabile_nome`, oggi vuoto)
- [ ] Elenco ispettori con email
- [ ] Email di ciascun destinatario attività (CN, CATEGORY, UFFICIO MKTG, UFFICIO TECNICO, UFFICIO HACCP, EDP, SICUREZZA)
- [ ] Credenziali SMTP Aruba e indirizzo mittente
- [ ] Logo aziendale (PNG/SVG alta risoluzione) e colori istituzionali
- [ ] Conferma sulle incongruenze del §5 (HACCP come destinatario e come tipo intervento)
- [ ] Conferma testo del corpo email
- [ ] Numero di tablet e modalità di distribuzione dell'APK

---

## 15. Fuori perimetro (v1)

Non implementare in questa versione, per non allungare i tempi del primo rilascio:
- allegati fotografici alle attività
- notifiche push
- dashboard analitica delle attività per destinatario
- app iOS
- firma digitale a valore legale (le firme sono grafometriche a scopo di attestazione interna)

Questi punti restano candidati per la v2 e vanno tenuti presenti nel modello dati, che è già
predisposto per estensioni.
