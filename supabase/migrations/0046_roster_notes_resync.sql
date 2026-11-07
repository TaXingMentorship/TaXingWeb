-- 0046: catch up roster_notes written after 0043, then retire set_roster_note.
--
-- 0043 copied roster_notes into roster_note_entries once. Until the note-thread
-- UI deploys, the old UI keeps writing roster_notes via set_roster_note, and
-- the new UI never reads that table, so those writes would be lost.
--
-- Apply right AFTER the note-thread UI is deployed. Anything the old UI saved
-- in between is copied here; after this, set_roster_note can no longer be
-- called, so a stale tab gets an error instead of writing somewhere unread.
--
-- Idempotent: a roster_notes value is copied only if that member has no entry
-- with the same text. A legacy note edited after 0043 becomes a new entry next
-- to the carried-over one (both are kept; nothing is deleted).

begin;

insert into public.roster_note_entries (profile_id, author_id, body, created_at)
  select n.profile_id, n.updated_by, btrim(n.notes), n.updated_at
  from public.roster_notes n
  where n.notes is not null
    and btrim(n.notes) <> ''
    and not exists (
      select 1 from public.roster_note_entries e
      where e.profile_id = n.profile_id
        and btrim(e.body) = btrim(n.notes)
    );

revoke execute on function public.set_roster_note(uuid, uuid, text) from authenticated;

commit;
