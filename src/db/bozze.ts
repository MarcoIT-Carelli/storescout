import * as SQLite from 'expo-sqlite';

import type { Bozza } from '@/types/bozza';

/**
 * Archivio locale delle ispezioni in corso. Non è una sincronizzazione offline completa:
 * serve solo a garantire che una scheda già compilata non si perda per una chiusura
 * imprevista o per un'assenza di rete dentro il punto vendita.
 *
 * La bozza è salvata come un unico documento JSON invece che replicando le tabelle remote:
 * la scheda si legge e si riscrive sempre per intero, e un solo record evita disallineamenti
 * fra righe attività e testata.
 */

let db: SQLite.SQLiteDatabase | null = null;

async function apri(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('storescout.db');
  await db.execAsync(`
    pragma journal_mode = WAL;
    create table if not exists bozze (
      id text primary key not null,
      ispettore_id text not null,
      dati text not null,
      aggiornata integer not null
    );
  `);
  return db;
}

type Riga = { id: string; dati: string; aggiornata: number };

export async function salvaBozza(bozza: Bozza): Promise<void> {
  const d = await apri();
  await d.runAsync(
    'insert or replace into bozze (id, ispettore_id, dati, aggiornata) values (?, ?, ?, ?)',
    bozza.id,
    bozza.ispettore_id,
    JSON.stringify(bozza),
    Date.now(),
  );
}

export async function leggiBozza(id: string): Promise<Bozza | null> {
  const d = await apri();
  const riga = await d.getFirstAsync<Riga>('select * from bozze where id = ?', id);
  return riga ? (JSON.parse(riga.dati) as Bozza) : null;
}

export async function leggiBozze(ispettoreId: string): Promise<Bozza[]> {
  const d = await apri();
  const righe = await d.getAllAsync<Riga>(
    'select * from bozze where ispettore_id = ? order by aggiornata desc',
    ispettoreId,
  );
  return righe.map((r) => JSON.parse(r.dati) as Bozza);
}

export async function eliminaBozza(id: string): Promise<void> {
  const d = await apri();
  await d.runAsync('delete from bozze where id = ?', id);
}
