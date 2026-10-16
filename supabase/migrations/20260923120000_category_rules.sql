-- Category rules the app already enforces, now enforced by the database too: sensible limits, one label per event,
-- and belts that exist in the event's list and run from lower to higher. Deleting a category still cascades to its
-- registrations and brackets on purpose: the event purge job relies on it.

do $$
declare dupes text;
begin
  select string_agg(format('"%s" (%s) x%s', label, event_id, n), ', ') into dupes
  from (select min(label) as label, event_id, count(*) as n from public.categories group by event_id, lower(btrim(label)) having count(*) > 1) d;
  if dupes is not null then
    raise exception 'Rename or remove duplicate category labels before applying this migration: %', dupes;
  end if;
end $$;

create unique index categories_event_label_key on categories (event_id, lower(btrim(label)));

alter table categories
  add constraint categories_age_limits check (
    (age_min is null or age_min >= 0) and (age_max is null or age_max >= 0) and (age_min is null or age_max is null or age_min <= age_max)),
  add constraint categories_weight_limits check (
    (weight_min is null or weight_min >= 0) and (weight_max is null or weight_max >= 0) and (weight_min is null or weight_max is null or weight_min <= weight_max));

create function check_category_belts() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare lo int; hi int;
begin
  if new.belt_min is not null then
    lo := public.belt_rank(new.event_id, new.belt_min);
    if lo is null then raise exception 'The belt "%" is not one of this event''s belts.', new.belt_min; end if;
  end if;
  if new.belt_max is not null then
    hi := public.belt_rank(new.event_id, new.belt_max);
    if hi is null then raise exception 'The belt "%" is not one of this event''s belts.', new.belt_max; end if;
  end if;
  if lo > hi then raise exception 'Belt from must not be higher than belt to.'; end if;
  return new;
end $$;

-- Only when the belts are written, so older rows that predate the rule stay editable.
create trigger categories_check_belts
  before insert or update of belt_min, belt_max on categories
  for each row execute function check_category_belts();

-- New groups are created under their final label, since the base label belongs to the group that already exists.
create or replace function set_category_groups(p_category_id uuid, p_groups int, p_tatami_ids uuid[] default null)
returns uuid[]
language plpgsql security definer set search_path = ''
as $$
declare
  v_root public.categories;
  v_ids uuid[];
  v_target uuid[] := '{}';
  v_base text;
  v_n int;
  v_have int;
  v_new uuid;
  i int;
begin
  select * into v_root from public.categories where id = coalesce(
    (select split_root from public.categories where id = p_category_id), p_category_id);
  if v_root.id is null then raise exception 'Unknown category'; end if;
  if not public.is_event_member(v_root.event_id, array['organizer']) then
    raise exception 'Only the organizer can split a category' using errcode = '42501';
  end if;
  perform public.assert_event_writable(v_root.event_id);

  select coalesce(array_agg(id order by split_index nulls first, created_at), '{}') into v_ids
  from public.categories where id = v_root.id or split_root = v_root.id;
  if exists (select 1 from public.categories c where c.id = any (v_ids) and c.status not in ('closed', 'bracket_generated')) then
    raise exception 'Close registration before splitting a category';
  end if;
  if exists (select 1 from public.matches m join public.brackets b on b.id = m.bracket_id
             where b.category_id = any (v_ids) and m.status in ('in_progress', 'completed')) then
    raise exception 'Matches have started, so the groups are locked';
  end if;
  if p_tatami_ids is not null and (select count(*) from public.tatamis
       where id = any (p_tatami_ids) and event_id = v_root.event_id) <> cardinality(p_tatami_ids) then
    raise exception 'That tatami belongs to a different event';
  end if;

  select count(*) into v_n from public.registrations where category_id = any (v_ids);
  if p_groups < 1 or p_groups > greatest(1, v_n / 2) then
    raise exception 'Choose between 1 and % groups; each needs at least 2 athletes.', greatest(1, v_n / 2);
  end if;

  v_base := regexp_replace(v_root.label, ' · Group [A-Z]$', '');
  v_have := cardinality(v_ids);
  delete from public.brackets where category_id = any (v_ids);

  -- One category per group: reuse the existing ones, add any that are missing.
  for i in 1..p_groups loop
    if i <= v_have then
      v_target := v_target || v_ids[i];
    else
      insert into public.categories
        (event_id, label, discipline, gender, age_min, age_max, weight_min, weight_max, belt_min, belt_max,
         bracket_format, status, scoring_mode, judge_panel, match_seconds, tatami_id, sequence, event_day, split_root)
      select event_id, case when p_groups = 1 then v_base else v_base || ' · Group ' || chr(64 + i) end, discipline, gender, age_min, age_max, weight_min, weight_max, belt_min, belt_max,
             bracket_format, 'closed', scoring_mode, judge_panel, match_seconds, tatami_id, sequence, event_day, v_root.id
      from public.categories where id = v_root.id
      returning id into v_new;
      v_target := v_target || v_new;
    end if;
  end loop;

  -- Deal: clubs in a random order, athletes of a club side by side, then one to each group in turn.
  with regs as (
    select r.id, lower(btrim(ce.club_name)) as club
    from public.registrations r
    join public.athletes a on a.id = r.athlete_id
    join public.club_entries ce on ce.id = a.club_entry_id
    where r.category_id = any (v_ids)
  ),
  clubs as (select club, random() as k from regs group by club),
  dealt as (
    select regs.id, (row_number() over (order by clubs.k, random()) - 1) % p_groups + 1 as g
    from regs join clubs using (club)
  )
  update public.registrations r set category_id = v_target[d.g], seed = null
  from dealt d where r.id = d.id;

  -- Groups that are no longer needed are empty by now.
  if v_have > p_groups then
    delete from public.categories where id = any (v_ids[p_groups + 1:]);
  end if;

  for i in 1..p_groups loop
    update public.categories set
      label = case when p_groups = 1 then v_base else v_base || ' · Group ' || chr(64 + i) end,
      split_index = case when p_groups = 1 then null else i - 1 end,
      split_root = case when i = 1 then null else v_root.id end,
      status = 'closed',
      tatami_id = case when p_tatami_ids is null then tatami_id else p_tatami_ids[(i - 1) % cardinality(p_tatami_ids) + 1] end
    where id = v_target[i];
  end loop;
  return v_target;
end;
$$;
