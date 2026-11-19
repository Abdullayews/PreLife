import { supaSelect, type SupaParams } from "./supa";
import { ttlGet, ttlPut } from "./ttl";

/**
 * Content assembly — the direct port of the Rust content.rs. Reads the
 * normalized Supabase tables and rebuilds the exact JSON the frontend
 * expects (same keys, same shapes, same ordering). Results are cached
 * in-process for 60s, like the Rust service's TTL cache.
 */

type Row = Record<string, unknown>;

/* ── Row-grouping helpers ────────────────────────────────────────────────── */

function group<T extends Row>(rows: T[], key: string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const k = r[key];
    if (typeof k === "string") {
      const list = map.get(k);
      if (list) list.push(r);
      else map.set(k, [r]);
    }
  }
  return map;
}

function groupNum<T extends Row>(rows: T[], key: string): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const r of rows) {
    const k = r[key];
    if (typeof k === "number") {
      const list = map.get(k);
      if (list) list.push(r);
      else map.set(k, [r]);
    }
  }
  return map;
}

function s(row: Row, key: string): string {
  const v = row[key];
  return typeof v === "string" ? v : "";
}

/* ── Shared world assembly ───────────────────────────────────────────────── */

type WorldData = {
  plans: unknown[];
  items: unknown[];
  places: unknown[];
  schedule: Record<string, unknown>;
};

async function sel(table: string, params: SupaParams): Promise<Row[]> {
  return (await supaSelect(table, params)) as Row[];
}

async function worldRows(worldId: string): Promise<WorldData> {
  const wf = `eq.${worldId}`;

  const plans = await sel("world_plans", [
    ["select", "*"], ["world_id", wf], ["order", "sort_order.asc"],
  ]);
  const allMetas = await sel("world_plan_meta", [
    ["select", "plan_id,meta_key,value"],
  ]);
  const planIds = new Set(plans.map((p) => p.id).filter((v): v is number => typeof v === "number"));
  const metas = allMetas.filter((m) => typeof m.plan_id === "number" && planIds.has(m.plan_id));

  const items = await sel("world_items", [
    ["select", "*"], ["world_id", wf], ["order", "sort_order.asc"],
  ]);
  const places = await sel("world_places", [
    ["select", "*"], ["world_id", wf], ["order", "sort_order.asc"],
  ]);
  const placeFeats = await sel("world_place_features", [
    ["select", "place_id,feature_key,sort_order"],
  ]);

  const slots = await sel("world_schedule_slots", [
    ["select", "*"], ["world_id", wf], ["order", "sort_order.asc"],
  ]);
  const kinds = await sel("world_schedule_kinds", [
    ["select", "code,label_key,sort_order"], ["world_id", wf], ["order", "sort_order.asc"],
  ]);
  const allCells = await sel("world_schedule_cells", [
    ["select", "slot_id,day_index,cell_code"],
  ]);
  const slotIds = new Set(slots.map((x) => x.id).filter((v): v is number => typeof v === "number"));
  const cells = allCells.filter((c) => typeof c.slot_id === "number" && slotIds.has(c.slot_id));

  const metaByPlan = groupNum(metas, "plan_id");
  const featByPlace = groupNum(placeFeats, "place_id");
  const cellsBySlot = groupNum(cells, "slot_id");

  const plansJson = plans.map((p) => {
    const id = typeof p.id === "number" ? p.id : 0;
    const meta = (metaByPlan.get(id) ?? []).map((m) => [s(m, "meta_key"), m.value]);
    return {
      id: s(p, "slug"),
      nameKey: s(p, "name_key"),
      descKey: s(p, "desc_key"),
      image: s(p, "image_url"),
      level: s(p, "level"),
      featured: p.featured === true,
      meta,
    };
  });

  const itemsJson = items.map((it) => ({
    id: s(it, "slug"),
    nameKey: s(it, "name_key"),
    targetKey: s(it, "target_key"),
    icon: s(it, "icon"),
    level: s(it, "level"),
  }));

  const placesJson = places.map((p) => {
    const id = typeof p.id === "number" ? p.id : 0;
    const feats = (featByPlace.get(id) ?? []).map((f) => s(f, "feature_key"));
    return {
      id: s(p, "slug"),
      nameKey: s(p, "name_key"),
      descKey: s(p, "desc_key"),
      image: s(p, "image_url"),
      rating: p.rating ?? null,
      featureKeys: feats,
    };
  });

  const cellKeys: Record<string, string> = {};
  for (const k of kinds) cellKeys[s(k, "code")] = s(k, "label_key");

  const slotsJson = slots.map((slot) => {
    const id = typeof slot.id === "number" ? slot.id : 0;
    const dayCells = (cellsBySlot.get(id) ?? [])
      .map((c) => ({ day: c.day_index, code: s(c, "cell_code") }))
      .filter((c): c is { day: number; code: string } => typeof c.day === "number")
      .sort((a, b) => a.day - b.day)
      .map((c) => c.code);
    return {
      time: s(slot, "time"),
      labelKey: s(slot, "label_key"),
      cells: dayCells,
    };
  });

  return {
    plans: plansJson,
    items: itemsJson,
    places: placesJson,
    schedule: { slots: slotsJson, cellKeys },
  };
}

/* ── GET /api/content/worlds ─────────────────────────────────────────────── */

export async function worldsCatalog(): Promise<Record<string, unknown>> {
  const cached = await ttlGet<Record<string, unknown>>("content:worlds");
  if (cached) return cached;

  const worldList = await sel("worlds", [["select", "*"], ["order", "sort_order.asc"]]);
  const cando = await sel("world_cando", [
    ["select", "world_id,icon,title_key,desc_key,sort_order"],
  ]);
  const candoByWorld = group(cando, "world_id");

  const worldsMap: Record<string, unknown> = {};
  for (const w of worldList) {
    const id = s(w, "id");
    const data = await worldRows(id);
    const canDo = (candoByWorld.get(id) ?? []).map((c) => ({
      icon: s(c, "icon"),
      titleKey: s(c, "title_key"),
      descKey: s(c, "desc_key"),
    }));
    worldsMap[id] = {
      slug: id,
      ns: s(w, "ns"),
      ids: { plans: s(w, "anchor_plans"), items: s(w, "anchor_items"), places: s(w, "anchor_places") },
      prefix: { items: s(w, "prefix_items"), places: s(w, "prefix_places") },
      hero: {
        images: w.hero_images ?? [],
        positions: w.hero_positions ?? [],
        stats: w.hero_stats ?? [],
      },
      plans: data.plans,
      items: data.items,
      canDo,
      schedule: data.schedule,
      initials: w.initials ?? [],
      places: data.places,
    };
  }

  // Landing frames: the banner still-life + each world's lead photo.
  const frames: { src: string; pos: unknown }[] = [{ src: "/img/banner.png", pos: "center" }];
  for (const w of worldList) {
    const images = Array.isArray(w.hero_images) ? w.hero_images : [];
    const positions = Array.isArray(w.hero_positions) ? w.hero_positions : [];
    const img = images[0];
    const pos = positions[0];
    if (typeof img === "string" && pos !== undefined) {
      frames.push({ src: img, pos });
    }
  }

  const out = { worlds: worldsMap, landingFrames: frames };
  ttlPut("content:worlds", out);
  return out;
}

/* ── GET /api/content/gym ────────────────────────────────────────────────── */

export async function gymCatalog(): Promise<Record<string, unknown>> {
  const cached = await ttlGet<Record<string, unknown>>("content:gym");
  if (cached) return cached;

  const world = await worldRows("gym");

  const places = await sel("gym_places", [["select", "*"], ["order", "sort_order.asc"]]);
  const feats = await sel("gym_place_features", [
    ["select", "gym_place_id,feature_key,sort_order"],
  ]);
  const equipment = await sel("gym_place_equipment", [
    ["select", "gym_place_id,equipment_code,sort_order"],
  ]);
  const trainers = await sel("gym_trainers", [
    ["select", "gym_place_id,name,spec_code,years,sort_order"],
  ]);

  const featBy = groupNum(feats, "gym_place_id");
  const eqBy = groupNum(equipment, "gym_place_id");
  const trBy = groupNum(trainers, "gym_place_id");

  const placesJson = places.map((p) => {
    const id = typeof p.id === "number" ? p.id : 0;
    const featureKeys = (featBy.get(id) ?? []).map((f) => s(f, "feature_key"));
    const eq = (eqBy.get(id) ?? [])
      .map((e) => ({ o: typeof e.sort_order === "number" ? e.sort_order : 0, code: s(e, "equipment_code") }))
      .sort((a, b) => a.o - b.o)
      .map((e) => e.code);
    const tr = (trBy.get(id) ?? [])
      .map((t) => ({
        o: typeof t.sort_order === "number" ? t.sort_order : 0,
        v: {
          name: s(t, "name"),
          spec: s(t, "spec_code"),
          years: typeof t.years === "number" ? t.years : 0,
        },
      }))
      .sort((a, b) => a.o - b.o)
      .map((t) => t.v);
    return {
      id: s(p, "slug"),
      ns: s(p, "ns"),
      nameKey: s(p, "name_key"),
      descKey: s(p, "desc_key"),
      image: s(p, "image_url"),
      rating: p.rating ?? null,
      featureKeys,
      address: s(p, "address"),
      hours: s(p, "hours"),
      dayPrice: p.day_price ?? null,
      equipment: eq,
      trainers: tr,
    };
  });

  const stores = await sel("gym_stores", [["select", "*"], ["order", "sort_order.asc"]]);
  const storesMap: Record<string, unknown> = {};
  for (const st of stores) {
    storesMap[s(st, "slug")] = {
      slug: s(st, "slug"), name: s(st, "name"), kind: s(st, "kind"), url: s(st, "url"),
    };
  }

  const products = await sel("gym_products", [
    ["select", "*"], ["order", "category.asc,sort_order.asc"],
  ]);
  const offers = await sel("gym_product_offers", [
    ["select", "product_id,store_slug,price,sort_order"],
  ]);
  const offersBy = groupNum(offers, "product_id");
  const catalog: Record<string, unknown> = {};
  for (const cat of ["equipment", "supplements", "accessories", "clothing"]) {
    const list = products
      .filter((p) => s(p, "category") === cat)
      .map((p) => {
        const id = typeof p.id === "number" ? p.id : 0;
        const at = (offersBy.get(id) ?? [])
          .map((o) => ({ o: typeof o.sort_order === "number" ? o.sort_order : 0, v: { store: s(o, "store_slug"), price: o.price ?? null } }))
          .sort((a, b) => a.o - b.o)
          .map((o) => o.v);
        return {
          id: s(p, "slug"),
          nameKey: s(p, "name_key"),
          brand: s(p, "brand"),
          icon: s(p, "icon"),
          price: [p.price_min ?? null, p.price_max ?? null],
          image: typeof p.image_url === "string" ? p.image_url : null,
          at,
        };
      });
    catalog[cat] = list;
  }

  const exercises = await sel("gym_exercises", [
    ["select", "code,name_key,target_key,guide_key,sort_order"], ["order", "sort_order.asc"],
  ]);
  const exMap: Record<string, unknown> = {};
  for (const ex of exercises) {
    exMap[s(ex, "code")] = {
      nameKey: s(ex, "name_key"), targetKey: s(ex, "target_key"), guideKey: s(ex, "guide_key"),
    };
  }

  // Workouts: days joined to their gym plan slug.
  const gymPlans = await sel("world_plans", [
    ["select", "id,slug"], ["world_id", "eq.gym"], ["order", "sort_order.asc"],
  ]);
  const planSlugById = new Map<number, string>();
  for (const p of gymPlans) {
    if (typeof p.id === "number") planSlugById.set(p.id, s(p, "slug"));
  }
  const days = await sel("gym_workout_days", [["select", "id,plan_id,day,sort_order"]]);
  const wex = await sel("gym_workout_exercises", [
    ["select", "day_id,exercise_code,sets,reps_type,reps_a,reps_b,rest_seconds,sort_order"],
  ]);
  const wexByDay = groupNum(wex, "day_id");

  const workouts: Record<string, unknown[]> = {};
  for (const d of days) {
    const planId = typeof d.plan_id === "number" ? d.plan_id : 0;
    const planSlug = planSlugById.get(planId);
    if (!planSlug) continue;
    const dayId = typeof d.id === "number" ? d.id : 0;
    const list = (wexByDay.get(dayId) ?? [])
      .map((e) => {
        const reps = typeof e.reps_b === "number"
          ? { t: s(e, "reps_type"), a: e.reps_a, b: e.reps_b }
          : { t: s(e, "reps_type"), a: e.reps_a };
        return {
          o: typeof e.sort_order === "number" ? e.sort_order : 0,
          v: {
            ex: s(e, "exercise_code"),
            sets: e.sets,
            reps,
            rest: typeof e.rest_seconds === "number" ? e.rest_seconds : 0,
          },
        };
      })
      .sort((a, b) => a.o - b.o)
      .map((x) => x.v);
    const entry = {
      day: typeof d.day === "number" ? d.day : 1,
      exercises: list,
    };
    const arr = workouts[planSlug];
    if (Array.isArray(arr)) arr.push(entry);
    else workouts[planSlug] = [entry];
  }

  const progress = await sel("gym_plan_progress", [["select", "plan_id,week,total"]]);
  const planWeeks: Record<string, unknown> = {};
  for (const p of progress) {
    const planId = typeof p.plan_id === "number" ? p.plan_id : 0;
    const slug = planSlugById.get(planId);
    if (slug) {
      planWeeks[slug] = {
        week: typeof p.week === "number" ? p.week : 1,
        total: typeof p.total === "number" ? p.total : 1,
      };
    }
  }

  const out = {
    plans: world.plans,
    schedule: world.schedule,
    places: placesJson,
    stores: storesMap,
    catalog,
    exercises: exMap,
    workouts,
    planWeeks,
  };
  ttlPut("content:gym", out);
  return out;
}

/* ── GET /api/content/diet ───────────────────────────────────────────────── */

export async function dietCatalog(): Promise<Record<string, unknown>> {
  const cached = await ttlGet<Record<string, unknown>>("content:diet");
  if (cached) return cached;

  const world = await worldRows("diet");

  const recipes = await sel("diet_recipes", [["select", "slug,minutes,kcal"]]);
  const ingredients = await sel("diet_recipe_ingredients", [
    ["select", "recipe_slug,ingredient_key,sort_order"],
  ]);
  const ingBy = group(ingredients, "recipe_slug");
  const recipeDetails: Record<string, unknown> = {};
  for (const r of recipes) {
    const slug = s(r, "slug");
    const ing = (ingBy.get(slug) ?? [])
      .map((i) => ({ o: typeof i.sort_order === "number" ? i.sort_order : 0, k: s(i, "ingredient_key") }))
      .sort((a, b) => a.o - b.o)
      .map((i) => i.k);
    recipeDetails[slug] = {
      id: slug,
      minutes: r.minutes,
      kcal: r.kcal,
      ingredients: ing,
    };
  }

  const placeRows = await sel("world_places", [["select", "id,slug"], ["world_id", "eq.diet"]]);
  const slugByPlaceId = new Map<number, string>();
  for (const p of placeRows) {
    if (typeof p.id === "number") slugByPlaceId.set(p.id, s(p, "slug"));
  }
  const details = await sel("diet_place_details", [
    ["select", "place_id,address,hours,map_query"],
  ]);
  const venueDetails: Record<string, unknown> = {};
  for (const d of details) {
    const pid = typeof d.place_id === "number" ? d.place_id : 0;
    const slug = slugByPlaceId.get(pid);
    if (slug) {
      venueDetails[slug] = {
        id: slug,
        address: s(d, "address"), hours: s(d, "hours"), mapQuery: s(d, "map_query"),
      };
    }
  }

  const out = {
    plans: world.plans,
    recipes: world.items,
    places: world.places,
    recipeDetails,
    venueDetails,
  };
  ttlPut("content:diet", out);
  return out;
}

/* ── GET /api/content/meditation ─────────────────────────────────────────── */

export async function meditationCatalog(): Promise<Record<string, unknown>> {
  const cached = await ttlGet<Record<string, unknown>>("content:meditation");
  if (cached) return cached;

  const world = await worldRows("meditation");

  const psy = await sel("psychologists_v2", [["select", "*"], ["order", "sort_order.asc"]]);
  const psySpecs = await sel("psychologist_specialties", [
    ["select", "psychologist_slug,specialty_code,sort_order"],
  ]);
  const psyFormats = await sel("psychologist_formats", [
    ["select", "psychologist_slug,format,sort_order"],
  ]);
  const psyLangs = await sel("psychologist_languages", [
    ["select", "psychologist_slug,lang,sort_order"],
  ]);
  const psyAvail = await sel("psychologist_availability", [
    ["select", "psychologist_slug,day,from_hour,to_hour,sort_order"],
  ]);
  const psyCerts = await sel("psychologist_certificates", [
    ["select", "psychologist_slug,cert_key,sort_order"],
  ]);

  const specsBy = group(psySpecs, "psychologist_slug");
  const formatsBy = group(psyFormats, "psychologist_slug");
  const langsBy = group(psyLangs, "psychologist_slug");
  const availBy = group(psyAvail, "psychologist_slug");
  const certsBy = group(psyCerts, "psychologist_slug");

  function sortedCodes(list: Row[] | undefined, key: string): string[] {
    return (list ?? [])
      .map((r) => ({ o: typeof r.sort_order === "number" ? r.sort_order : 0, v: s(r, key) }))
      .sort((a, b) => a.o - b.o)
      .map((x) => x.v);
  }

  const psyJson = psy.map((p) => {
    const slug = s(p, "slug");
    const avail = (availBy.get(slug) ?? [])
      .map((a) => ({
        o: typeof a.sort_order === "number" ? a.sort_order : 0,
        v: { day: a.day, from: a.from_hour, to: a.to_hour },
      }))
      .sort((a, b) => a.o - b.o)
      .map((x) => x.v);
    return {
      slug,
      nameKey: s(p, "name_key"),
      titleKey: s(p, "title_key"),
      bioKey: s(p, "bio_key"),
      image: s(p, "image_url"),
      rating: p.rating ?? null,
      price: p.price ?? null,
      specialties: sortedCodes(specsBy.get(slug), "specialty_code"),
      formats: sortedCodes(formatsBy.get(slug), "format"),
      languages: sortedCodes(langsBy.get(slug), "lang"),
      availability: avail,
      initials: s(p, "initials"),
      since: typeof p.since_year === "number" ? p.since_year : 2000,
      eduKey: s(p, "edu_key"),
      certKeys: sortedCodes(certsBy.get(slug), "cert_key"),
      rulesKey: s(p, "rules_key"),
    };
  });

  const media = await sel("media_resources", [
    ["select", "*"], ["collection", "eq.practice"], ["order", "sort_order.asc"],
  ]);
  const tdb = await sel("media_resources", [
    ["select", "*"], ["collection", "eq.tdb"], ["order", "sort_order.asc"],
  ]);

  const mediaView = (m: Row) => ({
    id: s(m, "id"), kind: s(m, "kind"),
    titleKey: s(m, "title_key"), descKey: s(m, "desc_key"),
    minutes: m.minutes, src: s(m, "src"), poster: s(m, "poster"),
  });

  const quizzes = await sel("quizzes", [["select", "code,question_count"], ["order", "sort_order.asc"]]);
  const quizzesJson = quizzes.map((q) => ({ id: s(q, "code"), questions: q.question_count }));

  const moodTags = await sel("mood_tags", [["select", "code"], ["order", "sort_order.asc"]]);
  const moodJson = moodTags.map((m) => s(m, "code"));

  const quotes = await sel("daily_quotes", [["select", "msg_key"], ["order", "sort_order.asc"]]);
  const quoteKeys = quotes.map((m) => s(m, "msg_key"));

  const prompts = await sel("journal_prompts", [["select", "msg_key"], ["order", "sort_order.asc"]]);
  const promptKeys = prompts.map((m) => s(m, "msg_key"));

  const out = {
    plans: world.plans,
    sessions: world.items,
    mentors: world.places,
    psychologists: psyJson,
    media: media.map(mediaView),
    tdb: tdb.map(mediaView),
    quizzes: quizzesJson,
    moodTags: moodJson,
    quoteKeys,
    promptKeys,
  };
  ttlPut("content:meditation", out);
  return out;
}

/* ── GET /api/content/library ────────────────────────────────────────────── */

export async function libraryCatalog(): Promise<Record<string, unknown>> {
  const cached = await ttlGet<Record<string, unknown>>("content:library");
  if (cached) return cached;

  const world = await worldRows("library");

  const books = await sel("library_books", [["select", "slug,author,pages,minutes,blurb_key"]]);
  const bookDetails: Record<string, unknown> = {};
  for (const b of books) {
    const slug = s(b, "slug");
    bookDetails[slug] = {
      id: slug, author: s(b, "author"),
      pages: b.pages, minutes: b.minutes, blurbKey: s(b, "blurb_key"),
    };
  }

  const placeRows = await sel("world_places", [["select", "id,slug"], ["world_id", "eq.library"]]);
  const slugByPlaceId = new Map<number, string>();
  for (const p of placeRows) {
    if (typeof p.id === "number") slugByPlaceId.set(p.id, s(p, "slug"));
  }
  const details = await sel("library_place_details", [
    ["select", "place_id,address,hours,map_query"],
  ]);
  const venueDetails: Record<string, unknown> = {};
  for (const d of details) {
    const pid = typeof d.place_id === "number" ? d.place_id : 0;
    const slug = slugByPlaceId.get(pid);
    if (slug) {
      venueDetails[slug] = {
        id: slug,
        address: s(d, "address"), hours: s(d, "hours"), mapQuery: s(d, "map_query"),
      };
    }
  }

  const out = {
    collections: world.plans,
    books: world.items,
    places: world.places,
    bookDetails,
    venueDetails,
  };
  ttlPut("content:library", out);
  return out;
}

/* ── GET /api/content/subscription ───────────────────────────────────────── */

export async function subscriptionCatalog(): Promise<Record<string, unknown>> {
  const cached = await ttlGet<Record<string, unknown>>("content:subscription");
  if (cached) return cached;

  const features = await sel("subscription_features", [["select", "*"], ["order", "sort_order.asc"]]);
  const tiers = await sel("subscription_tiers", [["select", "*"], ["order", "sort_order.asc"]]);
  const tierFeats = await sel("subscription_tier_features", [
    ["select", "tier_code,feature_code,sort_order"],
  ]);
  const tfBy = group(tierFeats, "tier_code");

  const featuresJson = features.map((f) => ({
    id: s(f, "code"), nameKey: s(f, "name_key"), price: f.price ?? null,
  }));
  const tiersJson = tiers.map((t) => {
    const code = s(t, "code");
    const fl = (tfBy.get(code) ?? [])
      .map((x) => ({ o: typeof x.sort_order === "number" ? x.sort_order : 0, v: s(x, "feature_code") }))
      .sort((a, b) => a.o - b.o)
      .map((x) => x.v);
    return {
      id: code, nameKey: s(t, "name_key"), price: t.price ?? null,
      features: fl,
    };
  });

  const out = { features: featuresJson, tiers: tiersJson };
  ttlPut("content:subscription", out);
  return out;
}

/* ── GET /api/i18n?locale=az|en|ru ───────────────────────────────────────── */

function setNested(root: Record<string, unknown>, path: string[], leaf: string): void {
  if (path.length === 0) return;
  if (path.length === 1) {
    root[path[0]] = leaf;
    return;
  }
  let entry = root[path[0]];
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    entry = {};
    root[path[0]] = entry;
  }
  setNested(entry as Record<string, unknown>, path.slice(1), leaf);
}

export async function i18nCatalog(locale: string): Promise<Record<string, unknown>> {
  const loc = locale === "en" ? "en" : locale === "ru" ? "ru" : "az";
  const cacheKey = `i18n:${loc}`;
  const cached = await ttlGet<Record<string, unknown>>(cacheKey);
  if (cached) return cached;

  // PostgREST caps responses at 1000 rows by default — paginate with a
  // deterministic key order until every i18n_messages row is fetched.
  const rows: Row[] = [];
  let offset = 0;
  for (;;) {
    const page = await sel("i18n_messages", [
      ["select", `key,value_${loc}`],
      ["order", "key.asc"],
      ["limit", "1000"],
      ["offset", String(offset)],
    ]);
    rows.push(...page);
    if (page.length < 1000) break;
    offset += 1000;
  }

  const root: Record<string, unknown> = {};
  for (const r of rows) {
    const key = r.key;
    const value = r[`value_${loc}`];
    if (typeof key !== "string" || typeof value !== "string") continue;
    setNested(root, key.split("."), value);
  }

  ttlPut(cacheKey, root);
  return root;
}
