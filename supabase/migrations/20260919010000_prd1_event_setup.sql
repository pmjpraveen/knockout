-- PRD 1: event lifecycle, category lifecycle, and staff management.

-- Registration opening/closing carries the event's categories with it.
create function sync_category_status() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'registration_open' then
    update public.categories set status = 'open'
    where event_id = new.id and status = 'draft';
  elsif new.status = 'registration_closed' then
    update public.categories set status = 'closed'
    where event_id = new.id and status in ('draft', 'open');
  end if;
  return new;
end;
$$;

create trigger events_sync_category_status
  after update of status on events
  for each row when (old.status is distinct from new.status)
  execute function sync_category_status();

-- Sets the 7-day purge clock and deactivates the registration link (PRD 2 retention).
create function complete_event(p_event_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_event_member(p_event_id, array['organizer']) then
    raise exception 'Only the organizer can complete an event' using errcode = '42501';
  end if;
  update public.events
  set status = 'completed', completed_at = now(), purge_at = now() + interval '7 days'
  where id = p_event_id and status <> 'completed';
  update public.registration_links set is_active = false where event_id = p_event_id;
end;
$$;

-- Organizer roster, with emails that clients cannot read from auth.users directly.
create function list_event_staff(p_event_id uuid)
returns table (id uuid, email text, role text, tatami_id uuid)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_event_member(p_event_id, array['organizer']) then
    raise exception 'Only the organizer can view staff' using errcode = '42501';
  end if;
  return query
    select m.id, u.email::text, m.role, m.tatami_id
    from public.event_members m
    join auth.users u on u.id = m.user_id
    where m.event_id = p_event_id
    order by m.created_at;
end;
$$;

-- Staff must already have an account; there is no pending-invite table yet.
create function add_event_member(
  p_event_id uuid,
  p_email text,
  p_role text,
  p_tatami_id uuid default null
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid;
begin
  if not public.is_event_member(p_event_id, array['organizer']) then
    raise exception 'Only the organizer can manage staff' using errcode = '42501';
  end if;
  if p_role not in ('tournament_director', 'scorekeeper') then
    raise exception 'Role must be tournament_director or scorekeeper';
  end if;
  if p_role = 'scorekeeper'
     and not exists (select 1 from public.tatamis where id = p_tatami_id and event_id = p_event_id) then
    raise exception 'A scorekeeper needs a tatami from this event';
  end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'No account with that email. Ask them to sign in to the app once first.';
  end if;
  insert into public.event_members (event_id, user_id, role, tatami_id)
  values (p_event_id, v_user, p_role, case when p_role = 'scorekeeper' then p_tatami_id end);
end;
$$;

-- Merges closed categories into p_target, carrying registrations (and seeds) over.
create function merge_categories(p_target uuid, p_sources uuid[]) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_event uuid;
begin
  select event_id into v_event from public.categories where id = p_target;
  if v_event is null or not public.is_event_member(v_event, array['organizer']) then
    raise exception 'Only the organizer can merge categories' using errcode = '42501';
  end if;
  if (select count(*) from public.categories
      where id = any (p_sources || p_target) and event_id = v_event and status = 'closed')
     <> cardinality(p_sources) + 1 then
    raise exception 'Merge needs distinct closed categories from the same event';
  end if;

  insert into public.registrations
    (athlete_id, category_id, seed, weigh_in_status, submitted_by, overridden_by_organizer, override_reason, created_at)
  select athlete_id, p_target, seed, weigh_in_status, submitted_by, overridden_by_organizer, override_reason, created_at
  from public.registrations
  where category_id = any (p_sources)
  order by created_at
  on conflict (athlete_id, category_id) do nothing;

  delete from public.categories where id = any (p_sources);
end;
$$;

-- Splits a closed category: the chosen registrations move to a new copy of it.
create function split_category(p_category uuid, p_registration_ids uuid[], p_label text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_event uuid;
  v_new uuid;
  v_moved int;
begin
  select event_id into v_event from public.categories where id = p_category and status = 'closed';
  if v_event is null or not public.is_event_member(v_event, array['organizer']) then
    raise exception 'Only the organizer can split a closed category' using errcode = '42501';
  end if;

  insert into public.categories
    (event_id, label, discipline, gender, age_min, age_max, weight_min, weight_max, belt_min, belt_max, bracket_format, status)
  select event_id, p_label, discipline, gender, age_min, age_max, weight_min, weight_max, belt_min, belt_max, bracket_format, 'closed'
  from public.categories where id = p_category
  returning id into v_new;

  update public.registrations set category_id = v_new
  where id = any (p_registration_ids) and category_id = p_category;
  get diagnostics v_moved = row_count;
  if v_moved <> cardinality(p_registration_ids) then
    raise exception 'Every registration to move must belong to the category being split';
  end if;
  return v_new;
end;
$$;

revoke all on function complete_event(uuid), list_event_staff(uuid), add_event_member(uuid, text, text, uuid),
  merge_categories(uuid, uuid[]), split_category(uuid, uuid[], text) from public, anon;
grant execute on function complete_event(uuid), list_event_staff(uuid), add_event_member(uuid, text, text, uuid),
  merge_categories(uuid, uuid[]), split_category(uuid, uuid[], text) to authenticated;
