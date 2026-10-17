-- A person's own profile photo, as a small JPEG data URI like event covers. It lives here, not in the sign-in
-- metadata, because that metadata travels inside every access token. Only this function writes it: a person may
-- change their photo but never their account type.
alter table profiles add column avatar text check (avatar is null or (length(avatar) <= 100000 and avatar like 'data:image/jpeg;base64,%'));

create function set_avatar(p_image text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  update public.profiles set avatar = p_image where user_id = auth.uid();
end;
$$;

revoke all on function set_avatar(text) from public, anon;
grant execute on function set_avatar(text) to authenticated;
