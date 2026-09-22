begin;
select plan(21);

insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'org@test.dev'),
  ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'out@test.dev');
insert into events (id, organizer_id, name, start_date, end_date, status)
values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000a', 'Groups', current_date, current_date, 'registration_closed');
insert into tatamis (id, event_id, name) values
  ('22222222-2222-2222-2222-222222222221', '11111111-1111-1111-1111-111111111111', 'Tatami 1'),
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Tatami 2');
insert into categories (id, event_id, label, discipline, status, bracket_format) values
  ('33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111111', 'Kumite Male', 'kumite', 'closed', 'single_elim_repechage'),
  ('33333333-3333-3333-3333-333333333302', '11111111-1111-1111-1111-111111111111', 'Eight', 'kumite', 'closed', 'single_elim_repechage'),
  ('33333333-3333-3333-3333-333333333303', '11111111-1111-1111-1111-111111111111', 'Four', 'kumite', 'closed', 'single_elim_repechage'),
  ('33333333-3333-3333-3333-333333333304', '11111111-1111-1111-1111-111111111111', 'Three', 'kumite', 'closed', 'round_robin'),
  ('33333333-3333-3333-3333-333333333305', '11111111-1111-1111-1111-111111111111', 'Double', 'kumite', 'closed', 'double_elim'),
  ('33333333-3333-3333-3333-333333333306', '11111111-1111-1111-1111-111111111111', 'Six', 'kumite', 'closed', 'single_elim_repechage');

create function pg_temp.fill(p_cat uuid, p_club text, p_n int) returns void language plpgsql as $$
declare v_ce uuid; v_ath uuid; i int;
begin
  insert into club_entries (event_id, club_name) values ('11111111-1111-1111-1111-111111111111', p_club) returning id into v_ce;
  for i in 1..p_n loop
    insert into athletes (club_entry_id, full_name) values (v_ce, p_club || ' ' || i) returning id into v_ath;
    insert into registrations (athlete_id, category_id) values (v_ath, p_cat);
  end loop;
end $$;

-- 10 athletes from four clubs
select pg_temp.fill('33333333-3333-3333-3333-333333333301', 'A', 3), pg_temp.fill('33333333-3333-3333-3333-333333333301', 'B', 3),
       pg_temp.fill('33333333-3333-3333-3333-333333333301', 'C', 2), pg_temp.fill('33333333-3333-3333-3333-333333333301', 'D', 2);
update registrations set seed = 1 where category_id = '33333333-3333-3333-3333-333333333301' and athlete_id = (select id from athletes where full_name = 'A 1');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select throws_ok($$select set_category_groups('33333333-3333-3333-3333-333333333301', 2)$$, '42501', null, 'only the organizer can split a category');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select is(cardinality(set_category_groups('33333333-3333-3333-3333-333333333301', 3)), 3, 'a category can be dealt into three groups');
select is((select array_agg(n order by n) from (select count(*)::int n from registrations r join categories c on c.id = r.category_id
           where c.id = '33333333-3333-3333-3333-333333333301' or c.split_root = '33333333-3333-3333-3333-333333333301' group by c.id) x), array[3, 3, 4], 'ten athletes make groups of 4, 3 and 3');
select is((select array_agg(label order by split_index) from categories where id = '33333333-3333-3333-3333-333333333301' or split_root = '33333333-3333-3333-3333-333333333301'),
          array['Kumite Male · Group A', 'Kumite Male · Group B', 'Kumite Male · Group C'], 'the groups are lettered');
select is((select count(*)::int from (select r.category_id, lower(ce.club_name) from registrations r join athletes a on a.id = r.athlete_id join club_entries ce on ce.id = a.club_entry_id
           where r.category_id in (select id from categories where id = '33333333-3333-3333-3333-333333333301' or split_root = '33333333-3333-3333-3333-333333333301')
           group by 1, 2 having count(*) > 1) d), 0, 'club-mates land in different groups');
select is((select count(seed)::int from registrations r join categories c on c.id = r.category_id where c.id = '33333333-3333-3333-3333-333333333301' or c.split_root = '33333333-3333-3333-3333-333333333301'), 0, 'seeds are cleared when the field changes');
select is((select count(*)::int from categories where id = '33333333-3333-3333-3333-333333333301' or split_root = '33333333-3333-3333-3333-333333333301'), 3, 'the original is one of the three');

select is(cardinality(set_category_groups('33333333-3333-3333-3333-333333333302', 1)), 1, 'one group is a no-op split');
select is(cardinality(set_category_groups((select id from categories where split_root = '33333333-3333-3333-3333-333333333301' order by split_index limit 1), 3)), 3, 'asking through a group reshuffles the whole set');
select is((select count(*)::int from registrations r join categories c on c.id = r.category_id where c.id = '33333333-3333-3333-3333-333333333301' or c.split_root = '33333333-3333-3333-3333-333333333301'), 10, 'a reshuffle keeps every athlete');

select is(cardinality(set_category_groups('33333333-3333-3333-3333-333333333301', 2, array['22222222-2222-2222-2222-222222222221', '22222222-2222-2222-2222-222222222222']::uuid[])), 2, 'fewer groups merges the extras away');
select is((select array_agg(tatami_id order by split_index) from categories where id = '33333333-3333-3333-3333-333333333301' or split_root = '33333333-3333-3333-3333-333333333301'),
          array['22222222-2222-2222-2222-222222222221', '22222222-2222-2222-2222-222222222222']::uuid[], 'each group can run on its own tatami');
select throws_ok($$select set_category_groups('33333333-3333-3333-3333-333333333301', 6)$$, null, 'Choose between 1 and 5 groups; each needs at least 2 athletes.', 'a group needs two athletes');
select is(cardinality(set_category_groups('33333333-3333-3333-3333-333333333301', 1)), 1, 'one group puts them back together');
select is((select label || '/' || coalesce(split_index::text, '-') from categories where id = '33333333-3333-3333-3333-333333333301'), 'Kumite Male/-', 'and restores the original label');

-- a started match locks the groups
reset role;
select pg_temp.fill('33333333-3333-3333-3333-333333333302', 'E', 8);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select generate_bracket('33333333-3333-3333-3333-333333333302');
reset role;
update matches set status = 'in_progress' where id = (select m.id from matches m join brackets b on b.id = m.bracket_id where b.category_id = '33333333-3333-3333-3333-333333333302' limit 1);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$select set_category_groups('33333333-3333-3333-3333-333333333302', 2)$$, null, 'Matches have started, so the groups are locked', 'groups are locked once a match starts');

-- podium
reset role;
update matches set status = 'scheduled' where status = 'in_progress';
create function pg_temp.play_all(p_cat uuid) returns void language plpgsql as $$
declare v_m uuid; n int := 0;
begin
  loop
    select m.id into v_m from public.matches m join public.brackets b on b.id = m.bracket_id
    where b.category_id = p_cat and m.status = 'scheduled' and m.athlete_a_id is not null and m.athlete_b_id is not null limit 1;
    exit when v_m is null or n > 60;
    perform public.bracket_complete_match(v_m, (select athlete_a_id from public.matches where id = v_m));
    n := n + 1;
  end loop;
end $$;
select pg_temp.play_all('33333333-3333-3333-3333-333333333302');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select array_agg(place order by place) from category_podium('33333333-3333-3333-3333-333333333302')), array[1, 2, 3, 3], 'eight athletes: 1st, 2nd and two shared 3rds');

reset role;
select pg_temp.fill('33333333-3333-3333-3333-333333333303', 'F', 4);
select pg_temp.fill('33333333-3333-3333-3333-333333333304', 'G', 3);
select pg_temp.fill('33333333-3333-3333-3333-333333333305', 'H', 4);
select pg_temp.fill('33333333-3333-3333-3333-333333333306', 'I', 6);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select generate_bracket('33333333-3333-3333-3333-333333333303');
select generate_bracket('33333333-3333-3333-3333-333333333304');
select generate_bracket('33333333-3333-3333-3333-333333333305');
select generate_bracket('33333333-3333-3333-3333-333333333306');
reset role;
select pg_temp.play_all('33333333-3333-3333-3333-333333333303');
select pg_temp.play_all('33333333-3333-3333-3333-333333333304');
select pg_temp.play_all('33333333-3333-3333-3333-333333333305');
select pg_temp.play_all('33333333-3333-3333-3333-333333333306');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select array_agg(place order by place) from category_podium('33333333-3333-3333-3333-333333333303')), array[1, 2, 3, 3], 'four athletes: the semi-final losers share 3rd');
select is((select array_agg(place order by place) from category_podium('33333333-3333-3333-3333-333333333304')), array[1, 2, 3], 'a round robin lists its top three');

select is((select array_agg(place order by place) from category_podium('33333333-3333-3333-3333-333333333305')), array[1, 2, 3], 'a double elimination gives 1st, 2nd and 3rd');

select is((select array_agg(place order by place) from category_podium('33333333-3333-3333-3333-333333333306')), array[1, 2, 3, 3], 'six athletes: a bye in the bronze bout still gives a 3rd');

select * from finish();
rollback;
