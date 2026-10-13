-- Número obrigatório e exclusivo para cada mesa; nome opcional.
-- Migração aditiva: preserva todas as mesas e seus relacionamentos.
begin;
alter table public.wedding_tables add column if not exists table_number integer;
with numbered as (
  select id, row_number() over (order by id) as rn
  from public.wedding_tables
  where table_number is null
)
update public.wedding_tables t
set table_number = numbered.rn
from numbered
where t.id = numbered.id;
alter table public.wedding_tables alter column table_number set not null;
create unique index if not exists idx_wedding_tables_table_number
  on public.wedding_tables(table_number);
commit;
