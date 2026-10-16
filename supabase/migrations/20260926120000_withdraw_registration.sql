-- Taking an athlete out of a category before the draw now needs a reason and leaves a trace in the audit log, like
-- every other organizer change. Once matches have started the bracket's withdrawal override applies instead.
create function withdraw_registration(p_registration_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_athlete uuid;
  v_name text;
  v_entry uuid;
  v_category uuid;
  v_label text;
  v_event uuid;
begin
  select r.athlete_id, a.full_name, a.club_entry_id, r.category_id, c.label, c.event_id
  into v_athlete, v_name, v_entry, v_category, v_label, v_event
  from public.registrations r
  join public.athletes a on a.id = r.athlete_id
  join public.categories c on c.id = r.category_id
  where r.id = p_registration_id;
  if v_event is null or not public.is_event_member(v_event, array['organizer']) then
    raise exception 'Only the organizer can withdraw an athlete' using errcode = '42501';
  end if;
  perform public.assert_event_writable(v_event);
  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'A reason is required to withdraw an athlete';
  end if;
  if exists (select 1 from public.matches m join public.brackets b on b.id = m.bracket_id
             where b.category_id = v_category and m.status in ('in_progress', 'completed')) then
    raise exception 'Matches have started. Use a withdrawal override on the bracket instead.';
  end if;

  delete from public.registrations where id = p_registration_id;

  insert into public.audit_log (event_id, actor_id, action, subject_id, reason, changes)
  values (v_event, auth.uid(), 'withdraw_registration', v_entry, btrim(p_reason),
          jsonb_build_object('athlete_id', v_athlete, 'athlete_name', v_name, 'category_id', v_category, 'category_label', v_label));
end;
$$;

revoke all on function withdraw_registration(uuid, text) from public, anon;
grant execute on function withdraw_registration(uuid, text) to authenticated;
