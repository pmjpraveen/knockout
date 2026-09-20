-- Accounts created through Google (or any provider) never chose an account type at sign-up.
-- They start unconfirmed and pick once, right after their first sign-in; after that it is locked.

alter table profiles add column type_confirmed boolean not null default true; -- existing accounts are confirmed

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (user_id, account_type, type_confirmed)
  values (
    new.id,
    case when new.raw_user_meta_data ->> 'account_type' = 'organizer' then 'organizer' else 'staff' end,
    coalesce(new.raw_user_meta_data ? 'account_type', false)
  );
  return new;
end;
$$;

create function set_account_type(p_account_type text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_account_type not in ('organizer', 'staff') then
    raise exception 'Account type must be organizer or staff';
  end if;
  update public.profiles set account_type = p_account_type, type_confirmed = true
  where user_id = auth.uid() and not type_confirmed;
  if not found then
    raise exception 'Account type is already set';
  end if;
end;
$$;

revoke all on function set_account_type(text) from public, anon;
grant execute on function set_account_type(text) to authenticated;
