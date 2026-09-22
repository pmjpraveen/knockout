-- A fourth bracket format: single elimination with no repechage bouts. The main bracket runs exactly like
-- single_elim_repechage, just without the repechage matches; both semi-final losers share 3rd by default,
-- matching what single_elim_repechage already falls back to when a category is too small for repechage.

alter table categories drop constraint categories_bracket_format_check;
alter table categories add constraint categories_bracket_format_check
  check (bracket_format in ('single_elim_repechage', 'single_elim', 'round_robin', 'double_elim'));

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
  if v_format not in ('single_elim_repechage', 'single_elim', 'round_robin', 'double_elim') then
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

  if v_format in ('single_elim_repechage', 'single_elim') then
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
       and (e.c ->> 'bracket_format') not in ('single_elim_repechage', 'single_elim', 'round_robin', 'double_elim') then
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
