begin;
select plan(17);

insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'belts-org@test.dev'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'belts-other@test.dev');
update profiles set account_type = 'organizer' where user_id = '00000000-0000-0000-0000-0000000000a2';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
insert into events (id, organizer_id, name, start_date, end_date)
values ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a2', 'Belts', current_date + 30, current_date + 31);

-- the belt list
select lives_ok($$select set_event_belts('bbbbbbbb-0000-0000-0000-000000000002', array[' Kyu 3 ', 'Kyu 2', 'kyu 1', 'Dan 1'])$$, 'the organizer sets the event''s belts');
select is((select belts from events where id = 'bbbbbbbb-0000-0000-0000-000000000002'), array['kyu 3', 'kyu 2', 'kyu 1', 'dan 1'], 'they are stored trimmed, lowercase and in order');
select is(belt_rank('bbbbbbbb-0000-0000-0000-000000000002', 'KYU 1'), 3, 'a belt''s position comes from the event''s own list');
select is(belt_rank('bbbbbbbb-0000-0000-0000-000000000002', 'white'), null, 'a belt outside the list has no position');
select throws_ok($$select set_event_belts('bbbbbbbb-0000-0000-0000-000000000002', array['a', 'A'])$$, 'P0001', 'Each belt can only appear once.', 'a belt cannot be listed twice');

insert into categories (event_id, label, discipline, belt_min, belt_max) values
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Kumite kyu', 'kumite', 'kyu 3', 'kyu 1'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Kata dan', 'kata', 'dan 1', null),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Team open', 'team', null, null);
select throws_ok($$select set_event_belts('bbbbbbbb-0000-0000-0000-000000000002', array['kyu 3', 'kyu 2', 'dan 1'])$$,
  'P0001', 'The belt "kyu 1" is still used by a category or participant, so it cannot be removed.', 'a belt a category uses cannot be removed');

-- what the participant entered decides which categories are suggested
select is((select array_agg(discipline order by discipline) from suggest_categories('bbbbbbbb-0000-0000-0000-000000000002', '2000-01-01', 'male', 60, 'kyu 2')),
  array['kumite', 'team'], 'both events: kumite and team categories that fit the belt');
select is((select array_agg(discipline order by discipline) from suggest_categories('bbbbbbbb-0000-0000-0000-000000000002', '2000-01-01', 'male', 60, 'kyu 2', array['kata'])),
  array['team'], 'kata only: no kumite category is suggested');
select is((select array_agg(discipline order by discipline) from suggest_categories('bbbbbbbb-0000-0000-0000-000000000002', '2000-01-01', 'male', 60, 'dan 1', array['kata'])),
  array['kata', 'team'], 'a dan belt kata only: the kata category');
select is((select array_agg(discipline order by discipline) from suggest_categories('bbbbbbbb-0000-0000-0000-000000000002', '2000-01-01', 'male', 60, 'dan 1', array['kumite'])),
  array['team'], 'kumite only: the kata category is left out, and a dan belt is above the kumite belt range');

update events set status = 'registration_open' where id = 'bbbbbbbb-0000-0000-0000-000000000002';

-- a club's submission
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select throws_ok(
  $$select save_club_entry('bbbbbbbb-0000-0000-0000-000000000002', null, 'X', 'y', '[{"full_name":"A","date_of_birth":"2000-01-01","gender":"male","weight":60,"belt_rank":"white"}]'::jsonb)$$,
  'P0001', 'Choose each belt from this event''s list.', 'a belt outside the event''s list is refused');
create temp table ref as
  select save_club_entry('bbbbbbbb-0000-0000-0000-000000000002', null, 'Club', 'c@d.e', '[
    {"full_name":"Kata Kid","date_of_birth":"2000-01-01","gender":"male","weight":60,"belt_rank":"kyu 2","disciplines":["kata"]},
    {"full_name":"Both Kid","date_of_birth":"2000-01-01","gender":"male","weight":60,"belt_rank":"Kyu 2"}
  ]'::jsonb) as id;
grant select on ref to authenticated;
select is((select disciplines from athletes where full_name = 'Both Kid'), array['kumite', 'kata'], 'no choice means both events');
select is((select disciplines from athletes where full_name = 'Kata Kid'), array['kata'], 'a kata-only choice is stored');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select lives_ok($$select approve_club_entry((select id from ref))$$, 'the organizer approves the submission');
select is((select count(*)::int from registrations r join athletes a on a.id = r.athlete_id join categories c on c.id = r.category_id
           where a.full_name = 'Kata Kid' and c.discipline = 'kumite'), 0, 'a kata-only athlete is not put in a kumite category');
select is((select count(*)::int from registrations r join athletes a on a.id = r.athlete_id join categories c on c.id = r.category_id
           where a.full_name = 'Both Kid' and c.discipline = 'kumite'), 1, 'while an athlete in both is');

-- anyone else
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select throws_ok($$select set_event_belts('bbbbbbbb-0000-0000-0000-000000000002', array['x'])$$, '42501', null, 'only the organizer can change the belts');

select * from finish();
rollback;
