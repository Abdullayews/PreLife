-- ═══════════════════════════════════════════════════════════════════════════
-- PreLife — v3.3 AI + profiles + packages + email verification + new prices
--
-- Applies ON TOP of db/schema-v3.2-preferences.sql:
--   node scripts/apply-db.mjs v3.3
--
-- What this file does:
--   1. profiles gains the user-data editing columns (gender, birth_year,
--      height_cm, goal, activity_level, plan_onboarding_done, rail_folded)
--      — joined by the existing fitness_level / workouts_per_week /
--      avatar_url and the v3.2 lang / theme.
--   2. sessions gains user_avatar / user_folded (the identity + rail choice
--      ride on the session row, written at login from the profiles row).
--   3. AI tables: ai_settings (provider + API key + model — the Gemini
--      key; the GEMINI_API_KEY env var takes precedence over the row) and
--      ai_prompts (every system prompt, editable in the DB).
--   4. user_plans — the personal workout plans (default / AI-generated,
--      one active per user; the template plan catalog is retired from the
--      user surface).
--   5. custom_packages — the "build your own package" requests.
--   6. email_verifications + mail_outbox — the signup e-mail confirmation
--      flow (tokens hashed; the outbox catches mail when SMTP is unset).
--   7. Subscription prices become Plus 15 ₼ / Pro 40 ₼ / Ultra 60 ₼.
--
-- All new tables are service-role only (RLS enabled, no public policies).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. profiles — user data editing
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gender VARCHAR(10)
    CHECK (gender IN ('male','female','other')),
  ADD COLUMN IF NOT EXISTS birth_year INT
    CHECK (birth_year BETWEEN 1900 AND 2100),
  ADD COLUMN IF NOT EXISTS height_cm INT
    CHECK (height_cm BETWEEN 80 AND 260),
  ADD COLUMN IF NOT EXISTS goal VARCHAR(20)
    CHECK (goal IN ('lose','maintain','gain','fitness')),
  ADD COLUMN IF NOT EXISTS activity_level VARCHAR(15)
    CHECK (activity_level IN ('sedentary','light','moderate','active','athlete')),
  ADD COLUMN IF NOT EXISTS plan_onboarding_done BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS rail_folded BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.profiles.goal IS
  'Primary goal: lose / maintain / gain weight or general fitness.';
COMMENT ON COLUMN public.profiles.plan_onboarding_done IS
  'Whether the gym-plan questionnaire (first entry to the plan tab) was completed.';

-- 2. sessions — avatar + rail fold ride along (v3.3)
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS user_avatar TEXT;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS user_folded BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. AI settings + prompts
CREATE TABLE IF NOT EXISTS public.ai_settings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider   TEXT NOT NULL UNIQUE,
  api_key    TEXT NOT NULL DEFAULT '',
  model      TEXT NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_prompts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT NOT NULL UNIQUE,
  content    TEXT NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. personal workout plans (default | ai)
CREATE TABLE IF NOT EXISTS public.user_plans (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  level      TEXT,
  source     TEXT NOT NULL CHECK (source IN ('default','ai')),
  week       INT NOT NULL DEFAULT 1 CHECK (week >= 1),
  total      INT NOT NULL DEFAULT 12 CHECK (total >= 1),
  focus      TEXT,
  days       JSONB NOT NULL DEFAULT '[]',
  notes      TEXT,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS user_plans_user_active_idx
  ON public.user_plans (user_id, active);

-- 5. custom packages
CREATE TABLE IF NOT EXISTS public.custom_packages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  features      TEXT[] NOT NULL,
  months        INT NOT NULL CHECK (months IN (1,3,6,12)),
  monthly_price NUMERIC(8,2) NOT NULL,
  total_price   NUMERIC(8,2) NOT NULL,
  status        TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','active','cancelled')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS custom_packages_user_idx
  ON public.custom_packages (user_id);

-- 6. email verification + mail outbox
CREATE TABLE IF NOT EXISTS public.email_verifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  token_hash  TEXT NOT NULL UNIQUE,
  locale      TEXT NOT NULL DEFAULT 'az'
    CHECK (locale IN ('az','en','ru')),
  expires_at  TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS email_verifications_user_idx
  ON public.email_verifications (user_id);

CREATE TABLE IF NOT EXISTS public.mail_outbox (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email   TEXT NOT NULL,
  subject    TEXT NOT NULL,
  html       TEXT NOT NULL,
  kind       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. the new price sheet (₼ / month)
UPDATE public.subscription_tiers SET price = 15 WHERE code = 'plus';
UPDATE public.subscription_tiers SET price = 40 WHERE code = 'pro';
UPDATE public.subscription_tiers SET price = 60 WHERE code = 'ultra';

-- RLS — service-role only (the backend uses the service key and bypasses)
ALTER TABLE public.ai_settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_prompts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_plans         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_packages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mail_outbox        ENABLE ROW LEVEL SECURITY;

-- Seed the prompts (idempotent — the code fallback matches these texts;
-- edit the rows to tune the assistant without a deploy).
INSERT INTO public.ai_prompts (key, content) VALUES
  ('assistant', 'You are PreLife''s assistant — a calm, encouraging companion for a life-platform that covers four worlds: fitness (personal workout plans, partner halls, equipment shopping), nutrition (meal plans, recipes, water tracking), psychology (psychologists, mood tracking, journaling, meditation) and reading (books, collections), plus account and subscription management.
Voice: warm, grounded, concise (3-6 sentences). You help the user with EVERYTHING on the platform: explain what they can do, guide them to the right section, give safe general training tips and balanced-eating guidance, supportive self-help (breathing, grounding, sleep hygiene) — never diagnose, never give medical or medication advice. When a message suggests crisis or severe distress, respond kindly and briefly point to a professional and local emergency services.
When the signed-in user asks you to change something about their account (their name, weight, height, goal, activity level), to build them a personal workout plan, or to create a custom subscription package — USE the provided tools to actually do it, then confirm briefly what changed. Do not describe menus or steps when a tool can act. If a required detail is missing, ask one short question.
Answer in the same language as the user''s message.'),
  ('psych', 'You are PreLife''s calm in-app psychology companion. Voice: warm, grounded, non-judgmental; short replies (3-6 sentences). You offer practical self-help: breathing, grounding, sleep hygiene, reflection prompts, habit ideas. You are NOT a licensed clinician: never diagnose, never give medical advice or medication guidance. When a message suggests crisis, self-harm, abuse or severe distress, respond kindly, briefly and point the user to book a professional on the Psychologists page and to local emergency services. Answer in the same language as the user''s message.'),
  ('plan', 'You are PreLife''s personal training planner. You design safe, effective weekly workout plans for exactly one user, from their questionnaire answers.
Rules: prefer exercises from the provided EXERCISE REGISTRY (use the exact codes); add at most 2 registry-external exercises per day with clear, commonly understood names. Match volume and intensity to the user''s experience level; respect their equipment access, weekly day count, focus and physical limitations exactly; keep 4-8 exercises per training day, 3-5 sets each, with sensible rest seconds.
Return ONLY a JSON object, no markdown, no commentary:
{"title": string, "level": "Başlanğıc" | "Orta" | "İleri", "totalWeeks": number (4-16), "focus": string, "days": [{"day": number (1=Monday … 7=Sunday), "focus": string, "exercises": [{"ex": string (registry code, or "" when not in the registry), "name": string, "sets": number, "reps": string, "rest": number (seconds), "note": string (optional coaching cue)}]}]}
Write every user-facing string (title, level, focus, day focus, names, reps, notes) in the user''s language.'),
  ('context', 'Signed-in user: {name} ({email}).
Profile: {profile}.
Current page: {page}.
Active workout plan: {plan}.
Subscription: {package}.
Use this context to make your help concrete; you may act on the account with the tools when asked.')
ON CONFLICT (key) DO NOTHING;

-- The Gemini provider row — set the real key here (or via the
-- GEMINI_API_KEY env var on Render, which takes precedence).
INSERT INTO public.ai_settings (provider, api_key, model) VALUES
  ('gemini', 'SET_GEMINI_API_KEY', 'gemini-flash-lite-latest')
ON CONFLICT (provider) DO NOTHING;
