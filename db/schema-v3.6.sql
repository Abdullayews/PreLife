-- ═══════════════════════════════════════════════════════════════════════════
-- PreLife — v3.6 role system: hall manager accounts + the admin role
--
-- Applies ON TOP of db/schema-v3.5.sql:
--   node scripts/apply-db.mjs v3.6
--
-- What this file does:
--   1. PROFILES.ROLE — the CHECK gains 'hall_manager' and 'admin'. Every
--      role except 'user' carries its own management console:
--        psychologist → /meditation/console   (v3.4, psychologists_v2.owner_id)
--        hall_manager → /gym/console          (gym_places.owner_id, below)
--        admin        → /admin                (no link needed)
--   2. GYM_PLACES.OWNER_ID — the hall-manager ownership link, exactly the
--      pattern psychologists_v2.owner_id set in v3.4: the account a hall
--      manager signs in with; the Rust backend resolves it at login and
--      re-verifies it on every console action.
--   3. SESSIONS.USER_HALL — the linked hall slug riding the session row
--      (mirrors user_psych), so server pages render the console guard
--      without an extra lookup.
--
-- Assigning roles (operator SQL — roles are never self-service):
--   Hall manager:
--     UPDATE public.profiles    SET role = 'hall_manager' WHERE id = '<auth.users uuid>';
--     UPDATE public.gym_places  SET owner_id = '<auth.users uuid>' WHERE slug = '<hall slug>';
--   Psychologist (as v3.4):
--     UPDATE public.profiles         SET role = 'psychologist' WHERE id = '<auth.users uuid>';
--     UPDATE public.psychologists_v2 SET owner_id = '<auth.users uuid>' WHERE slug = '<psychologist slug>';
--   Administrator:
--     UPDATE public.profiles SET role = 'admin' WHERE id = '<auth.users uuid>';
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. The role CHECK (drop + re-add: ALTER TYPE on a CHECK is not supported)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('user','psychologist','hall_manager','admin'));

-- 2. The hall-manager ownership link
ALTER TABLE public.gym_places
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS gym_places_owner_idx
  ON public.gym_places (owner_id);
COMMENT ON COLUMN public.gym_places.owner_id IS
  'The hall-manager account (auth.users) that owns this hall — resolved at login, re-verified on every /api/gym/console action.';

-- 3. The linked hall slug on the session row
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS user_hall TEXT;
COMMENT ON COLUMN public.sessions.user_hall IS
  'The linked gym_places slug when the session user is a hall manager (mirrors user_psych).';
