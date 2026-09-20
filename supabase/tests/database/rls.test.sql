begin;
select plan(16);

insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.dev'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.dev');
insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data)
values ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'g@test.dev', '{"provider":"google"}');

update profiles set account_type = 'organizer' where user_id = '00000000-0000-0000-0000-00000000000a';

set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
insert into events (id, organizer_id, name, start_date, end_date)
values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000a', 'A Open', current_date, current_date);
select is((select count(*)::int from event_members where event_id = '11111111-1111-1111-1111-111111111111' and role = 'organizer'), 1,
  'creating an event makes its creator an organizer member');
select lives_ok($$insert into categories (event_id, label, discipline) values ('11111111-1111-1111-1111-111111111111', 'Kumite -30kg', 'kumite')$$,
  'organizer can add a category');
select lives_ok($$insert into event_covers (event_id, image) values ('11111111-1111-1111-1111-111111111111', 'data:image/jpeg;base64,AAAA')$$,
  'organizer can add a cover image');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from events), 0, 'another user cannot see the event');
select is((select count(*)::int from categories), 0, 'another user cannot see its categories');
select is((select count(*)::int from event_covers), 0, 'another user cannot see its cover image');
select throws_ok($$insert into event_covers (event_id, image) values ('11111111-1111-1111-1111-111111111111', 'data:image/jpeg;base64,AAAA')$$,
  '42501', null, 'another user cannot add a cover image');
select throws_ok($$insert into categories (event_id, label, discipline) values ('11111111-1111-1111-1111-111111111111', 'x', 'kata')$$,
  '42501', null, 'another user cannot add a category');
select throws_ok($$insert into events (organizer_id, name, start_date, end_date) values ('00000000-0000-0000-0000-00000000000a', 'spoof', current_date, current_date)$$,
  '42501', null, 'cannot create an event on behalf of someone else');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$insert into events (organizer_id, name, start_date, end_date) values ('00000000-0000-0000-0000-00000000000b', 'mine', current_date, current_date)$$,
  '42501', null, 'a staff account cannot create an event');
select is((select account_type from profiles), 'staff', 'an account not created through Google is staff');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is((select account_type from profiles), 'organizer', 'a Google account is an organizer');
select lives_ok($$insert into events (organizer_id, name, start_date, end_date) values ('00000000-0000-0000-0000-00000000000d', 'mine', current_date, current_date)$$, 'so it can create an event');

reset role;
delete from events where id = '11111111-1111-1111-1111-111111111111';
select is((select count(*)::int from event_covers), 0, 'deleting an event (as the purge does) deletes its cover image');

set local role anon;
select is((select count(*)::int from events), 0, 'anon sees no events');
select throws_ok($$insert into club_entries (event_id, club_name) values ('11111111-1111-1111-1111-111111111111', 'x')$$,
  '42501', null, 'anon cannot write club entries');

select * from finish();
rollback;
