-- PRD 5: scoring, results, audit, and the server half of offline sync.
--
-- Devices never write score_events or matches directly. They queue operations locally and
-- send them in batches to sync_scoring(), which applies each one independently and in order.
-- The tatami's scoreboard device is the sole authority for its matches (matches.scoring_device_id);
-- an operation that cannot be applied (bracket redrawn, match already finalized, another device
-- holding the match, ...) becomes a scoring_conflict for the Tournament Director instead of
-- being guessed at.

alter table categories
  add column scoring_mode text check (scoring_mode in ('kumite_points', 'kata_scores', 'kata_flags', 'win_loss')),
  add column match_seconds int check (match_seconds > 0),
  add column judge_panel int not null default 5 check (judge_panel in (3, 5, 7));

-- Undo is a 'void' event pointing at the event it cancels; clock changes are logged too.
alter table score_events drop constraint score_events_type_check;
alter table score_events add constraint score_events_type_check
  check (type in ('ippon', 'waza_ari', 'yuko', 'penalty', 'kata_score', 'win_loss', 'void', 'clock'));
alter table score_events
  alter column athlete_id drop not null,
  add column actor_id uuid references auth.users(id) on delete set null,
  add column voids uuid references score_events(id),
  add column detail jsonb;

alter table matches
  add column scoring_device_id text,
  add column started_at timestamptz,
  add column result_method text
    check (result_method in ('points', 'lead', 'decision', 'disqualification', 'withdrawal', 'judges', 'flags', 'win_loss', 'override')),
  add column result_note text,
  add column finalized_by uuid references auth.users(id) on delete set null,
  add column finalized_at timestamptz;

create table scoring_conflicts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  match_id uuid, -- no foreign key: the match may be gone (bracket redrawn)
  device_id text not null,
  actor_id uuid references auth.users(id) on delete set null,
  reason text not null,
  op jsonb not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  resolution text
);
create index on scoring_conflicts (event_id, resolved_at);
alter table scoring_conflicts enable row level security;
create policy scoring_conflicts_select on scoring_conflicts for select to authenticated
  using (is_event_member(event_id, array['organizer', 'tournament_director']));

-- All result and score writes go through the functions below.
drop policy score_events_insert on score_events;
drop policy matches_update on matches;

create function scoring_effective_mode(p_category public.categories) returns text
language sql immutable set search_path = ''
as $$
  select coalesce(p_category.scoring_mode,
    case p_category.discipline when 'kumite' then 'kumite_points' when 'kata' then 'kata_scores' else 'win_loss' end);
$$;

-- What a scorekeeper's device downloads: the tatami's playable matches with scoring settings.
create function tatami_scoreboard(p_tatami_id uuid)
returns table (
  match_id uuid, queue_position int, bracket_side text, round int, match_status text,
  category_id uuid, category_label text, discipline text, scoring_mode text, match_seconds int, judge_panel int,
  athlete_a_id uuid, athlete_a text, athlete_b_id uuid, athlete_b text,
  scoring_device_id text, tatami_name text, tatami_status text
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_event uuid;
begin
  select event_id into v_event from public.tatamis where id = p_tatami_id;
  if v_event is null or not exists (
    select 1 from public.event_members em
    where em.event_id = v_event and em.user_id = auth.uid()
      and (em.role in ('organizer', 'tournament_director') or (em.role = 'scorekeeper' and em.tatami_id = p_tatami_id))
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  return query
  select m.id, (row_number() over (order by (m.status = 'in_progress') desc, m.queue_order))::int,
         m.bracket_side, m.round, m.status, c.id, c.label, c.discipline,
         public.scoring_effective_mode(c),
         coalesce(c.match_seconds,
           (case c.discipline when 'kumite' then e.kumite_minutes when 'kata' then e.kata_minutes else e.team_minutes end * 60)::int),
         c.judge_panel,
         m.athlete_a_id, na.full_name, m.athlete_b_id, nb.full_name,
         m.scoring_device_id, t.name, t.status
  from public.matches m
  join public.brackets b on b.id = m.bracket_id
  join public.categories c on c.id = b.category_id
  join public.events e on e.id = c.event_id
  join public.tatamis t on t.id = m.tatami_id
  join public.athletes na on na.id = m.athlete_a_id
  join public.athletes nb on nb.id = m.athlete_b_id
  where m.tatami_id = p_tatami_id and m.status in ('scheduled', 'in_progress')
  order by 2
  limit 12;
end;
$$;

create function scoring_conflict(p_reason text) returns void
language plpgsql set search_path = ''
as $$
begin
  raise exception '%', p_reason using errcode = 'P0409';
end;
$$;

-- Applies one queued operation. Raises P0409 (or any error) when it cannot be applied.
create function scoring_apply_op(p_device text, p_op jsonb) returns text
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

-- Records the result, advances the bracket, and closes out the bracket/category on the last match.
create function scoring_finalize(p_match_id uuid, p_winner uuid, p_method text, p_note text, p_at timestamptz) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_bracket uuid;
  v_category uuid;
begin
  update public.matches
  set result_method = p_method, result_note = left(nullif(btrim(coalesce(p_note, '')), ''), 500),
      finalized_by = auth.uid(), finalized_at = p_at
  where id = p_match_id
  returning bracket_id into v_bracket;

  perform public.bracket_complete_match(p_match_id, p_winner);

  if not exists (select 1 from public.matches where bracket_id = v_bracket and status in ('scheduled', 'in_progress')) then
    update public.brackets set status = 'completed' where id = v_bracket returning category_id into v_category;
    update public.categories set status = 'completed' where id = v_category;
  end if;
end;
$$;

-- Batch entry point for device sync. Each operation is applied in its own subtransaction, so
-- one failure never blocks the rest. Failures are recorded as conflicts for the Tournament Director.
create function sync_scoring(p_device_id text, p_ops jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_op jsonb;
  v_results jsonb := '[]';
  v_status text;
  v_reason text;
  v_event uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  if coalesce(p_device_id, '') = '' or jsonb_typeof(p_ops) <> 'array' then raise exception 'Bad batch'; end if;

  for v_op in select * from jsonb_array_elements(p_ops) loop
    begin
      v_status := public.scoring_apply_op(p_device_id, v_op);
      v_reason := null;
    exception when others then
      v_status := 'conflict';
      v_reason := sqlerrm;
      v_event := nullif(v_op ->> 'event_id', '')::uuid;
      if v_event is not null and public.is_event_member(v_event) then
        insert into public.scoring_conflicts (event_id, match_id, device_id, actor_id, reason, op)
        values (v_event, nullif(v_op ->> 'match_id', '')::uuid, p_device_id, auth.uid(), v_reason, v_op);
      end if;
    end;
    v_results := v_results || jsonb_build_object('op_id', v_op ->> 'op_id', 'status', v_status, 'reason', v_reason);
  end loop;
  return v_results;
end;
$$;

-- Tournament Director / Organizer finishes a match by hand (dead device, conflict, no-show).
create function override_match_result(p_match_id uuid, p_winner_id uuid, p_note text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_m public.matches;
  v_event uuid;
begin
  select m.* into v_m from public.matches m where m.id = p_match_id for update;
  select c.event_id into v_event from public.brackets b join public.categories c on c.id = b.category_id where b.id = v_m.bracket_id;
  if v_event is null or not public.is_event_member(v_event, array['organizer', 'tournament_director']) then
    raise exception 'Only the organizer or a tournament director can override a result' using errcode = '42501';
  end if;
  perform public.assert_event_writable(v_event);
  if btrim(coalesce(p_note, '')) = '' then raise exception 'A note is required for a result override'; end if;
  if v_m.status not in ('scheduled', 'in_progress') then
    raise exception 'Only a match that has not been finalized can be overridden';
  end if;
  if v_m.athlete_a_id is null or v_m.athlete_b_id is null or p_winner_id not in (v_m.athlete_a_id, v_m.athlete_b_id) then
    raise exception 'The winner must be one of the match''s athletes';
  end if;

  perform public.scoring_finalize(p_match_id, p_winner_id, 'override', p_note, now());
  insert into public.audit_log (event_id, actor_id, action, subject_id, reason, changes)
  values (v_event, auth.uid(), 'override_result', p_match_id, btrim(p_note), jsonb_build_object('winner_id', p_winner_id));
end;
$$;

-- Frees a match from a dead scoreboard device so another device can take it over.
create function release_match_claim(p_match_id uuid, p_note text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_event uuid;
begin
  select c.event_id into v_event
  from public.matches m join public.brackets b on b.id = m.bracket_id join public.categories c on c.id = b.category_id
  where m.id = p_match_id;
  if v_event is null or not public.is_event_member(v_event, array['organizer', 'tournament_director']) then
    raise exception 'Only the organizer or a tournament director can release a scoreboard' using errcode = '42501';
  end if;
  perform public.assert_event_writable(v_event);
  if btrim(coalesce(p_note, '')) = '' then raise exception 'A note is required'; end if;
  update public.matches set scoring_device_id = null where id = p_match_id and status = 'in_progress';
  insert into public.audit_log (event_id, actor_id, action, subject_id, reason, changes)
  values (v_event, auth.uid(), 'release_scoreboard', p_match_id, btrim(p_note), '{}');
end;
$$;

create function resolve_scoring_conflict(p_conflict_id uuid, p_note text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_event uuid;
begin
  select event_id into v_event from public.scoring_conflicts where id = p_conflict_id;
  if v_event is null or not public.is_event_member(v_event, array['organizer', 'tournament_director']) then
    raise exception 'Only the organizer or a tournament director can resolve conflicts' using errcode = '42501';
  end if;
  if btrim(coalesce(p_note, '')) = '' then raise exception 'Say how this was resolved'; end if;
  update public.scoring_conflicts set resolved_at = now(), resolved_by = auth.uid(), resolution = btrim(p_note)
  where id = p_conflict_id and resolved_at is null;
end;
$$;

-- Full trail for one match: the result, and every logged event with who entered it and when.
create function match_audit(p_match_id uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_m public.matches;
  v_event uuid;
begin
  select m.* into v_m from public.matches m where m.id = p_match_id;
  select c.event_id into v_event from public.brackets b join public.categories c on c.id = b.category_id where b.id = v_m.bracket_id;
  if v_event is null or not public.is_event_member(v_event, array['organizer', 'tournament_director']) then
    raise exception 'Only the organizer or a tournament director can view the audit trail' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'match', jsonb_build_object(
      'status', v_m.status,
      'started_at', v_m.started_at,
      'finalized_at', v_m.finalized_at,
      'result_method', v_m.result_method,
      'result_note', v_m.result_note,
      'scoring_device_id', v_m.scoring_device_id,
      'winner', (select full_name from public.athletes where id = v_m.winner_id),
      'finalized_by', (select email from auth.users where id = v_m.finalized_by),
      'athlete_a', (select full_name from public.athletes where id = v_m.athlete_a_id),
      'athlete_b', (select full_name from public.athletes where id = v_m.athlete_b_id)
    ),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'sequence', se.server_sequence, 'type', se.type, 'value', se.value, 'detail', se.detail,
        'athlete', a.full_name, 'actor', u.email, 'device_id', se.device_id,
        'client_timestamp', se.client_timestamp, 'voids', se.voids) order by se.server_sequence)
      from public.score_events se
      left join public.athletes a on a.id = se.athlete_id
      left join auth.users u on u.id = se.actor_id
      where se.match_id = p_match_id), '[]')
  );
end;
$$;

revoke all on function
  scoring_effective_mode(public.categories), tatami_scoreboard(uuid), scoring_conflict(text), scoring_apply_op(text, jsonb),
  scoring_finalize(uuid, uuid, text, text, timestamptz), sync_scoring(text, jsonb), override_match_result(uuid, uuid, text),
  release_match_claim(uuid, text), resolve_scoring_conflict(uuid, text), match_audit(uuid)
from public, anon, authenticated;

grant execute on function
  tatami_scoreboard(uuid), sync_scoring(text, jsonb), override_match_result(uuid, uuid, text),
  release_match_claim(uuid, text), resolve_scoring_conflict(uuid, text), match_audit(uuid)
to authenticated;
