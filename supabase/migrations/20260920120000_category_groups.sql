-- Groups: one category can be dealt into several groups that run at the same time. Each group is a category of its
-- own (own bracket, own tatami, own podium), so nothing downstream had to change. Groups share a root: the original
-- category, which keeps its id and becomes Group A.

alter table categories
  add column split_root uuid references categories(id) on delete set null,
  add column split_index int;

create index on categories (split_root);

-- Deals a category's athletes into p_groups groups, or back into one group with 1. Calling it again with the same
-- number reshuffles. Club-mates are spread across groups, group sizes differ by at most one, and seeds are cleared
-- because the field has changed. Any bracket already drawn for the groups is thrown away, so this is only allowed
-- before a match has started. p_tatami_ids (optional) puts group i on tatami i, wrapping round.
create function set_category_groups(p_category_id uuid, p_groups int, p_tatami_ids uuid[] default null)
returns uuid[]
language plpgsql security definer set search_path = ''
as $$
declare
  v_root public.categories;
  v_ids uuid[];
  v_target uuid[] := '{}';
  v_base text;
  v_n int;
  v_have int;
  v_new uuid;
  i int;
begin
  select * into v_root from public.categories where id = coalesce(
    (select split_root from public.categories where id = p_category_id), p_category_id);
  if v_root.id is null then raise exception 'Unknown category'; end if;
  if not public.is_event_member(v_root.event_id, array['organizer']) then
    raise exception 'Only the organizer can split a category' using errcode = '42501';
  end if;
  perform public.assert_event_writable(v_root.event_id);

  select coalesce(array_agg(id order by split_index nulls first, created_at), '{}') into v_ids
  from public.categories where id = v_root.id or split_root = v_root.id;
  if exists (select 1 from public.categories c where c.id = any (v_ids) and c.status not in ('closed', 'bracket_generated')) then
    raise exception 'Close registration before splitting a category';
  end if;
  if exists (select 1 from public.matches m join public.brackets b on b.id = m.bracket_id
             where b.category_id = any (v_ids) and m.status in ('in_progress', 'completed')) then
    raise exception 'Matches have started, so the groups are locked';
  end if;
  if p_tatami_ids is not null and (select count(*) from public.tatamis
       where id = any (p_tatami_ids) and event_id = v_root.event_id) <> cardinality(p_tatami_ids) then
    raise exception 'That tatami belongs to a different event';
  end if;

  select count(*) into v_n from public.registrations where category_id = any (v_ids);
  if p_groups < 1 or p_groups > greatest(1, v_n / 2) then
    raise exception 'Choose between 1 and % groups; each needs at least 2 athletes.', greatest(1, v_n / 2);
  end if;

  v_base := regexp_replace(v_root.label, ' · Group [A-Z]$', '');
  v_have := cardinality(v_ids);
  delete from public.brackets where category_id = any (v_ids);

  -- One category per group: reuse the existing ones, add any that are missing.
  for i in 1..p_groups loop
    if i <= v_have then
      v_target := v_target || v_ids[i];
    else
      insert into public.categories
        (event_id, label, discipline, gender, age_min, age_max, weight_min, weight_max, belt_min, belt_max,
         bracket_format, status, scoring_mode, judge_panel, match_seconds, tatami_id, sequence, event_day, split_root)
      select event_id, v_base, discipline, gender, age_min, age_max, weight_min, weight_max, belt_min, belt_max,
             bracket_format, 'closed', scoring_mode, judge_panel, match_seconds, tatami_id, sequence, event_day, v_root.id
      from public.categories where id = v_root.id
      returning id into v_new;
      v_target := v_target || v_new;
    end if;
  end loop;

  -- Deal: clubs in a random order, athletes of a club side by side, then one to each group in turn.
  with regs as (
    select r.id, lower(btrim(ce.club_name)) as club
    from public.registrations r
    join public.athletes a on a.id = r.athlete_id
    join public.club_entries ce on ce.id = a.club_entry_id
    where r.category_id = any (v_ids)
  ),
  clubs as (select club, random() as k from regs group by club),
  dealt as (
    select regs.id, (row_number() over (order by clubs.k, random()) - 1) % p_groups + 1 as g
    from regs join clubs using (club)
  )
  update public.registrations r set category_id = v_target[d.g], seed = null
  from dealt d where r.id = d.id;

  -- Groups that are no longer needed are empty by now.
  if v_have > p_groups then
    delete from public.categories where id = any (v_ids[p_groups + 1:]);
  end if;

  for i in 1..p_groups loop
    update public.categories set
      label = case when p_groups = 1 then v_base else v_base || ' · Group ' || chr(64 + i) end,
      split_index = case when p_groups = 1 then null else i - 1 end,
      split_root = case when i = 1 then null else v_root.id end,
      status = 'closed',
      tatami_id = case when p_tatami_ids is null then tatami_id else p_tatami_ids[(i - 1) % cardinality(p_tatami_ids) + 1] end
    where id = v_target[i];
  end loop;
  return v_target;
end;
$$;

-- Who finished where: 1st, 2nd and 3rd. Single elimination and double elimination give two bronze medals when the
-- bracket has repechage (a shared 3rd place); a round robin lists its top three of a single pool. A place appears
-- once the matches that decide it are done.
create function bracket_podium(p_bracket_id uuid)
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

  if v_format = 'single_elim_repechage' then
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

create function category_podium(p_category_id uuid)
returns table (place int, athlete_id uuid, athlete_name text, club_name text)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_event uuid;
  v_bracket uuid;
begin
  select c.event_id, b.id into v_event, v_bracket
  from public.categories c left join public.brackets b on b.category_id = c.id where c.id = p_category_id;
  if v_event is null or not public.is_event_member(v_event) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
  select p.place, a.id, a.full_name, ce.club_name
  from public.bracket_podium(v_bracket) p
  join public.athletes a on a.id = p.athlete
  join public.club_entries ce on ce.id = a.club_entry_id
  order by p.place, a.full_name;
end;
$$;

revoke all on function set_category_groups(uuid, int, uuid[]), bracket_podium(uuid), category_podium(uuid) from public, anon, authenticated;
grant execute on function set_category_groups(uuid, int, uuid[]), category_podium(uuid) to authenticated;
