-- ═══════════════════════════════════════════════════════════════════════════
-- PreLife — v3.8 notification channel preferences (the account tier)
--
-- Applies ON TOP of db/schema-v3.7.sql:
--   node scripts/apply-db.mjs v3.8
--
-- What this file does:
--   NOTIFICATION PREFS — profiles.notify_reminders / notify_digest /
--   notify_news: which notification channels the member opted into
--   (workout reminders, weekly digest, product news). Until now the
--   Settings toggles were a localStorage-only tier ("temporary toggles");
--   v3.8 makes them account-level preferences synced through
--   /api/me/preferences, so they follow the member across devices.
--   The browser notification PERMISSION (Notifications API) stays a
--   device-level gate handled client-side — these columns are the
--   member's channel CHOICE, checked before any notification is sent.
--   Defaults mirror the previous localStorage defaults: reminders and
--   digest on, news off.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. The three channel preferences on the profile row
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_reminders BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_digest BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_news BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.profiles.notify_reminders IS
  'Member opt-in for workout-reminder notifications (channel choice; the browser Notifications permission is a separate device-level gate).';
COMMENT ON COLUMN public.profiles.notify_digest IS
  'Member opt-in for the weekly digest notification.';
COMMENT ON COLUMN public.profiles.notify_news IS
  'Member opt-in for product-news notifications.';
