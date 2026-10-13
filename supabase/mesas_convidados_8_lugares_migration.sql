-- Migração aditiva: mesas fixas com 8 lugares e categorias de convidados/equipe.
-- Não remove tabelas nem registros existentes.
begin;

alter table public.wedding_tables alter column capacity set default 8;
update public.wedding_tables set capacity = 8 where capacity <> 8;
alter table public.wedding_tables drop constraint if exists wedding_tables_capacity_check;
alter table public.wedding_tables add constraint wedding_tables_capacity_eight_check check (capacity = 8);

alter table public.wedding_tables add column if not exists table_type text not null default 'convidados';
alter table public.wedding_tables drop constraint if exists wedding_tables_table_type_check;
alter table public.wedding_tables add constraint wedding_tables_table_type_check
  check (table_type in ('convidados','staff'));

alter table public.wedding_guests add column if not exists category text not null default 'convidado';
alter table public.wedding_guests drop constraint if exists wedding_guests_category_check;
alter table public.wedding_guests add constraint wedding_guests_category_check
  check (category in ('convidado','familia','fotografia','cerimonial','story_maker','som','musica','celebrante','outro'));

alter table public.wedding_guests drop constraint if exists wedding_guests_rsvp_status_check;
alter table public.wedding_guests add constraint wedding_guests_rsvp_status_check
  check (rsvp_status in ('confirmado','pendente','nao_confirmado','recusado'));

commit;
