begin;
select plan(14);

insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'org@test.dev'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@test.dev');
update profiles set account_type = 'organizer' where user_id = '00000000-0000-0000-0000-0000000000a1';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
insert into events (id, organizer_id, name, start_date, end_date)
values ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'Import', current_date + 30, current_date + 31);

-- categories: draft only
select is(
  import_categories('aaaaaaaa-0000-0000-0000-000000000001', '[
    {"label":"U12 Male","discipline":"kumite","gender":"male","age_min":10,"age_max":12,"belt_min":"white","belt_max":"green"},
    {"label":"Adults Female","discipline":"kata","gender":"female","age_min":18}
  ]'::jsonb),
  '{"inserted":2,"skipped":0}'::jsonb, 'categories are imported');
select is(
  import_categories('aaaaaaaa-0000-0000-0000-000000000001', '[{"label":"u12 male","discipline":"kumite"}]'::jsonb) ->> 'skipped',
  '1', 'a category whose label already exists is skipped');
select throws_ok(
  $$select import_categories('aaaaaaaa-0000-0000-0000-000000000001', '[{"label":"Fine","discipline":"kumite"},{"label":"Bad","discipline":"sparring"}]'::jsonb)$$,
  'P0001', 'Row 2: discipline must be kumite, kata or team.', 'a bad row is named');
select is((select count(*)::int from categories), 2, 'and a rejected import adds nothing');

-- athletes: not before registration opens
select throws_ok(
  $$select import_athletes('aaaaaaaa-0000-0000-0000-000000000001', '[]'::jsonb)$$,
  'P0001', 'Participants can only be imported while registration is open.', 'participants cannot be imported to a draft');

update events set status = 'registration_open' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select throws_ok(
  $$select import_categories('aaaaaaaa-0000-0000-0000-000000000001', '[{"label":"Late","discipline":"kumite"}]'::jsonb)$$,
  'P0001', 'Categories can only be imported while the event is a draft.', 'categories cannot be imported once registration is open');

create temp table sheet as
select jsonb_build_array(
  jsonb_build_object('club_name','Club Alpha','full_name','Ken Young','date_of_birth',(current_date - interval '11 years')::date,'gender','male','weight',35,'belt_rank','Orange'),
  jsonb_build_object('club_name','club alpha','full_name','Old Man','date_of_birth',(current_date - interval '60 years')::date,'gender','male','weight',80,'belt_rank','black'),
  jsonb_build_object('club_name','Club Beta','full_name','Mia Master','date_of_birth',(current_date - interval '30 years')::date,'gender','female','weight',55,'belt_rank','brown'),
  jsonb_build_object('club_name','Club Alpha','full_name','ken young','date_of_birth',(current_date - interval '11 years')::date,'gender','male','weight',35,'belt_rank','orange')
) as rows;
grant select on sheet to authenticated;

select is(
  import_athletes('aaaaaaaa-0000-0000-0000-000000000001', (select rows from sheet)),
  '{"clubs":2,"athletes":3,"skipped":1,"unmatched":1}'::jsonb, 'participants are imported by club; a repeat is skipped; one matches no category');
select is((select count(*)::int from club_entries where approval_status = 'approved'), 2, 'each club becomes an approved submission');
select is((select count(*)::int from registrations), 2, 'matching participants are registered in their categories');
select is(import_athletes('aaaaaaaa-0000-0000-0000-000000000001', (select rows from sheet)) ->> 'athletes', '0',
  'uploading the same sheet again adds nobody');
select throws_ok(
  $$select import_athletes('aaaaaaaa-0000-0000-0000-000000000001', '[{"club_name":"X","full_name":"Y","date_of_birth":"2015-01-01","gender":"male","weight":30,"belt_rank":"pink"}]'::jsonb)$$,
  'P0001', 'Row 1: the belt is not in this event''s belt list.', 'a bad participant row is named');
select is((select count(*)::int from audit_log where action = 'import_athletes'), 2, 'each imported club is logged');

-- anyone else
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select throws_ok($$select import_athletes('aaaaaaaa-0000-0000-0000-000000000001', (select rows from sheet))$$, '42501', null, 'only the organizer can import participants');
select throws_ok($$select import_categories('aaaaaaaa-0000-0000-0000-000000000001', '[{"label":"Z","discipline":"kata"}]'::jsonb)$$, '42501', null, 'or categories');

select * from finish();
rollback;
