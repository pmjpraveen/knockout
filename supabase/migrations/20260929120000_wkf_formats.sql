-- WKF competition formats (Kumite 3.4, Kata 3.3): elimination with repechage (already here), round-robin in groups followed by
-- elimination, and the two-pool round-robin used at multisport games. Single and double elimination stay for categories that
-- already use them but are no longer offered for new ones.

alter table categories drop constraint categories_bracket_format_check;
alter table categories add constraint categories_bracket_format_check
  check (bracket_format in ('single_elim_repechage', 'single_elim', 'round_robin', 'double_elim', 'groups_elimination', 'two_pool_round_robin'));

create or replace function generate_bracket(p_category_id uuid, p_format text default null) returns uuid
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
  if v_format not in ('single_elim_repechage', 'single_elim', 'round_robin', 'double_elim', 'groups_elimination', 'two_pool_round_robin') then
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
  -- WKF group stage (Kumite 3.7.2, Kata 3.7.9): 1 group up to 5 athletes, 2 up to 8, 3 up to 11, 4 up to 16, 5 for 17, 6 up to 23, 8 up to 32.
  -- A two-pool round-robin (multisport games) is always two pools.
  v_pools := case
    when v_format = 'two_pool_round_robin' then 2
    when v_format = 'groups_elimination' then
      case when v_n <= 5 then 1 when v_n <= 8 then 2 when v_n <= 11 then 3 when v_n <= 16 then 4 when v_n = 17 then 5 when v_n <= 23 then 6 else 8 end
    when v_n <= 6 then 1
    else ceil(v_n / 5.0)::int end;
  if v_format = 'groups_elimination' and (v_n < 3 or v_n > 32) then
    raise exception 'Round-robin groups followed by elimination take 3 to 32 athletes.';
  end if;
  if v_format = 'two_pool_round_robin' and v_n < 4 then
    raise exception 'A two-pool round-robin needs at least 4 athletes.';
  end if;

  -- Randomise the unseeded athletes, keeping the arrangement with the fewest same-club
  -- first-round (or same-pool) pairings. ponytail: 100 random restarts, not an exact solver.
  for i in 1..100 loop
    v_perm := array(select g from generate_series(v_k + 1, v_n) g order by random());
    v_arr := array(select g from generate_series(1, v_k) g) || v_perm;
    v_conf := 0;
    if v_format in ('round_robin', 'groups_elimination', 'two_pool_round_robin') then
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

  if v_format in ('round_robin', 'groups_elimination', 'two_pool_round_robin') then
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

-- The group stage is over: the qualifiers move into an elimination bracket on the same bracket row (WKF Kumite 3.7, Kata 3.7).
-- Groups of 3-5 athletes play a final between the first two and a bronze bout; 2 groups go straight to the semi-finals;
-- 3 or more groups fill a quarter-final bracket (winners, then the best runners-up, then the best third places), with the
-- usual repechage ladders for the bronze medals. A two-pool round-robin sends the two pool winners to the final.
-- ponytail: "best" runner-up compares wins then points difference, not the full WKF 12.3 tie-break list.
create function bracket_finish_groups(p_bracket_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_format text;
  v_cat uuid;
  v_tatami uuid;
  v_g int;
  v_q int;
  v_size int := 1;
  v_rounds int := 0;
  v_order int[];
  v_win uuid[];
  v_win_pool int[];
  v_rest uuid[];
  v_rest_pool int[];
  v_slot uuid[];
  v_slot_pool int[];
  v_best uuid[];
  v_best_pool int[];
  v_perm int[];
  v_conf int;
  v_best_conf int := 2147483647;
  v_third uuid;
  v_fourth uuid;
  v_bracket_repechage boolean := false;
  v_prev uuid[];
  v_semi uuid;
  v_last_bout uuid;
  i int;
  j int;
  k int;
  r int;
  s int;
  t int;
begin
  select b.format, b.category_id into v_format, v_cat from public.brackets b where b.id = p_bracket_id;
  select tatami_id into v_tatami from public.categories where id = v_cat;
  select max(pool) into v_g from public.matches where bracket_id = p_bracket_id and bracket_side = 'pool';

  -- Ranked per pool: position 1 is the winner, 2 the runner-up, and so on.
  create temporary table if not exists pg_temp.group_rank (pool int, athlete uuid, pos int, wins int, diff numeric) on commit drop;
  delete from pg_temp.group_rank;
  insert into pg_temp.group_rank
  select s.pool, s.athlete_id,
         (row_number() over (partition by s.pool order by s.rank, s.wins desc, (s.points_for - s.points_against) desc, s.athlete_id))::int,
         s.wins, s.points_for - s.points_against
  from public.pool_standings(p_bracket_id) s;

  if v_format = 'two_pool_round_robin' then
    v_q := 2;
  else
    v_q := case when v_g = 1 then 2 when v_g = 2 then 4 else 8 end;
  end if;
  while v_size < v_q loop v_size := v_size * 2; v_rounds := v_rounds + 1; end loop;
  v_order := public.bracket_seed_order(v_size);

  if v_g = 1 then
    v_win := array(select athlete from pg_temp.group_rank where pos <= 2 order by pos);
    v_win_pool := array[1, 1];
  elsif v_format = 'two_pool_round_robin' then
    v_win := array(select athlete from pg_temp.group_rank where pos = 1 order by pool);
    v_win_pool := array(select pool from pg_temp.group_rank where pos = 1 order by pool);
  else
    v_win := array(select athlete from pg_temp.group_rank where pos = 1 order by pool);
    v_win_pool := array(select pool from pg_temp.group_rank where pos = 1 order by pool);
    -- The rest of the places: every runner-up first (best first), then the best third places.
    v_rest := array(select athlete from pg_temp.group_rank where pos in (2, 3) order by pos, wins desc, diff desc, athlete);
    v_rest_pool := array(select pool from pg_temp.group_rank where pos in (2, 3) order by pos, wins desc, diff desc, athlete);
    v_rest := v_rest[1:v_q - cardinality(v_win)];
    v_rest_pool := v_rest_pool[1:v_q - cardinality(v_win)];
  end if;

  -- Winners hold the top seeds; the others are shuffled, keeping the arrangement with the fewest same-group first-round pairings.
  v_slot := v_win || coalesce(v_rest, '{}');
  v_slot_pool := v_win_pool || coalesce(v_rest_pool, '{}');
  v_best := v_slot;
  v_best_pool := v_slot_pool;
  if v_q > 2 then
    for i in 1..100 loop
      v_perm := array(select g from generate_series(cardinality(v_win) + 1, v_q) g order by random());
      v_conf := 0;
      for j in 1..v_size / 2 loop
        s := v_order[2 * j - 1];
        t := v_order[2 * j];
        s := case when s <= cardinality(v_win) then s else v_perm[s - cardinality(v_win)] end;
        t := case when t <= cardinality(v_win) then t else v_perm[t - cardinality(v_win)] end;
        if v_slot_pool[s] = v_slot_pool[t] then v_conf := v_conf + 1; end if;
      end loop;
      if v_conf < v_best_conf then
        v_best_conf := v_conf;
        v_best := array(select case when g <= cardinality(v_win) then v_slot[g] else v_slot[v_perm[g - cardinality(v_win)]] end from generate_series(1, v_q) g);
        v_best_pool := array(select case when g <= cardinality(v_win) then v_slot_pool[g] else v_slot_pool[v_perm[g - cardinality(v_win)]] end from generate_series(1, v_q) g);
      end if;
      exit when v_best_conf = 0;
    end loop;
  end if;

  for i in 1..v_size / 2 loop
    insert into public.matches (bracket_id, round, position, bracket_side, athlete_a_id, athlete_b_id, tatami_id)
    values (p_bracket_id, 1, i, 'main', v_best[v_order[2 * i - 1]], v_best[v_order[2 * i]], v_tatami);
  end loop;
  for r in 2..v_rounds loop
    v_prev := array(select id from public.matches where bracket_id = p_bracket_id and bracket_side = 'main' and round = r - 1 order by position);
    for j in 1..cardinality(v_prev) / 2 loop
      insert into public.matches (bracket_id, round, position, bracket_side, a_source_id, a_source_kind, b_source_id, b_source_kind, tatami_id)
      values (p_bracket_id, r, j, 'main', v_prev[2 * j - 1], 'winner', v_prev[2 * j], 'winner', v_tatami);
    end loop;
  end loop;

  if v_rounds >= 3 then
    v_bracket_repechage := true;
    for k in 1..2 loop
      select id into v_semi from public.matches where bracket_id = p_bracket_id and bracket_side = 'main' and round = v_rounds - 1 and position = k;
      v_last_bout := null;
      for j in 1..v_rounds - 2 loop
        insert into public.matches (bracket_id, round, position, bracket_side, is_repechage,
                                    a_source_id, a_source_kind, a_source_round, b_source_id, b_source_kind, b_source_round, tatami_id)
        values (p_bracket_id, v_rounds - 1 + j, j, case when k = 1 then 'repechage_top' else 'repechage_bottom' end, true,
                coalesce(v_last_bout, v_semi), case when j = 1 then 'ladder' else 'winner' end, case when j = 1 then 1 end,
                v_semi, 'ladder', j + 1, v_tatami)
        returning id into v_last_bout;
      end loop;
    end loop;
  elsif v_g = 1 and v_format = 'groups_elimination' then
    -- One group: a final between the first two, and a single bronze bout between third and fourth (third alone takes bronze when the group has three).
    select athlete into v_third from pg_temp.group_rank where pos = 3;
    select athlete into v_fourth from pg_temp.group_rank where pos = 4;
    v_bracket_repechage := true;
    insert into public.matches (bracket_id, round, position, bracket_side, is_repechage, athlete_a_id, athlete_b_id, status, winner_id, tatami_id)
    values (p_bracket_id, 1, 1, 'repechage_top', true, v_third, v_fourth,
            case when v_fourth is null then 'bye' else 'scheduled' end, case when v_fourth is null then v_third end, v_tatami);
  end if;

  update public.brackets
  set repechage = v_bracket_repechage, rounds = (select max(round) from public.matches where bracket_id = p_bracket_id)
  where id = p_bracket_id;
  perform public.bracket_resequence(v_tatami);
end;
$$;

-- Records a result and advances the bracket. When the last group match of a round-robin format is played, the elimination stage is created.
create or replace function bracket_complete_match(p_match_id uuid, p_winner_id uuid) returns void
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

  if v_m.bracket_side = 'pool'
     and (select format from public.brackets where id = v_m.bracket_id) in ('groups_elimination', 'two_pool_round_robin')
     and not exists (select 1 from public.matches where bracket_id = v_m.bracket_id and bracket_side = 'pool' and status in ('scheduled', 'in_progress'))
     and not exists (select 1 from public.matches where bracket_id = v_m.bracket_id and bracket_side <> 'pool') then
    perform public.bracket_finish_groups(v_m.bracket_id);
  end if;
end;
$$;

create or replace function bracket_podium(p_bracket_id uuid)
returns table (place int, athlete uuid)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_format text;
  v_repechage boolean;
  v_final public.matches;
  v_reset public.matches;
  v_last_losers public.matches;
begin
  select format, repechage into v_format, v_repechage from public.brackets where id = p_bracket_id;

  if v_format in ('single_elim_repechage', 'single_elim', 'groups_elimination', 'two_pool_round_robin') then
    select * into v_final from public.matches where bracket_id = p_bracket_id and bracket_side = 'main' order by round desc limit 1;
    if v_final.status = 'completed' then
      place := 1; athlete := v_final.winner_id; return next;
      place := 2; athlete := case when v_final.athlete_a_id = v_final.winner_id then v_final.athlete_b_id else v_final.athlete_a_id end; return next;
    end if;
    place := 3;
    if v_repechage then
      for athlete in
        select m.winner_id from public.matches m
        where m.bracket_id = p_bracket_id and m.bracket_side in ('repechage_top', 'repechage_bottom') and m.status in ('completed', 'bye') and m.winner_id is not null
          and m.round = (select max(x.round) from public.matches x where x.bracket_id = p_bracket_id and x.bracket_side = m.bracket_side)
      loop return next; end loop;
    elsif v_final.round > 1 then
      for athlete in
        select case when m.athlete_a_id = m.winner_id then m.athlete_b_id else m.athlete_a_id end from public.matches m
        where m.bracket_id = p_bracket_id and m.bracket_side = 'main' and m.round = v_final.round - 1 and m.status = 'completed'
      loop return next; end loop;
    end if;

  elsif v_format = 'double_elim' then
    select * into v_final from public.matches where bracket_id = p_bracket_id and bracket_side = 'grand_final';
    select * into v_reset from public.matches where bracket_id = p_bracket_id and bracket_side = 'reset';
    if v_reset.status = 'completed' then
      place := 1; athlete := v_reset.winner_id; return next;
      place := 2; athlete := case when v_reset.athlete_a_id = v_reset.winner_id then v_reset.athlete_b_id else v_reset.athlete_a_id end; return next;
    elsif v_final.status = 'completed' and v_reset.status = 'bye' then
      place := 1; athlete := v_final.winner_id; return next;
      place := 2; athlete := case when v_final.athlete_a_id = v_final.winner_id then v_final.athlete_b_id else v_final.athlete_a_id end; return next;
    end if;
    select * into v_last_losers from public.matches where bracket_id = p_bracket_id and bracket_side = 'losers' order by round desc limit 1;
    if v_last_losers.status = 'completed' then
      place := 3; athlete := case when v_last_losers.athlete_a_id = v_last_losers.winner_id then v_last_losers.athlete_b_id else v_last_losers.athlete_a_id end; return next;
    end if;

  elsif v_format = 'round_robin' then
    if (select count(distinct pool) from public.matches where bracket_id = p_bracket_id) = 1
       and not exists (select 1 from public.matches where bracket_id = p_bracket_id and status not in ('completed', 'bye')) then
      for place, athlete in select s.rank, s.athlete_id from public.pool_standings(p_bracket_id) s where s.rank <= 3 order by s.rank
      loop return next; end loop;
    end if;
  end if;
end;
$$;

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
       and (e.c ->> 'bracket_format') not in ('single_elim_repechage', 'single_elim', 'round_robin', 'double_elim', 'groups_elimination', 'two_pool_round_robin') then
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

revoke all on function bracket_finish_groups(uuid) from public, anon, authenticated;
