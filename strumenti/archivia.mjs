#!/usr/bin/env node
/**
 * Scarica in locale i file di StoreScout e libera lo spazio su Supabase.
 *
 * Il piano gratuito di Supabase concede 1 GB di storage, e con una ventina di ispezioni
 * al giorno — PDF, estratti, firme e foto — si riempie in poco più di un mese. Invece di
 * cancellare, questo strumento porta tutto su un disco aziendale: i documenti restano,
 * e Supabase torna a essere ciò che deve essere, un'area di transito.
 *
 * Gira una volta al giorno dall'Utilità di pianificazione di Windows.
 *
 * ── Come funziona ───────────────────────────────────────────────────────────────
 *
 * 1. Elenca i file dei tre bucket (`schede`, `firme`, `foto`).
 * 2. Scarica quelli che in locale non ci sono ancora, ricostruendo le cartelle.
 * 3. Cancella da Supabase i file più vecchi di GIORNI_DA_TENERE **che risultano già
 *    salvati in locale**, con la dimensione giusta.
 *
 * Il punto 3 non tocca mai un file che non sia già al sicuro: se il download di ieri è
 * fallito, quel file resta su Supabase e si riproverà domani. Meglio occupare spazio in
 * più che cancellare l'unica copia rimasta.
 *
 * ── Configurazione ──────────────────────────────────────────────────────────────
 *
 * Nel file `.env` della cartella di progetto servono, oltre alle due già presenti:
 *
 *   ARCHIVIO_CARTELLA=D:\\ArchivioStoreScout
 *   ARCHIVIO_EMAIL=tua.email@carellidistribuzione.it
 *   ARCHIVIO_PASSWORD=la-password-di-quell-utente
 *
 * Le credenziali sono quelle di un utente dell'app, non la chiave di servizio: per
 * leggere i file bastano i permessi che ha già un ispettore, e una chiave che scavalca
 * ogni regola non ha motivo di stare su un PC.
 */

import { createClient } from '@supabase/supabase-js';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const BUCKET = ['schede', 'firme', 'foto'];

/** Dopo quanti giorni un file già archiviato si può togliere da Supabase. */
const GIORNI_DA_TENERE = 20;

// ── Configurazione ──────────────────────────────────────────────────────────────

async function leggiEnv() {
  const testo = await readFile(new URL('../.env', import.meta.url), 'utf8').catch(() => '');
  const valori = {};
  for (const riga of testo.split(/\r?\n/)) {
    const pulita = riga.trim();
    if (!pulita || pulita.startsWith('#')) continue;
    const taglio = pulita.indexOf('=');
    if (taglio > 0) valori[pulita.slice(0, taglio).trim()] = pulita.slice(taglio + 1).trim();
  }
  return { ...valori, ...process.env };
}

const env = await leggiEnv();

const URL_SUPABASE = env.EXPO_PUBLIC_SUPABASE_URL;
const CHIAVE = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const CARTELLA = env.ARCHIVIO_CARTELLA;
const EMAIL = env.ARCHIVIO_EMAIL;
const PASSWORD = env.ARCHIVIO_PASSWORD;

const mancanti = [
  ['EXPO_PUBLIC_SUPABASE_URL', URL_SUPABASE],
  ['EXPO_PUBLIC_SUPABASE_ANON_KEY', CHIAVE],
  ['ARCHIVIO_CARTELLA', CARTELLA],
  ['ARCHIVIO_EMAIL', EMAIL],
  ['ARCHIVIO_PASSWORD', PASSWORD],
].filter(([, valore]) => !valore);

if (mancanti.length > 0) {
  console.error('Configurazione incompleta. Mancano nel file .env:');
  for (const [nome] of mancanti) console.error(`  ${nome}`);
  process.exit(1);
}

// ── Utilità ─────────────────────────────────────────────────────────────────────

const adesso = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const dice = (...parti) => console.log(`[${adesso()}]`, ...parti);

const leggibile = (byte) =>
  byte >= 1024 * 1024 ? `${(byte / 1024 / 1024).toFixed(1)} MB` : `${Math.round(byte / 1024)} KB`;

/**
 * Elenca ricorsivamente un bucket.
 *
 * L'API dello storage non ha una lista piatta: restituisce una cartella per volta, e le
 * sottocartelle si riconoscono perché non hanno metadati. Si scende a mano.
 */
async function elenca(supabase, bucket, prefisso = '') {
  const trovati = [];
  let pagina = 0;

  for (;;) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefisso, { limit: 100, offset: pagina * 100, sortBy: { column: 'name', order: 'asc' } });

    if (error) throw new Error(`elenco di ${bucket}/${prefisso}: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const voce of data) {
      const percorso = prefisso ? `${prefisso}/${voce.name}` : voce.name;
      if (voce.id === null || voce.metadata === null) {
        trovati.push(...(await elenca(supabase, bucket, percorso)));
      } else {
        trovati.push({
          percorso,
          byte: voce.metadata?.size ?? 0,
          creato: voce.created_at ?? voce.updated_at ?? null,
        });
      }
    }

    if (data.length < 100) break;
    pagina++;
  }

  return trovati;
}

/** Vero se il file è già in locale con la dimensione attesa. */
async function giaSalvato(destinazione, byteAttesi) {
  try {
    const informazioni = await stat(destinazione);
    // La dimensione a zero non si controlla: alcuni metadati non la riportano, e in quel
    // caso basta che il file esista.
    return byteAttesi === 0 || informazioni.size === byteAttesi;
  } catch {
    return false;
  }
}

async function scarica(supabase, bucket, percorso, destinazione) {
  const { data, error } = await supabase.storage.from(bucket).download(percorso);
  if (error) throw new Error(error.message);

  await mkdir(dirname(destinazione), { recursive: true });
  // In streaming invece che tutto in memoria: i PDF sono piccoli, ma una cartella di
  // foto di un anno non deve passare per la RAM.
  await pipeline(Readable.fromWeb(data.stream()), createWriteStream(destinazione));
}

// ── Corpo ───────────────────────────────────────────────────────────────────────

const supabase = createClient(URL_SUPABASE, CHIAVE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

dice('Accesso a Supabase…');
const { error: erroreAccesso } = await supabase.auth.signInWithPassword({
  email: EMAIL,
  password: PASSWORD,
});
if (erroreAccesso) {
  console.error(`Accesso non riuscito: ${erroreAccesso.message}`);
  process.exit(1);
}

const scadenza = new Date();
scadenza.setDate(scadenza.getDate() - GIORNI_DA_TENERE);

let scaricati = 0;
let byteScaricati = 0;
let gia = 0;
let falliti = 0;
const daCancellare = {};

for (const bucket of BUCKET) {
  dice(`— bucket ${bucket}`);
  let file;
  try {
    file = await elenca(supabase, bucket);
  } catch (e) {
    console.error(`  elenco non riuscito: ${e.message}`);
    falliti++;
    continue;
  }

  dice(`  ${file.length} file sul server`);
  daCancellare[bucket] = [];

  for (const voce of file) {
    const destinazione = resolve(join(CARTELLA, bucket, voce.percorso));

    if (await giaSalvato(destinazione, voce.byte)) {
      gia++;
    } else {
      try {
        await scarica(supabase, bucket, voce.percorso, destinazione);
        scaricati++;
        byteScaricati += voce.byte;
      } catch (e) {
        console.error(`  ${voce.percorso}: ${e.message}`);
        falliti++;
        continue;
      }
    }

    // Si cancella solo ciò che è vecchio **e** già al sicuro in locale.
    if (voce.creato && new Date(voce.creato) < scadenza) {
      if (await giaSalvato(destinazione, voce.byte)) daCancellare[bucket].push(voce.percorso);
    }
  }
}

dice(`Scaricati ${scaricati} file (${leggibile(byteScaricati)}), ${gia} già presenti, ${falliti} non riusciti`);

// ── Pulizia su Supabase ─────────────────────────────────────────────────────────

let cancellati = 0;
for (const bucket of BUCKET) {
  const elenco = daCancellare[bucket] ?? [];
  if (elenco.length === 0) continue;

  // A blocchi: l'API accetta un numero limitato di percorsi per chiamata.
  for (let i = 0; i < elenco.length; i += 50) {
    const blocco = elenco.slice(i, i + 50);
    const { error } = await supabase.storage.from(bucket).remove(blocco);
    if (error) {
      console.error(`  pulizia di ${bucket}: ${error.message}`);
      falliti++;
    } else {
      cancellati += blocco.length;
    }
  }
}

if (cancellati > 0) {
  dice(`Tolti da Supabase ${cancellati} file più vecchi di ${GIORNI_DA_TENERE} giorni, già archiviati in locale`);
} else {
  dice('Niente da togliere da Supabase');
}

await supabase.auth.signOut();

// Codice di uscita diverso da zero se qualcosa non è andato: l'Utilità di
// pianificazione lo segna come fallito e te ne accorgi dallo storico.
process.exit(falliti > 0 ? 1 : 0);
