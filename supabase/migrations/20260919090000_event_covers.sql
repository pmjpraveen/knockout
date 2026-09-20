-- A tournament's cover image. It lives in its own table rather than in Storage so that it cascades from events
-- like every other table: the nightly purge deletes it with the event, and no file is left behind. The app
-- resizes it to a small JPEG on the device and it is only read on the event screen, so event lists stay light.
create table event_covers (
  event_id uuid primary key references events(id) on delete cascade,
  image text not null check (image like 'data:image/jpeg;base64,%' and length(image) <= 400000),
  updated_at timestamptz not null default now()
);

alter table event_covers enable row level security;

create policy event_covers_select on event_covers for select to authenticated
  using (is_event_member(event_id));
create policy event_covers_write on event_covers for all to authenticated
  using (is_event_member(event_id, array['organizer']))
  with check (is_event_member(event_id, array['organizer']));
