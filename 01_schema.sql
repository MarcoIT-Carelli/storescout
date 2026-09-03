-- =====================================================================
-- APP SCHEDE ATTIVITÀ ISPETTORI — Carelli Distribuzione
-- Migrazione 01: schema, trigger, Row Level Security
-- Eseguire per intero nel SQL Editor di Supabase.
-- =====================================================================

-- ---------- ENUM ----------
create type ruolo_utente     as enum ('admin', 'ispettore');
create type stato_ispezione  as enum ('bozza', 'conclusa', 'inviata', 'errore_invio');
create type stato_invio      as enum ('in_coda', 'inviata', 'errore');

-- ---------- PROFILI ----------
create table profili (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null default '',
  cognome text not null default '',
  email text not null unique,
  ruolo ruolo_utente not null default 'ispettore',
  attivo boolean not null default true,
  deve_cambiare_password boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Crea automaticamente il profilo quando viene creato un utente in Authentication.
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profili (id, email, nome, cognome)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nome', ''),
    coalesce(new.raw_user_meta_data->>'cognome', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- PUNTI VENDITA ----------
create table pdv (
  id uuid primary key default gen_random_uuid(),
  progressivo text not null,
  codice text not null unique,
  citta text not null,
  indirizzo text not null,
  ragione_sociale text not null,
  codice_deposito text,
  telefono text,
  email text,
  responsabile_nome text,
  attivo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- LISTE VALORI ----------
create table destinatari (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  email text,
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

-- ---------- ISPEZIONI ----------
create table ispezioni (
  id uuid primary key default gen_random_uuid(),
  numero serial,
  pdv_id uuid not null references pdv(id),
  ispettore_id uuid not null references profili(id),
  data_ispezione date not null default current_date,
  ora_ingresso timestamptz not null default now(),
  ora_uscita timestamptz,
  niente_da_rilevare boolean not null default false,
  ha_svolto_attivita boolean not null default false,
  firma_ispettore_path text,
  firma_responsabile_path text,
  nome_responsabile text,
  motivo_assenza_firma text,
  pdf_path text,
  stato stato_ispezione not null default 'bozza',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ora_uscita_dopo_ingresso
    check (ora_uscita is null or ora_uscita >= ora_ingresso)
);

create table ispezione_attivita (
  id uuid primary key default gen_random_uuid(),
  ispezione_id uuid not null references ispezioni(id) on delete cascade,
  ordine integer not null default 0,
  destinatario_id uuid references destinatari(id),
  reparto_id uuid references reparti(id),
  tipo_intervento_id uuid references tipi_intervento(id),
  note text,
  scadenza_data date,
  scadenza_testo text,
  scadenza_note text,
  created_at timestamptz not null default now()
);

create table ispezione_svolte (
  id uuid primary key default gen_random_uuid(),
  ispezione_id uuid not null references ispezioni(id) on delete cascade,
  ordine integer not null default 0,
  descrizione text not null
);

create table invii_email (
  id uuid primary key default gen_random_uuid(),
  ispezione_id uuid not null references ispezioni(id) on delete cascade,
  destinatari jsonb not null,
  oggetto text not null,
  stato stato_invio not null default 'in_coda',
  errore text,
  tentativi integer not null default 0,
  inviata_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- INDICI ----------
create index idx_ispezioni_ispettore on ispezioni(ispettore_id, data_ispezione desc);
create index idx_ispezioni_pdv       on ispezioni(pdv_id, data_ispezione desc);
create index idx_attivita_ispezione  on ispezione_attivita(ispezione_id, ordine);
create index idx_svolte_ispezione    on ispezione_svolte(ispezione_id, ordine);
create index idx_pdv_attivi          on pdv(codice) where attivo = true;

-- ---------- AGGIORNAMENTO updated_at ----------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_ispezioni_updated
  before update on ispezioni
  for each row execute function set_updated_at();

create trigger trg_profili_updated
  before update on profili
  for each row execute function set_updated_at();

-- =====================================================================
-- ROW LEVEL SECURITY
-- Senza queste policy qualunque utente autenticato leggerebbe i dati
-- di tutti gli altri. Vanno applicate prima di inserire dati reali.
-- =====================================================================

create or replace function is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from profili
    where id = auth.uid() and ruolo = 'admin' and attivo = true
  );
$$;

alter table profili            enable row level security;
alter table pdv                enable row level security;
alter table destinatari        enable row level security;
alter table reparti            enable row level security;
alter table tipi_intervento    enable row level security;
alter table ispezioni          enable row level security;
alter table ispezione_attivita enable row level security;
alter table ispezione_svolte   enable row level security;
alter table invii_email        enable row level security;

-- --- PROFILI ---
create policy "vedo il mio profilo, admin vede tutti"
  on profili for select to authenticated
  using (id = auth.uid() or is_admin());

create policy "solo admin modifica i profili"
  on profili for update to authenticated
  using (is_admin()) with check (is_admin());

-- --- ANAGRAFICHE E LISTE: lettura a tutti, scrittura ai soli admin ---
create policy "lettura pdv"          on pdv             for select to authenticated using (true);
create policy "scrittura pdv"        on pdv             for all    to authenticated using (is_admin()) with check (is_admin());
create policy "lettura destinatari"  on destinatari     for select to authenticated using (true);
create policy "scrittura destinatari" on destinatari    for all    to authenticated using (is_admin()) with check (is_admin());
create policy "lettura reparti"      on reparti         for select to authenticated using (true);
create policy "scrittura reparti"    on reparti         for all    to authenticated using (is_admin()) with check (is_admin());
create policy "lettura tipi"         on tipi_intervento for select to authenticated using (true);
create policy "scrittura tipi"       on tipi_intervento for all    to authenticated using (is_admin()) with check (is_admin());

-- --- ISPEZIONI ---
create policy "vedo le mie ispezioni"
  on ispezioni for select to authenticated
  using (ispettore_id = auth.uid() or is_admin());

create policy "creo le mie ispezioni"
  on ispezioni for insert to authenticated
  with check (ispettore_id = auth.uid());

create policy "modifico solo le mie bozze"
  on ispezioni for update to authenticated
  using ((ispettore_id = auth.uid() and stato = 'bozza') or is_admin())
  with check ((ispettore_id = auth.uid()) or is_admin());

create policy "elimino solo le mie bozze"
  on ispezioni for delete to authenticated
  using ((ispettore_id = auth.uid() and stato = 'bozza') or is_admin());

-- --- RIGHE FIGLIE: seguono i permessi dell'ispezione padre ---
create policy "righe attivita"
  on ispezione_attivita for all to authenticated
  using (exists (
    select 1 from ispezioni i
    where i.id = ispezione_id and (i.ispettore_id = auth.uid() or is_admin())
  ))
  with check (exists (
    select 1 from ispezioni i
    where i.id = ispezione_id and i.ispettore_id = auth.uid() and i.stato = 'bozza'
  ) or is_admin());

create policy "righe svolte"
  on ispezione_svolte for all to authenticated
  using (exists (
    select 1 from ispezioni i
    where i.id = ispezione_id and (i.ispettore_id = auth.uid() or is_admin())
  ))
  with check (exists (
    select 1 from ispezioni i
    where i.id = ispezione_id and i.ispettore_id = auth.uid() and i.stato = 'bozza'
  ) or is_admin());

-- --- LOG INVII: sola lettura per l'ispettore, scrittura riservata al backend ---
create policy "leggo i log dei miei invii"
  on invii_email for select to authenticated
  using (exists (
    select 1 from ispezioni i
    where i.id = ispezione_id and (i.ispettore_id = auth.uid() or is_admin())
  ));
