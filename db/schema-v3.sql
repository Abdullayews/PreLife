-- ═══════════════════════════════════════════════════════════════════════════
-- PreLife — v3 unified schema (Supabase Auth based)
--
-- Applies ON TOP of db/schema.sql + seeds (the v2 content catalog):
--   node scripts/apply-db.mjs v3
--
-- What this file does:
--   0. Resolves the two name collisions with the v2 catalog by renaming the
--      legacy tables (the live Rust backend is updated to the new names in
--      the same commit — zero downtime):
--        psychologists   -> psychologists_v2   (i18n-key content catalog)
--        journal_entries -> journal_entries_v2 (v2 user journal)
--   1. Creates the v3 unified schema verbatim: profiles (Supabase Auth),
--      subscriptions + plan_sections, bookings/slots/payments, mood_checkins,
--      journal_entries, practice materials/sessions, exercises/workouts,
--      books/user_books/book_notes — with RLS policies for `authenticated`.
--   2. Grants PostgREST role access to the new tables (service_role bypasses
--      RLS; authenticated is governed by the policies below).
--   3. Migrates content from the v2 catalog into the v3 tables (Azerbaijani
--      text resolved from i18n_messages) and seeds subscription plans,
--      sections and 14 days of bookable psychologist slots.
--
-- The v2 catalog tables (worlds, gym_*, diet_*, media_resources, quizzes,
-- i18n_messages, …) stay untouched — the live backend keeps serving from
-- them until the v3 API rebuild.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 0. Rename legacy collisions ────────────────────────────────────────────

ALTER TABLE public.psychologists RENAME TO psychologists_v2;
COMMENT ON TABLE public.psychologists_v2 IS
  'v2 content catalog (i18n keys, certificates, availability). Live backend source.';

ALTER TABLE public.journal_entries RENAME TO journal_entries_v2;
COMMENT ON TABLE public.journal_entries_v2 IS
  'v2 user journal (custom scrypt auth users). Live backend source.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. The v3 unified schema (verbatim design)
-- ═══════════════════════════════════════════════════════════════════════════

-- ---------------------------------------------------------------------
-- 1. Profil
-- ---------------------------------------------------------------------
CREATE TABLE public.profiles (
    id                          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username                    VARCHAR(50) UNIQUE,
    full_name                   VARCHAR(100),
    avatar_url                  TEXT,
    lang                        VARCHAR(2) NOT NULL DEFAULT 'en' CHECK (lang IN ('az','en','ru')),
    fitness_level               VARCHAR(15) CHECK (fitness_level IN ('beginner','intermediate','advanced')),
    workouts_per_week           SMALLINT CHECK (workouts_per_week BETWEEN 0 AND 14),
    reading_goal_books_per_year SMALLINT CHECK (reading_goal_books_per_year >= 0),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Qeydiyyatda avtomatik profil yarat
CREATE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Çəki izləmə (Diet və İdman üçün ortaq)
CREATE TABLE public.user_weight_logs (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    log_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    weight_kg   NUMERIC(5,1) NOT NULL CHECK (weight_kg > 0),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, log_date)
);

-- ---------------------------------------------------------------------
-- 2. Abunəlik
-- ---------------------------------------------------------------------
CREATE TABLE public.subscription_plans (
    id             SERIAL PRIMARY KEY,
    code           VARCHAR(30) NOT NULL UNIQUE,
    name           VARCHAR(50) NOT NULL UNIQUE,
    description    TEXT,
    price_monthly  NUMERIC(8,2) NOT NULL CHECK (price_monthly >= 0),
    price_yearly   NUMERIC(8,2) CHECK (price_yearly >= 0),
    currency       CHAR(3) NOT NULL DEFAULT 'USD',
    is_active      BOOLEAN NOT NULL DEFAULT TRUE
);

-- Hər planın giriş verdiyi bölmələr
CREATE TABLE public.plan_sections (
    plan_id  INT NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
    section  VARCHAR(20) NOT NULL
             CHECK (section IN ('psychology','diet','sports','books','ai')),
    PRIMARY KEY (plan_id, section)
);

CREATE TABLE public.subscriptions (
    id                        BIGSERIAL PRIMARY KEY,
    user_id                   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan_id                   INT NOT NULL REFERENCES public.subscription_plans(id),
    status                    VARCHAR(20) NOT NULL DEFAULT 'active'
                              CHECK (status IN ('trial','active','past_due','cancelled','expired')),
    billing_period            VARCHAR(10) NOT NULL CHECK (billing_period IN ('monthly','yearly')),
    starts_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ends_at                   TIMESTAMPTZ NOT NULL,
    cancel_at_period_end      BOOLEAN NOT NULL DEFAULT FALSE,
    provider_subscription_id  VARCHAR(100)
);

CREATE INDEX idx_subscriptions_user ON public.subscriptions (user_id);

-- İstifadəçinin eyni anda yalnız bir canlı abunəliyi ola bilər
CREATE UNIQUE INDEX uq_one_live_subscription
ON public.subscriptions (user_id)
WHERE status IN ('trial','active','past_due');

-- ---------------------------------------------------------------------
-- 3. Psixologiya
-- ---------------------------------------------------------------------
CREATE TABLE public.psychologists (
    id          BIGSERIAL PRIMARY KEY,
    full_name   VARCHAR(100) NOT NULL,
    specialty   VARCHAR(100),
    bio         TEXT,
    photo_url   TEXT,
    price       NUMERIC(10,2) NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE public.psychologist_slots (
    id               BIGSERIAL PRIMARY KEY,
    psychologist_id  BIGINT NOT NULL REFERENCES public.psychologists(id) ON DELETE CASCADE,
    starts_at        TIMESTAMPTZ NOT NULL,
    ends_at          TIMESTAMPTZ NOT NULL,
    is_booked        BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (psychologist_id, starts_at)
);

CREATE TABLE public.bookings (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    slot_id         BIGINT NOT NULL UNIQUE REFERENCES public.psychologist_slots(id),
    status          VARCHAR(20) NOT NULL DEFAULT 'upcoming'
                    CHECK (status IN ('upcoming','done','cancelled')),
    payment_status  VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (payment_status IN ('pending','paid','refunded')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ödənişlər: ya seansa (booking), ya abunəliyə aiddir
CREATE TABLE public.payments (
    id               BIGSERIAL PRIMARY KEY,
    user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    booking_id       BIGINT REFERENCES public.bookings(id) ON DELETE SET NULL,
    subscription_id  BIGINT REFERENCES public.subscriptions(id) ON DELETE SET NULL,
    amount           NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
    currency         CHAR(3) NOT NULL DEFAULT 'USD',
    status           VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','paid','failed','refunded')),
    provider_ref     VARCHAR(100),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT payments_one_target CHECK (num_nonnulls(booking_id, subscription_id) = 1)
);

-- Mood (gündəlik check-in, 1-5)
CREATE TABLE public.mood_checkins (
    id             BIGSERIAL PRIMARY KEY,
    user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    checkin_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    mood           SMALLINT NOT NULL CHECK (mood BETWEEN 1 AND 5),
    energy         SMALLINT NOT NULL CHECK (energy BETWEEN 1 AND 5),
    sleep_quality  SMALLINT NOT NULL CHECK (sleep_quality BETWEEN 1 AND 5),
    UNIQUE (user_id, checkin_date)
);

-- Journal
CREATE TABLE public.journal_entries (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Practice (audio/video) və istifadə tarixçəsi
CREATE TABLE public.practice_materials (
    id            BIGSERIAL PRIMARY KEY,
    title         VARCHAR(100) NOT NULL,
    description   TEXT,
    media_type    VARCHAR(10) NOT NULL CHECK (media_type IN ('audio','video')),
    media_url     TEXT NOT NULL,
    duration_sec  INT,
    is_premium    BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE public.practice_sessions (
    id           BIGSERIAL PRIMARY KEY,
    user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    material_id  BIGINT REFERENCES public.practice_materials(id),
    minutes      INT NOT NULL CHECK (minutes > 0),
    done_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 4. İdman
-- ---------------------------------------------------------------------
CREATE TABLE public.exercises (
    id            BIGSERIAL PRIMARY KEY,
    name          VARCHAR(150) NOT NULL UNIQUE,
    -- v3 note: widened 30 -> 60 — the migrated AZ muscle-group descriptions
    -- (e.g. "Arxa zəncir: bel, kalça, arxa ayaq") need 34 chars.
    muscle_group  VARCHAR(60),
    equipment     VARCHAR(50) NOT NULL DEFAULT 'none',
    difficulty    VARCHAR(15) CHECK (difficulty IN ('beginner','intermediate','advanced')),
    instructions  TEXT,
    media_url     TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.workouts (
    id                BIGSERIAL PRIMARY KEY,
    title             VARCHAR(200) NOT NULL,
    description       TEXT,
    level             VARCHAR(15) NOT NULL CHECK (level IN ('beginner','intermediate','advanced')),
    goal_tags         TEXT[] NOT NULL DEFAULT '{}',
    duration_min      SMALLINT,
    equipment_needed  TEXT[] NOT NULL DEFAULT '{}',
    image_url         TEXT,
    is_premium        BOOLEAN NOT NULL DEFAULT FALSE,
    is_published      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.workout_exercises (
    id            BIGSERIAL PRIMARY KEY,
    workout_id    BIGINT NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
    exercise_id   BIGINT NOT NULL REFERENCES public.exercises(id),
    position      SMALLINT NOT NULL,
    sets          SMALLINT,
    reps          SMALLINT,
    duration_sec  SMALLINT,
    rest_sec      SMALLINT NOT NULL DEFAULT 60,
    UNIQUE (workout_id, position)
);

CREATE TABLE public.user_workout_schedule (
    user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    workout_id   BIGINT NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
    day_of_week  SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    PRIMARY KEY (user_id, day_of_week, workout_id)
);

CREATE TABLE public.user_workout_logs (
    id               BIGSERIAL PRIMARY KEY,
    user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    workout_id       BIGINT REFERENCES public.workouts(id) ON DELETE SET NULL,
    performed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_min     SMALLINT CHECK (duration_min > 0),
    calories_burned  INT CHECK (calories_burned >= 0),
    notes            TEXT
);

CREATE INDEX idx_workout_logs_user ON public.user_workout_logs (user_id, performed_at);

-- ---------------------------------------------------------------------
-- 5. Kitab
-- ---------------------------------------------------------------------
CREATE TABLE public.books (
    id            BIGSERIAL PRIMARY KEY,
    title         VARCHAR(250) NOT NULL,
    author        VARCHAR(150) NOT NULL,
    description   TEXT,
    category      VARCHAR(50),
    language      VARCHAR(10) NOT NULL DEFAULT 'az',
    page_count    SMALLINT CHECK (page_count > 0),
    cover_url     TEXT,
    is_premium    BOOLEAN NOT NULL DEFAULT FALSE,
    is_published  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_books_category ON public.books (category);

CREATE TABLE public.user_books (
    user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    book_id           BIGINT NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    status            VARCHAR(15) NOT NULL DEFAULT 'want_to_read'
                      CHECK (status IN ('want_to_read','reading','finished')),
    progress_percent  SMALLINT NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
    rating            SMALLINT CHECK (rating BETWEEN 1 AND 5),
    started_at        DATE,
    finished_at       DATE,
    PRIMARY KEY (user_id, book_id)
);

CREATE TABLE public.book_notes (
    id          BIGSERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    book_id     BIGINT NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    page        SMALLINT,
    note        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_book_notes_user_book ON public.book_notes (user_id, book_id);

-- ---------------------------------------------------------------------
-- 6. Bölməyə giriş yoxlaması
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_section_access(p_section TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    JOIN public.plan_sections ps ON ps.plan_id = s.plan_id
    WHERE s.user_id = (SELECT auth.uid())
      AND s.status IN ('trial','active')
      AND s.ends_at > NOW()
      AND ps.section = p_section
  );
$$;

-- ---------------------------------------------------------------------
-- 7. Təhlükəsizlik (RLS)
-- Abunəlik, ödəniş, rezervasiya və slot yazıları yalnız serverdən (service role) edilir.
-- ---------------------------------------------------------------------
ALTER TABLE public.profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_weight_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_sections          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.psychologists          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.psychologist_slots     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mood_checkins          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_materials     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workouts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_exercises      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_workout_schedule  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_workout_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_books             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_notes             ENABLE ROW LEVEL SECURITY;

-- Profil
CREATE POLICY "own_profile_select" ON public.profiles
  FOR SELECT TO authenticated USING (id = (SELECT auth.uid()));
CREATE POLICY "own_profile_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));

-- Yalnız öz məlumatları olan cədvəllər (oxu və yazı)
CREATE POLICY "own_rows" ON public.user_weight_logs
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "own_rows" ON public.mood_checkins
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "own_rows" ON public.journal_entries
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "own_rows" ON public.practice_sessions
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "own_rows" ON public.user_workout_schedule
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "own_rows" ON public.user_workout_logs
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "own_rows" ON public.user_books
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "own_rows" ON public.book_notes
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

-- Yalnız oxuna bilən (yazı serverdən)
CREATE POLICY "own_subscription_select" ON public.subscriptions
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "own_bookings_select" ON public.bookings
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "own_payments_select" ON public.payments
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

-- Kataloqlar
CREATE POLICY "read_plans" ON public.subscription_plans
  FOR SELECT TO authenticated USING (is_active);
CREATE POLICY "read_plan_sections" ON public.plan_sections
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "read_psychologists" ON public.psychologists
  FOR SELECT TO authenticated USING (is_active);
CREATE POLICY "read_free_slots" ON public.psychologist_slots
  FOR SELECT TO authenticated USING (NOT is_booked);
CREATE POLICY "read_exercises" ON public.exercises
  FOR SELECT TO authenticated USING (true);

-- Premium məzmun
CREATE POLICY "read_practice" ON public.practice_materials
  FOR SELECT TO authenticated
  USING (NOT is_premium OR public.has_section_access('psychology'));
CREATE POLICY "read_workouts" ON public.workouts
  FOR SELECT TO authenticated
  USING (is_published AND (NOT is_premium OR public.has_section_access('sports')));
CREATE POLICY "read_workout_exercises" ON public.workout_exercises
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workouts w WHERE w.id = workout_id));
CREATE POLICY "read_books" ON public.books
  FOR SELECT TO authenticated
  USING (is_published AND (NOT is_premium OR public.has_section_access('books')));

-- ── 8. PostgREST role grants for the new tables ───────────────────────────
-- (service_role bypasses RLS — the Rust backend; authenticated is governed
--  by the policies above. Mirrors the grant style of schema.sql.)

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'profiles','user_weight_logs',
    'subscription_plans','plan_sections','subscriptions',
    'psychologists','psychologist_slots','bookings','payments',
    'mood_checkins','journal_entries','practice_materials','practice_sessions',
    'exercises','workouts','workout_exercises','user_workout_schedule','user_workout_logs',
    'books','user_books','book_notes'
  ]) LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO service_role', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  END LOOP;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. Content migration: v2 catalog -> v3 tables (Azerbaijani text)
-- ═══════════════════════════════════════════════════════════════════════════

-- Abunəlik planları: Plus / Pro / Ultra (aylıq AZN; illik = 10 ay)
INSERT INTO public.subscription_plans (code, name, description, price_monthly, price_yearly, currency, is_active)
SELECT t.code,
       COALESCE(m.value_az, t.code),
       NULL,
       t.price,
       t.price * 10,
       'AZN',
       TRUE
FROM public.subscription_tiers t
LEFT JOIN public.i18n_messages m ON m.key = 'subscription.' || t.name_key;

-- Planların bölmələri (v2 xüsusiyyət kodları -> v3 bölmə adları;
-- videos/coaching/family xüsusiyyətdir, bölmə deyil — keçirilir)
INSERT INTO public.plan_sections (plan_id, section)
SELECT p.id,
       CASE f.code
         WHEN 'gym'     THEN 'sports'
         WHEN 'psych'   THEN 'psychology'
         WHEN 'library' THEN 'books'
         ELSE f.code
       END
FROM public.subscription_tier_features tf
JOIN public.subscription_tiers  t  ON t.code  = tf.tier_code
JOIN public.subscription_plans  p  ON p.code  = t.code
JOIN public.subscription_features f ON f.code = tf.feature_code
WHERE f.code IN ('gym','diet','psych','library','ai');

-- Psixoloqlar: 8 sətir, AZ mətnlər (ad, ixtisas başlığı, bio)
WITH ordered AS (
  SELECT row_number() OVER (ORDER BY sort_order) AS new_id, slug
  FROM public.psychologists_v2
)
INSERT INTO public.psychologists (id, full_name, specialty, bio, photo_url, price, is_active)
SELECT o.new_id,
       COALESCE(mn.value_az, p.name_key),
       COALESCE(mt.value_az, p.title_key),
       COALESCE(mb.value_az, p.bio_key),
       p.image_url,
       p.price,
       p.is_active
FROM public.psychologists_v2 p
JOIN ordered o ON o.slug = p.slug
LEFT JOIN public.i18n_messages mn ON mn.key = 'psychApp.' || p.name_key
LEFT JOIN public.i18n_messages mt ON mt.key = 'psychApp.' || p.title_key
LEFT JOIN public.i18n_messages mb ON mb.key = 'psychApp.' || p.bio_key;

SELECT setval(pg_get_serial_sequence('public.psychologists', 'id'),
              COALESCE((SELECT MAX(id) FROM public.psychologists), 1));

-- Rezervasiya slotları: növbəti 14 gün üçün saatlıq slotlar (Baku vaxtı)
WITH ordered AS (
  SELECT row_number() OVER (ORDER BY sort_order) AS new_id, slug
  FROM public.psychologists_v2
)
INSERT INTO public.psychologist_slots (psychologist_id, starts_at, ends_at)
SELECT o.new_id,
       (d + make_interval(hours => h))      AT TIME ZONE 'Asia/Baku',
       (d + make_interval(hours => h + 1))  AT TIME ZONE 'Asia/Baku'
FROM public.psychologist_availability a
JOIN ordered o ON o.slug = a.psychologist_slug
CROSS JOIN generate_series(CURRENT_DATE, CURRENT_DATE + 13, INTERVAL '1 day') AS d
CROSS JOIN LATERAL generate_series(a.from_hour, a.to_hour - 1) AS h
WHERE EXTRACT(ISODOW FROM d) = a.day
ON CONFLICT DO NOTHING;

-- Practice materialları: audio/video (AZ başlıq + təsvir)
INSERT INTO public.practice_materials (title, description, media_type, media_url, duration_sec, is_premium)
SELECT COALESCE(mt.value_az, mr.title_key),
       COALESCE(md.value_az, mr.desc_key),
       mr.kind::text,
       mr.src,
       mr.minutes * 60,
       FALSE
FROM public.media_resources mr
LEFT JOIN public.i18n_messages mt ON mt.key = 'psychApp.' || mr.title_key
LEFT JOIN public.i18n_messages md ON md.key = 'psychApp.' || mr.desc_key;

-- Məşqlər (exercises): AZ ad, əzələ qrupu, təlimat
INSERT INTO public.exercises (name, muscle_group, equipment, difficulty, instructions, media_url)
SELECT COALESCE(mn.value_az, ge.code),
       COALESCE(mt.value_az, ge.target_key),
       'none',
       NULL,
       COALESCE(mg.value_az, ge.guide_key),
       NULL
FROM public.gym_exercises ge
LEFT JOIN public.i18n_messages mn ON mn.key = 'gymApp.' || ge.name_key
LEFT JOIN public.i18n_messages mt ON mt.key = 'gymApp.' || ge.target_key
LEFT JOIN public.i18n_messages mg ON mg.key = 'gymApp.' || ge.guide_key;

-- Təlim proqramları (workouts): 3 idman planı
INSERT INTO public.workouts (title, description, level, goal_tags, duration_min, equipment_needed, image_url, is_premium, is_published)
SELECT COALESCE(mn.value_az, wp.slug),
       COALESCE(md.value_az, wp.desc_key),
       wp.level::text,
       ARRAY[]::text[],
       NULL,
       ARRAY[]::text[],
       wp.image_url,
       FALSE,
       TRUE
FROM public.world_plans wp
LEFT JOIN public.i18n_messages mn ON mn.key = 'gymHome.' || wp.name_key
LEFT JOIN public.i18n_messages md ON md.key = 'gymHome.' || wp.desc_key
WHERE wp.world_id = 'gym';

-- Proqram-məşq əlaqələri (gün mövqeyi = (gün-1)*100 + sıra)
INSERT INTO public.workout_exercises (workout_id, exercise_id, position, sets, reps, duration_sec, rest_sec)
SELECT w.id,
       ex.id,
       (gwd.day - 1) * 100 + gwe.sort_order,
       gwe.sets,
       CASE WHEN gwe.reps_type IN ('reps','each') THEN gwe.reps_a END,
       CASE WHEN gwe.reps_type IN ('secs','time') THEN gwe.reps_a END,
       gwe.rest_seconds
FROM public.gym_workout_exercises gwe
JOIN public.gym_workout_days gwd ON gwd.id = gwe.day_id
JOIN public.world_plans wp ON wp.id = gwd.plan_id AND wp.world_id = 'gym'
JOIN public.gym_exercises ge ON ge.code = gwe.exercise_code
LEFT JOIN public.i18n_messages me ON me.key = 'gymApp.' || ge.name_key
LEFT JOIN public.i18n_messages mp ON mp.key = 'gymHome.' || wp.name_key
JOIN public.exercises ex ON ex.name = COALESCE(me.value_az, ge.code)
JOIN public.workouts w  ON w.title  = COALESCE(mp.value_az, wp.slug);

-- Kitablar: AZ başlıq + resenye
INSERT INTO public.books (title, author, description, category, language, page_count, cover_url, is_premium, is_published)
SELECT COALESCE(mn.value_az, lb.slug),
       lb.author,
       COALESCE(mb.value_az, lb.blurb_key),
       NULL,
       'az',
       lb.pages,
       NULL,
       FALSE,
       TRUE
FROM public.library_books lb
JOIN public.world_items wi ON wi.world_id = 'library' AND wi.slug = lb.slug
LEFT JOIN public.i18n_messages mn ON mn.key = 'libraryApp.' || wi.name_key
LEFT JOIN public.i18n_messages mb ON mb.key = 'libraryApp.' || lb.blurb_key;
