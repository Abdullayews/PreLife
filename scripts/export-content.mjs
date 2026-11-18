/**
 * export-content.mjs — generates the Supabase seed SQL from the static
 * content libs (src/lib/*.ts) and the i18n catalogs (messages/*.json).
 *
 * Run with bun (it imports the TS libs directly):
 *   bun scripts/export-content.mjs
 *
 * Output:
 *   db/seed-content.sql     — all content tables (groups 2–7)
 *   db/seed-i18n-*.sql      — i18n_messages in N chunks (group 1)
 *
 * Deterministic and idempotent: every file starts with TRUNCATE …
 * RESTART IDENTITY CASCADE, and identity sequences are re-synced with
 * setval() after the explicit-id inserts.
 */
import * as Lucide from "lucide-react";
import { worlds } from "../src/lib/worlds.ts";
import {
  STORES, SHOP_CATALOG, GYM_PLACES, HALL_EQUIPMENT, TRAINER_SPECS,
  HALL_DETAILS, PLAN_WEEKS, EXERCISES, WORKOUTS,
} from "../src/lib/gym.ts";
import { RECIPE_DETAILS, VENUE_DETAILS } from "../src/lib/nutrition.ts";
import {
  PSYCHOLOGISTS, MEDIA, TDB_VIDEOS, MOOD_TAGS, QUIZZES,
  DAILY_QUOTE_KEYS, JOURNAL_PROMPT_KEYS,
} from "../src/lib/psychology.ts";
import { BOOK_DETAILS, LIB_VENUE_DETAILS } from "../src/lib/library.ts";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

/* ── Lucide reverse registry: component → export name ─────────────────── */
const iconByName = new Map();
for (const [name, val] of Object.entries(Lucide)) {
  // Skip the Lucide* aliases (same component, prefixed export) and helpers.
  if (name.startsWith("Lucide") || /^(createLucideIcon|icons|Icon)$/.test(name)) continue;
  if (val && (typeof val === "function" || typeof val === "object") && !iconByName.has(val)) {
    iconByName.set(val, name);
  }
}
const iconName = (icon) => iconByName.get(icon) ?? "Sparkles";

/* ── SQL helpers ────────────────────────────────────────────────────────── */
const q = (s) =>
  s === null || s === undefined ? "NULL" : `'${String(s).replace(/'/g, "''")}'`;
const n = (v) => (v === null || v === undefined ? "NULL" : String(v));
const qArr = (arr) =>
  arr.length === 0 ? "'{}'::text[]" : `ARRAY[${arr.map(q).join(",")}]::text[]`;
const qJson = (v) => `${q(JSON.stringify(v))}::jsonb`;

const out = [];
const emit = (sql) => out.push(sql);

const CONTENT_TABLES = [
  "i18n_messages",
  "world_place_features", "world_places", "world_schedule_cells",
  "world_schedule_kinds", "world_schedule_slots", "world_cando",
  "world_items", "world_plan_meta", "world_plans", "worlds",
  "gym_place_features", "gym_place_equipment", "gym_trainers", "gym_places",
  "gym_equipment", "gym_trainer_specs", "gym_stores", "gym_product_offers",
  "gym_products", "gym_exercises", "gym_workout_exercises",
  "gym_workout_days", "gym_plan_progress",
  "diet_recipe_ingredients", "diet_recipes", "diet_place_details",
  "psychologist_certificates", "psychologist_availability",
  "psychologist_languages", "psychologist_formats",
  "psychologist_specialties", "psych_specialties", "psychologists",
  "media_resources", "mood_tags", "quizzes", "daily_quotes",
  "journal_prompts", "library_books", "library_place_details",
  "subscription_tier_features", "subscription_tiers", "subscription_features",
];

/* ══════════════════════════════════════════════════════════════════════════
   GROUP 2 — worlds
   ══════════════════════════════════════════════════════════════════════════ */

const worldSlugs = Object.keys(worlds); // gym, diet, meditation, library
emit(`-- ══ Worlds ═════════════════════════════════════════════════════════`);
worldSlugs.forEach((slug, i) => {
  const w = worlds[slug];
  emit(
    `INSERT INTO worlds (id, ns, anchor_plans, anchor_items, anchor_places, prefix_items, prefix_places, hero_images, hero_positions, hero_stats, initials, sort_order) VALUES (` +
    `${q(w.slug)}, ${q(w.ns)}, ${q(w.ids.plans)}, ${q(w.ids.items)}, ${q(w.ids.places)}, ` +
    `${q(w.prefix.items)}, ${q(w.prefix.places)}, ${qArr(w.hero.images)}, ${qArr(w.hero.positions)}, ` +
    `${qJson(w.hero.stats)}, ${qArr(w.initials)}, ${i});`,
  );
});

/* world_plans — explicit ids 1..N so workouts/progress can reference them */
const planId = new Map(); // `${world}:${slug}` → bigint id
{
  let id = 0;
  const rows = [];
  const metas = [];
  for (const slug of worldSlugs) {
    const w = worlds[slug];
    w.plans.forEach((p, idx) => {
      id += 1;
      planId.set(`${slug}:${p.id}`, id);
      rows.push(
        `(${id}, ${q(slug)}, ${q(p.id)}, ${q(p.nameKey)}, ${q(p.descKey)}, ${q(p.image)}, ` +
        `${q(p.level)}, ${p.featured ? "true" : "false"}, ${idx})`,
      );
      p.meta.forEach(([k, v], mi) => {
        metas.push(`(${id}, ${q(k)}, ${v}, ${mi})`);
      });
    });
  }
  emit(`INSERT INTO world_plans (id, world_id, slug, name_key, desc_key, image_url, level, featured, sort_order) VALUES\n  ${rows.join(",\n  ")};`);
  emit(`INSERT INTO world_plan_meta (plan_id, meta_key, value, sort_order) VALUES\n  ${metas.join(",\n  ")};`);
}

/* world_items */
{
  const rows = [];
  for (const slug of worldSlugs) {
    worlds[slug].items.forEach((it, idx) => {
      rows.push(
        `(${q(slug)}, ${q(it.id)}, ${q(it.nameKey)}, ${q(it.targetKey)}, ` +
        `${q(iconName(it.icon))}, ${q(it.level)}, ${idx})`,
      );
    });
  }
  emit(`INSERT INTO world_items (world_id, slug, name_key, target_key, icon, level, sort_order) VALUES\n  ${rows.join(",\n  ")};`);
}

/* world_cando */
{
  const rows = [];
  for (const slug of worldSlugs) {
    worlds[slug].canDo.forEach((c, idx) => {
      rows.push(`(${q(slug)}, ${q(iconName(c.icon))}, ${q(c.titleKey)}, ${q(c.descKey)}, ${idx})`);
    });
  }
  emit(`INSERT INTO world_cando (world_id, icon, title_key, desc_key, sort_order) VALUES\n  ${rows.join(",\n  ")};`);
}

/* world_schedule_slots (explicit ids) + cells + kinds */
{
  let slotId = 0;
  const slotRows = [];
  const cellRows = [];
  const kindRows = [];
  for (const slug of worldSlugs) {
    const s = worlds[slug].schedule;
    Object.entries(s.cellKeys).forEach(([code, labelKey], i) => {
      kindRows.push(`(${q(slug)}, ${q(code)}, ${q(labelKey)}, ${i})`);
    });
    s.slots.forEach((slot, idx) => {
      slotId += 1;
      slotRows.push(`(${slotId}, ${q(slug)}, ${q(slot.time)}, ${q(slot.labelKey)}, ${idx})`);
      slot.cells.forEach((cell, day) => {
        cellRows.push(`(${slotId}, ${day}, ${q(cell)})`);
      });
    });
  }
  emit(`INSERT INTO world_schedule_slots (id, world_id, time, label_key, sort_order) VALUES\n  ${slotRows.join(",\n  ")};`);
  emit(`INSERT INTO world_schedule_kinds (world_id, code, label_key, sort_order) VALUES\n  ${kindRows.join(",\n  ")};`);
  emit(`INSERT INTO world_schedule_cells (slot_id, day_index, cell_code) VALUES\n  ${cellRows.join(",\n  ")};`);
}

/* world_places (explicit ids 1..N) + features */
const placeId = new Map(); // `${world}:${slug}` → bigint id
{
  let id = 0;
  const rows = [];
  const feats = [];
  for (const slug of worldSlugs) {
    worlds[slug].places.forEach((p, idx) => {
      id += 1;
      placeId.set(`${slug}:${p.id}`, id);
      rows.push(`(${id}, ${q(slug)}, ${q(p.id)}, ${q(p.nameKey)}, ${q(p.descKey)}, ${q(p.image)}, ${p.rating}, ${idx})`);
      p.featureKeys.forEach((k, ki) => feats.push(`(${id}, ${q(k)}, ${ki})`));
    });
  }
  emit(`INSERT INTO world_places (id, world_id, slug, name_key, desc_key, image_url, rating, sort_order) VALUES\n  ${rows.join(",\n  ")};`);
  emit(`INSERT INTO world_place_features (place_id, feature_key, sort_order) VALUES\n  ${feats.join(",\n  ")};`);
}

/* ══════════════════════════════════════════════════════════════════════════
   GROUP 3 — gym
   ══════════════════════════════════════════════════════════════════════════ */

emit(`-- ══ Gym ═════════════════════════════════════════════════════════════`);
const welcomeGymIds = new Set(worlds.gym.places.map((p) => p.id));
const gymPlaceId = new Map(); // slug → bigint id
{
  const rows = [];
  const feats = [];
  GYM_PLACES.forEach((g, idx) => {
    const id = idx + 1;
    gymPlaceId.set(g.id, id);
    rows.push(
      `(${id}, ${q(g.id)}, ${q(g.ns)}, ${q(g.nameKey)}, ${q(g.descKey)}, ${q(g.image)}, ` +
      `${g.rating}, ${q(g.address)}, ${q(g.hours)}, ${g.dayPrice}, ` +
      `${welcomeGymIds.has(g.id) ? "true" : "false"}, ${idx})`,
    );
    g.featureKeys.forEach((k, ki) => feats.push(`(${id}, ${q(k)}, ${ki})`));
  });
  emit(`INSERT INTO gym_places (id, slug, ns, name_key, desc_key, image_url, rating, address, hours, day_price, welcome_visible, sort_order) VALUES\n  ${rows.join(",\n  ")};`);
  emit(`INSERT INTO gym_place_features (gym_place_id, feature_key, sort_order) VALUES\n  ${feats.join(",\n  ")};`);
}

/* equipment master + per-hall equipment + trainer specs + trainers */
{
  emit(`INSERT INTO gym_equipment (code, name_key, sort_order) VALUES\n  ${HALL_EQUIPMENT.map((c, i) => `(${q(c)}, ${q(`hallEq.${c}`)}, ${i})`).join(",\n  ")};`);
  emit(`INSERT INTO gym_trainer_specs (code, name_key, sort_order) VALUES\n  ${TRAINER_SPECS.map((c, i) => `(${q(c)}, ${q(`hallSpec.${c}`)}, ${i})`).join(",\n  ")};`);

  const eqRows = [];
  const trRows = [];
  GYM_PLACES.forEach((g) => {
    const details = HALL_DETAILS[g.id];
    details.equipment.forEach((code, i) => {
      eqRows.push(`(${gymPlaceId.get(g.id)}, ${q(code)}, ${i})`);
    });
    details.trainers.forEach((tr, i) => {
      trRows.push(`(${gymPlaceId.get(g.id)}, ${q(tr.name)}, ${q(tr.spec)}, ${tr.years}, ${i})`);
    });
  });
  emit(`INSERT INTO gym_place_equipment (gym_place_id, equipment_code, sort_order) VALUES\n  ${eqRows.join(",\n  ")};`);
  emit(`INSERT INTO gym_trainers (gym_place_id, name, spec_code, years, sort_order) VALUES\n  ${trRows.join(",\n  ")};`);
}

/* stores + products + offers */
{
  emit(`INSERT INTO gym_stores (slug, name, kind, url, sort_order) VALUES\n  ${
    Object.values(STORES).map((s, i) => `(${q(s.slug)}, ${q(s.name)}, ${q(s.kind)}, ${q(s.url)}, ${i})`).join(",\n  ")
  };`);

  const rows = [];
  const offers = [];
  let pid = 0;
  for (const cat of SHOP_CATALOG) {
    cat.items.forEach((p, idx) => {
      pid += 1;
      rows.push(
        `(${pid}, ${q(cat.id)}, ${q(p.id)}, ${q(p.nameKey)}, ${q(p.brand)}, ${q(iconName(p.icon))}, ` +
        `${p.price[0]}, ${p.price[1]}, ${p.image ? q(p.image) : "NULL"}, ${idx})`,
      );
      p.at.forEach((a, ai) => offers.push(`(${pid}, ${q(a.store)}, ${a.price}, ${ai})`));
    });
  }
  emit(`INSERT INTO gym_products (id, category, slug, name_key, brand, icon, price_min, price_max, image_url, sort_order) VALUES\n  ${rows.join(",\n  ")};`);
  emit(`INSERT INTO gym_product_offers (product_id, store_slug, price, sort_order) VALUES\n  ${offers.join(",\n  ")};`);
}

/* exercises + workout days/exercises + plan progress */
{
  emit(`INSERT INTO gym_exercises (code, name_key, target_key, guide_key, sort_order) VALUES\n  ${
    Object.entries(EXERCISES).map(([code, ex], i) =>
      `(${q(code)}, ${q(ex.nameKey)}, ${q(ex.targetKey)}, ${q(ex.guideKey)}, ${i})`).join(",\n  ")
  };`);

  const dayRows = [];
  const exRows = [];
  let did = 0;
  for (const [planSlug, days] of Object.entries(WORKOUTS)) {
    const pid = planId.get(`gym:${planSlug}`);
    days.forEach((d, di) => {
      did += 1;
      dayRows.push(`(${did}, ${pid}, ${d.day}, ${di})`);
      d.exercises.forEach((pe, ei) => {
        exRows.push(
          `(${did}, ${q(pe.ex)}, ${pe.sets}, ${q(pe.reps.t)}, ${pe.reps.a}, ` +
          `${pe.reps.b === undefined ? "NULL" : pe.reps.b}, ${pe.rest}, ${ei})`,
        );
      });
    });
  }
  emit(`INSERT INTO gym_workout_days (id, plan_id, day, sort_order) VALUES\n  ${dayRows.join(",\n  ")};`);
  emit(`INSERT INTO gym_workout_exercises (day_id, exercise_code, sets, reps_type, reps_a, reps_b, rest_seconds, sort_order) VALUES\n  ${exRows.join(",\n  ")};`);

  emit(`INSERT INTO gym_plan_progress (plan_id, week, total) VALUES\n  ${
    Object.entries(PLAN_WEEKS).map(([slug, w]) => `(${planId.get(`gym:${slug}`)}, ${w.week}, ${w.total})`).join(",\n  ")
  };`);
}

/* ══════════════════════════════════════════════════════════════════════════
   GROUP 4 — diet details
   ══════════════════════════════════════════════════════════════════════════ */

emit(`-- ══ Diet ═════════════════════════════════════════════════════════════`);
{
  const rows = [];
  const ing = [];
  Object.values(RECIPE_DETAILS).forEach((r, i) => {
    rows.push(`(${q(r.id)}, ${r.minutes}, ${r.kcal})`);
    r.ingredients.forEach((k, ki) => ing.push(`(${q(r.id)}, ${q(k)}, ${ki})`));
  });
  emit(`INSERT INTO diet_recipes (slug, minutes, kcal) VALUES\n  ${rows.join(",\n  ")};`);
  emit(`INSERT INTO diet_recipe_ingredients (recipe_slug, ingredient_key, sort_order) VALUES\n  ${ing.join(",\n  ")};`);

  emit(`INSERT INTO diet_place_details (place_id, address, hours, map_query) VALUES\n  ${
    Object.values(VENUE_DETAILS).map((v) =>
      `(${placeId.get(`diet:${v.id}`)}, ${q(v.address)}, ${q(v.hours)}, ${q(v.mapQuery)})`).join(",\n  ")
  };`);
}

/* ══════════════════════════════════════════════════════════════════════════
   GROUP 5 — psychology
   ══════════════════════════════════════════════════════════════════════════ */

emit(`-- ══ Psychology ═══════════════════════════════════════════════════════`);
{
  const rows = PSYCHOLOGISTS.map((p, i) =>
    `(${q(p.slug)}, ${q(p.nameKey)}, ${q(p.titleKey)}, ${q(p.bioKey)}, ${q(p.image)}, ` +
    `${p.rating}, ${p.price}, ${q(p.initials)}, ${p.since}, ${q(p.eduKey)}, ${q(p.rulesKey)}, ${i})`);
  emit(`INSERT INTO psychologists (slug, name_key, title_key, bio_key, image_url, rating, price, initials, since_year, edu_key, rules_key, sort_order) VALUES\n  ${rows.join(",\n  ")};`);

  const specCodes = new Set(PSYCHOLOGISTS.flatMap((p) => p.specialties));
  emit(`INSERT INTO psych_specialties (code, sort_order) VALUES\n  ${
    [...specCodes].map((c, i) => `(${q(c)}, ${i})`).join(",\n  ")
  };`);

  const specs = [];
  const formats = [];
  const langs = [];
  const avail = [];
  const certs = [];
  PSYCHOLOGISTS.forEach((p) => {
    p.specialties.forEach((s, i) => specs.push(`(${q(p.slug)}, ${q(s)}, ${i})`));
    p.formats.forEach((f, i) => formats.push(`(${q(p.slug)}, ${q(f)}, ${i})`));
    p.languages.forEach((l, i) => langs.push(`(${q(p.slug)}, ${q(l)}, ${i})`));
    p.availability.forEach((b, i) => avail.push(`(${q(p.slug)}, ${b.day}, ${b.from}, ${b.to}, ${i})`));
    p.certKeys.forEach((c, i) => certs.push(`(${q(p.slug)}, ${q(c)}, ${i})`));
  });
  emit(`INSERT INTO psychologist_specialties (psychologist_slug, specialty_code, sort_order) VALUES\n  ${specs.join(",\n  ")};`);
  emit(`INSERT INTO psychologist_formats (psychologist_slug, format, sort_order) VALUES\n  ${formats.join(",\n  ")};`);
  emit(`INSERT INTO psychologist_languages (psychologist_slug, lang, sort_order) VALUES\n  ${langs.join(",\n  ")};`);
  emit(`INSERT INTO psychologist_availability (psychologist_slug, day, from_hour, to_hour, sort_order) VALUES\n  ${avail.join(",\n  ")};`);
  emit(`INSERT INTO psychologist_certificates (psychologist_slug, cert_key, sort_order) VALUES\n  ${certs.join(",\n  ")};`);

  const media = [
    ...MEDIA.map((m) => ({ ...m, collection: "practice" })),
    ...TDB_VIDEOS.map((m) => ({ ...m, collection: "tdb" })),
  ];
  emit(`INSERT INTO media_resources (id, kind, collection, title_key, desc_key, minutes, src, poster, sort_order) VALUES\n  ${
    media.map((m, i) =>
      `(${q(m.id)}, ${q(m.kind)}, ${q(m.collection)}, ${q(m.titleKey)}, ${q(m.descKey)}, ${m.minutes}, ${q(m.src)}, ${q(m.poster)}, ${i % 10})`).join(",\n  ")
  };`);

  emit(`INSERT INTO mood_tags (code, sort_order) VALUES\n  ${MOOD_TAGS.map((t, i) => `(${q(t)}, ${i})`).join(",\n  ")};`);
  emit(`INSERT INTO quizzes (code, question_count, sort_order) VALUES\n  ${QUIZZES.map((z, i) => `(${q(z.id)}, ${z.questions}, ${i})`).join(",\n  ")};`);
  emit(`INSERT INTO daily_quotes (msg_key, sort_order) VALUES\n  ${DAILY_QUOTE_KEYS.map((k, i) => `(${q(k)}, ${i})`).join(",\n  ")};`);
  emit(`INSERT INTO journal_prompts (msg_key, sort_order) VALUES\n  ${JOURNAL_PROMPT_KEYS.map((k, i) => `(${q(k)}, ${i})`).join(",\n  ")};`);
}

/* ══════════════════════════════════════════════════════════════════════════
   GROUP 6 — library
   ══════════════════════════════════════════════════════════════════════════ */

emit(`-- ══ Library ══════════════════════════════════════════════════════════`);
{
  emit(`INSERT INTO library_books (slug, author, pages, minutes, blurb_key) VALUES\n  ${
    Object.values(BOOK_DETAILS).map((b) =>
      `(${q(b.id)}, ${q(b.author)}, ${b.pages}, ${b.minutes}, ${q(b.blurbKey)})`).join(",\n  ")
  };`);
  emit(`INSERT INTO library_place_details (place_id, address, hours, map_query) VALUES\n  ${
    Object.values(LIB_VENUE_DETAILS).map((v) =>
      `(${placeId.get(`library:${v.id}`)}, ${q(v.address)}, ${q(v.hours)}, ${q(v.mapQuery)})`).join(",\n  ")
  };`);
}

/* ══════════════════════════════════════════════════════════════════════════
   GROUP 7 — subscriptions
   ══════════════════════════════════════════════════════════════════════════ */

emit(`-- ══ Subscriptions ════════════════════════════════════════════════════`);
{
  const FEATURES = [
    ["gym", "feat.gym", 3], ["diet", "feat.diet", 3], ["psych", "feat.psych", 4],
    ["library", "feat.library", 2], ["ai", "feat.ai", 2], ["videos", "feat.videos", 2],
    ["coaching", "feat.coaching", 6], ["family", "feat.family", 5],
  ];
  const TIERS = [
    ["plus", "plans.plus.name", 7, ["gym", "diet", "ai"]],
    ["pro", "plans.pro.name", 12, ["gym", "diet", "psych", "library", "ai", "videos"]],
    ["ultra", "plans.ultra.name", 19, ["gym", "diet", "psych", "library", "ai", "videos", "coaching", "family"]],
  ];
  emit(`INSERT INTO subscription_features (code, name_key, price, sort_order) VALUES\n  ${
    FEATURES.map(([c, k, p], i) => `(${q(c)}, ${q(k)}, ${p}, ${i})`).join(",\n  ")
  };`);
  emit(`INSERT INTO subscription_tiers (code, name_key, price, sort_order) VALUES\n  ${
    TIERS.map(([c, k, p], i) => `(${q(c)}, ${q(k)}, ${p}, ${i})`).join(",\n  ")
  };`);
  const tf = [];
  TIERS.forEach(([code, , , feats]) => feats.forEach((f, i) => tf.push(`(${q(code)}, ${q(f)}, ${i})`)));
  emit(`INSERT INTO subscription_tier_features (tier_code, feature_code, sort_order) VALUES\n  ${tf.join(",\n  ")};`);
}

/* ── sequence re-sync after explicit-id inserts ─────────────────────────── */
const setvalTables = [
  "world_plans", "world_places", "world_schedule_slots",
  "gym_places", "gym_products", "gym_workout_days",
];
emit(setvalTables.map((t) =>
  `SELECT setval(pg_get_serial_sequence('${t}', 'id'), COALESCE((SELECT MAX(id) FROM ${t}), 0) + 1, false);`,
).join("\n"));

/* ══════════════════════════════════════════════════════════════════════════
   GROUP 1 — i18n catalog (flattened, merged across locales)
   ══════════════════════════════════════════════════════════════════════════ */

const flatten = (obj, prefix = "") => {
  const rows = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) Object.assign(rows, flatten(v, key));
    else rows[key] = String(v);
  }
  return rows;
};

const catalogs = {};
for (const locale of ["az", "en", "ru"]) {
  catalogs[locale] = flatten(JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8")));
}
const allKeys = [...new Set([
  ...Object.keys(catalogs.az), ...Object.keys(catalogs.en), ...Object.keys(catalogs.ru),
])].sort();

const pickVal = (locale, key) => {
  const v = catalogs[locale][key];
  if (v !== undefined) return v;
  return catalogs.az[key] ?? catalogs.en[key] ?? catalogs.ru[key] ?? "";
};

/* ── write files ────────────────────────────────────────────────────────── */
mkdirSync(new URL("../db/", import.meta.url), { recursive: true });

const truncate = `TRUNCATE ${CONTENT_TABLES.join(", ")} RESTART IDENTITY CASCADE;`;
writeFileSync(new URL("../db/seed-content.sql", import.meta.url), `${truncate}\n\n${out.join("\n")}\n`);
console.log(`db/seed-content.sql — ${out.length} statements`);

const CHUNK = 350;
const chunks = [];
for (let i = 0; i < allKeys.length; i += CHUNK) {
  const rows = allKeys.slice(i, i + CHUNK).map((key) =>
    `(${q(key)}, ${q(pickVal("az", key))}, ${q(pickVal("en", key))}, ${q(pickVal("ru", key))})`);
  chunks.push(`INSERT INTO i18n_messages (key, value_az, value_en, value_ru) VALUES\n  ${rows.join(",\n  ")};`);
}
chunks.forEach((sql, i) => {
  writeFileSync(new URL(`../db/seed-i18n-${i + 1}.sql`, import.meta.url), `${sql}\n`);
});
console.log(`db/seed-i18n-*.sql — ${allKeys.length} keys × 3 locales in ${chunks.length} chunks`);
