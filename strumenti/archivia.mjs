#!/usr/bin/env node
/**
 * Sposta su questo computer i file di StoreScout, svuotando lo storage di Supabase.
 *
 * Scarica PDF, firme e foto mantenendo la struttura delle cartelle, e cancella dal
 * server ciò che ha portato via. Non fa altro.
 *
 * ── Perché non ha dipendenze ────────────────────────────────────────────────────
 *
 * Gira sul PC di backup, che non è la macchina di sviluppo: un file solo, nessun
 * `npm install`, nessuna cartella di librerie da tenere aggiornata. Serve soltanto
 * Node 18 o successivo, che porta `fetch` con sé. Le API di Supabase sono HTTP, e
 * chiamarle direttamente costa meno che portarsi dietro un client intero.
 *
 * ── Installazione ───────────────────────────────────────────────────────────────
 *
 * 1. Copia questo file in una cartella del PC di backup, per esempio
 *    `C:\\Storescout\\strumenti\\archivia.mjs`
 * 2. Accanto al file crea `.env` con dentro:
 *
 *      SUPABASE_URL=https://xxxxxxxx.supabase.co
 *      SUPABASE_ANON_KEY=eyJ...
 *      ARCHIVIO_CARTELLA=C:\\Storescout\\archivio
 *      ARCHIVIO_EMAIL=utente@carellidistribuzione.it
 *      ARCHIVIO_PASSWORD=la-password-di-quell-utente
 *
 * 3. Provalo:  node archivia.mjs
 *
 * ── Come si comporta ────────────────────────────────────────────────────────────
 *
 * Un file viene cancellato dal server **solo dopo** essere stato scritto su disco con
 * la dimensione giusta. Se il download fallisce, quel file resta su Supabase e si
 * riproverà domani: meglio occupare spazio in più che perdere l'unica copia.
 *
 * `GIORNI_DA_TENERE` a zero significa portare via tutto. Alzandolo si lascia sul
 * server una finestra recente — serve al reinvio di una scheda e alla riapertura del
 * PDF dallo storico, che leggono il file da lì.
 */

import { createWriteStream } from 'node:fs';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const BUCKET = ['schede', 'firme', 'foto'];

/** Giorni da lasciare sul server. Zero: si porta via tutto. */
const GIORNI_DA_TENERE = 0;

// ── Configurazione ──────────────────────────────────────────────────────────────

const QUI = dirname(fileURLToPath(import.meta.url));

async function leggiEnv() {
  const valori = {};
  for (const nome of ['.env', '../.env']) {
    const testo = await readFile(join(QUI, nome), 'utf8').catch(() => null);
    if (testo === null) continue;
    for (const riga of testo.split(/\r?\n/)) {
      const pulita = riga.trim();
      if (!pulita || pulita.startsWith('#')) continue;
      const taglio = pulita.indexOf('=');
      if (taglio > 0) valori[pulita.slice(0, taglio).trim()] = pulita.slice(taglio + 1).trim();
    }
    break;
  }
  return { ...valori, ...process.env };
}

const env = await leggiEnv();

// I nomi con `EXPO_PUBLIC_` sono quelli del progetto: si accettano entrambi, così lo
// stesso file funziona sia qui sia sul PC di backup.
const URL_SUPABASE = env.SUPABASE_URL || env.EXPO_PUBLIC_SUPABASE_URL;
const CHIAVE = env.SUPABASE_ANON_KEY || env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const CARTELLA = env.ARCHIVIO_CARTELLA;
const EMAIL = env.ARCHIVIO_EMAIL;
const PASSWORD = env.ARCHIVIO_PASSWORD;

const mancanti = [
  ['SUPABASE_URL', URL_SUPABASE],
  ['SUPABASE_ANON_KEY', CHIAVE],
  ['ARCHIVIO_CARTELLA', CARTELLA],
  ['ARCHIVIO_EMAIL', EMAIL],
  ['ARCHIVIO_PASSWORD', PASSWORD],
].filter(([, valore]) => !valore);

if (mancanti.length > 0) {
  console.error('Configurazione incompleta. Nel file .env mancano:');
  for (const [nome] of mancanti) console.error(`  ${nome}`);
  process.exit(1);
}

// ── Utilità ─────────────────────────────────────────────────────────────────────

const adesso = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const dice = (...parti) => console.log(`[${adesso()}]`, ...parti);
const leggibile = (byte) =>
  byte >= 1024 * 1024 ? `${(byte / 1024 / 1024).toFixed(1)} MB` : `${Math.round(byte / 1024)} KB`;

let token = '';

const intestazioni = () => ({
  apikey: CHIAVE,
  Authorization: `Bearer ${token || CHIAVE}`,
  'Content-Type': 'application/json',
});

async function accedi() {
  const r = await fetch(`${URL_SUPABASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: CHIAVE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!r.ok) throw new Error(`accesso non riuscito: ${r.status} ${await r.text()}`);
  token = (await r.json()).access_token;
}

/**
 * Elenca un bucket scendendo nelle sottocartelle.
 *
 * L'API restituisce una cartella per volta; le sottocartelle si riconoscono perché non
 * hanno metadati. Si scende a mano.
 */
async function elenca(bucket, prefisso = '') {
  const trovati = [];
  let saltati = 0;

  for (;;) {
    const r = await fetch(`${URL_SUPABASE}/storage/v1/object/list/${bucket}`, {
      method: 'POST',
      headers: intestazioni(),
      body: JSON.stringify({
        prefix: prefisso,
        limit: 100,
        offset: saltati,
        sortBy: { column: 'name', order: 'asc' },
      }),
    });
    if (!r.ok) throw new Error(`elenco di ${bucket}/${prefisso}: ${r.status} ${await r.text()}`);

    const pagina = await r.json();
    if (!Array.isArray(pagina) || pagina.length === 0) break;

    for (const voce of pagina) {
      const percorso = prefisso ? `${prefisso}/${voce.name}` : voce.name;
      if (voce.id === null || voce.metadata == null) {
        trovati.push(...(await elenca(bucket, percorso)));
      } else {
        trovati.push({
          percorso,
          byte: voce.metadata?.size ?? 0,
          creato: voce.created_at ?? voce.updated_at ?? null,
        });
      }
    }

    if (pagina.length < 100) break;
    saltati += 100;
  }

  return trovati;
}

/** Vero se il file è già su disco con la dimensione attesa. */
async function giaSalvato(destinazione, byteAttesi) {
  try {
    const informazioni = await stat(destinazione);
    return byteAttesi === 0 || informazioni.size === byteAttesi;
  } catch {
    return false;
  }
}

async function scarica(bucket, percorso, destinazione) {
  const r = await fetch(
    `${URL_SUPABASE}/storage/v1/object/${bucket}/${percorso.split('/').map(encodeURIComponent).join('/')}`,
    { headers: { apikey: CHIAVE, Authorization: `Bearer ${token}` } },
  );
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);

  await mkdir(dirname(destinazione), { recursive: true });
  // In streaming: una cartella di foto non deve passare per la memoria.
  await pipeline(Readable.fromWeb(r.body), createWriteStream(destinazione));
}

async function cancella(bucket, percorsi) {
  const r = await fetch(`${URL_SUPABASE}/storage/v1/object/${bucket}`, {
    method: 'DELETE',
    headers: intestazioni(),
    body: JSON.stringify({ prefixes: percorsi }),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
}

// ── Corpo ───────────────────────────────────────────────────────────────────────

dice('Accesso a Supabase…');
try {
  await accedi();
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

const scadenza = new Date();
scadenza.setDate(scadenza.getDate() - GIORNI_DA_TENERE);

let scaricati = 0;
let byteScaricati = 0;
let gia = 0;
let cancellati = 0;
let falliti = 0;

for (const bucket of BUCKET) {
  let file;
  try {
    file = await elenca(bucket);
  } catch (e) {
    console.error(`[${bucket}] ${e.message}`);
    falliti++;
    continue;
  }

  dice(`${bucket}: ${file.length} file sul server`);
  const daTogliere = [];

  for (const voce of file) {
    const destinazione = resolve(join(CARTELLA, bucket, voce.percorso));

    if (await giaSalvato(destinazione, voce.byte)) {
      gia++;
    } else {
      try {
        await scarica(bucket, voce.percorso, destinazione);
        scaricati++;
        byteScaricati += voce.byte;
      } catch (e) {
        console.error(`  ${voce.percorso}: ${e.message}`);
        falliti++;
        continue;
      }
    }

    // Si toglie dal server solo ciò che è davvero su disco. Un download fallito
    // lascia il file dov'è, e domani si riprova.
    const abbastanzaVecchio = !voce.creato || new Date(voce.creato) < scadenza;
    if (abbastanzaVecchio && (await giaSalvato(destinazione, voce.byte))) {
      daTogliere.push(voce.percorso);
    }
  }

  // A blocchi: l'API accetta un numero limitato di percorsi per chiamata.
  for (let i = 0; i < daTogliere.length; i += 50) {
    const blocco = daTogliere.slice(i, i + 50);
    try {
      await cancella(bucket, blocco);
      cancellati += blocco.length;
    } catch (e) {
      console.error(`  pulizia di ${bucket}: ${e.message}`);
      falliti++;
    }
  }
}

dice(
  `Scaricati ${scaricati} file (${leggibile(byteScaricati)}), ${gia} già presenti, ` +
    `${cancellati} tolti dal server, ${falliti} non riusciti`,
);

// Uscita diversa da zero se qualcosa non è andato: l'Utilità di pianificazione la
// registra come esecuzione fallita, e te ne accorgi dallo storico.
process.exit(falliti > 0 ? 1 : 0);
