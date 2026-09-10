-- =====================================================================
-- Migrazione 07: spegnere il flag deve_cambiare_password
--
-- La policy di update su `profili` è riservata agli amministratori, ed è
-- giusto così: se un ispettore potesse scrivere sul proprio profilo
-- potrebbe anche promuoversi ad amministratore, perché le policy non
-- distinguono fra colonne.
--
-- Il risultato però era che nessun ispettore riusciva a spegnere il
-- proprio flag: cambiava la password, l'app aggiornava il suo stato in
-- memoria e sembrava fatta, ma la scrittura veniva rifiutata in silenzio
-- — PostgREST risponde «fatto» anche quando non tocca una riga. Al
-- riavvio successivo il flag era ancora acceso e la schermata di cambio
-- password tornava, per sempre.
--
-- Questa funzione fa quella sola cosa, e solo sul proprio profilo.
-- =====================================================================

create or replace function password_cambiata()
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  toccate integer;
begin
  update profili
     set deve_cambiare_password = false
   where id = auth.uid()
     and deve_cambiare_password;

  get diagnostics toccate = row_count;
  return toccate > 0;
end;
$$;

revoke all on function password_cambiata() from public;
grant execute on function password_cambiata() to authenticated;
