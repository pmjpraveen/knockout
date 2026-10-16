begin;
select plan(7);

insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-0000000000a8', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'wd-org@test.dev'),
  ('00000000-0000-0000-0000-0000000000b8', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'wd-other@test.dev');
update profiles set account_type = 'organizer' where user_id in ('00000000-0000-0000-0000-0000000000a8', '00000000-0000-0000-0000-0000000000b8');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a8","role":"authenticated"}', true);
insert into events (id, organizer_id, name, start_date, end_date)
values ('bbbbbbbb-0000-0000-0000-000000000008', '00000000-0000-0000-0000-0000000000a8', 'Withdrawals', current_date + 30, current_date + 31);
insert into categories (id, event_id, label, discipline) values ('cccccccc-0000-0000-0000-000000000008', 'bbbbbbbb-0000-0000-0000-000000000008', 'Kumite A', 'kumite');
insert into club_entries (id, event_id, club_name) values ('dddddddd-0000-0000-0000-000000000008', 'bbbbbbbb-0000-0000-0000-000000000008', 'Test Club');
insert into athletes (id, club_entry_id, full_name) values ('eeeeeeee-0000-0000-0000-000000000008', 'dddddddd-0000-0000-0000-000000000008', 'Asha Rao');
insert into registrations (id, athlete_id, category_id) values ('ffffffff-0000-0000-0000-000000000008', 'eeeeeeee-0000-0000-0000-000000000008', 'cccccccc-0000-0000-0000-000000000008');

select throws_ok($$select withdraw_registration('ffffffff-0000-0000-0000-000000000008', '  ')$$, 'P0001', 'A reason is required to withdraw an athlete', 'a reason is required');
select is((select count(*)::int from registrations where id = 'ffffffff-0000-0000-0000-000000000008'), 1, 'nothing is removed without one');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b8","role":"authenticated"}', true);
select throws_ok($$select withdraw_registration('ffffffff-0000-0000-0000-000000000008', 'Injured')$$, '42501', null, 'another organizer cannot withdraw the athlete');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a8","role":"authenticated"}', true);
select lives_ok($$select withdraw_registration('ffffffff-0000-0000-0000-000000000008', ' Injured in warm-up ')$$, 'the organizer withdraws an athlete with a reason');
select is((select count(*)::int from registrations where id = 'ffffffff-0000-0000-0000-000000000008'), 0, 'the registration is removed');
select is((select reason from audit_log where subject_id = 'dddddddd-0000-0000-0000-000000000008' and action = 'withdraw_registration'), 'Injured in warm-up', 'the reason is logged, trimmed');
select is((select changes ->> 'category_label' from audit_log where subject_id = 'dddddddd-0000-0000-0000-000000000008' and action = 'withdraw_registration'), 'Kumite A', 'the log says which category');

select * from finish();
rollback;
