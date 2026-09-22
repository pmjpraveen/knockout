begin;
select plan(9);

insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'org@test.dev'),
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sk1@test.dev'),
  ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'out@test.dev');
insert into events (id, organizer_id, name, start_date, end_date, status)
values ('11111111-3333-3333-3333-111111111111', '00000000-0000-0000-0000-00000000000a', 'Export', current_date, current_date, 'registration_closed');
insert into tatamis (id, event_id, name) values ('22222222-3333-3333-3333-222222222231', '11111111-3333-3333-3333-111111111111', 'Tatami 1');
insert into event_members (event_id, user_id, role, tatami_id) values
  ('11111111-3333-3333-3333-111111111111', '00000000-0000-0000-0000-0000000000d1', 'scorekeeper', '22222222-3333-3333-3333-222222222231');
insert into categories (id, event_id, label, discipline, status, bracket_format, tatami_id) values
  ('33333333-9999-9999-9999-333333333391', '11111111-3333-3333-3333-111111111111', 'Kumite', 'kumite', 'closed', 'single_elim_repechage', '22222222-3333-3333-3333-222222222231');

create function pg_temp.fill(p_cat uuid, p_n int, p_prefix text) returns void language plpgsql as $$
declare v_ce uuid; v_ath uuid; i int;
begin
  insert into club_entries (event_id, club_name) values ('11111111-3333-3333-3333-111111111111', p_prefix) returning id into v_ce;
  for i in 1..p_n loop
    insert into athletes (club_entry_id, full_name) values (v_ce, p_prefix || ' ' || i) returning id into v_ath;
    insert into registrations (athlete_id, category_id, seed) values (v_ath, p_cat, case when i = 1 then 1 end);
  end loop;
end $$;
select pg_temp.fill('33333333-9999-9999-9999-333333333391', 3, 'P');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select generate_bracket('33333333-9999-9999-9999-333333333391');
select id as bracket_id into temp bkt from brackets where category_id = '33333333-9999-9999-9999-333333333391';

-- as the scorekeeper: no direct read of athletes, but the RPCs still work and return names
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select is((select count(*)::int from athletes), 0, 'a scorekeeper has no direct read access to athletes');
select is((select count(*)::int from bracket_matches((select bracket_id from bkt))), 3, 'a 3-athlete bracket has 3 matches (round 1 x2, final x1)');
select ok((select bool_and(athlete_a is not null or status = 'bye') from bracket_matches((select bracket_id from bkt))), 'every filled slot has a name, via the security-definer join');
select is((select count(*)::int from category_participants('33333333-9999-9999-9999-333333333391')), 3, 'the scorekeeper can list the category''s participants');
select is((select full_name from category_participants('33333333-9999-9999-9999-333333333391') where seed = 1), 'P 1', 'seed order is included');

-- a non-member is refused
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select throws_ok($$select * from bracket_matches((select bracket_id from bkt))$$, '42501', null, 'a non-member cannot read the bracket');
select throws_ok($$select * from category_participants('33333333-9999-9999-9999-333333333391')$$, '42501', null, 'a non-member cannot list participants');

-- and the organizer still sees everything, byes included
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*)::int from bracket_matches((select bracket_id from bkt)) where status = 'bye'), 1, 'the bye is visible in round 1');
select ok((select athlete_a is not null from bracket_matches((select bracket_id from bkt)) where status = 'bye'), 'the bye names who advanced');

select * from finish();
rollback;
