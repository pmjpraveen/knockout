-- PRD 2: registration link, club submissions, approval, overrides, audit log.

-- Every organizer override is logged with its reason. Cascades from events, so the purge removes it too.
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  subject_id uuid not null, -- the club entry the change belongs to
  reason text not null,
  changes jsonb not null,
  created_at timestamptz not null default now()
);
create index on audit_log (event_id, subject_id);
alter table audit_log enable row level security;
create policy audit_log_select on audit_log for select to authenticated
  using (is_event_member(event_id, array['organizer']));

-- Standard WKF-style ladder. Belts outside it (e.g. "5th kyu") never match a belt-limited category.
create function belt_rank(p_belt text) returns int
language sql immutable set search_path = ''
as $$
  select array_position(
    array['white','yellow','orange','green','blue','purple','brown','black'],
    lower(trim(p_belt))
  );
$$;

-- One suggested category per discipline: the most specific match, else the oldest.
-- Age is measured on the event's start date.
create function suggest_categories(
  p_event_id uuid,
  p_date_of_birth date,
  p_gender text,
  p_weight numeric,
  p_belt text
) returns table (id uuid, label text, discipline text)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_age int;
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
      and (c.gender is null or c.gender = 'mixed' or c.gender = p_gender)
      and (c.age_min is null or v_age >= c.age_min)
      and (c.age_max is null or v_age <= c.age_max)
      and (c.weight_min is null or p_weight >= c.weight_min)
      and (c.weight_max is null or p_weight <= c.weight_max)
      and (c.belt_min is null or public.belt_rank(p_belt) >= public.belt_rank(c.belt_min))
      and (c.belt_max is null or public.belt_rank(p_belt) <= public.belt_rank(c.belt_max))
    order by c.discipline,
      ((c.gender is not null)::int + (c.age_min is not null)::int + (c.age_max is not null)::int
       + (c.weight_min is not null)::int + (c.weight_max is not null)::int
       + (c.belt_min is not null)::int + (c.belt_max is not null)::int) desc,
      c.created_at;
end;
$$;

-- Archived (completed) events are read-only.
create function assert_event_writable(p_event_id uuid) returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.events where id = p_event_id and status = 'completed') then
    raise exception 'This event is archived and read-only';
  end if;
end;
$$;

-- Creates the event's link, or replaces its token (which invalidates the old link).
create function regenerate_registration_link(p_event_id uuid) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if not public.is_event_member(p_event_id, array['organizer']) then
    raise exception 'Only the organizer can manage the registration link' using errcode = '42501';
  end if;
  perform public.assert_event_writable(p_event_id);

  update public.registration_links
  set token = v_token, is_active = true, regenerated_count = regenerated_count + 1
  where event_id = p_event_id;
  if not found then
    insert into public.registration_links (event_id, token) values (p_event_id, v_token);
  end if;
  return v_token;
end;
$$;

-- Only the submit-registration Edge Function (service role) calls this. Creates a
-- submission, or replaces an unapproved one, atomically.
create function save_club_entry(
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

  insert into public.athletes (club_entry_id, full_name, date_of_birth, gender, weight, belt_rank)
  select v_id, a.full_name, a.date_of_birth, a.gender, a.weight, a.belt_rank
  from jsonb_to_recordset(p_athletes)
    as a(full_name text, date_of_birth date, gender text, weight numeric, belt_rank text);
  return v_id;
end;
$$;

-- Approval registers every athlete in their suggested categories. Returns how many
-- athletes matched no category, so the Organizer knows to look at them.
create function approve_club_entry(p_club_entry_id uuid) returns int
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
  cross join lateral public.suggest_categories(v_event, a.date_of_birth, a.gender, a.weight, a.belt_rank) s
  where a.club_entry_id = p_club_entry_id
  on conflict (athlete_id, category_id) do nothing;

  return (
    select count(*)::int from public.athletes a
    where a.club_entry_id = p_club_entry_id
      and not exists (select 1 from public.registrations r where r.athlete_id = a.id)
  );
end;
$$;

-- "Flag" sends a submission back to the club; the reason names what to fix.
create function flag_club_entry(p_club_entry_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_event uuid;
  v_status text;
begin
  select event_id, approval_status into v_event, v_status
  from public.club_entries where id = p_club_entry_id;
  if v_event is null or not public.is_event_member(v_event, array['organizer']) then
    raise exception 'Only the organizer can flag submissions' using errcode = '42501';
  end if;
  perform public.assert_event_writable(v_event);
  if v_status <> 'submitted' then
    raise exception 'Only submitted entries can be flagged';
  end if;
  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'Say what the club needs to fix';
  end if;

  update public.club_entries
  set approval_status = 'rejected', rejection_reason = btrim(p_reason)
  where id = p_club_entry_id;
end;
$$;

-- Organizer override of any athlete field, at any time (including after the deadline).
create function organizer_edit_athlete(
  p_athlete_id uuid,
  p_full_name text,
  p_date_of_birth date,
  p_gender text,
  p_weight numeric,
  p_belt_rank text,
  p_reason text
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

  update public.athletes
  set full_name = p_full_name, date_of_birth = p_date_of_birth, gender = p_gender,
      weight = p_weight, belt_rank = p_belt_rank
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
create function organizer_add_athlete(
  p_club_entry_id uuid,
  p_full_name text,
  p_date_of_birth date,
  p_gender text,
  p_weight numeric,
  p_belt_rank text,
  p_reason text
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_event uuid;
  v_status text;
  v_id uuid;
  v_after jsonb;
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

  insert into public.athletes (club_entry_id, full_name, date_of_birth, gender, weight, belt_rank)
  values (p_club_entry_id, p_full_name, p_date_of_birth, p_gender, p_weight, p_belt_rank)
  returning id, to_jsonb(athletes) into v_id, v_after;

  if v_status = 'approved' then
    insert into public.registrations
      (athlete_id, category_id, weigh_in_status, submitted_by, overridden_by_organizer, override_reason)
    select v_id, s.id, 'pending', 'organizer', true, btrim(p_reason)
    from public.suggest_categories(v_event, p_date_of_birth, p_gender, p_weight, p_belt_rank) s;
  end if;

  insert into public.audit_log (event_id, actor_id, action, subject_id, reason, changes)
  values (v_event, auth.uid(), 'add_athlete', p_club_entry_id, btrim(p_reason),
          jsonb_build_object('after', v_after));
  return v_id;
end;
$$;

revoke all on function
  suggest_categories(uuid, date, text, numeric, text),
  assert_event_writable(uuid),
  regenerate_registration_link(uuid),
  save_club_entry(uuid, uuid, text, text, jsonb),
  approve_club_entry(uuid),
  flag_club_entry(uuid, text),
  organizer_edit_athlete(uuid, text, date, text, numeric, text, text),
  organizer_add_athlete(uuid, text, date, text, numeric, text, text)
from public, anon;

revoke execute on function save_club_entry(uuid, uuid, text, text, jsonb) from authenticated;
revoke execute on function assert_event_writable(uuid) from authenticated;

grant execute on function
  suggest_categories(uuid, date, text, numeric, text),
  regenerate_registration_link(uuid),
  approve_club_entry(uuid),
  flag_club_entry(uuid, text),
  organizer_edit_athlete(uuid, text, date, text, numeric, text, text),
  organizer_add_athlete(uuid, text, date, text, numeric, text, text)
to authenticated;

grant execute on function suggest_categories(uuid, date, text, numeric, text), save_club_entry(uuid, uuid, text, text, jsonb)
to service_role;
