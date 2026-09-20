-- The full-screen scoreboard shows each competitor's club under their name.
drop function tatami_scoreboard(uuid);

create function tatami_scoreboard(p_tatami_id uuid)
returns table (
  match_id uuid, queue_position int, bracket_side text, round int, match_status text,
  category_id uuid, category_label text, discipline text, scoring_mode text, match_seconds int, judge_panel int,
  athlete_a_id uuid, athlete_a text, athlete_b_id uuid, athlete_b text,
  scoring_device_id text, tatami_name text, tatami_status text,
  club_a text, club_b text
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_event uuid;
begin
  select event_id into v_event from public.tatamis where id = p_tatami_id;
  if v_event is null or not exists (
    select 1 from public.event_members em
    where em.event_id = v_event and em.user_id = auth.uid()
      and (em.role in ('organizer', 'tournament_director') or (em.role = 'scorekeeper' and em.tatami_id = p_tatami_id))
  ) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  return query
  select m.id, (row_number() over (order by (m.status = 'in_progress') desc, m.queue_order))::int,
         m.bracket_side, m.round, m.status, c.id, c.label, c.discipline,
         public.scoring_effective_mode(c),
         coalesce(c.match_seconds,
           (case c.discipline when 'kumite' then e.kumite_minutes when 'kata' then e.kata_minutes else e.team_minutes end * 60)::int),
         c.judge_panel,
         m.athlete_a_id, na.full_name, m.athlete_b_id, nb.full_name,
         m.scoring_device_id, t.name, t.status,
         ca.club_name, cb.club_name
  from public.matches m
  join public.brackets b on b.id = m.bracket_id
  join public.categories c on c.id = b.category_id
  join public.events e on e.id = c.event_id
  join public.tatamis t on t.id = m.tatami_id
  join public.athletes na on na.id = m.athlete_a_id
  join public.athletes nb on nb.id = m.athlete_b_id
  join public.club_entries ca on ca.id = na.club_entry_id
  join public.club_entries cb on cb.id = nb.club_entry_id
  where m.tatami_id = p_tatami_id and m.status in ('scheduled', 'in_progress')
  order by 2
  limit 12;
end;
$$;

revoke all on function tatami_scoreboard(uuid) from public, anon, authenticated;
grant execute on function tatami_scoreboard(uuid) to authenticated;
