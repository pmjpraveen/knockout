-- "Save & exit" in the create flow keeps a draft event with only what was entered, so a draft may have no dates.
-- Once an event leaves draft it must have both.
alter table events
  alter column start_date drop not null,
  alter column end_date drop not null,
  add constraint events_dates_required_after_draft check (status = 'draft' or (start_date is not null and end_date is not null));

-- A small copy of the cover for the events list, so listing events never downloads the full image.
alter table event_covers
  add column thumb text check (thumb is null or (thumb like 'data:image/jpeg;base64,%' and length(thumb) <= 150000));
