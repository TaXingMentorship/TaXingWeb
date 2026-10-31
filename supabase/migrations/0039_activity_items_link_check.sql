-- Tighten the link checks on activity_items (0038).
--
-- 0038 accepted anything starting with `http(s)://`, including a bare
-- `http://`, which renders as a 会议链接 button that leads nowhere. A link now
-- needs a host and no whitespace — the same rule the dialog applies
-- (HTTP_URL in ActivityItemDialog.tsx).
--
-- Optional links that fail the new rule are cleared first, so the constraints
-- validate against existing rows. `url` is required on link rows and is not
-- touched: if one fails, adding its constraint errors and names it.

update public.activity_items
set meeting_url = null
where meeting_url is not null
  and meeting_url !~* '^https?://[^[:space:]/]+[^[:space:]]*$';

update public.activity_items
set recording_url = null
where recording_url is not null
  and recording_url !~* '^https?://[^[:space:]/]+[^[:space:]]*$';

alter table public.activity_items
  drop constraint if exists activity_items_url_check,
  drop constraint if exists activity_items_meeting_url_check,
  drop constraint if exists activity_items_recording_url_check;

alter table public.activity_items
  add constraint activity_items_url_check
    check (url ~* '^https?://[^[:space:]/]+[^[:space:]]*$'),
  add constraint activity_items_meeting_url_check
    check (meeting_url ~* '^https?://[^[:space:]/]+[^[:space:]]*$'),
  add constraint activity_items_recording_url_check
    check (recording_url ~* '^https?://[^[:space:]/]+[^[:space:]]*$');
