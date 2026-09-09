-- =====================================================================
-- Migrazione 06: foto delle attività rilevate
--
-- Una riga per foto invece di un array di percorsi sulla riga attività:
-- serve conservare anche il peso in byte, che è quello su cui si decide se
-- la mail può partire. Chiederlo allo Storage foto per foto, al momento
-- dell'invio, vorrebbe dire scoprire il problema quando è troppo tardi.
--
-- PRIMA di eseguire: creare in Storage il bucket `foto`, con
-- "Public bucket" DISATTIVATO. Le foto ritraggono l'interno dei punti
-- vendita e non devono essere scaricabili da chiunque conosca l'URL.
--
-- Eseguire per intero nel SQL Editor di Supabase.
-- =====================================================================

create table ispezione_foto (
  id           uuid primary key default gen_random_uuid(),
  ispezione_id uuid not null references ispezioni(id) on delete cascade,
  -- L'attività a cui la foto appartiene. Nessun vincolo di chiave esterna:
  -- le righe attività vengono riscritte in blocco a ogni salvataggio, e un
  -- riferimento rigido farebbe fallire il salvataggio invece di seguire.
  attivita_id  uuid not null,
  ordine       integer not null default 0,
  path         text not null,
  byte         integer not null,
  created_at   timestamptz not null default now()
);

create index idx_foto_ispezione on ispezione_foto(ispezione_id, ordine);

alter table ispezione_foto enable row level security;

-- Stessi permessi delle altre righe figlie: seguono l'ispezione padre.
create policy "foto attivita"
  on ispezione_foto for all to authenticated
  using (exists (
    select 1 from ispezioni i
    where i.id = ispezione_id and (i.ispettore_id = auth.uid() or is_admin())
  ))
  with check (exists (
    select 1 from ispezioni i
    where i.id = ispezione_id and i.ispettore_id = auth.uid() and i.stato = 'bozza'
  ) or is_admin());

-- ---------------------------------------------------------------------
-- Storage
--
-- Le quattro policy servono tutte. Con le sole select e insert, un secondo
-- tentativo di conclusione dopo un errore a metà verrebbe rifiutato
-- (`upsert` richiede l'update) e nessuno potrebbe più eliminare le foto di
-- una bozza scartata. È lo stesso inciampo già visto sui bucket `firme` e
-- `schede`.
-- ---------------------------------------------------------------------
create policy "utenti autenticati leggono le foto"
  on storage.objects for select to authenticated
  using (bucket_id = 'foto');

create policy "utenti autenticati caricano le foto"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'foto');

create policy "utenti autenticati sostituiscono le foto"
  on storage.objects for update to authenticated
  using (bucket_id = 'foto') with check (bucket_id = 'foto');

create policy "utenti autenticati eliminano le foto"
  on storage.objects for delete to authenticated
  using (bucket_id = 'foto');

-- ---------------------------------------------------------------------
-- Verifica
-- ---------------------------------------------------------------------
-- select count(*) as foto, pg_size_pretty(sum(byte)) as peso from ispezione_foto;
