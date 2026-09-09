-- =====================================================================
-- Migrazione 05: verifica delle attività assegnate a CN
--
-- Un'ispezione che contiene attività assegnate a un destinatario "da
-- verificare" non si considera chiusa quando parte la mail: resta in carico
-- all'ispettore finché non la chiude lui, dopo aver controllato che
-- l'intervento sia stato fatto.
--
-- Eseguire per intero nel SQL Editor di Supabase.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Quali destinatari fanno scattare la verifica
--
-- È un flag sulla lista, non il nome "CN" scritto nel codice: le liste
-- valori sono modificabili dall'admin a runtime, e una condizione legata al
-- nome si romperebbe in silenzio il giorno in cui qualcuno rinomina la voce
-- o ne aggiunge una seconda con lo stesso scopo.
-- ---------------------------------------------------------------------
alter table destinatari
  add column richiede_verifica boolean not null default false;

update destinatari set richiede_verifica = true where nome = 'CN';

-- ---------------------------------------------------------------------
-- Stato della verifica
--
-- Colonne separate dallo stato dell'invio: una scheda può essere insieme
-- "inviata" e "da chiudere", e schiacciare i due significati in un unico
-- enum farebbe perdere la traccia di un invio fallito mentre è in verifica.
-- ---------------------------------------------------------------------
alter table ispezioni
  add column in_verifica boolean not null default false,
  add column verifica_chiusa_at timestamptz;

-- Le ispezioni da chiudere si leggono a ogni apertura della home: senza
-- indice sarebbe una scansione dell'intera tabella a ogni avvio.
create index idx_ispezioni_da_verificare
  on ispezioni(ispettore_id, data_ispezione desc)
  where in_verifica;

-- ---------------------------------------------------------------------
-- Chiusura della verifica
--
-- Passa da una funzione e non da un update diretto perché la policy di
-- update su `ispezioni` si ferma alle bozze, ed è giusto che sia così: una
-- scheda firmata e spedita non si tocca. Allargare quella policy per far
-- passare un solo campo aprirebbe l'intera riga, visto che le policy non
-- distinguono fra colonne — un ispettore potrebbe riscrivere gli orari di
-- un documento già in mano all'ufficio.
--
-- Qui invece l'unica cosa che si può cambiare è la chiusura della verifica,
-- e solo sulle proprie ispezioni.
-- ---------------------------------------------------------------------
create or replace function chiudi_verifica(id_ispezione uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  toccate integer;
begin
  update ispezioni
     set in_verifica = false,
         verifica_chiusa_at = now()
   where id = id_ispezione
     and in_verifica
     and (ispettore_id = auth.uid() or is_admin());

  get diagnostics toccate = row_count;
  return toccate > 0;
end;
$$;

revoke all on function chiudi_verifica(uuid) from public;
grant execute on function chiudi_verifica(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Verifica
-- ---------------------------------------------------------------------
-- select nome, richiede_verifica from destinatari order by ordine;
-- select count(*) from ispezioni where in_verifica;
