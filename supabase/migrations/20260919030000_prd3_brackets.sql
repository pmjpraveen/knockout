-- PRD 3: bracket generation, seeding, and the engine that advances a bracket.
--
-- Each match slot (a / b) is either filled at generation (a real athlete or an empty
-- bye) or fed by another match: the 'winner' or 'loser' of it, or the 'ladder' entry
-- "the opponent the finalist beat in round N" (single-elimination repechage). Advancing
-- a bracket is then one generic rule: when a match resolves, fill the slots it feeds.

alter table matches
  add column position int,
  add column bracket_side text not null default 'main'
    check (bracket_side in ('main','repechage_top','repechage_bottom','winners','losers','grand_final','reset','pool')),
  add column pool int,
  add column a_source_id uuid references matches(id) on delete cascade,
  add column a_source_kind text check (a_source_kind in ('winner','loser','ladder')),
  add column a_source_round int,
  add column b_source_id uuid references matches(id) on delete cascade,
  add column b_source_kind text check (b_source_kind in ('winner','loser','ladder')),
  add column b_source_round int;

create index on matches (a_source_id);
create index on matches (b_source_id);

-- Standard seeding positions: size 8 -> {1,8,4,5,2,7,3,6}; adjacent pairs are round-1 matches.
create function bracket_seed_order(p_size int) returns int[]
language plpgsql immutable set search_path = ''
as $$
declare
  v int[] := array[1];
  v_next int[];
  v_n int := 1;
  s int;
begin
  while v_n < p_size loop
    v_next := '{}';
    foreach s in array v loop
      v_next := v_next || s || (2 * v_n + 1 - s);
    end loop;
    v := v_next;
    v_n := v_n * 2;
  end loop;
  return v;
end;
$$;

-- Serpentine pool assignment: seeds 1..p go to pools 1..p, the next p go back p..1, and so on.
create function bracket_snake_pool(p_seed int, p_pools int) returns int
language sql immutable set search_path = ''
as $$
  select case when ((p_seed - 1) / p_pools) % 2 = 0
              then ((p_seed - 1) % p_pools) + 1
              else p_pools - ((p_seed - 1) % p_pools) end;
$$;

-- What a slot receives from the match that feeds it (null = nobody, i.e. an empty slot).
create function bracket_slot_value(p_source uuid, p_kind text, p_round int) returns uuid
language plpgsql stable set search_path = ''
as $$
declare
  v_m public.matches;
  v_loser uuid;
begin
  select * into v_m from public.matches where id = p_source;

  if p_kind = 'winner' then
    return v_m.winner_id;
  elsif p_kind = 'loser' then
    if v_m.status <> 'completed' then return null; end if; -- a bye has no loser
    return case when v_m.winner_id = v_m.athlete_a_id then v_m.athlete_b_id else v_m.athlete_a_id end;
  end if;

  -- ladder: the opponent the finalist (winner of p_source) beat in round p_round
  if v_m.winner_id is null then return null; end if;
  select case when x.winner_id = x.athlete_a_id then x.athlete_b_id else x.athlete_a_id end into v_loser
  from public.matches x
  where x.bracket_id = v_m.bracket_id and x.bracket_side = 'main'
    and x.round = p_round and x.status = 'completed' and x.winner_id = v_m.winner_id;
  return v_loser;
end;
$$;

-- Fills every slot fed by p_match_id, then resolves matches that can no longer have two
-- athletes (a bye, or an empty match) and keeps going down the bracket.
create function bracket_propagate(p_match_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_queue uuid[] := array[p_match_id];
  v_cur uuid;
  v_src public.matches;
  v_dep public.matches;
  v_a_ready boolean;
  v_b_ready boolean;
  v_a uuid;
  v_b uuid;
begin
  while cardinality(v_queue) > 0 loop
    v_cur := v_queue[1];
    v_queue := v_queue[2:];
    select * into v_src from public.matches where id = v_cur;

    for v_dep in
      select * from public.matches where a_source_id = v_cur or b_source_id = v_cur order by round, position
    loop
      -- Double elimination: no reset match if the winners-bracket finalist (slot a) won the final.
      if v_dep.bracket_side = 'reset' and v_src.winner_id = v_src.athlete_a_id then
        update public.matches set status = 'bye', winner_id = null where id = v_dep.id;
        v_queue := v_queue || v_dep.id;
        continue;
      end if;

      select * into v_dep from public.matches where id = v_dep.id;
      if v_dep.status <> 'scheduled' then continue; end if;

      -- Both slots are recomputed here rather than trusting what earlier propagation wrote,
      -- so a slot fed by an already-resolved bye is never mistaken for an empty one.
      v_a_ready := v_dep.a_source_id is null or exists (
        select 1 from public.matches s where s.id = v_dep.a_source_id and s.status in ('completed', 'bye'));
      v_b_ready := v_dep.b_source_id is null or exists (
        select 1 from public.matches s where s.id = v_dep.b_source_id and s.status in ('completed', 'bye'));
      v_a := case when v_dep.a_source_id is not null and v_a_ready
                  then public.bracket_slot_value(v_dep.a_source_id, v_dep.a_source_kind, v_dep.a_source_round)
                  else v_dep.athlete_a_id end;
      v_b := case when v_dep.b_source_id is not null and v_b_ready
                  then public.bracket_slot_value(v_dep.b_source_id, v_dep.b_source_kind, v_dep.b_source_round)
                  else v_dep.athlete_b_id end;

      if v_a_ready and v_b_ready and (v_a is null or v_b is null) then
        update public.matches
        set athlete_a_id = v_a, athlete_b_id = v_b, status = 'bye', winner_id = coalesce(v_a, v_b)
        where id = v_dep.id;
        v_queue := v_queue || v_dep.id;
      else
        update public.matches set athlete_a_id = v_a, athlete_b_id = v_b where id = v_dep.id;
      end if;
    end loop;
  end loop;
end;
$$;

-- Records a result and advances the bracket. Internal: PRD 5's finalize_match wraps it,
-- and withdraw_athlete uses it for walkovers.
create function bracket_complete_match(p_match_id uuid, p_winner_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_m public.matches;
begin
  select * into v_m from public.matches where id = p_match_id for update;
  if v_m.status not in ('scheduled', 'in_progress') or v_m.athlete_a_id is null or v_m.athlete_b_id is null then
    raise exception 'Match is not ready to be completed';
  end if;
  if p_winner_id is distinct from v_m.athlete_a_id and p_winner_id is distinct from v_m.athlete_b_id then
    raise exception 'Winner must be one of the match''s athletes';
  end if;
  update public.matches set status = 'completed', winner_id = p_winner_id where id = p_match_id;
  perform public.bracket_propagate(p_match_id);
end;
$$;

-- Manual seeds: the listed registrations get seeds 1..n in order, everyone else is unseeded.
create function set_seeds(p_category_id uuid, p_registration_ids uuid[]) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_event uuid;
begin
  select event_id into v_event from public.categories where id = p_category_id;
  if v_event is null or not public.is_event_member(v_event, array['organizer']) then
    raise exception 'Only the organizer can seed a category' using errcode = '42501';
  end if;
  perform public.assert_event_writable(v_event);
  if exists (select 1 from public.matches m join public.brackets b on b.id = m.bracket_id
             where b.category_id = p_category_id and m.status in ('in_progress', 'completed')) then
    raise exception 'Matches have started; seeds are locked';
  end if;
  if (select count(*) from public.registrations
      where category_id = p_category_id and id = any (p_registration_ids)) <> cardinality(p_registration_ids) then
    raise exception 'Every seeded registration must belong to this category';
  end if;

  update public.registrations set seed = null where category_id = p_category_id;
  update public.registrations r set seed = s.n
  from unnest(p_registration_ids) with ordinality as s(id, n)
  where r.id = s.id;
end;
$$;

create function generate_bracket(p_category_id uuid, p_format text default null) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_event uuid;
  v_status text;
  v_format text;
  v_bracket uuid;
  v_n int;
  v_k int;
  v_ath uuid[];
  v_club text[];
  v_perm int[];
  v_arr int[];
  v_best_arr int[];
  v_conf int;
  v_best int := 2147483647;
  v_size int := 1;
  v_rounds int := 0;
  v_pools int;
  v_order int[];
  v_side text;
  v_id uuid;
  v_prev uuid[];
  v_cur uuid[];
  v_a uuid;
  v_b uuid;
  s int;
  t int;
  i int;
  j int;
  r int;
  k int;
  p int;
  v_semi uuid;
  v_last_bout uuid;
  v_lr int := 0;
  v_gf uuid;
  v_members uuid[];
  v_pl uuid[];
  v_m int;
begin
  select event_id, status, bracket_format into v_event, v_status, v_format
  from public.categories where id = p_category_id for update;
  if v_event is null or not public.is_event_member(v_event, array['organizer']) then
    raise exception 'Only the organizer can generate brackets' using errcode = '42501';
  end if;
  perform public.assert_event_writable(v_event);
  if v_status not in ('closed', 'bracket_generated') then
    raise exception 'Close registration before generating brackets';
  end if;
  v_format := coalesce(p_format, v_format);
  if v_format not in ('single_elim_repechage', 'round_robin', 'double_elim') then
    raise exception 'Choose a bracket format';
  end if;
  if exists (select 1 from public.matches m join public.brackets b on b.id = m.bracket_id
             where b.category_id = p_category_id and m.status in ('in_progress', 'completed')) then
    raise exception 'Matches have started. Use a withdrawal override instead of regenerating.';
  end if;

  -- Seeded athletes first (in seed order), then the rest.
  select array_agg(a.id order by reg.seed nulls last, reg.created_at),
         array_agg(lower(btrim(ce.club_name)) order by reg.seed nulls last, reg.created_at),
         count(*) filter (where reg.seed is not null)
  into v_ath, v_club, v_k
  from public.registrations reg
  join public.athletes a on a.id = reg.athlete_id
  join public.club_entries ce on ce.id = a.club_entry_id
  where reg.category_id = p_category_id;
  v_n := coalesce(cardinality(v_ath), 0);
  if v_n < 2 then
    raise exception 'A bracket needs at least 2 athletes';
  end if;

  delete from public.brackets where category_id = p_category_id;
  update public.categories set bracket_format = v_format where id = p_category_id;

  while v_size < v_n loop v_size := v_size * 2; v_rounds := v_rounds + 1; end loop;
  v_order := public.bracket_seed_order(v_size);
  v_pools := case when v_n <= 6 then 1 else ceil(v_n / 5.0)::int end;

  -- Randomise the unseeded athletes, keeping the arrangement with the fewest same-club
  -- first-round (or same-pool) pairings. ponytail: 100 random restarts, not an exact solver.
  for i in 1..100 loop
    v_perm := array(select g from generate_series(v_k + 1, v_n) g order by random());
    v_arr := array(select g from generate_series(1, v_k) g) || v_perm;
    v_conf := 0;
    if v_format = 'round_robin' then
      for s in 1..v_n - 1 loop
        for t in s + 1..v_n loop
          if public.bracket_snake_pool(s, v_pools) = public.bracket_snake_pool(t, v_pools)
             and v_club[v_arr[s]] = v_club[v_arr[t]] then
            v_conf := v_conf + 1;
          end if;
        end loop;
      end loop;
    else
      for j in 1..v_size / 2 loop
        s := v_order[2 * j - 1];
        t := v_order[2 * j];
        if s <= v_n and t <= v_n and v_club[v_arr[s]] = v_club[v_arr[t]] then
          v_conf := v_conf + 1;
        end if;
      end loop;
    end if;
    if v_conf < v_best then
      v_best := v_conf;
      v_best_arr := v_arr;
    end if;
    exit when v_best = 0 or v_k >= v_n - 1;
  end loop;
  v_arr := v_best_arr;

  insert into public.brackets (category_id, format, repechage)
  values (p_category_id, v_format, v_format = 'single_elim_repechage' and v_rounds >= 3)
  returning id into v_bracket;

  if v_format = 'round_robin' then
    for p in 1..v_pools loop
      v_pl := array(select v_ath[v_arr[g]] from generate_series(1, v_n) g
                    where public.bracket_snake_pool(g, v_pools) = p order by g);
      if cardinality(v_pl) % 2 = 1 then v_pl := v_pl || null::uuid; end if;
      v_m := cardinality(v_pl);
      for r in 1..v_m - 1 loop
        for i in 1..v_m / 2 loop
          v_a := v_pl[i];
          v_b := v_pl[v_m + 1 - i];
          if v_a is not null and v_b is not null then
            insert into public.matches (bracket_id, round, position, bracket_side, pool, athlete_a_id, athlete_b_id)
            values (v_bracket, r, i, 'pool', p, v_a, v_b);
          end if;
        end loop;
        v_pl := v_pl[1:1] || v_pl[v_m:v_m] || v_pl[2:v_m - 1]; -- circle method rotation
      end loop;
    end loop;
    update public.brackets set rounds = (select max(round) from public.matches where bracket_id = v_bracket)
    where id = v_bracket;
  else
    v_side := case when v_format = 'double_elim' then 'winners' else 'main' end;

    for i in 1..v_size / 2 loop
      s := v_order[2 * i - 1];
      t := v_order[2 * i];
      v_a := case when s <= v_n then v_ath[v_arr[s]] end;
      v_b := case when t <= v_n then v_ath[v_arr[t]] end;
      insert into public.matches (bracket_id, round, position, bracket_side, athlete_a_id, athlete_b_id, status, winner_id)
      values (v_bracket, 1, i, v_side, v_a, v_b,
              case when v_a is null or v_b is null then 'bye' else 'scheduled' end,
              case when v_a is null then v_b when v_b is null then v_a end);
    end loop;
    for r in 2..v_rounds loop
      v_prev := array(select id from public.matches
                      where bracket_id = v_bracket and bracket_side = v_side and round = r - 1 order by position);
      for j in 1..cardinality(v_prev) / 2 loop
        insert into public.matches (bracket_id, round, position, bracket_side,
                                    a_source_id, a_source_kind, b_source_id, b_source_kind)
        values (v_bracket, r, j, v_side, v_prev[2 * j - 1], 'winner', v_prev[2 * j], 'winner');
      end loop;
    end loop;

    if v_format = 'single_elim_repechage' and v_rounds >= 3 then
      -- One ladder per finalist: bout 1 = losers to the finalist in rounds 1 and 2, each
      -- later bout adds the loser from the next round; the last bout is for bronze.
      for k in 1..2 loop
        select id into v_semi from public.matches
        where bracket_id = v_bracket and bracket_side = 'main' and round = v_rounds - 1 and position = k;
        v_last_bout := null;
        for j in 1..v_rounds - 2 loop
          insert into public.matches (bracket_id, round, position, bracket_side, is_repechage,
                                      a_source_id, a_source_kind, a_source_round, b_source_id, b_source_kind, b_source_round)
          values (v_bracket, v_rounds - 1 + j, j, case when k = 1 then 'repechage_top' else 'repechage_bottom' end, true,
                  coalesce(v_last_bout, v_semi), case when j = 1 then 'ladder' else 'winner' end, case when j = 1 then 1 end,
                  v_semi, 'ladder', j + 1)
          returning id into v_last_bout;
        end loop;
      end loop;

    elsif v_format = 'double_elim' and v_rounds >= 2 then
      v_prev := array(select id from public.matches
                      where bracket_id = v_bracket and bracket_side = 'winners' and round = 1 order by position);
      v_lr := 1;
      for i in 1..cardinality(v_prev) / 2 loop
        insert into public.matches (bracket_id, round, position, bracket_side,
                                    a_source_id, a_source_kind, b_source_id, b_source_kind)
        values (v_bracket, 1, i, 'losers', v_prev[2 * i - 1], 'loser', v_prev[2 * i], 'loser');
      end loop;
      for k in 2..v_rounds loop
        v_cur := array(select id from public.matches
                       where bracket_id = v_bracket and bracket_side = 'winners' and round = k order by position);
        v_prev := array(select id from public.matches
                        where bracket_id = v_bracket and bracket_side = 'losers' and round = v_lr order by position);
        v_lr := v_lr + 1;
        -- Winners-bracket losers drop in, reversed on even rounds to delay rematches.
        for i in 1..cardinality(v_cur) loop
          insert into public.matches (bracket_id, round, position, bracket_side,
                                      a_source_id, a_source_kind, b_source_id, b_source_kind)
          values (v_bracket, v_lr, i, 'losers', v_prev[i], 'winner',
                  v_cur[case when k % 2 = 0 then cardinality(v_cur) + 1 - i else i end], 'loser');
        end loop;
        if k < v_rounds then
          v_prev := array(select id from public.matches
                          where bracket_id = v_bracket and bracket_side = 'losers' and round = v_lr order by position);
          v_lr := v_lr + 1;
          for i in 1..cardinality(v_prev) / 2 loop
            insert into public.matches (bracket_id, round, position, bracket_side,
                                        a_source_id, a_source_kind, b_source_id, b_source_kind)
            values (v_bracket, v_lr, i, 'losers', v_prev[2 * i - 1], 'winner', v_prev[2 * i], 'winner');
          end loop;
        end if;
      end loop;

      insert into public.matches (bracket_id, round, position, bracket_side,
                                  a_source_id, a_source_kind, b_source_id, b_source_kind)
      values (v_bracket, v_rounds + 1, 1, 'grand_final',
              (select id from public.matches where bracket_id = v_bracket and bracket_side = 'winners' and round = v_rounds),
              'winner',
              (select id from public.matches where bracket_id = v_bracket and bracket_side = 'losers' and round = v_lr),
              'winner')
      returning id into v_gf;
      insert into public.matches (bracket_id, round, position, bracket_side,
                                  a_source_id, a_source_kind, b_source_id, b_source_kind)
      values (v_bracket, v_rounds + 2, 1, 'reset', v_gf, 'winner', v_gf, 'loser');
    end if;

    update public.brackets set rounds = (select max(round) from public.matches where bracket_id = v_bracket)
    where id = v_bracket;

    for v_id in select id from public.matches where bracket_id = v_bracket and status = 'bye' loop
      perform public.bracket_propagate(v_id);
    end loop;
  end if;

  update public.categories set status = 'bracket_generated' where id = p_category_id;
  return v_bracket;
end;
$$;

-- After matches have started: the withdrawing athlete's unplayed matches are walkovers.
-- Their opponent must already be known, otherwise nothing changes and the caller is told.
create function withdraw_athlete(p_bracket_id uuid, p_athlete_id uuid, p_note text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_event uuid;
  v_m public.matches;
begin
  select c.event_id into v_event
  from public.brackets b join public.categories c on c.id = b.category_id
  where b.id = p_bracket_id;
  if v_event is null or not public.is_event_member(v_event, array['organizer', 'tournament_director']) then
    raise exception 'Only the organizer or a tournament director can record a withdrawal' using errcode = '42501';
  end if;
  perform public.assert_event_writable(v_event);
  if btrim(coalesce(p_note, '')) = '' then
    raise exception 'A note is required for a bracket override';
  end if;

  loop
    select * into v_m from public.matches
    where bracket_id = p_bracket_id and status = 'scheduled'
      and (athlete_a_id = p_athlete_id or athlete_b_id = p_athlete_id)
    order by round limit 1;
    exit when not found;
    if v_m.athlete_a_id is null or v_m.athlete_b_id is null then
      raise exception 'The opponent is not decided yet. Try again once their match is finished.';
    end if;
    perform public.bracket_complete_match(
      v_m.id, case when v_m.athlete_a_id = p_athlete_id then v_m.athlete_b_id else v_m.athlete_a_id end);
  end loop;

  insert into public.audit_log (event_id, actor_id, action, subject_id, reason, changes)
  values (v_event, auth.uid(), 'withdraw_athlete', p_bracket_id, btrim(p_note),
          jsonb_build_object('athlete_id', p_athlete_id));
end;
$$;

-- Pool ranking: wins, then head-to-head wins among athletes level on wins, then points
-- differential. Points come from score_events of type ippon/waza_ari/yuko (PRD 5 owns scoring).
-- Athletes still level after all three share a rank; the PRD leaves that tiebreak open.
create function pool_standings(p_bracket_id uuid)
returns table (pool int, athlete_id uuid, wins int, losses int, points_for numeric, points_against numeric, rank int)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_event_member(public.bracket_event_id(p_bracket_id)) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  return query
  with sides as (
    select m.pool, m.id as match_id, m.athlete_a_id as athlete, m.athlete_b_id as opp, m.winner_id, m.status
    from public.matches m where m.bracket_id = p_bracket_id and m.bracket_side = 'pool'
    union all
    select m.pool, m.id, m.athlete_b_id, m.athlete_a_id, m.winner_id, m.status
    from public.matches m where m.bracket_id = p_bracket_id and m.bracket_side = 'pool'
  ),
  pts as (
    select se.match_id, se.athlete_id, sum(se.value) as p
    from public.score_events se where se.type in ('ippon', 'waza_ari', 'yuko') group by se.match_id, se.athlete_id
  ),
  base as (
    select s.pool, s.athlete,
           count(*) filter (where s.status = 'completed' and s.winner_id = s.athlete)::int as w,
           count(*) filter (where s.status = 'completed' and s.winner_id <> s.athlete)::int as l,
           coalesce(sum(p1.p), 0) as pf,
           coalesce(sum(p2.p), 0) as pa
    from sides s
    left join pts p1 on p1.match_id = s.match_id and p1.athlete_id = s.athlete
    left join pts p2 on p2.match_id = s.match_id and p2.athlete_id = s.opp
    group by s.pool, s.athlete
  ),
  h2h as (
    select s.pool, s.athlete, count(*)::int as h
    from sides s
    join base me on me.pool = s.pool and me.athlete = s.athlete
    join base them on them.pool = s.pool and them.athlete = s.opp
    where s.status = 'completed' and s.winner_id = s.athlete and me.w = them.w
    group by s.pool, s.athlete
  )
  select b.pool, b.athlete, b.w, b.l, b.pf, b.pa,
         (rank() over (partition by b.pool order by b.w desc, coalesce(h.h, 0) desc, (b.pf - b.pa) desc))::int
  from base b
  left join h2h h on h.pool = b.pool and h.athlete = b.athlete
  order by b.pool, 7, b.athlete;
end;
$$;

revoke all on function
  bracket_seed_order(int), bracket_snake_pool(int, int), bracket_slot_value(uuid, text, int),
  bracket_propagate(uuid), bracket_complete_match(uuid, uuid),
  set_seeds(uuid, uuid[]), generate_bracket(uuid, text), withdraw_athlete(uuid, uuid, text), pool_standings(uuid)
from public, anon, authenticated;

grant execute on function
  set_seeds(uuid, uuid[]), generate_bracket(uuid, text), withdraw_athlete(uuid, uuid, text), pool_standings(uuid)
to authenticated;
