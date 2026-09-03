# Guida passo passo a Supabase

Per chi non l'ha mai usato. Segui i passaggi nell'ordine: ognuno dipende dal precedente.
Tempo stimato: 60–75 minuti in tutto.

I passi **1–9** configurano il database e vanno fatti subito.
I passi **10–11** proteggono il progetto e vanno fatti prima di caricare dati veri.
Il passo **12** serve più avanti, alla milestone 8.

## Cos'è Supabase, in due righe

È un database PostgreSQL ospitato, con sopra tre servizi già pronti: autenticazione utenti,
archiviazione file e funzioni server. Sostituisce quello che altrimenti dovresti installare e
mantenere su un server tuo. L'app sul tablet parla direttamente con Supabase.

---

## Passo 1 — Creare l'account

1. Vai su **supabase.com** e clicca *Start your project*.
2. Registrati con GitHub oppure con email e password.
3. Ti verrà chiesto di creare una **Organization**: chiamala `Carelli Distribuzione`.
   Tipo: *Company*. Piano: *Free* per ora.

---

## Passo 2 — Creare il progetto

Clicca *New project* e compila:

| Campo | Valore |
|---|---|
| Name | `app-ispettori` |
| Database Password | generane una lunga e **salvala subito** nel gestore password aziendale |
| Region | **Central EU (Frankfurt)** |
| Plan | Free |

Due avvertenze concrete:

**La password del database non è recuperabile.** Se la perdi puoi solo resettarla, il che
interrompe le connessioni attive. Salvala prima di cliccare *Create*.

**La regione va scelta ora e non si cambia più.** Frankfurt tiene i dati dentro l'Unione
Europea, che è quello che ti serve con dati di dipendenti e firme. Un progetto creato per errore
in Virginia va ricreato da zero.

Il provisioning richiede 1–2 minuti.

---

## Passo 3 — Orientarsi nella dashboard

Menu a sinistra, le voci che userai:

- **Table Editor** — le tabelle, come un foglio di calcolo. Utile per controllare i dati.
- **SQL Editor** — qui esegui gli script. È lo strumento principale nei prossimi passi.
- **Authentication** — gli utenti che fanno login (gli ispettori).
- **Storage** — i file (firme e PDF).
- **Edge Functions** — le funzioni server (l'invio email).
- **Project Settings → API** — le chiavi che l'app userà per collegarsi.

---

## Passo 4 — Creare le tabelle

1. **SQL Editor** → *New query*.
2. Apri il file `01_schema.sql`, copia **tutto** il contenuto e incollalo nell'editor.
3. Clicca **Run** (o `Ctrl+Invio`).
4. Deve comparire *Success. No rows returned*.

Questo script crea 9 tabelle, i trigger e tutte le regole di sicurezza. Se compare un errore,
fermati e leggilo: quasi sempre significa che una parte era già stata eseguita. In quel caso non
rilanciarlo a pezzi; svuota tutto con `drop schema public cascade; create schema public;` e
riparti dall'inizio.

Verifica: vai in **Table Editor**, devi vedere `profili`, `pdv`, `destinatari`, `reparti`,
`tipi_intervento`, `ispezioni`, `ispezione_attivita`, `ispezione_svolte`, `invii_email`.

---

## Passo 5 — Caricare i dati

Sempre da **SQL Editor**, una query nuova per ciascun file, nell'ordine:

1. `02_seed_liste.sql` → destinatari, reparti, tipi di intervento
2. `03_seed_pdv.sql` → i 47 punti vendita

Verifica in Table Editor: `pdv` deve contenere 47 righe, `reparti` 11, `tipi_intervento` 11,
`destinatari` 7.

Entrambi gli script hanno `on conflict do update`: puoi rieseguirli in futuro quando
l'anagrafica cambia, senza creare duplicati.

---

## Passo 6 — Creare i bucket per i file

**Storage** → *New bucket*. Creane due, entrambi con **Public bucket disattivato**:

- `firme`
- `schede`

Devono restare privati. Un bucket pubblico rende ogni PDF scaricabile da chiunque conosca
l'URL, senza login: sono documenti aziendali con firme di persone fisiche.

Poi torna in **SQL Editor** e lancia questo, che dà accesso ai soli utenti autenticati:

```sql
create policy "utenti autenticati leggono le firme"
  on storage.objects for select to authenticated
  using (bucket_id = 'firme');

create policy "utenti autenticati caricano le firme"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'firme');

create policy "utenti autenticati leggono le schede"
  on storage.objects for select to authenticated
  using (bucket_id = 'schede');

create policy "utenti autenticati caricano le schede"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'schede');
```

---

## Passo 7 — Creare il primo utente admin

1. **Authentication** → *Users* → *Add user* → *Create new user*.
2. Inserisci la tua email aziendale e una password. Spunta **Auto Confirm User**, altrimenti
   l'account resta in attesa di una conferma via email che non è ancora configurata.
3. Clicca *Create user*. Il trigger creato al passo 4 genera automaticamente la riga in `profili`.
4. Ora promuovilo ad amministratore. **SQL Editor**:

```sql
update profili
set ruolo = 'admin', nome = 'TuoNome', cognome = 'TuoCognome'
where email = 'tua.email@carellidistribuzione.it';
```

5. Verifica in Table Editor → `profili`: deve esserci una riga con `ruolo = admin`.

Gli altri ispettori li creerai dal pannello admin dell'app, non da qui.

---

## Passo 8 — Recuperare le chiavi di collegamento

**Project Settings** → *API*. Ti servono due valori:

- **Project URL** — es. `https://xxxxxxxx.supabase.co`
- **anon public** key — una stringa lunga che inizia per `eyJ...`

Nella stessa pagina trovi anche la **service_role** key. Quella **non va mai** nell'app, nel
repository o in un messaggio: ignora ogni regola di sicurezza e dà accesso completo al database.
Serve solo dentro le Edge Functions e nel workflow di backup, dove viene passata come secret.

Nel progetto Expo crea un file `.env` nella cartella principale:

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

e aggiungi `.env` al `.gitignore`.

La chiave `anon` è sicura nell'app perché da sola non apre niente: sono le policy RLS del passo 4
a decidere cosa ciascun utente può leggere. È esattamente per questo che quelle policy vanno
verificate prima di caricare dati veri.

---

## Passo 9 — Verificare che tutto funzioni

In **SQL Editor**:

```sql
select
  (select count(*) from pdv)             as punti_vendita,
  (select count(*) from destinatari)     as destinatari,
  (select count(*) from reparti)         as reparti,
  (select count(*) from tipi_intervento) as tipi_intervento,
  (select count(*) from profili where ruolo = 'admin') as admin;
```

Atteso: `47 | 7 | 11 | 11 | 1`.

---

## Passo 10 — Impedire la sospensione per inattività

**Da fare se resti sul piano gratuito.** Sul piano Pro questo passo non serve: i progetti a
pagamento non vengono mai sospesi.

### Cosa succede senza questo passo

Il piano gratuito sospende i progetti dopo circa **7 giorni senza richieste**. I dati **non
vengono persi**: il progetto viene congelato e si ripristina dal dashboard, e anche i file su
Storage tornano disponibili. La documentazione Supabase indica una finestra di un anno per il
ripristino; varie segnalazioni riportano che dopo 90 giorni il ripristino con un clic viene
disattivato e serve ricaricare il backup in un progetto nuovo.

Il problema non è quindi la perdita dei dati, ma il **disservizio**: l'ispettore arriva al punto
vendita, apre il tablet e l'app non risponde. E il ripristino si fa **solo dal dashboard** — non
esiste una chiamata API o un comando per riattivare il progetto da fuori. Finché non lo riattivi
tu a mano, gli ispettori sono fermi. Bastano le ferie di agosto perché succeda.

### La soluzione

Qualunque richiesta API azzera il timer. Il file `keep-alive.yml` fa una query minima ogni giorno.

1. Crea un repository **privato** su GitHub per il progetto (se non ce l'hai già).
2. Copia `keep-alive.yml` in `.github/workflows/keep-alive.yml` e fai push.
3. Su GitHub: **Settings → Secrets and variables → Actions → New repository secret**.
   Aggiungi `SUPABASE_URL` e `SUPABASE_ANON_KEY` con i valori del passo 8.
4. Vai su **Actions**, seleziona il workflow e lancialo a mano con *Run workflow* per
   verificare che risponda `HTTP 200`.

**Avvertenza.** GitHub disattiva i workflow schedulati dopo **60 giorni senza attività sul
repository**, e lo fa in silenzio. Metti un promemoria ogni 45 giorni per controllare che gli
ultimi run siano verdi. Se preferisci non dipendere da GitHub, **cron-job.org** è gratuito e
chiama lo stesso URL: cinque minuti di configurazione dal browser e nessun file da mantenere.

---

## Passo 11 — Backup automatico

Sul piano gratuito Supabase **non fa backup**. E anche sul piano Pro i backup nativi **non
includono i byte dei file su Storage**, quindi le firme vanno salvate a parte in ogni caso.

Il file `backup.yml` copre entrambi: esporta il database, scarica le firme, cifra tutto con
AES256 e conserva 90 giorni di copie.

1. Copia `backup.yml` in `.github/workflows/backup.yml`.
2. Aggiungi quattro secret nel repository:

| Secret | Dove trovarlo |
|---|---|
| `SUPABASE_DB_URL` | Project Settings → Database → Connection string → **Session pooler** |
| `SUPABASE_URL` | come al passo 8 |
| `SUPABASE_SERVICE_KEY` | Project Settings → API → chiave `service_role` |
| `BACKUP_PASSPHRASE` | una passphrase lunga che generi tu, da salvare nel gestore password |

3. Lancia il workflow a mano da **Actions** e verifica che produca l'artefatto cifrato.

Tre note che fanno la differenza:

**Usa la stringa "Session pooler", non la connessione diretta.** Quest'ultima è solo IPv6 e i
runner GitHub non la raggiungono: è il motivo numero uno per cui questo job fallisce al primo
tentativo.

**La cifratura non è opzionale.** Il dump contiene nomi di dipendenti, email e firme di persone
fisiche. Un artefatto non cifrato con quei dati dentro è un problema di GDPR, non solo di
sicurezza.

**Un backup mai ripristinato non è un backup.** Ogni tre mesi prendi l'ultimo file, decifralo,
caricalo su un progetto Supabase di prova e verifica che i dati ci siano. Le procedure di
ripristino si scoprono rotte solo quando servono.

Gli artefatti GitHub scadono dopo 90 giorni. Per un archivio permanente il passo successivo è
copiarli su Google Drive.

---

## Passo 12 — Preparare le Edge Functions

Questo passo serve alla milestone 8 (invio email). Lo trovi qui per completezza.

Nel terminale di VS Code:

```bash
npm install -g supabase
supabase login
supabase link --project-ref xxxxxxxx    # la sigla nel Project URL
```

Le credenziali Aruba si impostano come *secrets*, mai nel codice:

```bash
supabase secrets set SMTP_HOST=smtps.aruba.it
supabase secrets set SMTP_PORT=465
supabase secrets set SMTP_USER=...
supabase secrets set SMTP_PASS=...
```

E la funzione si pubblica con:

```bash
supabase functions deploy invia-scheda
```

---

## Piano gratuito o Pro?

| | Free | Pro (25 $/mese) |
|---|---|---|
| Database | 500 MB | 8 GB |
| Storage file | 1 GB | 100 GB |
| Sospensione per inattività | dopo ~7 giorni | mai |
| Backup automatici | nessuno | giornalieri |
| Costo annuo | 0 | ~280 € |

Con 47 punti vendita e qualche centinaio di ispezioni al mese, i limiti di spazio non sono un
problema per anni. Le uniche due differenze che contano davvero sono la sospensione e i backup,
ed entrambe le copri con i passi 10 e 11 a costo zero.

Resta sul gratuito durante lo sviluppo. La decisione la prendi al rilascio, con i consumi reali
sotto gli occhi, e il passaggio al Pro è un clic che non richiede di toccare il codice.

---

## E se un giorno volessi andartene?

Puoi, e senza perdere niente. Sotto c'è PostgreSQL standard: nessun formato proprietario.

- **Supabase self-hosted** — la piattaforma è open source e si installa con Docker sul tuo
  server. Carichi il dump, sposti i file, cambi l'URL nel `.env`. **Zero codice da riscrivere.**
- **Un Postgres qualunque** — su un VPS o su un server aziendale. Vanno riadattati solo
  autenticazione e invio email, che sono servizi Supabase e non database.
- **Un altro programma** — dal dump esporti in CSV o Excel qualsiasi tabella.

Il backup del passo 11 è già l'archivio da cui ripartire: contiene struttura, dati, utenti
(con le password, che restano valide) e firme.

---

## Errori frequenti

**"new row violates row-level security policy"** — l'operazione è bloccata da una policy.
Nel 90% dei casi l'utente non è autenticato, oppure sta scrivendo su un'ispezione non sua o già
conclusa. È il sistema che funziona, non un bug.

**Le query dall'app tornano vuote ma in dashboard i dati ci sono** — il SQL Editor gira come
superutente e ignora le RLS. Prova la stessa query da un utente reale.

**Il progetto è "paused"** — piano Free, 7 giorni di inattività. Riattivalo dal dashboard e
controlla che il keep-alive del passo 10 stia girando.

**Il backup fallisce con timeout di connessione** — stai usando la connessione diretta invece
del Session pooler. Vedi passo 11.

**Non riesco a fare login con l'utente appena creato** — probabilmente manca la conferma email:
in Authentication → Users la colonna dice *Waiting for verification*. Ricrea l'utente con
*Auto Confirm User* attivo.
