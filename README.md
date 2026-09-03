# App Schede Attività Ispettori — Indice dei file

Progetto Carelli Distribuzione, area vendite. Questa cartella contiene tutto il materiale
prodotto finora. Scaricala per intero e usala come cartella di lavoro del progetto.

## Ordine di lavoro

1. Leggi `GUIDA_SUPABASE.md` ed esegui i passi 1–2 (creazione account e progetto).
2. Torna ai file SQL e caricali dal SQL Editor: `01`, poi `02`, poi `03`.
3. Prosegui con i passi 6–9 della guida.
4. Metti in funzione `keep-alive.yml` e `backup.yml` (passi 10–11).
5. Solo a questo punto si passa alla grafica e allo sviluppo dell'app.

## I file

| File | Cosa è | Dove va |
|---|---|---|
| `SPEC_APP_ISPETTORI.md` | Specifica funzionale e tecnica completa | Nella cartella del progetto. È il documento da dare a Claude Code prima di generare codice. |
| `GUIDA_SUPABASE.md` | Guida passo passo alla configurazione | Da leggere a schermo. Non va caricata da nessuna parte. |
| `01_schema.sql` | Tabelle, trigger, policy di sicurezza | Copia e incolla nel **SQL Editor** di Supabase, poi Run. |
| `02_seed_liste.sql` | Destinatari, reparti, tipi di intervento | Idem, dopo il 01. |
| `03_seed_pdv.sql` | I 47 punti vendita | Idem, dopo il 02. |
| `keep-alive.yml` | Impedisce la sospensione del progetto | `.github/workflows/keep-alive.yml` nel repository. |
| `backup.yml` | Backup notturno cifrato di database e firme | `.github/workflows/backup.yml` nel repository. |
| `pdv_seed.csv` | La stessa anagrafica in formato tabella | Tienilo da parte: servirà per collaudare l'import CSV del pannello admin. |

I tre file SQL non vanno "caricati" come file: si aprono con un editor di testo, si seleziona
tutto, si copia e si incolla nel SQL Editor di Supabase.

## Stato del progetto

**Fatto**
- Analisi del modello Excel esistente ed estrazione delle liste valori
- Specifica funzionale e tecnica
- Schema database con Row Level Security
- Anagrafica 47 punti vendita (BV, BJ e SE esclusi su indicazione del committente)
- Guida alla configurazione, keep-alive e backup

**Prossimo passo**
- Grafica su Claude Design, partendo dalla schermata delle attività rilevate

**Dati ancora mancanti** (vedi §14 della specifica)
- Email dei sette destinatari attività — bloccante per l'invio delle schede
- Credenziali SMTP Aruba e indirizzo mittente — bloccante per l'invio delle schede
- Elenco ispettori con email
- Logo aziendale e colori istituzionali
- Decisione su `EC` (e-commerce), oggi caricato come non attivo

---

## Avviare l'app

Prerequisiti già installati su questa macchina: Node 24, JDK 17, Android SDK in
`%LOCALAPPDATA%\Android\Sdk`, emulatore tablet `StoreScout_Tablet` (1280×800, Android 15).

```powershell
# 1. variabili d'ambiente (una volta per sessione di terminale)
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME

# 2. emulatore
& "$env:ANDROID_HOME\emulator\emulator.exe" -avd StoreScout_Tablet

# 3. app (installa e avvia la build di sviluppo)
npm run android
```

Dopo la prima volta basta `npm run android`: Metro si riavvia e l'app si ricarica.
Per la sola ricompilazione nativa (dopo aver aggiunto un modulo con codice nativo):
`npx expo prebuild --platform android` seguito da `npm run android`.

`.env` contiene solo `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
Il file non è versionato: `.env.example` ne è il modello.

## Nota sulla splash nativa

`assets/splash.png` è volutamente un'immagine trasparente. Da Android 12 la schermata di
avvio di sistema usa `windowSplashScreenAnimatedIcon`, che **ritaglia l'icona dentro un
cerchio di dimensione fissa**: qualunque marchio ci si metta viene rimpicciolito e tagliato,
e non può combaciare con il primo fotogramma dell'animazione. Mostrarne uno lì dentro
significa far vedere due marchi diversi in successione.

Resta quindi il solo colore di fondo, scelto in base al tema con cui l'app è stata chiusa,
e il marchio compare una volta sola: quello animato di `src/components/SplashAnimation.tsx`.
