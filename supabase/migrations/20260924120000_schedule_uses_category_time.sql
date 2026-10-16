-- The schedule's estimated call times budget each match with the category's own match time when it has one, the same
-- rule the scoring clock already follows (tatami_scoreboard), and the event's per-discipline default otherwise.
create or replace function event_schedule(p_event_id uuid)
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
           coalesce(c.match_seconds / 60.0,
             case c.discipline when 'kumite' then e.kumite_minutes when 'kata' then e.kata_minutes else e.team_minutes end) as mins
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
