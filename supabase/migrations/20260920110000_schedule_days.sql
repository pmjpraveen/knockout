-- Schedule by day: a category runs on one day of the event. Each day has its own queue on every
-- tatami; the earliest day that still has matches is the one being run, so only it gets call times.

alter table categories add column event_day date;

update categories c set event_day = e.start_date from events e where e.id = c.event_id;

-- New categories run on the first day unless told otherwise. A draft has no dates yet, so its
-- categories are filled in when the event gets its start date.
create function categories_default_day() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.event_day is null then
    select start_date into new.event_day from public.events where id = new.event_id;
  end if;
  return new;
end;
$$;
create trigger categories_default_day before insert on categories
  for each row execute function categories_default_day();

create function events_fill_category_days() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.categories set event_day = new.start_date where event_id = new.id and event_day is null;
  return new;
end;
$$;
create trigger events_fill_category_days after update of start_date on events
  for each row when (old.start_date is null and new.start_date is not null)
  execute function events_fill_category_days();

-- Queues are ordered day first, so a category moved to another day leaves its old queue at once.
create or replace function bracket_resequence(p_tatami_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_tatami_id is null then return; end if;

  with recursive dep(id, depth) as (
    select m.id, 0 from public.matches m
    where m.a_source_id is null and m.b_source_id is null
      and m.bracket_id in (select bracket_id from public.matches where tatami_id = p_tatami_id)
    union
    select c.id, dep.depth + 1 from dep join public.matches c on dep.id in (c.a_source_id, c.b_source_id)
  ),
  depth as (select id, max(depth) as depth from dep group by id),
  ordered as (
    select m.id,
           row_number() over (
             order by (m.status = 'in_progress') desc, cat.event_day nulls last, cat.sequence nulls last, cat.created_at,
                      d.depth, m.round, m.pool nulls first, m.position
           ) as rn
    from public.matches m
    join public.brackets b on b.id = m.bracket_id
    join public.categories cat on cat.id = b.category_id
    join depth d on d.id = m.id
    where m.tatami_id = p_tatami_id and m.status in ('scheduled', 'in_progress')
  )
  update public.matches m set queue_order = o.rn from ordered o where m.id = o.id;

  update public.matches set queue_order = null
  where tatami_id = p_tatami_id and status not in ('scheduled', 'in_progress');
end;
$$;

create function categories_resequence_after_day() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  t uuid;
begin
  for t in
    select distinct m.tatami_id from public.matches m join public.brackets b on b.id = m.bracket_id
    where b.category_id = new.id and m.tatami_id is not null
  loop
    perform public.bracket_resequence(t);
  end loop;
  return new;
end;
$$;
create trigger categories_resequence_after_day after update of event_day on categories
  for each row execute function categories_resequence_after_day();

create function set_category_day(p_category_id uuid, p_day date) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_event uuid;
  v_start date;
  v_end date;
begin
  select c.event_id, e.start_date, e.end_date into v_event, v_start, v_end
  from public.categories c join public.events e on e.id = c.event_id where c.id = p_category_id;
  if v_event is null then raise exception 'Unknown category'; end if;
  perform public.assert_schedule_editor(v_event);
  if p_day is null or p_day < v_start or p_day > v_end then
    raise exception 'Choose a day the event runs on.';
  end if;
  update public.categories set event_day = p_day where id = p_category_id;
end;
$$;

-- Moves a category earlier (-1) or later (+1) among the categories of its own day.
create or replace function move_category_sequence(p_category_id uuid, p_direction int) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_event uuid;
  v_day date;
  v_seq int;
  v_other uuid;
  v_other_seq int;
  t uuid;
begin
  if p_direction not in (-1, 1) then raise exception 'Direction must be -1 or 1'; end if;
  select event_id, event_day into v_event, v_day from public.categories where id = p_category_id;
  if v_event is null then raise exception 'Unknown category'; end if;
  perform public.assert_schedule_editor(v_event);

  update public.categories c set sequence = n.rn
  from (select id, row_number() over (order by sequence nulls last, created_at) as rn
        from public.categories where event_id = v_event) n
  where c.id = n.id;

  select sequence into v_seq from public.categories where id = p_category_id;
  select id, sequence into v_other, v_other_seq from public.categories
  where event_id = v_event and id <> p_category_id and event_day is not distinct from v_day
    and (case when p_direction = 1 then sequence > v_seq else sequence < v_seq end)
  order by case when p_direction = 1 then sequence end asc, case when p_direction = -1 then sequence end desc
  limit 1;
  if v_other is null then return; end if;

  update public.categories set sequence = case when id = p_category_id then v_other_seq else v_seq end
  where id in (p_category_id, v_other);

  for t in select id from public.tatamis where event_id = v_event loop
    perform public.bracket_resequence(t);
  end loop;
end;
$$;

-- Same as before, plus each match's day. Position and estimated time count within a tatami's day.
-- Only the day being run (the earliest with matches left, or no day at all) gets call times, so a later
-- day shows order only. Conflicts are judged on the offset from the day's start, on the same day only.
drop function event_schedule(uuid);
create function event_schedule(p_event_id uuid)
returns table (
  tatami_id uuid, tatami_name text, tatami_status text, queue_position int, match_id uuid,
  category_label text, discipline text, bracket_side text, round int, match_status text,
  athlete_a text, athlete_b text, estimated_call_time timestamptz, minutes numeric, conflict boolean,
  event_day date
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' and not public.is_event_member(p_event_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  return query
  with q as (
    select t.id as tid, t.name as tname, t.status as tstatus, m.id as mid, m.queue_order, m.bracket_side as side,
           m.round as rnd, m.status as mstatus, m.athlete_a_id as a_id, m.athlete_b_id as b_id,
           c.label as clabel, c.discipline as disc, c.event_day as day,
           case c.discipline when 'kumite' then e.kumite_minutes when 'kata' then e.kata_minutes else e.team_minutes end as mins
    from public.matches m
    join public.brackets b on b.id = m.bracket_id
    join public.categories c on c.id = b.category_id
    join public.events e on e.id = c.event_id
    join public.tatamis t on t.id = m.tatami_id
    where c.event_id = p_event_id and m.status in ('scheduled', 'in_progress')
  ),
  live as (select min(q.day) as day from q),
  timed as (
    select q.*,
           (row_number() over w)::int as pos,
           coalesce(sum(q.mins) over (w rows between unbounded preceding and 1 preceding), 0) as offset_min
    from q window w as (partition by q.tid, q.day order by (q.a_id is null or q.b_id is null), q.queue_order)
  ),
  booked as (
    select tm.mid, tm.tid, tm.day, tm.offset_min as s, tm.offset_min + tm.mins as e, v.athlete
    from timed tm cross join lateral (values (tm.a_id), (tm.b_id)) v(athlete)
    where v.athlete is not null
  ),
  clashes as (
    select distinct x.mid from booked x
    join booked y on y.athlete = x.athlete and y.tid <> x.tid and y.day is not distinct from x.day
                 and x.s < y.e and y.s < x.e
  )
  select tm.tid, tm.tname, tm.tstatus, tm.pos, tm.mid, tm.clabel, tm.disc, tm.side, tm.rnd, tm.mstatus,
         na.full_name, nb.full_name,
         case when tm.day is null or tm.day = l.day then now() + tm.offset_min * interval '1 minute' end,
         tm.mins, (cl.mid is not null), tm.day
  from timed tm
  cross join live l
  left join public.athletes na on na.id = tm.a_id
  left join public.athletes nb on nb.id = tm.b_id
  left join clashes cl on cl.mid = tm.mid
  order by tm.tname, tm.tid, tm.day nulls last, tm.pos;
end;
$$;

revoke all on function set_category_day(uuid, date), event_schedule(uuid) from public, anon, authenticated;
grant execute on function set_category_day(uuid, date), event_schedule(uuid) to authenticated;
grant execute on function event_schedule(uuid) to service_role;
