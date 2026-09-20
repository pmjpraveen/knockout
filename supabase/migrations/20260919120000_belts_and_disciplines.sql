-- Belts and events a participant enters.
-- 1. Each event has its own ordered belt list (lowest first), because dojos use different belt systems.
-- 2. Each participant enters kumite, kata or both, and is only registered in categories of what they entered.

alter table events
  add column belts text[] not null default array['white','yellow','orange','green','blue','purple','brown','black']
    check (cardinality(belts) between 1 and 20);

alter table athletes
  add column disciplines text[] not null default array['kumite','kata']
    check (cardinality(disciplines) >= 1 and disciplines <@ array['kumite','kata']);

-- A belt's position in the event's own list; null when the belt is not in it. Replaces the fixed WKF-style ladder.
create function belt_rank(p_event_id uuid, p_belt text) returns int
language sql stable security definer set search_path = ''
as $$
  select array_position(e.belts, lower(btrim(p_belt))) from public.events e where e.id = p_event_id;
$$;

-- One suggested category per discipline: the most specific match, else the oldest. Age is measured on the event's
-- start date. `p_disciplines` limits which of kumite and kata are considered (null means both); team categories
-- are always considered, as before.
drop function suggest_categories(uuid, date, text, numeric, text);
create function suggest_categories(
  p_event_id uuid,
  p_date_of_birth date,
  p_gender text,
  p_weight numeric,
  p_belt text,
  p_disciplines text[] default null
) returns table (id uuid, label text, discipline text)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_age int;
  v_belt int := public.belt_rank(p_event_id, p_belt);
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     and not public.is_event_member(p_event_id, array['organizer']) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select date_part('year', age(e.start_date, p_date_of_birth))::int into v_age
  from public.events e where e.id = p_event_id;

  return query
    select distinct on (c.discipline) c.id, c.label, c.discipline
    from public.categories c
    where c.event_id = p_event_id
      and c.status in ('draft', 'open', 'closed')
      and (p_disciplines is null or c.discipline = 'team' or c.discipline = any (p_disciplines))
      and (c.gender is null or c.gender = 'mixed' or c.gender = p_gender)
      and (c.age_min is null or v_age >= c.age_min)
      and (c.age_max is null or v_age <= c.age_max)
      and (c.weight_min is null or p_weight >= c.weight_min)
      and (c.weight_max is null or p_weight <= c.weight_max)
      and (c.belt_min is null or v_belt >= public.belt_rank(p_event_id, c.belt_min))
      and (c.belt_max is null or v_belt <= public.belt_rank(p_event_id, c.belt_max))
    order by c.discipline,
      ((c.gender is not null)::int + (c.age_min is not null)::int + (c.age_max is not null)::int
       + (c.weight_min is not null)::int + (c.weight_max is not null)::int
       + (c.belt_min is not null)::int + (c.belt_max is not null)::int) desc,
      c.created_at;
end;
$$;

-- The Organizer sets an event's belt list. A belt that a category or participant still uses cannot be removed.
create function set_event_belts(p_event_id uuid, p_belts text[]) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_belts text[];
  v_used text;
begin
  if not public.is_event_member(p_event_id, array['organizer']) then
    raise exception 'Only the organizer can change the belts' using errcode = '42501';
  end if;
  perform public.assert_event_writable(p_event_id);

  select array_agg(s.b order by s.n) into v_belts
  from (select lower(btrim(x)) as b, n from unnest(p_belts) with ordinality as t(x, n) where btrim(x) <> '') s;
  if v_belts is null or cardinality(v_belts) not between 1 and 20 then
    raise exception 'A belt system needs between 1 and 20 belts.';
  end if;
  if exists (select 1 from unnest(v_belts) b where length(b) > 30) then
    raise exception 'A belt name can be up to 30 characters.';
  end if;
  if (select count(distinct b) from unnest(v_belts) b) <> cardinality(v_belts) then
    raise exception 'Each belt can only appear once.';
  end if;

  select u.b into v_used
  from (
    select lower(btrim(belt_min)) as b from public.categories where event_id = p_event_id
    union select lower(btrim(belt_max)) from public.categories where event_id = p_event_id
    union select lower(btrim(a.belt_rank)) from public.athletes a
      join public.club_entries c on c.id = a.club_entry_id where c.event_id = p_event_id
  ) u
  where u.b is not null and u.b <> '' and not (u.b = any (v_belts))
  limit 1;
  if v_used is not null then
    raise exception 'The belt "%" is still used by a category or participant, so it cannot be removed.', v_used;
  end if;

  update public.events set belts = v_belts where id = p_event_id;
end;
$$;

-- Approval registers each athlete in the categories that match what they entered.
create or replace function approve_club_entry(p_club_entry_id uuid) returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_event uuid;
  v_status text;
begin
  select event_id, approval_status into v_event, v_status
  from public.club_entries where id = p_club_entry_id;
  if v_event is null or not public.is_event_member(v_event, array['organizer']) then
    raise exception 'Only the organizer can approve submissions' using errcode = '42501';
  end if;
  perform public.assert_event_writable(v_event);
  if v_status <> 'submitted' then
    raise exception 'Only submitted entries can be approved';
  end if;

  update public.club_entries
  set approval_status = 'approved', approved_at = now(), rejection_reason = null
  where id = p_club_entry_id;

  insert into public.registrations (athlete_id, category_id, weigh_in_status)
  select a.id, s.id, 'pending'
  from public.athletes a
  cross join lateral public.suggest_categories(v_event, a.date_of_birth, a.gender, a.weight, a.belt_rank, a.disciplines) s
  where a.club_entry_id = p_club_entry_id
  on conflict (athlete_id, category_id) do nothing;

  return (
    select count(*)::int from public.athletes a
    where a.club_entry_id = p_club_entry_id
      and not exists (select 1 from public.registrations r where r.athlete_id = a.id)
  );
end;
$$;

-- A club's submission. Belts must come from the event's list and the events entered must be kumite and/or kata.
create or replace function save_club_entry(
  p_event_id uuid,
  p_reference uuid,
  p_club_name text,
  p_club_contact text,
  p_athletes jsonb
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if (select count(*) from public.club_entries
      where event_id = p_event_id and submitted_at > now() - interval '1 minute') >= 30 then
    raise exception 'Too many submissions. Try again in a minute.' using errcode = 'P0429';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_athletes) as a(belt_rank text) where public.belt_rank(p_event_id, a.belt_rank) is null
  ) then
    raise exception 'Choose each belt from this event''s list.';
  end if;

  if p_reference is null then
    insert into public.club_entries (event_id, club_name, club_contact)
    values (p_event_id, p_club_name, p_club_contact)
    returning id into v_id;
  else
    select id into v_id from public.club_entries
    where id = p_reference and event_id = p_event_id and approval_status in ('submitted', 'rejected')
    for update;
    if v_id is null then
      raise exception 'This submission can no longer be edited.' using errcode = 'P0403';
    end if;
    update public.club_entries
    set club_name = p_club_name, club_contact = p_club_contact,
        approval_status = 'submitted', rejection_reason = null, submitted_at = now()
    where id = v_id;
    delete from public.athletes where club_entry_id = v_id;
  end if;

  insert into public.athletes (club_entry_id, full_name, date_of_birth, gender, weight, belt_rank, disciplines)
  select v_id, a.full_name, a.date_of_birth, a.gender, a.weight, lower(btrim(a.belt_rank)),
         coalesce(a.disciplines, array['kumite', 'kata'])
  from jsonb_to_recordset(p_athletes)
    as a(full_name text, date_of_birth date, gender text, weight numeric, belt_rank text, disciplines text[]);
  return v_id;
end;
$$;

-- Organizer override of any athlete field, at any time (including after the deadline). Unchanged except that the
-- belt must be in the event's list and the events entered can be changed too.
drop function organizer_edit_athlete(uuid, text, date, text, numeric, text, text);
create function organizer_edit_athlete(
  p_athlete_id uuid,
  p_full_name text,
  p_date_of_birth date,
  p_gender text,
  p_weight numeric,
  p_belt_rank text,
  p_reason text,
  p_disciplines text[] default null
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_entry uuid;
  v_event uuid;
  v_before jsonb;
  v_after jsonb;
begin
  select a.club_entry_id, ce.event_id, to_jsonb(a) into v_entry, v_event, v_before
  from public.athletes a join public.club_entries ce on ce.id = a.club_entry_id
  where a.id = p_athlete_id;
  if v_event is null or not public.is_event_member(v_event, array['organizer']) then
    raise exception 'Only the organizer can edit participants' using errcode = '42501';
  end if;
  perform public.assert_event_writable(v_event);
  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'A reason is required for organizer changes';
  end if;
  if public.belt_rank(v_event, p_belt_rank) is null then
    raise exception 'Choose a belt from this event''s list.';
  end if;

  update public.athletes
  set full_name = p_full_name, date_of_birth = p_date_of_birth, gender = p_gender,
      weight = p_weight, belt_rank = lower(btrim(p_belt_rank)), disciplines = coalesce(p_disciplines, disciplines)
  where id = p_athlete_id
  returning to_jsonb(athletes) into v_after;

  update public.registrations
  set overridden_by_organizer = true, override_reason = btrim(p_reason)
  where athlete_id = p_athlete_id;

  insert into public.audit_log (event_id, actor_id, action, subject_id, reason, changes)
  values (v_event, auth.uid(), 'edit_athlete', v_entry, btrim(p_reason),
          jsonb_build_object('before', v_before, 'after', v_after));
end;
$$;

-- Organizer adds a participant to an existing submission; registered at once if it is approved.
drop function organizer_add_athlete(uuid, text, date, text, numeric, text, text);
create function organizer_add_athlete(
  p_club_entry_id uuid,
  p_full_name text,
  p_date_of_birth date,
  p_gender text,
  p_weight numeric,
  p_belt_rank text,
  p_reason text,
  p_disciplines text[] default null
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_event uuid;
  v_status text;
  v_id uuid;
  v_after jsonb;
  v_disciplines text[] := coalesce(p_disciplines, array['kumite', 'kata']);
begin
  select event_id, approval_status into v_event, v_status
  from public.club_entries where id = p_club_entry_id;
  if v_event is null or not public.is_event_member(v_event, array['organizer']) then
    raise exception 'Only the organizer can add participants' using errcode = '42501';
  end if;
  perform public.assert_event_writable(v_event);
  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'A reason is required for organizer changes';
  end if;
  if public.belt_rank(v_event, p_belt_rank) is null then
    raise exception 'Choose a belt from this event''s list.';
  end if;

  insert into public.athletes (club_entry_id, full_name, date_of_birth, gender, weight, belt_rank, disciplines)
  values (p_club_entry_id, p_full_name, p_date_of_birth, p_gender, p_weight, lower(btrim(p_belt_rank)), v_disciplines)
  returning id, to_jsonb(athletes) into v_id, v_after;

  if v_status = 'approved' then
    insert into public.registrations
      (athlete_id, category_id, weigh_in_status, submitted_by, overridden_by_organizer, override_reason)
    select v_id, s.id, 'pending', 'organizer', true, btrim(p_reason)
    from public.suggest_categories(v_event, p_date_of_birth, p_gender, p_weight, p_belt_rank, v_disciplines) s;
  end if;

  insert into public.audit_log (event_id, actor_id, action, subject_id, reason, changes)
  values (v_event, auth.uid(), 'add_athlete', p_club_entry_id, btrim(p_reason),
          jsonb_build_object('after', v_after));
  return v_id;
end;
$$;

-- The spreadsheet imports check belts against the event's list, and participants carry what they entered.
create or replace function import_categories(p_event_id uuid, p_categories jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  e record;
  v_inserted int := 0;
  v_skipped int := 0;
  v_label text;
  v_min numeric;
  v_max numeric;
begin
  if not public.is_event_member(p_event_id, array['organizer']) then
    raise exception 'Only the organizer can import categories' using errcode = '42501';
  end if;
  if not exists (select 1 from public.events where id = p_event_id and status = 'draft') then
    raise exception 'Categories can only be imported while the event is a draft.';
  end if;
  if jsonb_typeof(p_categories) <> 'array' or jsonb_array_length(p_categories) not between 1 and 500 then
    raise exception 'Import between 1 and 500 categories at a time.';
  end if;

  for e in select value as c, ordinality as n from jsonb_array_elements(p_categories) with ordinality loop
    v_label := btrim(coalesce(e.c ->> 'label', ''));
    if v_label = '' or length(v_label) > 120 then
      raise exception 'Row %: the category needs a label of up to 120 characters.', e.n;
    end if;
    if (e.c ->> 'discipline') is null or (e.c ->> 'discipline') not in ('kumite', 'kata', 'team') then
      raise exception 'Row %: discipline must be kumite, kata or team.', e.n;
    end if;
    if (e.c ->> 'gender') is not null and (e.c ->> 'gender') not in ('male', 'female', 'mixed') then
      raise exception 'Row %: gender must be male, female or mixed.', e.n;
    end if;
    if (e.c ->> 'bracket_format') is not null
       and (e.c ->> 'bracket_format') not in ('single_elim_repechage', 'round_robin', 'double_elim') then
      raise exception 'Row %: unknown bracket format.', e.n;
    end if;
    v_min := (e.c ->> 'age_min')::numeric; v_max := (e.c ->> 'age_max')::numeric;
    if coalesce(v_min, 0) < 0 or coalesce(v_max, 0) > 120 or v_min > v_max then
      raise exception 'Row %: the age range is not valid.', e.n;
    end if;
    v_min := (e.c ->> 'weight_min')::numeric; v_max := (e.c ->> 'weight_max')::numeric;
    if coalesce(v_min, 0) < 0 or coalesce(v_max, 0) > 300 or v_min > v_max then
      raise exception 'Row %: the weight range is not valid.', e.n;
    end if;
    if ((e.c ->> 'belt_min') is not null and public.belt_rank(p_event_id, e.c ->> 'belt_min') is null)
       or ((e.c ->> 'belt_max') is not null and public.belt_rank(p_event_id, e.c ->> 'belt_max') is null)
       or public.belt_rank(p_event_id, e.c ->> 'belt_min') > public.belt_rank(p_event_id, e.c ->> 'belt_max') then
      raise exception 'Row %: the belt range is not valid for this event''s belts.', e.n;
    end if;

    if exists (select 1 from public.categories where event_id = p_event_id and lower(label) = lower(v_label)) then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    insert into public.categories
      (event_id, label, discipline, gender, age_min, age_max, weight_min, weight_max, belt_min, belt_max, bracket_format)
    values (
      p_event_id, v_label, e.c ->> 'discipline', e.c ->> 'gender',
      (e.c ->> 'age_min')::int, (e.c ->> 'age_max')::int,
      (e.c ->> 'weight_min')::numeric, (e.c ->> 'weight_max')::numeric,
      lower(btrim(e.c ->> 'belt_min')), lower(btrim(e.c ->> 'belt_max')), e.c ->> 'bracket_format'
    );
    v_inserted := v_inserted + 1;
  end loop;

  return jsonb_build_object('inserted', v_inserted, 'skipped', v_skipped);
end;
$$;

create or replace function import_athletes(p_event_id uuid, p_athletes jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  e record;
  v_club record;
  v_fresh jsonb;
  v_entry uuid;
  v_clubs int := 0;
  v_athletes int := 0;
  v_unmatched int := 0;
  v_added int;
begin
  if not public.is_event_member(p_event_id, array['organizer']) then
    raise exception 'Only the organizer can import participants' using errcode = '42501';
  end if;
  if not exists (select 1 from public.events where id = p_event_id and status = 'registration_open') then
    raise exception 'Participants can only be imported while registration is open.';
  end if;
  if jsonb_typeof(p_athletes) <> 'array' or jsonb_array_length(p_athletes) not between 1 and 1000 then
    raise exception 'Import between 1 and 1000 participants at a time.';
  end if;

  for e in select value as a, ordinality as n from jsonb_array_elements(p_athletes) with ordinality loop
    if btrim(coalesce(e.a ->> 'club_name', '')) = '' or length(e.a ->> 'club_name') > 120 then
      raise exception 'Row %: the club name is required (up to 120 characters).', e.n;
    end if;
    if btrim(coalesce(e.a ->> 'full_name', '')) = '' or length(e.a ->> 'full_name') > 120 then
      raise exception 'Row %: the athlete name is required (up to 120 characters).', e.n;
    end if;
    if (e.a ->> 'date_of_birth') is null or (e.a ->> 'date_of_birth')::date > current_date then
      raise exception 'Row %: the date of birth must be a date in the past.', e.n;
    end if;
    if (e.a ->> 'gender') is null or (e.a ->> 'gender') not in ('male', 'female') then
      raise exception 'Row %: gender must be male or female.', e.n;
    end if;
    if not ((e.a ->> 'weight')::numeric > 0 and (e.a ->> 'weight')::numeric < 300) then
      raise exception 'Row %: weight must be between 0 and 300 kg.', e.n;
    end if;
    if public.belt_rank(p_event_id, e.a ->> 'belt_rank') is null then
      raise exception 'Row %: the belt is not in this event''s belt list.', e.n;
    end if;
    if (e.a -> 'disciplines') is not null and (
         jsonb_typeof(e.a -> 'disciplines') <> 'array'
         or jsonb_array_length(e.a -> 'disciplines') = 0
         or exists (select 1 from jsonb_array_elements_text(e.a -> 'disciplines') d where d not in ('kumite', 'kata'))
       ) then
      raise exception 'Row %: the events entered must be kumite, kata or both.', e.n;
    end if;
  end loop;

  select coalesce(jsonb_agg(f.a), '[]'::jsonb) into v_fresh
  from (
    select distinct on (lower(btrim(t.a ->> 'full_name')), (t.a ->> 'date_of_birth')::date) t.a
    from jsonb_array_elements(p_athletes) with ordinality as t(a, n)
    where not exists (
      select 1 from public.athletes x join public.club_entries c on c.id = x.club_entry_id
      where c.event_id = p_event_id
        and lower(btrim(x.full_name)) = lower(btrim(t.a ->> 'full_name'))
        and x.date_of_birth = (t.a ->> 'date_of_birth')::date
    )
    order by lower(btrim(t.a ->> 'full_name')), (t.a ->> 'date_of_birth')::date, t.n
  ) f;

  for v_club in
    select lower(btrim(a ->> 'club_name')) as club_key, min(btrim(a ->> 'club_name')) as club
    from jsonb_array_elements(v_fresh) a group by 1 order by 1
  loop
    insert into public.club_entries (event_id, club_name) values (p_event_id, v_club.club) returning id into v_entry;
    insert into public.athletes (club_entry_id, full_name, date_of_birth, gender, weight, belt_rank, disciplines)
    select v_entry, btrim(a ->> 'full_name'), (a ->> 'date_of_birth')::date, a ->> 'gender',
           (a ->> 'weight')::numeric, lower(btrim(a ->> 'belt_rank')),
           case when a -> 'disciplines' is null then array['kumite', 'kata']
                else array(select jsonb_array_elements_text(a -> 'disciplines')) end
    from jsonb_array_elements(v_fresh) a
    where lower(btrim(a ->> 'club_name')) = v_club.club_key;
    get diagnostics v_added = row_count;
    v_athletes := v_athletes + v_added;
    v_clubs := v_clubs + 1;
    v_unmatched := v_unmatched + public.approve_club_entry(v_entry);
    insert into public.audit_log (event_id, actor_id, action, subject_id, reason, changes)
    values (p_event_id, auth.uid(), 'import_athletes', v_entry, 'Imported from a spreadsheet',
            jsonb_build_object('athletes', v_added));
  end loop;

  return jsonb_build_object(
    'clubs', v_clubs, 'athletes', v_athletes,
    'skipped', jsonb_array_length(p_athletes) - jsonb_array_length(v_fresh), 'unmatched', v_unmatched
  );
end;
$$;

drop function belt_rank(text);

revoke all on function
  belt_rank(uuid, text),
  suggest_categories(uuid, date, text, numeric, text, text[]),
  set_event_belts(uuid, text[]),
  organizer_edit_athlete(uuid, text, date, text, numeric, text, text, text[]),
  organizer_add_athlete(uuid, text, date, text, numeric, text, text, text[])
from public, anon;

grant execute on function
  belt_rank(uuid, text),
  suggest_categories(uuid, date, text, numeric, text, text[]),
  set_event_belts(uuid, text[]),
  organizer_edit_athlete(uuid, text, date, text, numeric, text, text, text[]),
  organizer_add_athlete(uuid, text, date, text, numeric, text, text, text[])
to authenticated;

grant execute on function belt_rank(uuid, text), suggest_categories(uuid, date, text, numeric, text, text[]) to service_role;
