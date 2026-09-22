begin;
select plan(13);

insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'org@test.dev');
insert into events (id, organizer_id, name, start_date, end_date, status)
values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000a', 'Two days', current_date, current_date + 1, 'registration_closed');
insert into tatamis (id, event_id, name) values
  ('22222222-2222-2222-2222-222222222221', '11111111-1111-1111-1111-111111111111', 'Tatami 1'),
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Tatami 2');

create function pg_temp.fill(p_cat uuid, p_n int, p_prefix text) returns void language plpgsql as $$
declare v_ce uuid; v_ath uuid; i int;
begin
  insert into club_entries (event_id, club_name) values ('11111111-1111-1111-1111-111111111111', p_prefix) returning id into v_ce;
  for i in 1..p_n loop
    insert into athletes (club_entry_id, full_name) values (v_ce, p_prefix || ' ' || i) returning id into v_ath;
    insert into registrations (athlete_id, category_id) values (v_ath, p_cat);
  end loop;
end $$;

insert into categories (id, event_id, label, discipline, status, bracket_format, tatami_id)
select ('33333333-3333-3333-3333-3333333333' || lpad(n::text, 2, '0'))::uuid, '11111111-1111-1111-1111-111111111111', 'C' || n, 'kumite', 'closed',
       'single_elim_repechage', '22222222-2222-2222-2222-222222222221'
from generate_series(1, 3) n;
update categories set created_at = now() + right(id::text, 2)::int * interval '1 second' where event_id = '11111111-1111-1111-1111-111111111111';

select is((select count(*)::int from categories where event_day = current_date), 3, 'a new category runs on the first day');
select pg_temp.fill(('33333333-3333-3333-3333-3333333333' || lpad(n::text, 2, '0'))::uuid, 2, 'Club ' || n) from generate_series(1, 3) n;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select generate_bracket(('33333333-3333-3333-3333-3333333333' || lpad(n::text, 2, '0'))::uuid) from generate_series(1, 3) n;

select lives_ok($$select set_category_day('33333333-3333-3333-3333-333333333301', current_date + 1)$$, 'a category can move to another day of the event');
select throws_ok($$select set_category_day('33333333-3333-3333-3333-333333333301', current_date + 5)$$, null, 'Choose a day the event runs on.', 'a day outside the event is refused');
select throws_ok($$select set_category_day('33333333-3333-3333-3333-333333333301', null)$$, null, 'Choose a day the event runs on.', 'a category needs a day');

select is((select array_agg(distinct category_label order by category_label) from event_schedule('11111111-1111-1111-1111-111111111111') where event_day = current_date + 1), array['C1'], 'the moved category is on day two');
select is((select count(*)::int from event_schedule('11111111-1111-1111-1111-111111111111') where event_day = current_date), 2, 'the other two are still on day one');
select is((select min(queue_position) from event_schedule('11111111-1111-1111-1111-111111111111') where event_day = current_date + 1), 1, 'each day counts its own queue from one');
select is((select estimated_call_time from event_schedule('11111111-1111-1111-1111-111111111111') where event_day = current_date and queue_position = 1), now(), 'the day being run has call times');
select is((select count(*)::int from event_schedule('11111111-1111-1111-1111-111111111111') where event_day = current_date + 1 and estimated_call_time is not null), 0, 'a later day has none yet');

select is((select max(m.queue_order) filter (where c.event_day = current_date) < min(m.queue_order) filter (where c.event_day = current_date + 1)
  from matches m join brackets b on b.id = m.bracket_id join categories c on c.id = b.category_id where m.tatami_id = '22222222-2222-2222-2222-222222222221'), true, 'the queue runs day one before day two');

select lives_ok($$select move_category_sequence('33333333-3333-3333-3333-333333333303', -1)$$, 'a category can move up among its own day');
select is((select sequence from categories where id = '33333333-3333-3333-3333-333333333303') < (select sequence from categories where id = '33333333-3333-3333-3333-333333333302'), true, 'it passed the other day-one category');

reset role;
insert into events (id, organizer_id, name, status) values ('11111111-1111-1111-1111-111111111112', '00000000-0000-0000-0000-00000000000a', 'Draft', 'draft');
insert into categories (id, event_id, label, discipline) values ('33333333-3333-3333-3333-333333333391', '11111111-1111-1111-1111-111111111112', 'Draft cat', 'kumite');
update events set start_date = current_date + 3, end_date = current_date + 3 where id = '11111111-1111-1111-1111-111111111112';
select is((select event_day from categories where id = '33333333-3333-3333-3333-333333333391'), current_date + 3, 'a draft''s categories take the start date once it has one');

select * from finish();
rollback;
