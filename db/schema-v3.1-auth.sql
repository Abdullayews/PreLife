-- ═══════════════════════════════════════════════════════════════════════════
-- PreLife — v3.1 auth migration (login verification fully in the database)
--
-- Applies ON TOP of db/schema-v3.sql:
--   node scripts/apply-db.mjs v3.1
--
-- What this file does:
--   1. sessions gains user_email / user_name — the GoTrue response rides
--      on the session row so the API needs no extra lookup per request.
--   2. Every session / user-data row that still points at a legacy v2
--      users row is deleted (they were all preview sessions).
--   3. The six user_id foreign keys are re-pointed from public.users to
--      auth.users — one account source, deletes cascade everywhere.
--   4. The legacy custom-auth table public.users (scrypt hashes) is dropped.
--
-- After this, accounts live only in auth.users + profiles, and passwords
-- are verified by GoTrue (the Rust API calls the admin/token endpoints).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Sessions carry the user snapshot (written at login/signup).
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS user_email text;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS user_name text;

-- 2. Purge rows owned by legacy v2 users (no real data).
DELETE FROM public.sessions            WHERE user_id NOT IN (SELECT id FROM auth.users);
DELETE FROM public.journal_entries_v2  WHERE user_id NOT IN (SELECT id FROM auth.users);
DELETE FROM public.mood_logs           WHERE user_id NOT IN (SELECT id FROM auth.users);
DELETE FROM public.quiz_results        WHERE user_id NOT IN (SELECT id FROM auth.users);
DELETE FROM public.meditation_progress WHERE user_id NOT IN (SELECT id FROM auth.users);
DELETE FROM public.appointments        WHERE user_id NOT IN (SELECT id FROM auth.users);

-- 3. One account source: auth.users.
ALTER TABLE public.sessions DROP CONSTRAINT sessions_user_id_fkey,
  ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id)
  REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.journal_entries_v2 DROP CONSTRAINT journal_entries_user_id_fkey,
  ADD CONSTRAINT journal_entries_user_id_fkey FOREIGN KEY (user_id)
  REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.mood_logs DROP CONSTRAINT mood_logs_user_id_fkey,
  ADD CONSTRAINT mood_logs_user_id_fkey FOREIGN KEY (user_id)
  REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.quiz_results DROP CONSTRAINT quiz_results_user_id_fkey,
  ADD CONSTRAINT quiz_results_user_id_fkey FOREIGN KEY (user_id)
  REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.meditation_progress DROP CONSTRAINT meditation_progress_user_id_fkey,
  ADD CONSTRAINT meditation_progress_user_id_fkey FOREIGN KEY (user_id)
  REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.appointments DROP CONSTRAINT appointments_user_id_fkey,
  ADD CONSTRAINT appointments_user_id_fkey FOREIGN KEY (user_id)
  REFERENCES auth.users(id) ON DELETE CASCADE;

-- 4. The legacy custom-auth table is gone.
DROP TABLE IF EXISTS public.users;
