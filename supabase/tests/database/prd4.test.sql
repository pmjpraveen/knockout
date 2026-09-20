begin;
select plan(30);

insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'org@test.dev'),
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'td@test.dev'),
  ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sk@test.dev'),
  ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'out@test.dev');
insert into events (id, organizer_id, name, start_date, end_date, status)
values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000a', 'Rings', current_date, current_date, 'registration_closed');
insert into event_members (event_id, user_id, role) values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000c', 'tournament_director'),
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000d', 'scorekeeper');
insert into tatamis (id, event_id, name) values
  ('22222222-2222-2222-2222-222222222221', '11111111-1111-1111-1111-111111111111', 'Tatami 1'),
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Tatami 2'),
  ('22222222-2222-2222-2222-222222222223', '11111111-1111-1111-1111-111111111111', 'Tatami 3'),
  ('22222222-2222-2222-2222-222222222224', '11111111-1111-1111-1111-111111111111', 'Tatami 4');

create function pg_temp.fill(p_cat uuid, p_n int, p_prefix text) returns void language plpgsql as $$
declare v_ce uuid; v_ath uuid; i int;
begin
  insert into club_entries (event_id, club_name) values ('11111111-1111-1111-1111-111111111111', p_prefix) returning id into v_ce;
  for i in 1..p_n loop
    insert into athletes (club_entry_id, full_name) values (v_ce, p_prefix || ' ' || lpad(i::text, 2, '0')) returning id into v_ath;
    insert into registrations (athlete_id, category_id) values (v_ath, p_cat);
  end loop;
end $$;

insert into categories (id, event_id, label, discipline, status, bracket_format)
select ('33333333-3333-3333-3333-3333333333' || lpad(n::text, 2, '0'))::uuid, '11111111-1111-1111-1111-111111111111', 'C' || n, d, 'closed', f
from (values (1,'kumite','single_elim_repechage'),(2,'kata','single_elim_repechage'),(3,'kumite','round_robin'),
             (4,'kumite','single_elim_repechage'),(5,'kumite','single_elim_repechage'),(6,'kumite','single_elim_repechage')) v(n, d, f);
update categories set created_at = now() + right(id::text, 2)::int * interval '1 second' where event_id = '11111111-1111-1111-1111-111111111111';
select pg_temp.fill('33333333-3333-3333-3333-333333333301', 8, 'One');
select pg_temp.fill('33333333-3333-3333-3333-333333333302', 3, 'Two');
select pg_temp.fill('33333333-3333-3333-3333-333333333303', 9, 'Three');
select pg_temp.fill('33333333-3333-3333-3333-333333333304', 16, 'Four');
select pg_temp.fill('33333333-3333-3333-3333-333333333305', 2, 'Five');
select pg_temp.fill('33333333-3333-3333-3333-333333333306', 2, 'Six');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select generate_bracket(('33333333-3333-3333-3333-3333333333' || lpad(n::text, 2, '0'))::uuid) from generate_series(1, 6) n;
-- the kata category also holds a kumite athlete (double entry), seeded 1 so they open the kata draw
reset role;
insert into registrations (athlete_id, category_id, seed)
select (select athlete_a_id from matches m join brackets b on b.id = m.bracket_id
        where b.category_id = '33333333-3333-3333-3333-333333333301' and m.round = 1 and m.position = 1), '33333333-3333-3333-3333-333333333302', 1;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select generate_bracket('33333333-3333-3333-3333-333333333302');

-- unassigned brackets are in no queue
select is((select count(*)::int from event_schedule('11111111-1111-1111-1111-111111111111')), 0, 'nothing is scheduled until a bracket is assigned');

-- assignment (as tournament director)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select lives_ok($$select assign_category_to_tatami('33333333-3333-3333-3333-333333333301', '22222222-2222-2222-2222-222222222221')$$, 'a tournament director assigns a category to a tatami');
select is((select max(queue_order) from matches m join brackets b on b.id = m.bracket_id where b.category_id = '33333333-3333-3333-3333-333333333301'),
          (select count(*)::int from matches m join brackets b on b.id = m.bracket_id where b.category_id = '33333333-3333-3333-3333-333333333301' and m.status = 'scheduled'),
          'the queue is numbered 1..n over playable matches');
select ok((select min(queue_order) from matches where bracket_side = 'main' and round = 3 and tatami_id = '22222222-2222-2222-2222-222222222221')
        > (select max(queue_order) from matches where bracket_side = 'main' and round = 2 and tatami_id = '22222222-2222-2222-2222-222222222221'),
  'the final is queued after the semifinals');
select ok((select min(queue_order) from matches where is_repechage and tatami_id = '22222222-2222-2222-2222-222222222221')
        > (select max(queue_order) from matches where bracket_side = 'main' and round = 2 and tatami_id = '22222222-2222-2222-2222-222222222221'),
  'repechage bouts are queued after the semifinals');
select lives_ok($$select assign_category_to_tatami('33333333-3333-3333-3333-333333333302', '22222222-2222-2222-2222-222222222222')$$, 'the kata category goes on another tatami');

-- estimated call times
select is((select estimated_call_time from event_schedule('11111111-1111-1111-1111-111111111111') where tatami_name = 'Tatami 1' and queue_position = 1), now(),
  'the first match on a ring is called now');
select is((select estimated_call_time from event_schedule('11111111-1111-1111-1111-111111111111') where tatami_name = 'Tatami 1' and queue_position = 3), now() + interval '4 minutes',
  'kumite matches are 2 minutes each');
select is((select estimated_call_time from event_schedule('11111111-1111-1111-1111-111111111111') where tatami_name = 'Tatami 2' and queue_position = 2), now() + interval '90 seconds',
  'kata matches are 1.5 minutes each');

-- conflicts: the double-entered athlete opens both rings
select is((select count(*)::int from event_schedule('11111111-1111-1111-1111-111111111111') where conflict), 2, 'the double-booked athlete flags both matches');
select is((select conflict from event_schedule('11111111-1111-1111-1111-111111111111') where tatami_name = 'Tatami 1' and queue_position = 2), false, 'unrelated matches are not flagged');
select lives_ok($$select move_in_queue((select match_id from event_schedule('11111111-1111-1111-1111-111111111111') where tatami_name = 'Tatami 1' and queue_position = 1), 1)$$,
  'the tournament director delays one of the clashing matches');
select is((select count(*)::int from event_schedule('11111111-1111-1111-1111-111111111111') where conflict), 0, 'delaying it clears the conflict');
select throws_ok($$select move_in_queue((select match_id from event_schedule('11111111-1111-1111-1111-111111111111') where tatami_name = 'Tatami 2' and queue_position = 3), -1)$$,
  'P0001', null, 'a match still waiting on earlier results cannot be moved');

-- pausing one ring leaves the others alone
update tatamis set status = 'paused' where id = '22222222-2222-2222-2222-222222222222';
select is((select array_agg(distinct tatami_status order by tatami_status) from event_schedule('11111111-1111-1111-1111-111111111111')), array['active', 'paused'], 'a paused tatami is flagged, the other stays active');
select is((select estimated_call_time from event_schedule('11111111-1111-1111-1111-111111111111') where tatami_name = 'Tatami 1' and queue_position = 3), now() + interval '4 minutes',
  'the other ring''s estimates are unchanged');

-- splitting: round robin pools go to different rings, the category stays one bracket
select lives_ok($$select split_bracket_across_tatamis('33333333-3333-3333-3333-333333333303', array['22222222-2222-2222-2222-222222222221','22222222-2222-2222-2222-222222222222']::uuid[], '22222222-2222-2222-2222-222222222223')$$,
  'a round-robin category splits its pools across two rings');
select is((select array_agg(distinct tatami_id order by tatami_id) from matches m join brackets b on b.id = m.bracket_id where b.category_id = '33333333-3333-3333-3333-333333333303'),
  array['22222222-2222-2222-2222-222222222221', '22222222-2222-2222-2222-222222222222']::uuid[], 'pools 1 and 2 run on different tatamis');
select is((select count(*)::int from brackets where category_id = '33333333-3333-3333-3333-333333333303'), 1, 'the split category is still a single bracket');

select lives_ok($$select split_bracket_across_tatamis('33333333-3333-3333-3333-333333333304', array['22222222-2222-2222-2222-222222222221','22222222-2222-2222-2222-222222222222']::uuid[], '22222222-2222-2222-2222-222222222223', 3)$$,
  'a 16-athlete draw splits its early rounds across two rings');
select is((select array_agg(tatami_id order by position) from matches m join brackets b on b.id = m.bracket_id
           where b.category_id = '33333333-3333-3333-3333-333333333304' and m.bracket_side = 'main' and m.round = 1),
  array['22222222-2222-2222-2222-222222222221','22222222-2222-2222-2222-222222222221','22222222-2222-2222-2222-222222222221','22222222-2222-2222-2222-222222222221',
        '22222222-2222-2222-2222-222222222222','22222222-2222-2222-2222-222222222222','22222222-2222-2222-2222-222222222222','22222222-2222-2222-2222-222222222222']::uuid[],
  'round 1 is split in two halves of the draw');
select is((select array_agg(distinct tatami_id) from matches m join brackets b on b.id = m.bracket_id
           where b.category_id = '33333333-3333-3333-3333-333333333304' and (m.round >= 3 or m.is_repechage)),
  array['22222222-2222-2222-2222-222222222223']::uuid[], 'the rounds from the convergence round on, and the repechage, run on the home tatami');

-- category sequence
select assign_category_to_tatami('33333333-3333-3333-3333-333333333305', '22222222-2222-2222-2222-222222222224');
select assign_category_to_tatami('33333333-3333-3333-3333-333333333306', '22222222-2222-2222-2222-222222222224');
select is((select category_label from event_schedule('11111111-1111-1111-1111-111111111111') where tatami_name = 'Tatami 4' and queue_position = 1), 'C5', 'categories run in creation order by default');
select move_category_sequence('33333333-3333-3333-3333-333333333306', -1);
select is((select category_label from event_schedule('11111111-1111-1111-1111-111111111111') where tatami_name = 'Tatami 4' and queue_position = 1), 'C6', 'moving a category earlier reorders the queue');

-- regeneration keeps the home tatami
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select generate_bracket('33333333-3333-3333-3333-333333333301');
select is((select count(*)::int from matches m join brackets b on b.id = m.bracket_id
           where b.category_id = '33333333-3333-3333-3333-333333333301' and m.status = 'scheduled' and m.tatami_id = '22222222-2222-2222-2222-222222222221' and m.queue_order is not null),
  (select count(*)::int from matches m join brackets b on b.id = m.bracket_id where b.category_id = '33333333-3333-3333-3333-333333333301' and m.status = 'scheduled'),
  'a redrawn bracket lands back on its home tatami with a queue');

-- permissions
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok($$select assign_category_to_tatami('33333333-3333-3333-3333-333333333301', '22222222-2222-2222-2222-222222222222')$$, '42501', null, 'a scorekeeper cannot change the schedule');
select is((select count(*)::int > 0 from event_schedule('11111111-1111-1111-1111-111111111111')), true, 'a scorekeeper can read the schedule');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select throws_ok($$select event_schedule('11111111-1111-1111-1111-111111111111')$$, '42501', null, 'outsiders cannot read the schedule');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$select regenerate_schedule_link('11111111-1111-1111-1111-111111111111')$$, '42501', null, 'a tournament director cannot manage the public link');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select length(regenerate_schedule_link('11111111-1111-1111-1111-111111111111'))), 64, 'the organizer generates a 64-char schedule token');

select * from finish();
rollback;
