begin;
select plan(7);

insert into auth.users (id, instance_id, aud, role, email)
values ('00000000-0000-0000-0000-0000000000a9', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rules-org@test.dev');
update profiles set account_type = 'organizer' where user_id = '00000000-0000-0000-0000-0000000000a9';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}', true);
insert into events (id, organizer_id, name, start_date, end_date)
values ('bbbbbbbb-0000-0000-0000-000000000009', '00000000-0000-0000-0000-0000000000a9', 'Rules', current_date + 30, current_date + 31);
select set_event_belts('bbbbbbbb-0000-0000-0000-000000000009', array['white', 'green', 'black']);

select lives_ok($$insert into categories (event_id, label, discipline, age_min, age_max, belt_min, belt_max) values ('bbbbbbbb-0000-0000-0000-000000000009', 'Juniors', 'kumite', 10, 12, 'white', 'green')$$, 'a valid category is accepted');
select throws_ok($$insert into categories (event_id, label, discipline) values ('bbbbbbbb-0000-0000-0000-000000000009', ' juniors ', 'kata')$$, '23505', null, 'a label can be used once per event, ignoring case and spaces');
select throws_ok($$insert into categories (event_id, label, discipline, age_min, age_max) values ('bbbbbbbb-0000-0000-0000-000000000009', 'Bad age', 'kata', 15, 10)$$, '23514', null, 'age min cannot exceed age max');
select throws_ok($$insert into categories (event_id, label, discipline, weight_min) values ('bbbbbbbb-0000-0000-0000-000000000009', 'Bad weight', 'kata', -1)$$, '23514', null, 'weights cannot be negative');
select throws_ok($$insert into categories (event_id, label, discipline, belt_min, belt_max) values ('bbbbbbbb-0000-0000-0000-000000000009', 'Bad belts', 'kata', 'black', 'white')$$, 'P0001', 'Belt from must not be higher than belt to.', 'belts must run low to high');
select throws_ok($$insert into categories (event_id, label, discipline, belt_min) values ('bbbbbbbb-0000-0000-0000-000000000009', 'Odd belt', 'kata', 'purple')$$, 'P0001', 'The belt "purple" is not one of this event''s belts.', 'belts must be in the event''s list');
select lives_ok($$update categories set label = 'Juniors A' where label = 'Juniors'$$, 'renaming leaves belts alone and still works');

select * from finish();
rollback;
