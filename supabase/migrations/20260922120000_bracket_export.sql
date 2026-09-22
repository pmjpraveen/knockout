-- Lets any event member (including a scorekeeper, who has no direct read access to the athletes table) see a
-- bracket's matches with athlete names, and a category's registered participants. Both back the bracket screen
-- and its PDF export. Security-definer, so it does not need to widen athletes/club_entries RLS: only names and
-- club names are exposed here, never date of birth, weight or belt, which stay organizer-only.

create function bracket_matches(p_bracket_id uuid)
returns table (
  id uuid, round int, "position" int, bracket_side text, pool int, status text, is_repechage boolean,
  athlete_a_id uuid, athlete_a text, athlete_b_id uuid, athlete_b text, winner_id uuid
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_event_member(public.bracket_event_id(p_bracket_id)) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
  select m.id, m.round, m.position, m.bracket_side, m.pool, m.status, m.is_repechage,
         m.athlete_a_id, na.full_name, m.athlete_b_id, nb.full_name, m.winner_id
  from public.matches m
  left join public.athletes na on na.id = m.athlete_a_id
  left join public.athletes nb on nb.id = m.athlete_b_id
  where m.bracket_id = p_bracket_id
  order by m.bracket_side, m.round, m.position;
end;
$$;

create function category_participants(p_category_id uuid)
returns table (athlete_id uuid, full_name text, club_name text, seed int)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_event_member(public.category_event_id(p_category_id)) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
  select a.id, a.full_name, ce.club_name, r.seed
  from public.registrations r
  join public.athletes a on a.id = r.athlete_id
  join public.club_entries ce on ce.id = a.club_entry_id
  where r.category_id = p_category_id
  order by r.seed nulls last, a.full_name;
end;
$$;

revoke all on function bracket_matches(uuid), category_participants(uuid) from public, anon;
grant execute on function bracket_matches(uuid), category_participants(uuid) to authenticated;

-- A scorekeeper can now see brackets (via bracket_matches above), so the category list's participant counts
-- should be accurate for them too. registrations holds no personal detail itself (that's on athletes, still
-- organizer-only), so this widens who can count rows, not who can read names, dates of birth or weights.
drop policy registrations_select on registrations;
create policy registrations_select on registrations for select to authenticated
  using (is_event_member(category_event_id(category_id), array['organizer', 'tournament_director', 'scorekeeper']));
