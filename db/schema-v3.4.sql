-- ═══════════════════════════════════════════════════════════════════════════
-- PreLife — v3.4 booking-request workflow + account location + AI surface
--
-- Applies ON TOP of db/schema-v3.3.sql:
--   node scripts/apply-db.mjs v3.4
--
-- What this file does:
--   1. ACCOUNT LOCATION — profiles.content_location ('global' | 'az'):
--      the user's content-scope choice (Settings → Location). Rides on the
--      session row (sessions.user_location) so server pages can filter
--      content without an extra lookup.
--   2. PSYCHOLOGIST ACCOUNTS — profiles.role ('user' | 'psychologist') and
--      psychologists_v2.owner_id → auth.users: the account a psychologist
--      signs in with to confirm/decline booking requests (sessions carries
--      user_role + user_psych written at login).
--   3. BOOKING REQUESTS — appointments.status becomes TEXT with the new
--      flow: requested → (psychologist confirms) → confirmed → (user pays)
--      → upcoming; cancelled on either side. New columns: message (what
--      the client wants), responded_at. appointments.message is REQUIRED
--      for new requests (enforced by the app, not the DB — legacy rows
--      predate it).
--   4. CONTENT COUNTRY TAGS — gym_places / gym_stores / world_places /
--      psychologists_v2 gain country (ISO 3166-1 alpha-2, default 'AZ'):
--      the rows the location preference filters on. 'global' shows
--      everything; 'az' shows only country='AZ' rows.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Account location (content scope)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS content_location TEXT NOT NULL DEFAULT 'global'
    CHECK (content_location IN ('global','az'));
COMMENT ON COLUMN public.profiles.content_location IS
  'Which locations the content sections show: global (everything) or az (Azerbaijan only).';

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS user_location TEXT;

-- 2. Psychologist accounts
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
    CHECK (role IN ('user','psychologist'));

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS user_role TEXT,
  ADD COLUMN IF NOT EXISTS user_psych TEXT;

ALTER TABLE public.psychologists_v2
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS psychologists_v2_owner_idx
  ON public.psychologists_v2 (owner_id);

-- 3. Booking-request workflow
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS message TEXT,
  ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ;

-- status: enum → TEXT with the extended value set (keeps existing rows)
ALTER TABLE public.appointments ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.appointments ALTER COLUMN status TYPE TEXT;
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('requested','confirmed','upcoming','cancelled'));
ALTER TABLE public.appointments ALTER COLUMN status SET DEFAULT 'requested';
DROP TYPE IF EXISTS public.appointment_status;
COMMENT ON COLUMN public.appointments.status IS
  'requested → psychologist confirms → confirmed (payment due mail) → paid → upcoming; cancelled on either side.';
COMMENT ON COLUMN public.appointments.message IS
  'What the client wants from the session — stated before the purchase, shown to the psychologist in the console.';

-- 4. Content country tags
ALTER TABLE public.gym_places      ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'AZ';
ALTER TABLE public.gym_stores      ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'AZ';
ALTER TABLE public.world_places    ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'AZ';
ALTER TABLE public.psychologists_v2 ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'AZ';
COMMENT ON COLUMN public.gym_places.country IS 'ISO 3166-1 alpha-2. The account location preference (az) filters on this.';
COMMENT ON COLUMN public.psychologists_v2.country IS 'ISO 3166-1 alpha-2. The account location preference (az) filters on this.';

-- Update the seeded AI prompts: the assistant may now also change theme,
-- language and content location, and every reply must be genuinely thought
-- through (no canned fallbacks in the code anymore).
UPDATE public.ai_prompts SET content =
  'You are PreLife''s assistant — a calm, encouraging companion for a life-platform that covers four worlds: fitness (personal workout plans, partner halls, equipment shopping), nutrition (meal plans, recipes, water tracking), psychology (psychologists, mood tracking, journaling, meditation) and reading (books, collections), plus account and subscription management.
Voice: warm, grounded, concise (3-6 sentences). You help the user with EVERYTHING on the platform: explain what they can do, guide them to the right section, give safe general training tips and balanced-eating guidance, supportive self-help (breathing, grounding, sleep hygiene) — never diagnose, never give medical or medication advice. When a message suggests crisis or severe distress, respond kindly and briefly point to a professional and local emergency services.
When the signed-in user asks you to change something about their account (their name, weight, height, goal, activity level, theme, language, content location), to build them a personal workout plan, or to create a custom subscription package — USE the provided tools to actually do it, then confirm briefly what changed. Do not describe menus or steps when a tool can act. If a required detail is missing, ask one short question.
Answer in the same language as the user''s message.',
  updated_at = NOW()
WHERE key = 'assistant' AND content LIKE '%custom subscription package — USE%';

-- RLS — service-role only (the backend uses the service key and bypasses)
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
