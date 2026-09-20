-- Bulk imports from a spreadsheet the Organizer uploads. The app reads the file on the device and sends parsed rows
-- here, so the file itself is never stored. Both imports are all-or-nothing and re-check every rule server-side.

-- Categories: only while the event is a draft. Rows whose label already exists in the event are skipped.
create function import_categories(p_event_id uuid, p_categories jsonb) returns jsonb
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
    if ((e.c ->> 'belt_min') is not null and public.belt_rank(e.c ->> 'belt_min') is null)
       or ((e.c ->> 'belt_max') is not null and public.belt_rank(e.c ->> 'belt_max') is null)
       or public.belt_rank(e.c ->> 'belt_min') > public.belt_rank(e.c ->> 'belt_max') then
      raise exception 'Row %: the belt range is not valid.', e.n;
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
      lower(e.c ->> 'belt_min'), lower(e.c ->> 'belt_max'), e.c ->> 'bracket_format'
    );
    v_inserted := v_inserted + 1;
  end loop;

  return jsonb_build_object('inserted', v_inserted, 'skipped', v_skipped);
end;
$$;

-- Athletes: only while registration is open. Each club in the sheet becomes an approved submission and its
-- athletes are registered in their matching categories, exactly as approving a club's own submission does.
-- An athlete already in the event (same name and date of birth) is skipped, so re-uploading a sheet is safe.
create function import_athletes(p_event_id uuid, p_athletes jsonb) returns jsonb
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
    if public.belt_rank(e.a ->> 'belt_rank') is null then
      raise exception 'Row %: unknown belt.', e.n;
    end if;
  end loop;

  -- drop anyone already in the event, and repeats within the sheet (the first row wins)
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
    insert into public.athletes (club_entry_id, full_name, date_of_birth, gender, weight, belt_rank)
    select v_entry, btrim(a ->> 'full_name'), (a ->> 'date_of_birth')::date, a ->> 'gender',
           (a ->> 'weight')::numeric, lower(btrim(a ->> 'belt_rank'))
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

revoke all on function import_categories(uuid, jsonb), import_athletes(uuid, jsonb) from public, anon;
grant execute on function import_categories(uuid, jsonb), import_athletes(uuid, jsonb) to authenticated;
