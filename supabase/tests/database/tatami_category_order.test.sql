begin;
select plan(8);

insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'org@test.dev'),
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sk1@test.dev');
insert into events (id, organizer_id, name, start_date, end_date, status)
values ('11111111-2222-2222-2222-111111111111', '00000000-0000-0000-0000-00000000000a', 'Order', current_date, current_date, 'registration_closed');
insert into tatamis (id, event_id, name) values ('22222222-2222-2222-2222-222222222231', '11111111-2222-2222-2222-111111111111', 'Tatami 1');
insert into event_members (event_id, user_id, role, tatami_id) values
  ('11111111-2222-2222-2222-111111111111', '00000000-0000-0000-0000-0000000000d1', 'scorekeeper', '22222222-2222-2222-2222-222222222231');
-- both categories share one tatami; A is created first, so it runs first. A has 4 athletes (two rounds), B has 2.
insert into categories (id, event_id, label, discipline, status, bracket_format, tatami_id, created_at) values
  ('33333333-4444-4444-4444-333333333301', '11111111-2222-2222-2222-111111111111', 'Category A', 'kumite', 'closed', 'single_elim_repechage', '22222222-2222-2222-2222-222222222231', now()),
  ('33333333-4444-4444-4444-333333333302', '11111111-2222-2222-2222-111111111111', 'Category B', 'kumite', 'closed', 'single_elim_repechage', '22222222-2222-2222-2222-222222222231', now() + interval '1 second');

create function pg_temp.fill(p_cat uuid, p_n int, p_prefix text) returns void language plpgsql as $$
declare v_ce uuid; v_ath uuid; i int;
begin
  insert into club_entries (event_id, club_name) values ('11111111-2222-2222-2222-111111111111', p_prefix) returning id into v_ce;
  for i in 1..p_n loop
    insert into athletes (club_entry_id, full_name) values (v_ce, p_prefix || ' ' || i) returning id into v_ath;
    insert into registrations (athlete_id, category_id) values (v_ath, p_cat);
  end loop;
end $$;
create function pg_temp.as_user(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.op(p_kind text, p_match uuid, p_extra jsonb default '{}') returns jsonb language sql as $$
  select jsonb_build_object('op_id', gen_random_uuid(), 'kind', p_kind, 'event_id', '11111111-2222-2222-2222-111111111111',
    'match_id', p_match, 'client_timestamp', now()) || p_extra;
$$;
create function pg_temp.status_of(p_result jsonb, p_i int) returns text language sql as $$ select p_result -> p_i ->> 'status'; $$;

select pg_temp.fill('33333333-4444-4444-4444-333333333301', 4, 'A');
select pg_temp.fill('33333333-4444-4444-4444-333333333302', 2, 'B');
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select generate_bracket('33333333-4444-4444-4444-333333333301');
select generate_bracket('33333333-4444-4444-4444-333333333302');
reset role;
update matches m set tatami_id = c.tatami_id from brackets b join categories c on c.id = b.category_id
  where b.id = m.bracket_id and c.event_id = '11111111-2222-2222-2222-111111111111';
select bracket_resequence('22222222-2222-2222-2222-222222222231');

create temp table ids as
select (select m.id from matches m join brackets b on b.id = m.bracket_id where b.category_id = '33333333-4444-4444-4444-333333333301' and m.round = 1 and m.position = 1) as a1,
       (select m.id from matches m join brackets b on b.id = m.bracket_id where b.category_id = '33333333-4444-4444-4444-333333333301' and m.round = 1 and m.position = 2) as a2,
       (select m.id from matches m join brackets b on b.id = m.bracket_id where b.category_id = '33333333-4444-4444-4444-333333333302' and m.round = 1) as b1;
grant select on ids to authenticated;

set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');

select is(pg_temp.status_of(sync_scoring('dev1', jsonb_build_array(pg_temp.op('start', gen_random_uuid()))), 0), 'conflict', 'sanity: an unknown match is a conflict too');
select is(pg_temp.status_of(sync_scoring('dev1', jsonb_build_array(pg_temp.op('start', (select b1 from ids)))), 0), 'conflict',
  'starting the later category is refused while the earlier one is unfinished');
select is((select status from matches where id = (select b1 from ids)), 'scheduled', 'the blocked match stays scheduled');
select is(pg_temp.status_of(sync_scoring('dev1', jsonb_build_array(pg_temp.op('start', (select a1 from ids)))), 0), 'ok',
  'the earlier category can start');

reset role;
select bracket_complete_match((select a1 from ids), (select athlete_a_id from matches where id = (select a1 from ids)));
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');

select is(pg_temp.status_of(sync_scoring('dev1', jsonb_build_array(pg_temp.op('start', (select b1 from ids)))), 0), 'conflict',
  'category A''s second semi-final is still unplayed, so B still waits');

reset role;
select bracket_complete_match((select a2 from ids), (select athlete_a_id from matches where id = (select a2 from ids)));
select bracket_complete_match(
  (select id from matches where bracket_id = (select bracket_id from matches where id = (select a1 from ids)) and round = 2),
  (select athlete_a_id from matches where bracket_id = (select bracket_id from matches where id = (select a1 from ids)) and round = 2)
);
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1');

select is(pg_temp.status_of(sync_scoring('dev1', jsonb_build_array(pg_temp.op('start', (select b1 from ids)))), 0), 'ok',
  'once category A is fully finished, category B may start');
select is((select status from matches where id = (select b1 from ids)), 'in_progress');
reset role;
select is((select count(*)::int from scoring_conflicts where event_id = '11111111-2222-2222-2222-111111111111'), 3, 'each blocked attempt is logged for the tournament director');

select * from finish();
rollback;
