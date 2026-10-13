-- Regras de integridade: limite de oito pessoas e separação entre staff/convidados.
-- Não altera nem apaga registros existentes.
begin;

create or replace function public.enforce_wedding_guest_seating()
returns trigger
language plpgsql
as $$
declare
  v_table_type text;
  v_occupancy integer;
  v_is_staff boolean;
begin
  if new.table_id is null then return new; end if;

  select table_type into v_table_type
  from public.wedding_tables
  where id = new.table_id
  for update;

  if not found then raise exception 'A mesa selecionada não existe.'; end if;

  v_is_staff := new.category in ('fotografia','cerimonial','story_maker','som','musica','celebrante');
  if (v_table_type = 'staff') <> v_is_staff then
    raise exception 'A categoria da pessoa não corresponde ao tipo da mesa.';
  end if;

  select count(*) into v_occupancy
  from public.wedding_guests
  where table_id = new.table_id and id <> new.id;

  if v_occupancy >= 8 then
    raise exception 'Esta mesa já está com os oito lugares ocupados.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_wedding_guest_seating on public.wedding_guests;
create trigger trg_enforce_wedding_guest_seating
before insert or update of table_id, category on public.wedding_guests
for each row execute function public.enforce_wedding_guest_seating();

create or replace function public.prevent_incompatible_wedding_table_type()
returns trigger
language plpgsql
as $$
declare v_mismatch_count integer;
begin
  if new.table_type is distinct from old.table_type then
    select count(*) into v_mismatch_count
    from public.wedding_guests g
    where g.table_id = new.id
      and ((new.table_type = 'staff') <> (g.category in ('fotografia','cerimonial','story_maker','som','musica','celebrante')));
    if v_mismatch_count > 0 then
      raise exception 'Há pessoas nesta mesa cuja categoria não corresponde ao novo tipo. Realoque-as antes de mudar o tipo.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_incompatible_wedding_table_type on public.wedding_tables;
create trigger trg_prevent_incompatible_wedding_table_type
before update of table_type on public.wedding_tables
for each row execute function public.prevent_incompatible_wedding_table_type();

commit;
