begin;
select plan(21);

insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'org@test.dev'),
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'td@test.dev');

update profiles set account_type = 'organizer' where user_id = '00000000-0000-0000-0000-00000000000a';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

insert into events (id, organizer_id, name, start_date, end_date, status)
values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000a', 'Open', '2026-10-10', '2026-10-10', 'registration_open');
insert into categories (id, event_id, label, discipline, gender, age_min, age_max, weight_max, belt_min, belt_max, status) values
  ('33333333-3333-3333-3333-333333333331', '11111111-1111-1111-1111-111111111111', 'Broad kumite', 'kumite', null, null, null, null, null, null, 'open'),
  ('33333333-3333-3333-3333-333333333332', '11111111-1111-1111-1111-111111111111', 'Boys 12-14 -40kg white-orange', 'kumite', 'male', 12, 14, 40, 'white', 'orange', 'open'),
  ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Girls kata', 'kata', 'female', null, null, null, null, null, 'open');

-- link
select is((select length(regenerate_registration_link('11111111-1111-1111-1111-111111111111'))), 64, 'organizer generates a 64-char link token');
select is((select regenerated_count from registration_links), 0, 'first generation is not a regeneration');
select lives_ok($$select regenerate_registration_link('11111111-1111-1111-1111-111111111111')$$, 'organizer regenerates the token');
select is((select regenerated_count from registration_links), 1, 'regeneration is counted');

-- suggestions: boy, 13, 35kg, orange belt -> most specific kumite; no kata
select is((select array_agg(label order by label) from suggest_categories('11111111-1111-1111-1111-111111111111', '2013-03-01', 'male', 35, 'Orange')),
  array['Boys 12-14 -40kg white-orange'], 'suggests the most specific category per discipline');
select is((select array_agg(label order by label) from suggest_categories('11111111-1111-1111-1111-111111111111', '2013-03-01', 'male', 45, 'orange')),
  array['Broad kumite'], 'falls back to the broad category when weight is too high');
select is((select array_agg(discipline order by discipline) from suggest_categories('11111111-1111-1111-1111-111111111111', '2013-03-01', 'female', 35, 'white')),
  array['kata', 'kumite'], 'an athlete can match one category per discipline');

-- club submission (Edge Function path, service role)
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
create temp table ref as
  select save_club_entry('11111111-1111-1111-1111-111111111111', null, 'Dragon Dojo', 'a@b.c',
    '[{"full_name":"Kai","date_of_birth":"2013-03-01","gender":"male","weight":35,"belt_rank":"orange"},
      {"full_name":"Mei","date_of_birth":"1990-01-01","gender":"female","weight":50,"belt_rank":"5th kyu"}]'::jsonb) as id;
grant select on ref to authenticated;
select is((select count(*)::int from athletes where club_entry_id = (select id from ref)), 2, 'save_club_entry stores the roster');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$select approve_club_entry((select id from ref))$$, '42501', null, 'a non-member cannot approve');
select throws_ok($$select save_club_entry('11111111-1111-1111-1111-111111111111', null, 'x', 'y', '[]'::jsonb)$$, '42501', null, 'signed-in users cannot call the public save function');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$select flag_club_entry((select id from ref), '  ')$$, 'P0001', null, 'flagging needs a reason');
select lives_ok($$select flag_club_entry((select id from ref), 'Mei weight looks wrong')$$, 'organizer flags a submission');

reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select lives_ok($$select save_club_entry('11111111-1111-1111-1111-111111111111', (select id from ref), 'Dragon Dojo', 'a@b.c',
  '[{"full_name":"Kai","date_of_birth":"2013-03-01","gender":"male","weight":35,"belt_rank":"orange"}]'::jsonb)$$,
  'the club resubmits a flagged entry');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select approve_club_entry((select id from ref))), 0, 'approval registers athletes and reports none unmatched');
select is((select count(*)::int from registrations r join athletes a on a.id = r.athlete_id where a.club_entry_id = (select id from ref)), 1,
  'Kai is registered in his single matching category');

-- organizer overrides
select throws_ok($$select organizer_edit_athlete((select id from athletes where full_name = 'Kai'), 'Kai', '2013-03-01', 'male', 38, 'orange', '')$$,
  'P0001', null, 'an override needs a reason');
select lives_ok($$select organizer_edit_athlete((select id from athletes where full_name = 'Kai'), 'Kai', '2013-03-01', 'male', 38, 'orange', 'Weigh-in correction')$$,
  'organizer corrects a weight with a reason');
select is((select reason from audit_log where action = 'edit_athlete'), 'Weigh-in correction', 'the override is logged with its reason');
select lives_ok($$select organizer_add_athlete((select id from ref), 'Late Entry', '2014-01-01', 'male', 30, 'white', 'Added after deadline')$$,
  'organizer adds a participant to an approved entry');
select is((select submitted_by from registrations r join athletes a on a.id = r.athlete_id where a.full_name = 'Late Entry' limit 1), 'organizer',
  'the added participant is registered as an organizer entry');

reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select throws_ok($$select save_club_entry('11111111-1111-1111-1111-111111111111', (select id from ref), 'x', 'y', '[]'::jsonb)$$,
  'P0403', null, 'an approved submission can no longer be edited by the club');

select * from finish();
rollback;
