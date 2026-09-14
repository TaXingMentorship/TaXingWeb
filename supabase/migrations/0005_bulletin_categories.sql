-- New bulletin categories for the Padlet-style board redesign.
--
-- IMPORTANT: run this file on its own and let it COMMIT before running
-- 0006_bulletin_padlet.sql. Postgres cannot use an enum value that was added
-- in the same transaction, and the Supabase SQL editor wraps a run in one.

alter type bulletin_category add value if not exists 'question';     -- 提问
alter type bulletin_category add value if not exists 'feedback';     -- 反馈与建议
alter type bulletin_category add value if not exists 'expectation';  -- 期待
alter type bulletin_category add value if not exists 'reflection';   -- 感想
