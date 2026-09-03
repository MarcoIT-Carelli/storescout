-- =====================================================================
-- Migrazione 02: seed liste valori
-- Le email dei destinatari sono da completare (vedi §14 della specifica).
-- =====================================================================

insert into destinatari (nome, email, ordine) values
  ('CN',              null, 1),
  ('CATEGORY',        null, 2),
  ('UFFICIO MKTG',    null, 3),
  ('UFFICIO TECNICO', null, 4),
  ('UFFICIO HACCP',   null, 5),
  ('EDP',             null, 6),
  ('SICUREZZA',       null, 7)
on conflict (nome) do update set ordine = excluded.ordine;

insert into reparti (nome, ordine) values
  ('ESTERNO PDV',       1),
  ('MAGAZZINO',         2),
  ('ORTOFRUTTA',        3),
  ('SALUMERIA',         4),
  ('SURGELATI',         5),
  ('DEPERIBILI',        6),
  ('MACELLERIA',        7),
  ('SALA VANO TECNICO', 8),
  ('BARRIERA CASSE',    9),
  ('BOX UFFICIO',      10),
  ('GENERICO',         11)
on conflict (nome) do update set ordine = excluded.ordine;

insert into tipi_intervento (nome, ordine) values
  ('COMUNICAZIONE',                 1),
  ('ROTTURE/ECCESSI',               2),
  ('NON IDONEI',                    3),
  ('PULIZIE',                       4),
  ('GUASTO/MALFUNZIONAMENTO',       5),
  ('RIPRISTINO (ES. PITTURAZIONE)', 6),
  ('TECNICO',                       7),
  ('MKTG',                          8),
  ('EDP',                           9),
  ('SICUREZZA',                    10),
  ('HACCP',                        11)
on conflict (nome) do update set ordine = excluded.ordine;

-- Da eseguire quando avrai le email:
-- update destinatari set email = 'indirizzo@carellidistribuzione.it' where nome = 'CN';
