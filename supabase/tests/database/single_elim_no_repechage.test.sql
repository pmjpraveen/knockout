begin;
select plan(6);

insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'org@test.dev');
insert into events (id, organizer_id, name, start_date, end_date, status)
values ('11111111-5555-5555-5555-111111111111', '00000000-0000-0000-0000-00000000000a', 'Plain', current_date, current_date, 'registration_closed');
insert into categories (id, event_id, label, discipline, status, bracket_format) values
  ('33333333-5555-5555-5555-333333333301', '11111111-5555-5555-5555-111111111111', 'Four', 'kumite', 'closed', 'single_elim');

create function pg_temp.fill(p_cat uuid, p_n int, p_prefix text) returns void language plpgsql as $$
declare v_ce uuid; v_ath uuid; i int;
begin
  insert into club_entries (event_id, club_name) values ('11111111-5555-5555-5555-111111111111', p_prefix) returning id into v_ce;
  for i in 1..p_n loop
    insert into athletes (club_entry_id, full_name) values (v_ce, p_prefix || ' ' || i) returning id into v_ath;
    insert into registrations (athlete_id, category_id) values (v_ath, p_cat);
  end loop;
end $$;
select pg_temp.fill('33333333-5555-5555-5555-333333333301', 4, 'P');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$select generate_bracket('33333333-5555-5555-5555-333333333301')$$, 'single_elim generates a bracket like the others');
select is((select count(*)::int from matches m join brackets b on b.id = m.bracket_id where b.category_id = '33333333-5555-5555-5555-333333333301' and m.bracket_side <> 'main'), 0, 'no repechage matches are created');
select is((select repechage from brackets where category_id = '33333333-5555-5555-5555-333333333301'), false);

reset role;
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
select pg_temp.play_all('33333333-5555-5555-5555-333333333301');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select array_agg(place order by place) from category_podium('33333333-5555-5555-5555-333333333301')), array[1, 2, 3, 3], 'both semi-final losers share 3rd, with no bronze bout played');

select throws_ok($$select generate_bracket('33333333-5555-5555-5555-333333333301', 'not_a_format')$$, null, 'Choose a bracket format', 'an unknown format is still refused');

reset role;
insert into events (id, organizer_id, name, start_date, end_date, status) values ('11111111-5555-5555-5555-111111111112', '00000000-0000-0000-0000-00000000000a', 'Draft import', current_date, current_date, 'draft');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$select import_categories('11111111-5555-5555-5555-111111111112', jsonb_build_array(jsonb_build_object('label','X','discipline','kumite','bracket_format','single_elim')))$$,
  'a sheet import accepts the new format');

select * from finish();
rollback;
