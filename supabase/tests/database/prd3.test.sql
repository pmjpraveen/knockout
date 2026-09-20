begin;
select plan(29);

insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'org@test.dev'),
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'td@test.dev');

insert into events (id, organizer_id, name, start_date, end_date, status)
values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000a', 'Draw', current_date, current_date, 'registration_closed');
insert into event_members (event_id, user_id, role)
values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-00000000000c', 'tournament_director');

-- n athletes ("Ath 1".."Ath n") spread over p clubs, registered in the category
create function pg_temp.fill(p_cat uuid, p_n int, p_clubs int) returns void language plpgsql as $$
declare v_ce uuid[] := '{}'; v_id uuid; v_ath uuid; i int;
begin
  for i in 1..p_clubs loop
    insert into club_entries (event_id, club_name) values ('11111111-1111-1111-1111-111111111111', 'Club ' || i) returning id into v_id;
    v_ce := v_ce || v_id;
  end loop;
  for i in 1..p_n loop
    insert into athletes (club_entry_id, full_name) values (v_ce[(i - 1) % p_clubs + 1], 'Ath ' || lpad(i::text, 2, '0')) returning id into v_ath;
    insert into registrations (athlete_id, category_id) values (v_ath, p_cat);
  end loop;
end $$;

-- plays every ready match: slot a wins (slot b in the grand final when p_lb_wins)
create function pg_temp.play(p_bracket uuid, p_lb_wins boolean default false) returns void language plpgsql as $$
declare v_m matches;
begin
  loop
    select * into v_m from matches where bracket_id = p_bracket and status = 'scheduled'
      and athlete_a_id is not null and athlete_b_id is not null order by round, position limit 1;
    exit when not found;
    perform bracket_complete_match(v_m.id, case when p_lb_wins and v_m.bracket_side = 'grand_final' then v_m.athlete_b_id else v_m.athlete_a_id end);
  end loop;
end $$;

insert into categories (id, event_id, label, discipline, status, bracket_format)
select ('33333333-3333-3333-3333-3333333333' || lpad(n::text, 2, '0'))::uuid, '11111111-1111-1111-1111-111111111111', 'C' || n, 'kumite', 'closed', f
from (values (1,'single_elim_repechage'),(2,'single_elim_repechage'),(3,'single_elim_repechage'),(4,'round_robin'),(5,'round_robin'),
             (6,'double_elim'),(7,'double_elim'),(8,'single_elim_repechage'),(9,'round_robin'),(10,'single_elim_repechage')) v(n, f);
select pg_temp.fill('33333333-3333-3333-3333-333333333301', 8, 8);
select pg_temp.fill('33333333-3333-3333-3333-333333333302', 5, 5);
select pg_temp.fill('33333333-3333-3333-3333-333333333303', 4, 2);
select pg_temp.fill('33333333-3333-3333-3333-333333333304', 5, 5);
select pg_temp.fill('33333333-3333-3333-3333-333333333305', 9, 9);
select pg_temp.fill('33333333-3333-3333-3333-333333333306', 8, 8);
select pg_temp.fill('33333333-3333-3333-3333-333333333307', 4, 4);
select pg_temp.fill('33333333-3333-3333-3333-333333333308', 4, 4);
select pg_temp.fill('33333333-3333-3333-3333-333333333309', 3, 3);
select pg_temp.fill('33333333-3333-3333-3333-333333333310', 10, 10);

select is(bracket_seed_order(8), array[1,8,4,5,2,7,3,6], 'seed order pairs 1v8, 4v5, 2v7, 3v6');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

-- C1: 8 athletes, single elimination + repechage
create temp table b1 as select generate_bracket('33333333-3333-3333-3333-333333333301') as id;
grant select on b1 to authenticated;
select is((select count(*)::int from matches where bracket_id = (select id from b1) and bracket_side = 'main'), 7, '8 athletes: 7 main-bracket matches');
select is((select count(*)::int from matches where bracket_id = (select id from b1) and is_repechage), 2, 'one repechage bout per finalist');
select is((select status from categories where id = '33333333-3333-3333-3333-333333333301'), 'bracket_generated', 'generating moves the category on');
reset role;
select pg_temp.play((select id from b1));
select is((select count(*)::int from matches where bracket_id = (select id from b1) and status = 'scheduled'), 0, 'a played-out bracket has nothing left scheduled');
select ok((select bool_and(exists (
    select 1 from matches m
    where m.bracket_id = (select id from b1) and m.bracket_side = 'main' and m.status = 'completed'
      and m.winner_id = (select winner_id from matches where bracket_id = (select id from b1) and bracket_side = 'main' and round = 2 and position = 1)
      and x in (m.athlete_a_id, m.athlete_b_id) and x <> m.winner_id))
  from (select athlete_a_id x from matches where bracket_id = (select id from b1) and bracket_side = 'repechage_top'
        union all select athlete_b_id from matches where bracket_id = (select id from b1) and bracket_side = 'repechage_top') q),
  'the top ladder holds only athletes the finalist beat');
select is((select count(distinct winner_id)::int from matches where bracket_id = (select id from b1) and is_repechage), 2, 'two distinct bronze winners');

-- C2: 5 athletes with 3 manual seeds: byes go to the top seeds
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select set_seeds('33333333-3333-3333-3333-333333333302',
  array(select r.id from registrations r join athletes a on a.id = r.athlete_id
        where r.category_id = '33333333-3333-3333-3333-333333333302' and a.full_name in ('Ath 01','Ath 02','Ath 03') order by a.full_name));
create temp table b2 as select generate_bracket('33333333-3333-3333-3333-333333333302') as id;
grant select on b2 to authenticated;
select is((select array_agg(a.full_name order by a.full_name) from matches m join athletes a on a.id = m.winner_id
          where m.bracket_id = (select id from b2) and m.status = 'bye' and m.round = 1), array['Ath 01','Ath 02','Ath 03'],
  '5 athletes: the three seeded athletes get the byes');
reset role;
select pg_temp.play((select id from b2));
select is((select count(*)::int from matches where bracket_id = (select id from b2) and status = 'scheduled'), 0, 'a bracket with byes plays out completely');

-- C3: same-club first-round pairings are avoided
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
create temp table b3 as select generate_bracket('33333333-3333-3333-3333-333333333303') as id;
grant select on b3 to authenticated;
reset role;
select is((select count(*)::int from matches m
           join athletes a on a.id = m.athlete_a_id join athletes b on b.id = m.athlete_b_id
           where m.bracket_id = (select id from b3) and m.round = 1 and a.club_entry_id = b.club_entry_id), 0,
  '4 athletes from 2 clubs: no same-club first-round match');

-- round robin
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
create temp table b4 as select generate_bracket('33333333-3333-3333-3333-333333333304') as id;
create temp table b5 as select generate_bracket('33333333-3333-3333-3333-333333333305') as id;
grant select on b4, b5 to authenticated;
select is((select count(*)::int from matches where bracket_id = (select id from b4)), 10, '5 athletes: one pool, 10 matches');
select is((select count(distinct pool)::int from matches where bracket_id = (select id from b5)), 2, '9 athletes: two pools');
select is((select count(*)::int from matches where bracket_id = (select id from b5)), 16, '9 athletes in pools of 5 and 4: 10 + 6 matches');

-- double elimination
create temp table b6 as select generate_bracket('33333333-3333-3333-3333-333333333306') as id;
create temp table b7 as select generate_bracket('33333333-3333-3333-3333-333333333307') as id;
grant select on b6, b7 to authenticated;
select is((select count(*)::int from matches where bracket_id = (select id from b6)), 15, '8 athletes: 7 winners + 6 losers + final + reset');
reset role;
select pg_temp.play((select id from b6));
select is((select count(*)::int from matches where bracket_id = (select id from b6) and status = 'scheduled'), 0, 'double elimination plays out');
select is((select status from matches where bracket_id = (select id from b6) and bracket_side = 'reset'), 'bye',
  'no reset match when the winners-bracket finalist wins the final');
select pg_temp.play((select id from b7), true);
select is((select status from matches where bracket_id = (select id from b7) and bracket_side = 'reset'), 'completed',
  'the reset match is played when the losers-bracket finalist wins the final');

-- 10 athletes: seeds 3-6 all have byes, so 4v5 and 3v6 meet in round 2 (real matches, not byes)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
create temp table b10 as select generate_bracket('33333333-3333-3333-3333-333333333310') as id;
grant select on b10 to authenticated;
select is((select count(*)::int from matches where bracket_id = (select id from b10) and round = 2 and status = 'bye'), 0,
  'two adjacent round-1 byes do not turn the round-2 match into a bye');
select is((select count(*)::int from matches where bracket_id = (select id from b10) and round = 2 and status = 'scheduled'
           and athlete_a_id is not null and athlete_b_id is not null), 2, 'seeds 4v5 and 3v6 are both ready to play in round 2');
reset role;

-- pool standings
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
create temp table b9 as select generate_bracket('33333333-3333-3333-3333-333333333309') as id;
grant select on b9 to authenticated;
reset role;
select pg_temp.play((select id from b9));
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select wins from pool_standings((select id from b9)) where rank = 1), 2, 'the pool leader has beaten everyone');
select is((select array_agg(wins order by wins) from pool_standings((select id from b9))), array[0,1,2], 'standings rank 2-1-0 records');

-- regeneration and overrides
create temp table b8 as select generate_bracket('33333333-3333-3333-3333-333333333308') as id;
grant select on b8 to authenticated;
select lives_ok($$select generate_bracket('33333333-3333-3333-3333-333333333308')$$, 'a bracket regenerates freely before any match starts');
select is((select count(*)::int from brackets where category_id = '33333333-3333-3333-3333-333333333308'), 1, 'regenerating replaces the bracket');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$select generate_bracket('33333333-3333-3333-3333-333333333308')$$, '42501', null, 'a tournament director cannot generate brackets');

reset role;
select bracket_complete_match((select id from matches where bracket_id = (select id from brackets where category_id = '33333333-3333-3333-3333-333333333308') and round = 1 and position = 1),
  (select athlete_a_id from matches where bracket_id = (select id from brackets where category_id = '33333333-3333-3333-3333-333333333308') and round = 1 and position = 1));
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$select generate_bracket('33333333-3333-3333-3333-333333333308')$$, 'P0001', null, 'regeneration is refused once a match has been played');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$select withdraw_athlete((select id from brackets where category_id = '33333333-3333-3333-3333-333333333308'),
  (select athlete_a_id from matches where bracket_id = (select id from brackets where category_id = '33333333-3333-3333-3333-333333333308') and round = 1 and position = 2), ' ')$$,
  'P0001', null, 'a withdrawal needs a note');
select lives_ok($$select withdraw_athlete((select id from brackets where category_id = '33333333-3333-3333-3333-333333333308'),
  (select athlete_a_id from matches where bracket_id = (select id from brackets where category_id = '33333333-3333-3333-3333-333333333308') and round = 1 and position = 2), 'Injured')$$,
  'a tournament director records a withdrawal');
reset role;
select is((select status from matches where bracket_id = (select id from brackets where category_id = '33333333-3333-3333-3333-333333333308') and round = 1 and position = 2), 'completed',
  'the withdrawn athlete''s match becomes a walkover');
select is((select reason from audit_log where action = 'withdraw_athlete'), 'Injured', 'the override is audit-logged');

select * from finish();
rollback;
