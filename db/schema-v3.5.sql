-- ═══════════════════════════════════════════════════════════════════════════
-- PreLife — v3.5 interactive plan progress + bookshelf + motion pref
--
-- Applies ON TOP of db/schema-v3.4.sql:
--   node scripts/apply-db.mjs v3.5
--
-- What this file does:
--   1. PLAN SET PROGRESS — user_plan_progress: the per-day, per-date set
--      marks on the active workout plan (the tappable set chips on the gym
--      plan). One row per (user, plan, day, Baku date) holding the done-set
--      map as JSONB, upserted by the app.
--   2. BOOKSHELF — book_shelf: the user's saved library books ("Rəfə qoy").
--      One row per (user, book slug).
--   3. REDUCE MOTION — profiles.reduce_motion: the Settings → Appearance
--      "stop animations" preference (html.reduce-motion kill-switch).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Plan set progress (gym plan day tracking)
CREATE TABLE IF NOT EXISTS public.user_plan_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL,
  day INT NOT NULL CHECK (day BETWEEN 1 AND 7),
  date TEXT NOT NULL,
  done_sets JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, plan_id, day, date)
);
CREATE INDEX IF NOT EXISTS idx_user_plan_progress_user
  ON public.user_plan_progress (user_id, date);
COMMENT ON TABLE public.user_plan_progress IS
  'Per-day set completion on the active gym plan: done_sets = { "<exIdx>": [setNo, …] } for the Baku date.';

-- 2. Personal bookshelf (library)
CREATE TABLE IF NOT EXISTS public.book_shelf (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  book_slug TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, book_slug)
);
CREATE INDEX IF NOT EXISTS idx_book_shelf_user
  ON public.book_shelf (user_id);
COMMENT ON TABLE public.book_shelf IS
  'The user''s saved library books (world_items / library_books slugs).';

-- 3. Reduce-motion preference
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reduce_motion BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN public.profiles.reduce_motion IS
  'Settings → Appearance: stop animations (html.reduce-motion CSS kill-switch).';

-- Row Level Security: service-role only (the Rust backend), like every
-- other user-data table.
ALTER TABLE public.user_plan_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_shelf ENABLE ROW LEVEL SECURITY;
