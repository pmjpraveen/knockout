-- PRD 4: tatami assignment, running order, estimated call times, conflicts, public schedule.
--
-- A category has a home tatami (all its matches run there by default) and a place in the
-- event's category sequence. A match's position in its tatami's queue is matches.queue_order;
-- call times are never stored, they are estimated from the queue each time it is read.

alter table events
  add column kumite_minutes numeric not null default 2 check (kumite_minutes > 0),
  add column kata_minutes numeric not null default 1.5 check (kata_minutes > 0),
  add column team_minutes numeric not null default 3 check (team_minutes > 0),
  add column schedule_token text unique;

alter table categories
  add column tatami_id uuid references tatamis(id) on delete set null,
  add column sequence int;

alter table matches add column queue_order int;
create index on matches (tatami_id, queue_order);

-- Rebuilds one tatami's queue: in-progress first, then category sequence, then dependency
-- depth (a match never precedes the matches that feed it), then round/pool/position.
create function bracket_resequence(p_tatami_id uuid) returns void
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
             order by (m.status = 'in_progress') desc, cat.sequence nulls last, cat.created_at,
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

-- New matches (including a regenerated bracket) start on their category's home tatami.
create function matches_default_tatami() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.tatami_id is null then
    select c.tatami_id into new.tatami_id
    from public.brackets b join public.categories c on c.id = b.category_id
    where b.id = new.bracket_id;
  end if;
  return new;
end;
$$;
create trigger matches_default_tatami before insert on matches
  for each row execute function matches_default_tatami();

create function categories_resequence_after_draw() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.bracket_resequence(new.tatami_id);
  return new;
end;
$$;
create trigger categories_resequence_after_draw after update of status on categories
  for each row when (new.status = 'bracket_generated') execute function categories_resequence_after_draw();

-- Shared guard: Organizer or Tournament Director of a still-live event.
create function assert_schedule_editor(p_event_id uuid) returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_event_member(p_event_id, array['organizer', 'tournament_director']) then
    raise exception 'Only the organizer or a tournament director can change the schedule' using errcode = '42501';
  end if;
  perform public.assert_event_writable(p_event_id);
end;
$$;

-- Runs the whole category on one tatami (or unassigns it with null). Already-played and
-- in-progress matches stay where they were.
create function assign_category_to_tatami(p_category_id uuid, p_tatami_id uuid default null) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_event uuid;
  v_touched uuid[];
  t uuid;
begin
  select event_id into v_event from public.categories where id = p_category_id;
  if v_event is null then raise exception 'Unknown category'; end if;
  perform public.assert_schedule_editor(v_event);
  if p_tatami_id is not null
     and not exists (select 1 from public.tatamis where id = p_tatami_id and event_id = v_event) then
    raise exception 'That tatami belongs to a different event';
  end if;

  select array_agg(distinct m.tatami_id) into v_touched
  from public.matches m join public.brackets b on b.id = m.bracket_id
  where b.category_id = p_category_id and m.tatami_id is not null;

  update public.categories set tatami_id = p_tatami_id where id = p_category_id;
  update public.matches m set tatami_id = p_tatami_id
  from public.brackets b
  where b.id = m.bracket_id and b.category_id = p_category_id and m.status in ('scheduled', 'bye');

  foreach t in array coalesce(v_touched, '{}') || p_tatami_id loop
    perform public.bracket_resequence(t);
  end loop;
end;
$$;

-- Early rounds (or round-robin pools) run in parallel on the listed tatamis; everything from
-- p_converge_round on runs on the home tatami. Same bracket, so seeding and results stay unified.
-- Single/double elimination: only the main/winners bracket is split; the losers bracket, finals
-- and repechage stay on the home tatami. ponytail: no per-match balancing.
create function split_bracket_across_tatamis(
  p_category_id uuid,
  p_tatami_ids uuid[],
  p_home_tatami uuid,
  p_converge_round int default null
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_event uuid;
  v_bracket uuid;
  v_format text;
  v_rounds int;
  v_k int := cardinality(p_tatami_ids);
  v_touched uuid[];
  t uuid;
begin
  select c.event_id, b.id, b.format, (select max(round) from public.matches where bracket_id = b.id and bracket_side in ('main', 'winners'))
  into v_event, v_bracket, v_format, v_rounds
  from public.categories c left join public.brackets b on b.category_id = c.id
  where c.id = p_category_id;
  if v_event is null then raise exception 'Unknown category'; end if;
  perform public.assert_schedule_editor(v_event);
  if v_bracket is null then raise exception 'Generate the bracket before splitting it'; end if;
  if v_k < 2 or v_k <> (select count(distinct x) from unnest(p_tatami_ids) x) then
    raise exception 'Pick at least two different tatamis';
  end if;
  if (select count(*) from public.tatamis where event_id = v_event and id = any (p_tatami_ids || p_home_tatami))
     <> (select count(distinct x) from unnest(p_tatami_ids || p_home_tatami) x) then
    raise exception 'Every tatami must belong to this event';
  end if;
  if v_format <> 'round_robin' and (p_converge_round is null or p_converge_round < 2 or p_converge_round > v_rounds) then
    raise exception 'Converge on a round between 2 and %', v_rounds;
  end if;

  select array_agg(distinct m.tatami_id) into v_touched from public.matches m where m.bracket_id = v_bracket and m.tatami_id is not null;

  update public.categories set tatami_id = p_home_tatami where id = p_category_id;
  update public.matches set tatami_id = p_home_tatami where bracket_id = v_bracket and status in ('scheduled', 'bye');

  if v_format = 'round_robin' then
    update public.matches m set tatami_id = p_tatami_ids[((m.pool - 1) % v_k) + 1]
    where m.bracket_id = v_bracket and m.status in ('scheduled', 'bye') and m.pool is not null;
  else
    -- contiguous blocks by position, so each ring keeps one part of the draw until the merge
    update public.matches m set tatami_id = p_tatami_ids[((s.position - 1) * v_k) / s.total + 1]
    from (
      select id, position, count(*) over (partition by round) as total
      from public.matches
      where bracket_id = v_bracket and bracket_side in ('main', 'winners') and round < p_converge_round
    ) s
    where m.id = s.id and m.status in ('scheduled', 'bye');
  end if;

  foreach t in array coalesce(v_touched, '{}') || p_tatami_ids || p_home_tatami loop
    perform public.bracket_resequence(t);
  end loop;
end;
$$;

-- Delay (+1) or advance (-1) a playable match by one place among its tatami's playable matches.
-- Matches still waiting on earlier results, and the match in progress, cannot be moved, so a
-- match never jumps ahead of one that feeds it.
create function move_in_queue(p_match_id uuid, p_direction int) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_m public.matches;
  v_n public.matches;
  v_event uuid;
begin
  if p_direction not in (-1, 1) then raise exception 'Direction must be -1 or 1'; end if;
  select m.* into v_m from public.matches m where m.id = p_match_id;
  select c.event_id into v_event
  from public.brackets b join public.categories c on c.id = b.category_id where b.id = v_m.bracket_id;
  if v_event is null then raise exception 'Unknown match'; end if;
  perform public.assert_schedule_editor(v_event);
  if v_m.tatami_id is null or v_m.queue_order is null then raise exception 'That match is not in a queue'; end if;
  if v_m.status = 'in_progress' then raise exception 'The match in progress cannot be moved'; end if;
  if v_m.athlete_a_id is null or v_m.athlete_b_id is null then
    raise exception 'Only a match whose athletes are known can be moved';
  end if;

  select * into v_n from public.matches
  where tatami_id = v_m.tatami_id and status = 'scheduled'
    and athlete_a_id is not null and athlete_b_id is not null
    and (case when p_direction = 1 then queue_order > v_m.queue_order else queue_order < v_m.queue_order end)
  order by case when p_direction = 1 then queue_order end asc, case when p_direction = -1 then queue_order end desc
  limit 1;
  if not found then return; end if;

  update public.matches set queue_order = case when id = v_m.id then v_n.queue_order else v_m.queue_order end
  where id in (v_m.id, v_n.id);
end;
$$;

-- Moves a category earlier (-1) or later (+1) in the event's running order.
create function move_category_sequence(p_category_id uuid, p_direction int) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_event uuid;
  v_seq int;
  t uuid;
begin
  if p_direction not in (-1, 1) then raise exception 'Direction must be -1 or 1'; end if;
  select event_id into v_event from public.categories where id = p_category_id;
  if v_event is null then raise exception 'Unknown category'; end if;
  perform public.assert_schedule_editor(v_event);

  update public.categories c set sequence = n.rn
  from (select id, row_number() over (order by sequence nulls last, created_at) as rn
        from public.categories where event_id = v_event) n
  where c.id = n.id;

  select sequence into v_seq from public.categories where id = p_category_id;
  if not exists (select 1 from public.categories where event_id = v_event and sequence = v_seq + p_direction) then
    return;
  end if;
  update public.categories set sequence = v_seq where event_id = v_event and sequence = v_seq + p_direction;
  update public.categories set sequence = v_seq + p_direction where id = p_category_id;

  for t in select id from public.tatamis where event_id = v_event loop
    perform public.bracket_resequence(t);
  end loop;
end;
$$;

-- Every upcoming match with its estimated call time: now plus the durations of the matches
-- ahead of it on the same tatami. Matches whose athletes are known come first (a ring runs what it
-- can call), the ones still waiting on earlier results follow. Flags an athlete who would be called to two rings at once.
-- Used by the app and, via the Edge Function, the public schedule.
create function event_schedule(p_event_id uuid)
returns table (
  tatami_id uuid, tatami_name text, tatami_status text, queue_position int, match_id uuid,
  category_label text, discipline text, bracket_side text, round int, match_status text,
  athlete_a text, athlete_b text, estimated_call_time timestamptz, minutes numeric, conflict boolean
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
           c.label as clabel, c.discipline as disc,
           case c.discipline when 'kumite' then e.kumite_minutes when 'kata' then e.kata_minutes else e.team_minutes end as mins
    from public.matches m
    join public.brackets b on b.id = m.bracket_id
    join public.categories c on c.id = b.category_id
    join public.events e on e.id = c.event_id
    join public.tatamis t on t.id = m.tatami_id
    where c.event_id = p_event_id and m.status in ('scheduled', 'in_progress')
  ),
  timed as (
    select q.*,
           (row_number() over w)::int as pos,
           now() + coalesce(sum(q.mins) over (w rows between unbounded preceding and 1 preceding), 0) * interval '1 minute' as est
    from q window w as (partition by q.tid order by (q.a_id is null or q.b_id is null), q.queue_order)
  ),
  booked as (
    select tm.mid, tm.tid, tm.est, tm.est + tm.mins * interval '1 minute' as est_end, v.athlete
    from timed tm cross join lateral (values (tm.a_id), (tm.b_id)) v(athlete)
    where v.athlete is not null
  ),
  clashes as (
    select distinct x.mid from booked x
    join booked y on y.athlete = x.athlete and y.tid <> x.tid and x.est < y.est_end and y.est < x.est_end
  )
  select tm.tid, tm.tname, tm.tstatus, tm.pos, tm.mid, tm.clabel, tm.disc, tm.side, tm.rnd, tm.mstatus,
         na.full_name, nb.full_name, tm.est, tm.mins, (cl.mid is not null)
  from timed tm
  left join public.athletes na on na.id = tm.a_id
  left join public.athletes nb on nb.id = tm.b_id
  left join clashes cl on cl.mid = tm.mid
  order by tm.tname, tm.tid, tm.pos;
end;
$$;

create function regenerate_schedule_link(p_event_id uuid) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if not public.is_event_member(p_event_id, array['organizer']) then
    raise exception 'Only the organizer can manage the schedule link' using errcode = '42501';
  end if;
  update public.events set schedule_token = v_token where id = p_event_id;
  return v_token;
end;
$$;

revoke all on function
  bracket_resequence(uuid), assert_schedule_editor(uuid),
  assign_category_to_tatami(uuid, uuid), split_bracket_across_tatamis(uuid, uuid[], uuid, int),
  move_in_queue(uuid, int), move_category_sequence(uuid, int), event_schedule(uuid), regenerate_schedule_link(uuid)
from public, anon, authenticated;

grant execute on function
  assign_category_to_tatami(uuid, uuid), split_bracket_across_tatamis(uuid, uuid[], uuid, int),
  move_in_queue(uuid, int), move_category_sequence(uuid, int), event_schedule(uuid), regenerate_schedule_link(uuid)
to authenticated;

grant execute on function event_schedule(uuid) to service_role;
