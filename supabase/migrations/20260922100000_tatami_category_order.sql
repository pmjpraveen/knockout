-- A tatami runs one category at a time: a match cannot start while an earlier category assigned to the
-- same tatami still has unfinished matches there. "Earlier" follows the same order the schedule already
-- uses (event day, then running-order sequence, then creation order) — the same key bracket_resequence sorts by.
-- Matches within the category being started, or on a different tatami, are never affected.

create function assert_tatami_category_turn(p_category_id uuid, p_tatami_id uuid) returns void
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_blocking text;
begin
  if p_tatami_id is null then return; end if;

  select other.label into v_blocking
  from public.categories other, public.categories mine
  where mine.id = p_category_id
    and other.tatami_id = p_tatami_id
    and other.id <> mine.id
    and row(coalesce(other.event_day, 'infinity'::date), coalesce(other.sequence, 2147483647), other.created_at)
      < row(coalesce(mine.event_day, 'infinity'::date), coalesce(mine.sequence, 2147483647), mine.created_at)
    and exists (
      select 1 from public.matches m join public.brackets b on b.id = m.bracket_id
      where b.category_id = other.id and m.tatami_id = p_tatami_id and m.status not in ('completed', 'bye')
    )
  limit 1;

  if v_blocking is not null then
    raise exception 'Finish "%" on this tatami before starting the next category.', v_blocking using errcode = 'P0409';
  end if;
end;
$$;

create or replace function scoring_apply_op(p_device text, p_op jsonb) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_kind text := p_op ->> 'kind';
  v_m public.matches;
  v_cat public.categories;
  v_ts timestamptz := coalesce((p_op ->> 'client_timestamp')::timestamptz, now());
  v_mode text;
  v_type text := p_op ->> 'type';
  v_val numeric := (p_op ->> 'value')::numeric;
  v_athlete uuid := (p_op ->> 'athlete_id')::uuid;
  v_detail jsonb := p_op -> 'detail';
  v_voids uuid := (p_op ->> 'voids')::uuid;
  v_id uuid := (p_op ->> 'id')::uuid;
  v_winner uuid := (p_op ->> 'winner_id')::uuid;
  v_method text := p_op ->> 'method';
begin
  select m.* into v_m from public.matches m where m.id = (p_op ->> 'match_id')::uuid for update;
  if not found then perform public.scoring_conflict('match_not_found'); end if;
  select c.* into v_cat from public.brackets b join public.categories c on c.id = b.category_id where b.id = v_m.bracket_id;
  if not public.can_score_match(v_m.id) then perform public.scoring_conflict('not_authorized'); end if;
  if exists (select 1 from public.events where id = v_cat.event_id and status = 'completed') then
    perform public.scoring_conflict('event_archived');
  end if;
  v_mode := public.scoring_effective_mode(v_cat);

  if v_kind = 'start' then
    if v_m.status = 'completed' then perform public.scoring_conflict('match_finalized'); end if;
    if v_m.status = 'in_progress' then
      if v_m.scoring_device_id = p_device then return 'duplicate'; end if;
      if v_m.scoring_device_id is not null then perform public.scoring_conflict('device_mismatch'); end if;
    elsif v_m.status <> 'scheduled' or v_m.athlete_a_id is null or v_m.athlete_b_id is null then
      perform public.scoring_conflict('not_ready');
    else
      perform public.assert_tatami_category_turn(v_cat.id, v_m.tatami_id);
    end if;
    update public.matches set status = 'in_progress', scoring_device_id = p_device, started_at = coalesce(started_at, v_ts)
    where id = v_m.id;
    update public.brackets set status = 'in_progress' where id = v_m.bracket_id and status = 'draft';
    update public.categories set status = 'in_progress' where id = v_cat.id and status = 'bracket_generated';
    update public.events set status = 'in_progress' where id = v_cat.event_id and status = 'registration_closed';
    return 'ok';

  elsif v_kind = 'event' then
    if exists (select 1 from public.score_events where id = v_id) then return 'duplicate'; end if;
    if v_m.status = 'completed' then perform public.scoring_conflict('match_finalized'); end if;
    if v_m.status <> 'in_progress' then perform public.scoring_conflict('not_started'); end if;
    if v_m.scoring_device_id is distinct from p_device then perform public.scoring_conflict('device_mismatch'); end if;

    if v_type in ('ippon', 'waza_ari', 'yuko', 'penalty', 'kata_score', 'win_loss')
       and v_athlete is distinct from v_m.athlete_a_id and v_athlete is distinct from v_m.athlete_b_id then
      perform public.scoring_conflict('invalid_athlete');
    end if;
    if v_type = 'ippon' and v_val is distinct from 3 or v_type = 'waza_ari' and v_val is distinct from 2
       or v_type = 'yuko' and v_val is distinct from 1 then
      perform public.scoring_conflict('invalid_value');
    end if;
    if v_type = 'penalty' and coalesce(v_detail ->> 'category', '') not in ('1', '2') then
      perform public.scoring_conflict('invalid_penalty');
    end if;
    if v_type = 'kata_score' then
      if coalesce((v_detail ->> 'judge')::int, 0) not between 1 and v_cat.judge_panel then perform public.scoring_conflict('invalid_judge'); end if;
      if v_mode = 'kata_flags' then
        if v_val is distinct from 1 then perform public.scoring_conflict('invalid_value'); end if;
      elsif v_val is null or v_val < 5 or v_val > 10 or v_val * 10 <> round(v_val * 10) then
        perform public.scoring_conflict('invalid_value');
      end if;
    end if;
    if v_type = 'void' and not exists (
      select 1 from public.score_events where id = v_voids and match_id = v_m.id and type <> 'void') then
      perform public.scoring_conflict('unknown_event');
    end if;
    if v_type = 'clock' and (coalesce(v_detail ->> 'action', '') not in ('start', 'pause', 'resume', 'expire') or coalesce(v_val, -1) < 0) then
      perform public.scoring_conflict('invalid_clock');
    end if;
    if v_type not in ('ippon', 'waza_ari', 'yuko', 'penalty', 'kata_score', 'win_loss', 'void', 'clock') or v_type is null then
      perform public.scoring_conflict('invalid_type');
    end if;

    insert into public.score_events (id, match_id, athlete_id, type, value, device_id, client_timestamp, actor_id, voids, detail)
    values (v_id, v_m.id, v_athlete, v_type, v_val, p_device, v_ts, auth.uid(), v_voids, v_detail);
    return 'ok';

  elsif v_kind = 'finalize' then
    if v_m.status = 'completed' then
      if v_m.winner_id = v_winner then return 'duplicate'; end if;
      perform public.scoring_conflict('match_finalized');
    end if;
    if v_m.status <> 'in_progress' then perform public.scoring_conflict('not_started'); end if;
    if v_m.scoring_device_id is distinct from p_device then perform public.scoring_conflict('device_mismatch'); end if;
    if v_method not in ('points', 'lead', 'decision', 'disqualification', 'withdrawal', 'judges', 'flags', 'win_loss') then
      perform public.scoring_conflict('invalid_method');
    end if;
    if v_winner is distinct from v_m.athlete_a_id and v_winner is distinct from v_m.athlete_b_id then
      perform public.scoring_conflict('invalid_winner');
    end if;
    perform public.scoring_finalize(v_m.id, v_winner, v_method, p_op ->> 'note', v_ts);
    return 'ok';
  end if;

  perform public.scoring_conflict('unknown_operation');
  return null;
end;
$$;

revoke all on function assert_tatami_category_turn(uuid, uuid) from public, anon, authenticated;
