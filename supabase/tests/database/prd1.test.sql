begin;
select plan(21);

insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'org@test.dev'),
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'td@test.dev'),
  ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sk@test.dev');

update profiles set account_type = 'organizer' where user_id = '00000000-0000-0000-0000-00000000000a';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

insert into events (id, organizer_id, name, start_date, end_date)
values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000a', 'Open', current_date, current_date);
insert into tatamis (id, event_id, name) values
  ('22222222-2222-2222-2222-222222222221', '11111111-1111-1111-1111-111111111111', 'Tatami 1');
insert into categories (id, event_id, label, discipline) values
  ('33333333-3333-3333-3333-333333333331', '11111111-1111-1111-1111-111111111111', 'U12', 'kumite'),
  ('33333333-3333-3333-3333-333333333332', '11111111-1111-1111-1111-111111111111', 'U14', 'kumite');

-- staff management
select lives_ok($$select add_event_member('11111111-1111-1111-1111-111111111111', 'TD@test.dev', 'tournament_director')$$,
  'organizer adds a tournament director by email');
select lives_ok($$select add_event_member('11111111-1111-1111-1111-111111111111', 'sk@test.dev', 'scorekeeper', '22222222-2222-2222-2222-222222222221')$$,
  'organizer adds a scorekeeper with a tatami');
select throws_ok($$select add_event_member('11111111-1111-1111-1111-111111111111', 'sk2@test.dev', 'scorekeeper')$$,
  'P0001', null, 'scorekeeper without a tatami is rejected');
select throws_ok($$select add_event_member('11111111-1111-1111-1111-111111111111', 'nobody@test.dev', 'tournament_director')$$,
  'P0001', null, 'unknown email is rejected');
select is((select count(*)::int from list_event_staff('11111111-1111-1111-1111-111111111111')), 3, 'staff list has organizer, TD and scorekeeper');
update events set status = 'completed' where id = '11111111-1111-1111-1111-111111111111';
select throws_ok($$select add_event_member('11111111-1111-1111-1111-111111111111', 'TD@test.dev', 'tournament_director')$$,
  'P0001', 'This event is completed, so staff can no longer be added.', 'staff cannot be added once the event is completed');
update events set status = 'draft' where id = '11111111-1111-1111-1111-111111111111';

-- a draft can be saved half-filled, but cannot leave draft without dates
select lives_ok($$insert into events (id, organizer_id, name) values ('11111111-1111-1111-1111-1111111111ff', '00000000-0000-0000-0000-00000000000a', 'Saved draft')$$,
  'a draft can be saved without dates');
select throws_ok($$update events set status = 'registration_open' where id = '11111111-1111-1111-1111-1111111111ff'$$,
  '23514', null, 'but it cannot leave draft until it has dates');

-- category lifecycle follows the event
update events set status = 'registration_open' where id = '11111111-1111-1111-1111-111111111111';
select is((select count(*)::int from categories where status = 'open'), 2, 'opening registration opens draft categories');

-- role boundaries
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*)::int from categories), 2, 'tournament director can read categories');
with u as (update categories set label = 'hacked' returning 1) select is((select count(*)::int from u), 0, 'tournament director cannot edit categories');
with u as (update events set name = 'hacked' returning 1) select is((select count(*)::int from u), 0, 'tournament director cannot edit the event');
select throws_ok($$select complete_event('11111111-1111-1111-1111-111111111111')$$, '42501', null, 'tournament director cannot complete the event');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok($$insert into categories (event_id, label, discipline) values ('11111111-1111-1111-1111-111111111111', 'x', 'kata')$$,
  '42501', null, 'scorekeeper cannot add categories');
select throws_ok($$select list_event_staff('11111111-1111-1111-1111-111111111111')$$, '42501', null, 'scorekeeper cannot list staff');

-- merge / split
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
reset role;
insert into club_entries (id, event_id, club_name) values ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'Club');
insert into athletes (id, club_entry_id, full_name) values
  ('44444444-4444-4444-4444-444444444441', '55555555-5555-5555-5555-555555555555', 'One'),
  ('44444444-4444-4444-4444-444444444442', '55555555-5555-5555-5555-555555555555', 'Two');
insert into registrations (id, athlete_id, category_id, seed) values
  ('66666666-6666-6666-6666-666666666661', '44444444-4444-4444-4444-444444444441', '33333333-3333-3333-3333-333333333331', 1),
  ('66666666-6666-6666-6666-666666666662', '44444444-4444-4444-4444-444444444442', '33333333-3333-3333-3333-333333333332', 2);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

update events set status = 'registration_closed' where id = '11111111-1111-1111-1111-111111111111';
select lives_ok($$select merge_categories('33333333-3333-3333-3333-333333333331', array['33333333-3333-3333-3333-333333333332']::uuid[])$$,
  'closed categories merge');
select is((select seed from registrations where athlete_id = '44444444-4444-4444-4444-444444444442'), 2,
  'merge carries registrations and seeds into the target');
select lives_ok($$select split_category('33333333-3333-3333-3333-333333333331',
  array(select id from registrations where athlete_id = '44444444-4444-4444-4444-444444444442'), 'U12 B')$$,
  'a closed category splits');
select is((select c.label from registrations r join categories c on c.id = r.category_id
  where r.athlete_id = '44444444-4444-4444-4444-444444444442'), 'U12 B', 'split moves the chosen registration');

select lives_ok($$select complete_event('11111111-1111-1111-1111-111111111111')$$, 'organizer completes the event');
select ok((select purge_at > now() + interval '6 days' from events where id = '11111111-1111-1111-1111-111111111111'),
  'completing sets purge_at seven days out');

select * from finish();
rollback;
