-- =====================================================================
-- Migrazione 04: visibilità dei punti vendita per ispettore
--
-- Ogni ispettore vede e può ispezionare solo i punti vendita che gli sono
-- stati assegnati dal pannello di amministrazione. Chi non ha assegnazioni
-- non vede nulla: la visibilità si apre con un atto esplicito, non per
-- dimenticanza.
--
-- Eseguire per intero nel SQL Editor di Supabase.
-- =====================================================================

create table ispettore_pdv (
  ispettore_id uuid not null references profili(id) on delete cascade,
  pdv_id       uuid not null references pdv(id)     on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (ispettore_id, pdv_id)
);

-- La chiave primaria copre già le ricerche per ispettore; questo serve al verso
-- opposto, quando il pannello conta quanti ispettori vedono un punto vendita.
create index idx_ispettore_pdv_pdv on ispettore_pdv(pdv_id);

alter table ispettore_pdv enable row level security;

create policy "vedo le mie assegnazioni"
  on ispettore_pdv for select to authenticated
  using (ispettore_id = auth.uid() or is_admin());

create policy "solo admin assegna"
  on ispettore_pdv for all to authenticated
  using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------
-- Lettura dell'anagrafica
--
-- Alla regola si aggiunge un'eccezione: restano leggibili anche i punti
-- vendita su cui l'ispettore ha già delle ispezioni. Senza, togliergli
-- un'assegnazione renderebbe illeggibile il suo storico — l'elenco
-- mostrerebbe «punto vendita non disponibile» al posto di sigla e città su
-- schede già firmate e spedite.
--
-- L'eccezione vale per la sola lettura. Aprire una NUOVA ispezione richiede
-- l'assegnazione, e a impedirlo è la policy di insert più sotto.
-- ---------------------------------------------------------------------
drop policy "lettura pdv" on pdv;

create policy "lettura pdv"
  on pdv for select to authenticated
  using (
    is_admin()
    or exists (
      select 1 from ispettore_pdv ip
      where ip.pdv_id = pdv.id and ip.ispettore_id = auth.uid()
    )
    or exists (
      select 1 from ispezioni i
      where i.pdv_id = pdv.id and i.ispettore_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- Creazione delle ispezioni
--
-- La restrizione dev'essere vera anche in scrittura: un elenco filtrato
-- lato app è una comodità, non una regola, e chi sa parlare con le API
-- aggirerebbe la prima ma non questa.
-- ---------------------------------------------------------------------
drop policy "creo le mie ispezioni" on ispezioni;

create policy "creo le mie ispezioni"
  on ispezioni for insert to authenticated
  with check (
    ispettore_id = auth.uid()
    and (
      is_admin()
      or exists (
        select 1 from ispettore_pdv ip
        where ip.ispettore_id = auth.uid() and ip.pdv_id = pdv_id
      )
    )
  );

-- ---------------------------------------------------------------------
-- Verifica
-- ---------------------------------------------------------------------
-- select p.nome, p.cognome, count(ip.pdv_id) as punti_vendita
--   from profili p
--   left join ispettore_pdv ip on ip.ispettore_id = p.id
--  group by p.id, p.nome, p.cognome
--  order by p.cognome;
