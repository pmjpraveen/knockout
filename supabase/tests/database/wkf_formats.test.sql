begin;
select plan(15);

insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000a6', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'wkf@test.dev');
insert into events (id, organizer_id, name, start_date, end_date, status)
values ('11111111-6666-6666-6666-111111111111', '00000000-0000-0000-0000-0000000000a6', 'WKF formats', current_date, current_date, 'registration_closed');

create function pg_temp.category(p_id uuid, p_label text, p_n int, p_format text) returns void language plpgsql as $$
declare v_ce uuid; v_ath uuid; i int;
begin
  insert into categories (id, event_id, label, discipline, status, bracket_format)
  values (p_id, '11111111-6666-6666-6666-111111111111', p_label, 'kumite', 'closed', p_format);
  insert into club_entries (event_id, club_name) values ('11111111-6666-6666-6666-111111111111', p_label) returning id into v_ce;
  for i in 1..p_n loop
    insert into athletes (club_entry_id, full_name) values (v_ce, p_label || ' ' || i) returning id into v_ath;
    insert into registrations (athlete_id, category_id) values (v_ath, p_id);
  end loop;
end $$;
create function pg_temp.play_all(p_cat uuid) returns void language plpgsql as $$
declare v_m uuid; n int := 0;
begin
  loop
    select m.id into v_m from public.matches m join public.brackets b on b.id = m.bracket_id
    where b.category_id = p_cat and m.status = 'scheduled' and m.athlete_a_id is not null and m.athlete_b_id is not null
    order by (m.bracket_side = 'pool') desc, m.round limit 1;
    exit when v_m is null or n > 400;
    perform public.bracket_complete_match(v_m, (select athlete_a_id from public.matches where id = v_m));
    n := n + 1;
  end loop;
end $$;
create function pg_temp.sides(p_cat uuid, p_side text) returns int language sql as $$
  select count(*)::int from public.matches m join public.brackets b on b.id = m.bracket_id where b.category_id = p_cat and m.bracket_side = p_side
$$;

select pg_temp.category('33333333-6666-6666-6666-333333333312', 'Twelve', 12, 'groups_elimination');
select pg_temp.category('33333333-6666-6666-6666-333333333320', 'Twenty', 20, 'groups_elimination');
select pg_temp.category('33333333-6666-6666-6666-333333333306', 'Six', 6, 'groups_elimination');
select pg_temp.category('33333333-6666-6666-6666-333333333304', 'Four', 4, 'groups_elimination');
select pg_temp.category('33333333-6666-6666-6666-333333333308', 'Eight', 8, 'two_pool_round_robin');
select pg_temp.category('33333333-6666-6666-6666-333333333302', 'Two', 2, 'groups_elimination');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a6","role":"authenticated"}', true);
select generate_bracket(id) from categories where event_id = '11111111-6666-6666-6666-111111111111' and label in ('Twelve', 'Twenty', 'Six', 'Four', 'Eight');
select is(pg_temp.sides('33333333-6666-6666-6666-333333333312', 'pool'), 12, '12 athletes: 4 groups of 3, 3 matches each');
select is(pg_temp.sides('33333333-6666-6666-6666-333333333312', 'main'), 0, 'the elimination stage waits for the groups');
select is((select max(pool) from matches m join brackets b on b.id = m.bracket_id where b.category_id = '33333333-6666-6666-6666-333333333320'), 6, '20 athletes: 6 groups');
select throws_ok($$select generate_bracket('33333333-6666-6666-6666-333333333302')$$, 'P0001', 'Round-robin groups followed by elimination take 3 to 32 athletes.', 'two athletes are too few for groups');

reset role;
select pg_temp.play_all('33333333-6666-6666-6666-333333333312');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a6","role":"authenticated"}', true);
select is(pg_temp.sides('33333333-6666-6666-6666-333333333312', 'main'), 7, '4 groups: a quarter-final bracket of 7 matches');
select is(pg_temp.sides('33333333-6666-6666-6666-333333333312', 'repechage_top') + pg_temp.sides('33333333-6666-6666-6666-333333333312', 'repechage_bottom'), 2, 'with a bronze bout on each side');
select is((select count(distinct a)::int from (select athlete_a_id a from matches m join brackets b on b.id = m.bracket_id where b.category_id = '33333333-6666-6666-6666-333333333312' and m.bracket_side = 'main' and m.round = 1 union select athlete_b_id from matches m join brackets b on b.id = m.bracket_id where b.category_id = '33333333-6666-6666-6666-333333333312' and m.bracket_side = 'main' and m.round = 1) x), 8, 'eight different qualifiers');
select is((select count(*)::int from matches m join brackets b on b.id = m.bracket_id where b.category_id = '33333333-6666-6666-6666-333333333312' and m.bracket_side = 'main' and m.round = 1 and (select pool from matches p where p.bracket_id = b.id and p.bracket_side = 'pool' and m.athlete_a_id in (p.athlete_a_id, p.athlete_b_id) limit 1) = (select pool from matches p where p.bracket_id = b.id and p.bracket_side = 'pool' and m.athlete_b_id in (p.athlete_a_id, p.athlete_b_id) limit 1)), 0, 'no quarter-final pairs two athletes from the same group');
reset role;
select pg_temp.play_all('33333333-6666-6666-6666-333333333312');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a6","role":"authenticated"}', true);
select is((select array_agg(place order by place) from category_podium('33333333-6666-6666-6666-333333333312')), array[1, 2, 3, 3], 'two bronze medals after the repechage bouts');

reset role;
select pg_temp.play_all('33333333-6666-6666-6666-333333333320');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a6","role":"authenticated"}', true);
select is(pg_temp.sides('33333333-6666-6666-6666-333333333320', 'main'), 7, '6 groups: winners plus the 2 best runners-up fill 8 places');

reset role;
select pg_temp.play_all('33333333-6666-6666-6666-333333333306');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a6","role":"authenticated"}', true);
select is(pg_temp.sides('33333333-6666-6666-6666-333333333306', 'main'), 3, '2 groups: straight to the semi-finals');
select is((select array_agg(place order by place) from category_podium('33333333-6666-6666-6666-333333333306')), array[1, 2, 3, 3], 'the semi-final losers share 3rd');

reset role;
select pg_temp.play_all('33333333-6666-6666-6666-333333333304');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a6","role":"authenticated"}', true);
select is(pg_temp.sides('33333333-6666-6666-6666-333333333304', 'main'), 1, '1 group: a final');
select is((select array_agg(place order by place) from category_podium('33333333-6666-6666-6666-333333333304')), array[1, 2, 3], 'and one bronze medal from the bronze bout');

reset role;
select pg_temp.play_all('33333333-6666-6666-6666-333333333308');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a6","role":"authenticated"}', true);
select is((select array_agg(place order by place) from category_podium('33333333-6666-6666-6666-333333333308')), array[1, 2], 'two pools: the pool winners play the final, which names gold and silver');

select * from finish();
rollback;
