begin;
select plan(38);

insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'org@test.dev'),
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'td@test.dev'),
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sk1@test.dev'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sk2@test.dev');
insert into events (id, organizer_id, name, start_date, end_date, status)
values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000a', 'Score', current_date, current_date, 'registration_closed');
insert into tatamis (id, event_id, name) values
  ('22222222-2222-2222-2222-222222222221', '11111111-1111-1111-1111-111111111111', 'Tatami 1'),
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Tatami 2');
insert into event_members (event_id, user_id, role, tatami_id) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000c', 'tournament_director', null),
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-0000000000d1', 'scorekeeper', '22222222-2222-2222-2222-222222222221'),
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-0000000000d2', 'scorekeeper', '22222222-2222-2222-2222-222222222222');
insert into categories (id, event_id, label, discipline, status, bracket_format, tatami_id) values
  ('33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111111', 'Kumite', 'kumite', 'closed', 'single_elim_repechage', '22222222-2222-2222-2222-222222222221'),
  ('33333333-3333-3333-3333-333333333302', '11111111-1111-1111-1111-111111111111', 'Kata', 'kata', 'closed', 'single_elim_repechage', '22222222-2222-2222-2222-222222222222');

create function pg_temp.fill(p_cat uuid, p_n int, p_prefix text) returns void language plpgsql as $$
declare v_ce uuid; v_ath uuid; i int;
begin
  insert into club_entries (event_id, club_name) values ('11111111-1111-1111-1111-111111111111', p_prefix) returning id into v_ce;
  for i in 1..p_n loop
    insert into athletes (club_entry_id, full_name) values (v_ce, p_prefix || ' ' || i) returning id into v_ath;
    insert into registrations (athlete_id, category_id) values (v_ath, p_cat);
  end loop;
end $$;
create function pg_temp.as_user(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;
-- one queued operation
create function pg_temp.op(p_kind text, p_match uuid, p_extra jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object('op_id', gen_random_uuid(), 'kind', p_kind, 'event_id', '11111111-1111-1111-1111-111111111111',
    'match_id', p_match, 'client_timestamp', now()) || p_extra;
$$;
create function pg_temp.status_of(p_result jsonb, p_i int) returns text language sql as $$ select p_result -> p_i ->> 'status'; $$;

select pg_temp.fill('33333333-3333-3333-3333-333333333301', 4, 'K');
select pg_temp.fill('33333333-3333-3333-3333-333333333302', 2, 'T');
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select generate_bracket('33333333-3333-3333-3333-333333333301');
select generate_bracket('33333333-3333-3333-3333-333333333302');
reset role;
update categories set tatami_id = '22222222-2222-2222-2222-222222222221' where id = '33333333-3333-3333-3333-333333333301';
update categories set tatami_id = '22222222-2222-2222-2222-222222222222' where id = '33333333-3333-3333-3333-333333333302';
update matches m set tatami_id = c.tatami_id from brackets b join categories c on c.id = b.category_id where b.id = m.bracket_id;
select bracket_resequence('22222222-2222-2222-2222-222222222221');
select bracket_resequence('22222222-2222-2222-2222-222222222222');

create temp table ids as
select (select m.id from matches m join brackets b on b.id = m.bracket_id where b.category_id = '33333333-3333-3333-3333-333333333301' and m.round = 1 and m.position = 1) as m1,
       (select m.id from matches m join brackets b on b.id = m.bracket_id where b.category_id = '33333333-3333-3333-3333-333333333301' and m.round = 1 and m.position = 2) as m2,
       (select m.id from matches m join brackets b on b.id = m.bracket_id where b.category_id = '33333333-3333-3333-3333-333333333301' and m.round = 2) as fin,
       (select m.id from matches m join brackets b on b.id = m.bracket_id where b.category_id = '33333333-3333-3333-3333-333333333302' and m.round = 1) as kata;
grant select on ids to authenticated;
create temp table a1 as select athlete_a_id as a, athlete_b_id as b from matches where id = (select m1 from ids);
grant select on a1 to authenticated;

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');

-- the device's download
select is((select count(*)::int from tatami_scoreboard('22222222-2222-2222-2222-222222222221')), 2, 'a scorekeeper downloads their tatami''s playable matches');
select is((select scoring_mode from tatami_scoreboard('22222222-2222-2222-2222-222222222221') limit 1), 'kumite_points', 'kumite categories default to point scoring');
select is((select match_seconds from tatami_scoreboard('22222222-2222-2222-2222-222222222221') limit 1), 120, 'the clock defaults to the kumite duration');
select isnt((select club_a from tatami_scoreboard('22222222-2222-2222-2222-222222222221') limit 1), null, 'the scoreboard names each competitor''s club');
select throws_ok($$select tatami_scoreboard('22222222-2222-2222-2222-222222222222')$$, '42501', null, 'a scorekeeper cannot download another tatami');

-- start + score + undo, one batch, device A
create temp table r1 as select sync_scoring('devA', jsonb_build_array(
  pg_temp.op('start', (select m1 from ids)),
  pg_temp.op('event', (select m1 from ids), jsonb_build_object('id', '90000000-0000-0000-0000-000000000001', 'type', 'ippon', 'value', 3, 'athlete_id', (select a from a1))),
  pg_temp.op('event', (select m1 from ids), jsonb_build_object('id', '90000000-0000-0000-0000-000000000002', 'type', 'yuko', 'value', 1, 'athlete_id', (select b from a1))),
  pg_temp.op('event', (select m1 from ids), jsonb_build_object('id', '90000000-0000-0000-0000-000000000003', 'type', 'void', 'voids', '90000000-0000-0000-0000-000000000002')),
  pg_temp.op('event', (select m1 from ids), jsonb_build_object('id', '90000000-0000-0000-0000-000000000004', 'type', 'penalty', 'value', 0, 'athlete_id', (select b from a1), 'detail', '{"category":1}'::jsonb)),
  pg_temp.op('event', (select m1 from ids), jsonb_build_object('id', '90000000-0000-0000-0000-000000000005', 'type', 'clock', 'value', 100, 'detail', '{"action":"pause"}'::jsonb))
)) as res;
grant select on r1 to authenticated;
select is((select array_agg(x ->> 'status') from jsonb_array_elements((select res from r1)) x), array['ok','ok','ok','ok','ok','ok'], 'a batch of start, scores, undo, penalty and clock all apply');
select is((select status from matches where id = (select m1 from ids)), 'in_progress', 'starting the match puts it in progress');
select is((select scoring_device_id from matches where id = (select m1 from ids)), 'devA', 'the starting device becomes the match''s scoring authority');
select is((select count(*)::int from score_events where match_id = (select m1 from ids) and actor_id = '00000000-0000-0000-0000-0000000000d1'), 5, 'every event records who entered it');
select is((select status from categories where id = '33333333-3333-3333-3333-333333333301'), 'in_progress', 'the category moves to in progress');
select is((select status from events where id = '11111111-1111-1111-1111-111111111111'), 'in_progress', 'the event moves to in progress');

-- replay is idempotent
select is((select array_agg(x ->> 'status') from jsonb_array_elements(sync_scoring('devA', jsonb_build_array(
  pg_temp.op('start', (select m1 from ids)),
  pg_temp.op('event', (select m1 from ids), jsonb_build_object('id', '90000000-0000-0000-0000-000000000001', 'type', 'ippon', 'value', 3, 'athlete_id', (select a from a1)))))) x),
  array['duplicate','duplicate'], 'replaying a batch is harmless');
select is((select count(*)::int from score_events where match_id = (select m1 from ids)), 5, 'and adds nothing');

-- bad operations become conflicts, without blocking the rest
create temp table r2 as select sync_scoring('devA', jsonb_build_array(
  pg_temp.op('event', (select m1 from ids), jsonb_build_object('id', '90000000-0000-0000-0000-000000000010', 'type', 'ippon', 'value', 5, 'athlete_id', (select a from a1))),
  pg_temp.op('event', (select m1 from ids), jsonb_build_object('id', '90000000-0000-0000-0000-000000000011', 'type', 'void', 'voids', '90000000-0000-0000-0000-0000000000ff')),
  pg_temp.op('event', (select m1 from ids), jsonb_build_object('id', '90000000-0000-0000-0000-000000000012', 'type', 'waza_ari', 'value', 2, 'athlete_id', (select a from a1))),
  pg_temp.op('event', '00000000-0000-0000-0000-00000000dead', jsonb_build_object('id', '90000000-0000-0000-0000-000000000013', 'type', 'yuko', 'value', 1))
)) as res;
grant select on r2 to authenticated;
select is((select array_agg(x ->> 'status') from jsonb_array_elements((select res from r2)) x), array['conflict','conflict','ok','conflict'], 'invalid operations conflict while valid ones still apply');
reset role;
select is((select array_agg(reason order by reason) from scoring_conflicts where event_id = '11111111-1111-1111-1111-111111111111'), array['invalid_value','match_not_found','unknown_event'], 'each failure is recorded for the tournament director with its reason');
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');

-- another device cannot write to a match this device holds
select is((sync_scoring('devB', jsonb_build_array(pg_temp.op('event', (select m1 from ids), jsonb_build_object('id', '90000000-0000-0000-0000-000000000020', 'type', 'yuko', 'value', 1, 'athlete_id', (select a from a1))))) -> 0 ->> 'reason'),
  'device_mismatch', 'a second device is refused: one authority per tatami');

-- a scorekeeper on another tatami is refused
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d2');
select is((sync_scoring('devC', jsonb_build_array(pg_temp.op('start', (select m2 from ids)))) -> 0 ->> 'reason'), 'not_authorized', 'a scorekeeper cannot score another tatami''s match');

-- direct writes are closed
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
select throws_ok($$insert into score_events (match_id, athlete_id, type, value, device_id, client_timestamp) values ((select m1 from ids), (select a from a1), 'ippon', 3, 'x', now())$$,
  '42501', null, 'devices cannot insert score events directly');
with u as (update matches set winner_id = (select a from a1) where id = (select m1 from ids) returning 1) select is((select count(*)::int from u), 0, 'devices cannot edit matches directly');

-- finalize: winner advances the bracket
select is((sync_scoring('devA', jsonb_build_array(pg_temp.op('finalize', (select m1 from ids), jsonb_build_object('winner_id', (select a from a1), 'method', 'points', 'note', 'on points')))) -> 0 ->> 'status'),
  'ok', 'the device finalizes the match');
reset role;
select is((select status || '/' || result_method from matches where id = (select m1 from ids)), 'completed/points', 'the match is completed with its method');
select is((select athlete_a_id from matches where id = (select fin from ids)), (select a from a1), 'the winner advances to the final');
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
select is((sync_scoring('devA', jsonb_build_array(pg_temp.op('event', (select m1 from ids), jsonb_build_object('id', '90000000-0000-0000-0000-000000000030', 'type', 'yuko', 'value', 1, 'athlete_id', (select a from a1))))) -> 0 ->> 'reason'),
  'match_finalized', 'scores after the result are conflicts');

-- overrides (tournament director)
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select throws_ok($$select override_match_result((select m2 from ids), (select athlete_a_id from matches where id = (select m2 from ids)), ' ')$$, 'P0001', null, 'an override needs a note');
select lives_ok($$select override_match_result((select m2 from ids), (select athlete_a_id from matches where id = (select m2 from ids)), 'No-show')$$, 'a tournament director finishes a match by hand');
select throws_ok($$select override_match_result((select m2 from ids), (select athlete_a_id from matches where id = (select m2 from ids)), 'again')$$, 'P0001', null, 'a finalized match cannot be overridden');
reset role;
select is((select count(*)::int from audit_log where action = 'override_result'), 1, 'the override is audit-logged');
select is((select status from matches where id = (select fin from ids)), 'scheduled', 'the override advanced the bracket, so the final is ready');
set local role authenticated;

-- taking over a dead scoreboard
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
select sync_scoring('devA', jsonb_build_array(pg_temp.op('start', (select fin from ids))));
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select lives_ok($$select release_match_claim((select fin from ids), 'Tablet died')$$, 'a tournament director releases a dead scoreboard');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
select is((sync_scoring('devB', jsonb_build_array(pg_temp.op('start', (select fin from ids)))) -> 0 ->> 'status'), 'ok', 'a replacement device can then take the match');
select is((sync_scoring('devA', jsonb_build_array(pg_temp.op('event', (select fin from ids), jsonb_build_object('id', '90000000-0000-0000-0000-000000000040', 'type', 'yuko', 'value', 1, 'athlete_id', (select athlete_a_id from matches where id = (select fin from ids)))))) -> 0 ->> 'reason'),
  'device_mismatch', 'the old device is now refused');
select sync_scoring('devB', jsonb_build_array(pg_temp.op('finalize', (select fin from ids), jsonb_build_object('winner_id', (select athlete_a_id from matches where id = (select fin from ids)), 'method', 'decision'))));
reset role;
select is((select b.status from brackets b join categories c on c.id = b.category_id where c.id = '33333333-3333-3333-3333-333333333301' limit 1), 'completed', 'the last result completes the bracket');

-- audit
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select is((select jsonb_array_length(match_audit((select m1 from ids)) -> 'events')), 6, 'the audit trail lists every logged event');
select is((select match_audit((select m1 from ids)) -> 'match' ->> 'finalized_by'), 'sk1@test.dev', 'and who finalized the result');
select is((select match_audit((select m1 from ids)) -> 'events' -> 0 ->> 'actor'), 'sk1@test.dev', 'each event shows who entered it');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');
select throws_ok($$select match_audit((select m1 from ids))$$, '42501', null, 'a scorekeeper cannot read the audit trail');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select lives_ok($$select resolve_scoring_conflict((select id from scoring_conflicts where event_id = '11111111-1111-1111-1111-111111111111' limit 1), 'Reviewed with the scorekeeper')$$, 'a conflict is resolved with a note');

-- kata validation
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d2');
create temp table r3 as select sync_scoring('devK', jsonb_build_array(
  pg_temp.op('start', (select kata from ids)),
  pg_temp.op('event', (select kata from ids), jsonb_build_object('id', '90000000-0000-0000-0000-000000000050', 'type', 'kata_score', 'value', 7.3, 'athlete_id', (select athlete_a_id from matches where id = (select kata from ids)), 'detail', '{"judge":1}'::jsonb)),
  pg_temp.op('event', (select kata from ids), jsonb_build_object('id', '90000000-0000-0000-0000-000000000051', 'type', 'kata_score', 'value', 7.35, 'athlete_id', (select athlete_a_id from matches where id = (select kata from ids)), 'detail', '{"judge":2}'::jsonb)),
  pg_temp.op('event', (select kata from ids), jsonb_build_object('id', '90000000-0000-0000-0000-000000000052', 'type', 'kata_score', 'value', 4.5, 'athlete_id', (select athlete_a_id from matches where id = (select kata from ids)), 'detail', '{"judge":3}'::jsonb)),
  pg_temp.op('event', (select kata from ids), jsonb_build_object('id', '90000000-0000-0000-0000-000000000053', 'type', 'kata_score', 'value', 8.0, 'athlete_id', (select athlete_a_id from matches where id = (select kata from ids)), 'detail', '{"judge":9}'::jsonb))
)) as res;
select is((select array_agg(x ->> 'status') from jsonb_array_elements((select res from r3)) x), array['ok','ok','conflict','conflict','conflict'], 'kata scores must be 5.0-10.0 in 0.1 steps from a judge on the panel');

select * from finish();
rollback;
