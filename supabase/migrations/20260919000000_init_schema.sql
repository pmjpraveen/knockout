create extension if not exists "pgcrypto";

create table events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references auth.users(id),
  name text not null,
  venue text,
  start_date date not null,
  end_date date not null,
  host_club text,
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  status text not null default 'draft'
    check (status in ('draft','registration_open','registration_closed','in_progress','completed')),
  completed_at timestamptz,
  purge_at timestamptz, -- completed_at + interval '7 days'
  created_at timestamptz not null default now()
);

create table event_members (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('organizer','tournament_director','scorekeeper')),
  tatami_id uuid, -- fk added below, after tatamis exists
  created_at timestamptz not null default now(),
  unique (event_id, user_id, role)
);

create table registration_links (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  token text not null unique,
  is_active boolean not null default true,
  regenerated_count int not null default 0,
  created_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  label text not null,
  discipline text not null check (discipline in ('kumite','kata','team')),
  gender text check (gender in ('male','female','mixed')),
  age_min int,
  age_max int,
  weight_min numeric,
  weight_max numeric,
  belt_min text,
  belt_max text,
  bracket_format text check (bracket_format in ('single_elim_repechage','round_robin','double_elim')),
  status text not null default 'draft'
    check (status in ('draft','open','closed','bracket_generated','in_progress','completed')),
  created_at timestamptz not null default now()
);

create table club_entries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  club_name text not null,
  club_contact text,
  approval_status text not null default 'submitted'
    check (approval_status in ('submitted','approved','rejected')),
  rejection_reason text,
  submitted_at timestamptz not null default now(),
  approved_at timestamptz
);

create table athletes (
  id uuid primary key default gen_random_uuid(),
  club_entry_id uuid not null references club_entries(id) on delete cascade,
  full_name text not null,
  date_of_birth date,
  gender text,
  weight numeric,
  belt_rank text,
  created_at timestamptz not null default now()
);

create table registrations (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  seed int,
  weigh_in_status text check (weigh_in_status in ('pending','confirmed','flagged')),
  submitted_by text not null default 'club' check (submitted_by in ('club','organizer')),
  overridden_by_organizer boolean not null default false,
  override_reason text,
  created_at timestamptz not null default now(),
  unique (athlete_id, category_id)
);

create table tatamis (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  status text not null default 'active' check (status in ('active','paused')),
  created_at timestamptz not null default now()
);

alter table event_members
  add constraint event_members_tatami_fk foreign key (tatami_id) references tatamis(id) on delete set null;

create table brackets (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null unique references categories(id) on delete cascade,
  format text not null,
  rounds int,
  repechage boolean not null default false,
  status text not null default 'draft' check (status in ('draft','in_progress','completed')),
  created_at timestamptz not null default now()
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  bracket_id uuid not null references brackets(id) on delete cascade,
  round int not null,
  athlete_a_id uuid references athletes(id),
  athlete_b_id uuid references athletes(id),
  tatami_id uuid references tatamis(id) on delete set null,
  scheduled_time timestamptz,
  status text not null default 'scheduled'
    check (status in ('scheduled','in_progress','completed','bye')),
  winner_id uuid references athletes(id),
  is_repechage boolean not null default false,
  created_at timestamptz not null default now()
);

create table score_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  athlete_id uuid not null references athletes(id),
  type text not null
    check (type in ('ippon','waza_ari','yuko','penalty','kata_score','win_loss')),
  value numeric,
  device_id text not null,
  client_timestamp timestamptz not null,
  server_sequence bigserial,
  created_at timestamptz not null default now()
);

create index on event_members (event_id, user_id);
create index on categories (event_id);
create index on club_entries (event_id, approval_status);
create index on athletes (club_entry_id);
create index on registrations (category_id);
create index on matches (bracket_id, tatami_id);
create index on score_events (match_id, server_sequence);

-- Row Level Security -------------------------------------------------------
-- Helpers are security definer so policies can read event_members without
-- recursing into its own RLS.

create function is_event_member(
  p_event_id uuid,
  p_roles text[] default array['organizer','tournament_director','scorekeeper']
) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.event_members m
    where m.event_id = p_event_id
      and m.user_id = (select auth.uid())
      and m.role = any (p_roles)
  );
$$;

create function category_event_id(p_category_id uuid) returns uuid
language sql stable security definer set search_path = ''
as $$ select event_id from public.categories where id = p_category_id; $$;

create function bracket_event_id(p_bracket_id uuid) returns uuid
language sql stable security definer set search_path = ''
as $$
  select c.event_id from public.brackets b
  join public.categories c on c.id = b.category_id
  where b.id = p_bracket_id;
$$;

create function club_entry_event_id(p_club_entry_id uuid) returns uuid
language sql stable security definer set search_path = ''
as $$ select event_id from public.club_entries where id = p_club_entry_id; $$;

-- Organizer/TD of the match's event, or the Scorekeeper assigned to its tatami.
create function can_score_match(p_match_id uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.matches m
    join public.brackets b on b.id = m.bracket_id
    join public.categories c on c.id = b.category_id
    join public.event_members em on em.event_id = c.event_id
    where m.id = p_match_id
      and em.user_id = (select auth.uid())
      and (
        em.role in ('organizer','tournament_director')
        or (em.role = 'scorekeeper' and em.tatami_id = m.tatami_id)
      )
  );
$$;

-- The creator is always the event's first Organizer member.
create function add_organizer_member() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.event_members (event_id, user_id, role)
  values (new.id, new.organizer_id, 'organizer');
  return new;
end;
$$;

create trigger events_add_organizer_member
  after insert on events
  for each row execute function add_organizer_member();

alter table events enable row level security;
alter table event_members enable row level security;
alter table registration_links enable row level security;
alter table categories enable row level security;
alter table club_entries enable row level security;
alter table athletes enable row level security;
alter table registrations enable row level security;
alter table tatamis enable row level security;
alter table brackets enable row level security;
alter table matches enable row level security;
alter table score_events enable row level security;

-- events
create policy events_select on events for select to authenticated
  using (organizer_id = (select auth.uid()) or is_event_member(id));
create policy events_insert on events for insert to authenticated
  with check (organizer_id = (select auth.uid()));
create policy events_update on events for update to authenticated
  using (is_event_member(id, array['organizer']))
  with check (is_event_member(id, array['organizer']));
create policy events_delete on events for delete to authenticated
  using (is_event_member(id, array['organizer']));

-- event_members: staff see their event's roster; only the Organizer manages it
create policy event_members_select on event_members for select to authenticated
  using (is_event_member(event_id));
create policy event_members_write on event_members for all to authenticated
  using (is_event_member(event_id, array['organizer']))
  with check (is_event_member(event_id, array['organizer']));

-- registration_links: Organizer only (clubs go through the Edge Function)
create policy registration_links_organizer on registration_links for all to authenticated
  using (is_event_member(event_id, array['organizer']))
  with check (is_event_member(event_id, array['organizer']));

-- categories: everyone on the event reads; only the Organizer edits
create policy categories_select on categories for select to authenticated
  using (is_event_member(event_id));
create policy categories_write on categories for all to authenticated
  using (is_event_member(event_id, array['organizer']))
  with check (is_event_member(event_id, array['organizer']));

-- club_entries / athletes: no public policy; the Organizer reviews and edits
create policy club_entries_organizer on club_entries for all to authenticated
  using (is_event_member(event_id, array['organizer']))
  with check (is_event_member(event_id, array['organizer']));
create policy athletes_organizer on athletes for all to authenticated
  using (is_event_member(club_entry_event_id(club_entry_id), array['organizer']))
  with check (is_event_member(club_entry_event_id(club_entry_id), array['organizer']));

-- registrations: Organizer edits; Tournament Director reads for ring operations
create policy registrations_select on registrations for select to authenticated
  using (is_event_member(category_event_id(category_id), array['organizer','tournament_director']));
create policy registrations_write on registrations for all to authenticated
  using (is_event_member(category_event_id(category_id), array['organizer']))
  with check (is_event_member(category_event_id(category_id), array['organizer']));

-- tatamis
create policy tatamis_select on tatamis for select to authenticated
  using (is_event_member(event_id));
create policy tatamis_write on tatamis for all to authenticated
  using (is_event_member(event_id, array['organizer','tournament_director']))
  with check (is_event_member(event_id, array['organizer','tournament_director']));

-- brackets
create policy brackets_select on brackets for select to authenticated
  using (is_event_member(category_event_id(category_id)));
create policy brackets_write on brackets for all to authenticated
  using (is_event_member(category_event_id(category_id), array['organizer','tournament_director']))
  with check (is_event_member(category_event_id(category_id), array['organizer','tournament_director']));

-- matches: Scorekeeper may update only matches on their assigned tatami
create policy matches_select on matches for select to authenticated
  using (is_event_member(bracket_event_id(bracket_id)));
create policy matches_insert on matches for insert to authenticated
  with check (is_event_member(bracket_event_id(bracket_id), array['organizer','tournament_director']));
create policy matches_delete on matches for delete to authenticated
  using (is_event_member(bracket_event_id(bracket_id), array['organizer','tournament_director']));
create policy matches_update on matches for update to authenticated
  using (can_score_match(id))
  -- checks the new row: can_score_match(id) would only see the old tatami_id
  with check (
    is_event_member(bracket_event_id(bracket_id), array['organizer','tournament_director'])
    or exists (
      select 1 from event_members em
      where em.event_id = bracket_event_id(bracket_id)
        and em.user_id = (select auth.uid())
        and em.role = 'scorekeeper'
        and em.tatami_id = matches.tatami_id
    )
  );

-- score_events: append-only, so no update or delete policy exists
create policy score_events_select on score_events for select to authenticated
  using (can_score_match(match_id));
create policy score_events_insert on score_events for insert to authenticated
  with check (can_score_match(match_id));

-- Realtime, scoped to the tables the app subscribes to
alter publication supabase_realtime add table categories, tatamis, matches, club_entries;

-- Retention: every table cascades from events, so one delete purges everything
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'purge-expired-events',
  '0 3 * * *',
  $$ delete from events where purge_at is not null and purge_at < now(); $$
);
