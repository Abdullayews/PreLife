-- ═══════════════════════════════════════════════════════════════════════════
-- PreLife — v3.7 data-consent gate + self-service erasure support
--
-- Applies ON TOP of db/schema-v3.6.sql:
--   node scripts/apply-db.mjs v3.7
--
-- What this file does:
--   1. DATA CONSENTS — user_consents: the per-scope explicit consent
--      record for the health-adjacent features (GDPR Art. 9 explicit
--      consent; AZ PDPA consent; 152-FZ written-consent analog). One row
--      per (user, scope); scopes: mood, journal, quiz, ai. Granting and
--      revoking are separate timestamped events (granted_at / revoked_at)
--      so the row itself is the consent log. Writes go through
--      /api/me/consents; the mood / journal / quiz / AI endpoints refuse
--      with 403 consent_required_<scope> until the scope is granted.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Per-scope explicit consents (the consent log)
CREATE TABLE IF NOT EXISTS public.user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('mood', 'journal', 'quiz', 'ai')),
  granted BOOLEAN NOT NULL,
  granted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, scope)
);
CREATE INDEX IF NOT EXISTS idx_user_consents_user
  ON public.user_consents (user_id);
COMMENT ON TABLE public.user_consents IS
  'Per-scope explicit consent for health-adjacent features (mood/journal/quiz/ai). granted=FALSE with revoked_at is a withdrawal; the timestamps are the audit trail.';

-- Row Level Security: service-role only (the Rust backend), like every
-- other user-data table.
ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;
