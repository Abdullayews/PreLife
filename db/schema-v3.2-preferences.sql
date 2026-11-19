-- ═══════════════════════════════════════════════════════════════════════════
-- PreLife — v3.2 user preferences (theme joins lang on the profile row)
--
-- Applies ON TOP of db/schema-v3.1-auth.sql:
--   node scripts/apply-db.mjs v3.2
--
-- What this file does:
--   1. public.profiles gains `theme` ('light' | 'dark', default 'light').
--      The `lang` column already exists from v3 (az/en/ru, default 'en').
--   2. Both columns are synced by the new /api/me/preferences endpoints
--      (GET + PATCH, session-guarded) — signed-in users get their language
--      and dark/light choice on every device instead of browser-local
--      cookie/localStorage only. Guests keep the pre-consent tiers
--      (in-memory / cookie / localStorage — see src/lib/consent.ts).
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS theme VARCHAR(5) NOT NULL DEFAULT 'light'
  CHECK (theme IN ('light','dark'));

COMMENT ON COLUMN public.profiles.theme IS
  'UI theme for the signed-in user (light/dark). Written by PATCH /api/me/preferences; GET applies it on every device.';
COMMENT ON COLUMN public.profiles.lang IS
  'UI language for the signed-in user (az/en/ru). Written by PATCH /api/me/preferences together with theme.';
