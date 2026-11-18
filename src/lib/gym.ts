import {
  Activity, AudioLines, Backpack, CalendarDays, Dumbbell, MapPin, Pill, Shirt,
  BicepsFlexed, Cable, Cookie, CupSoda, Fish, Flame, Grab, Hand, Layers,
  Milk, Moon, PersonStanding, Shield, Sun, Waves, Zap, Footprints, Move,
  type LucideIcon,
} from "lucide-react";
import { worlds, scheduleDayKeys } from "./worlds";

/**
 * The registered-surface gym app (/<locale>/gym): six subtabs behind a
 * collapsible left rail. Structure and numbers live here; every visible
 * string is a message key (gymApp namespace, messages/*.json) resolved
 * server-side in the page and passed down as plain strings.
 *
 * Two kinds of tabs:
 * • plan / gyms — PreLife-native content (training plan, partner halls).
 * • the four SHOP tabs (equipment, supplements, accessories, clothing) —
 *   directory-style: we show WHAT exists and WHERE to buy it; the actual
 *   purchase happens on the partner store's own site (external links).
 */

export type GymTabId =
  | "plan" | "gyms" | "equipment" | "supplements" | "accessories" | "clothing";

export type GymTab = { id: GymTabId; icon: LucideIcon };

/** Display order matters — the rail lists these top to bottom. */
export const GYM_TABS: readonly GymTab[] = [
  { id: "plan", icon: CalendarDays },
  { id: "gyms", icon: MapPin },
  { id: "equipment", icon: Dumbbell },
  { id: "supplements", icon: Pill },
  { id: "accessories", icon: Backpack },
  { id: "clothing", icon: Shirt },
] as const;

export const isGymTabId = (v: string): v is GymTabId =>
  GYM_TABS.some((t) => t.id === v);

export const SHOP_TAB_IDS = ["equipment", "supplements", "accessories", "clothing"] as const;
export type ShopTabId = (typeof SHOP_TAB_IDS)[number];
export const isShopTab = (id: GymTabId): id is ShopTabId =>
  (SHOP_TAB_IDS as readonly string[]).includes(id);

/* ── Stores (the "where to buy" side of the shop tabs) ────────────────── */

export type StoreKind = "online" | "store" | "pharmacy";

export type StoreRef = {
  slug: string;
  /** Proper noun — rendered as-is, no translation. */
  name: string;
  kind: StoreKind;
  /** V1 links go to the store's homepage; deep product-search links later. */
  url: string;
};

/** V1 mock directory of real Azerbaijani retailers. */
export const STORES: Record<string, StoreRef> = {
  tap:     { slug: "tap",     kind: "online",   name: "Tap.az",          url: "https://tap.az" },
  unimall: { slug: "unimall", kind: "online",   name: "Unimall.az",      url: "https://unimall.az" },
  wolmart: { slug: "wolmart", kind: "online",   name: "Wolmart.az",      url: "https://wolmart.az" },
  kontakt: { slug: "kontakt", kind: "store",    name: "Kontakt Home",    url: "https://kontakt.az" },
  aptek:   { slug: "aptek",   kind: "pharmacy", name: "Aptek.az",        url: "https://aptek.az" },
  araz:    { slug: "araz",    kind: "store",    name: "Araz Supermarket", url: "https://arazmarket.az" },
};

/* ── Products (shop tabs) ──────────────────────────────────────────────── */

export type Product = {
  id: string;
  /** gymApp.<tab>.<id> — resolved server-side. */
  nameKey: string;
  /** Proper noun, shown as-is. */
  brand: string;
  icon: LucideIcon;
  /** Typical price window in ₼. */
  price: [number, number];
  /** Product photo — OSS-rehosted search result (stable, embeddable).
   *  The card falls back to the icon chip when null. */
  image?: string;
  /** Where to buy: STORES slug + typical price there (₼). */
  at: { store: string; price: number }[];
};

export type ShopCategory = { id: ShopTabId; items: Product[] };

const eq = (id: string, nameKey: string, brand: string, icon: LucideIcon,
  price: [number, number], at: Product["at"], image?: string): Product =>
  ({ id, nameKey, brand, icon, price, at, image });

export const SHOP_CATALOG: readonly ShopCategory[] = [
  {
    id: "equipment",
    items: [
      eq("barbell", "barbell", "Torros", Dumbbell, [220, 380], [{ store: "tap", price: 245 }, { store: "unimall", price: 259 }, { store: "kontakt", price: 289 }],
        "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/c63185e2c96c.jpeg"),
      eq("dumbbells", "dumbbells", "Demir Fit", BicepsFlexed, [90, 190], [{ store: "tap", price: 110 }, { store: "unimall", price: 98 }, { store: "wolmart", price: 129 }],
        "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/970d32c7fbf6.png"),
      eq("kettlebell", "kettlebell", "CrossFlow", Flame, [45, 95], [{ store: "tap", price: 52 }, { store: "kontakt", price: 69 }],
        "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/c9f725cf60b7.jpg"),
      eq("bands", "bands", "Gym80", Waves, [18, 40], [{ store: "araz", price: 19 }, { store: "wolmart", price: 22 }, { store: "tap", price: 25 }],
        "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/5e042b843d76.jpg"),
      eq("pullup", "pullup", "Iron Grip", PersonStanding, [55, 120], [{ store: "tap", price: 64 }, { store: "kontakt", price: 79 }],
        "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/3c977e0bb71b.jpg"),
      eq("mat", "mat", "Lotos", Layers, [25, 60], [{ store: "tap", price: 27 }, { store: "araz", price: 29 }, { store: "wolmart", price: 34 }],
        "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/59d27a744cda.jpg"),
      eq("bench", "bench", "Torros", Layers, [180, 350], [{ store: "tap", price: 199 }, { store: "unimall", price: 215 }, { store: "kontakt", price: 249 }],
        "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/da104366b0bd.webp"),
      eq("rack", "rack", "Iron Grip", Dumbbell, [450, 850], [{ store: "unimall", price: 520 }, { store: "kontakt", price: 599 }],
        "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/f852f55f0081.jpg"),
      eq("plates", "plates", "Demir Fit", Dumbbell, [6, 14], [{ store: "tap", price: 7 }, { store: "wolmart", price: 8 }, { store: "araz", price: 9 }],
        "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/c0574a11860f.jpeg"),
      eq("roller", "roller", "Lotos", Activity, [18, 45], [{ store: "tap", price: 21 }, { store: "araz", price: 24 }, { store: "wolmart", price: 27 }],
        "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/a6bd53bb86b1.jpg"),
    ],
  },
  {
    id: "supplements",
    items: [
      eq("whey", "whey", "Optimum Nutrition", Milk, [95, 145], [{ store: "tap", price: 105 }, { store: "aptek", price: 118 }, { store: "unimall", price: 129 }],
        "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/79ec97b80d88.png"),
      eq("creatine", "creatine", "BioTech USA", Zap, [45, 75], [{ store: "tap", price: 49 }, { store: "aptek", price: 58 }],
        "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/90ee7867bd64.jpg"),
      eq("omega3", "omega3", "Solgar", Fish, [28, 48], [{ store: "aptek", price: 34 }, { store: "araz", price: 39 }],
        "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/3eb05baaea0f.jpg"),
      eq("vitamind", "vitamind", "Now Foods", Sun, [15, 30], [{ store: "aptek", price: 19 }, { store: "wolmart", price: 23 }],
        "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/de056b06fbc0.jpg"),
      eq("magnesium", "magnesium", "Doctor's Best", Moon, [22, 40], [{ store: "aptek", price: 27 }, { store: "unimall", price: 31 }],
        "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/32abf866628e.png"),
      eq("proteinbar", "proteinbar", "Oatein", Cookie, [4, 6], [{ store: "wolmart", price: 4 }, { store: "araz", price: 5 }, { store: "tap", price: 6 }],
        "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/2dbe4c8aba13.jpg"),
      eq("preworkout", "preworkout", "BioTech USA", Zap, [55, 90], [{ store: "tap", price: 62 }, { store: "unimall", price: 74 }],
        "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/8ed468d0d5bc.png"),
      eq("bcaa", "bcaa", "Optimum Nutrition", Zap, [40, 70], [{ store: "tap", price: 45 }, { store: "aptek", price: 52 }],
        "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/baa26a6898a2.jpg"),
      eq("multivit", "multivit", "Solgar", Pill, [25, 55], [{ store: "aptek", price: 32 }, { store: "wolmart", price: 38 }, { store: "unimall", price: 44 }],
        "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/27f2af6c7e46.webp"),
      eq("electrolyte", "electrolyte", "Now Foods", CupSoda, [12, 28], [{ store: "wolmart", price: 15 }, { store: "araz", price: 17 }, { store: "tap", price: 19 }],
        "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/f4006fa6575e.jpg"),
    ],
  },
  {
    id: "accessories",
    items: [
      eq("belt", "belt", "Harbinger", Shield, [70, 130], [{ store: "tap", price: 84 }, { store: "kontakt", price: 99 }],
        "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/63875af399a3.jpg"),
      eq("gloves", "gloves", "Under Armour", Hand, [25, 55], [{ store: "tap", price: 32 }, { store: "wolmart", price: 39 }],
        "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/0e40b821c3eb.jpg"),
      eq("shaker", "shaker", "SmartShake", CupSoda, [12, 25], [{ store: "wolmart", price: 14 }, { store: "araz", price: 15 }, { store: "tap", price: 19 }],
        "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/6380dbb1ead5.png"),
      eq("bag", "bag", "Nike", Backpack, [60, 120], [{ store: "tap", price: 75 }, { store: "unimall", price: 89 }],
        "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/9d9a2b491213.png"),
      eq("rope", "rope", "Reebok", Cable, [15, 35], [{ store: "araz", price: 18 }, { store: "tap", price: 21 }],
        "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/a3d9d8e17ca6.jpg"),
      eq("wraps", "wraps", "Rogue", Grab, [20, 45], [{ store: "tap", price: 28 }, { store: "kontakt", price: 36 }],
        "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/03575f4b66b8.jpg"),
      eq("straps", "straps", "Rogue", Grab, [15, 35], [{ store: "tap", price: 19 }, { store: "unimall", price: 24 }],
        "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/3bc06c3e544f.jpg"),
      eq("towel", "towel", "Lotos", Layers, [10, 25], [{ store: "araz", price: 12 }, { store: "wolmart", price: 14 }, { store: "tap", price: 15 }],
        "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/6341e1797310.jpg"),
      eq("bottle", "bottle", "ThermoFlask", CupSoda, [20, 50], [{ store: "tap", price: 26 }, { store: "wolmart", price: 31 }],
        "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/747f404c827f.jpg"),
      eq("headphones", "headphones", "JBL", AudioLines, [60, 160], [{ store: "tap", price: 79 }, { store: "kontakt", price: 95 }, { store: "unimall", price: 112 }],
        "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/1e2a34144f00.png"),
    ],
  },
  {
    id: "clothing",
    items: [
      eq("tshirt", "tshirt", "Nike Dri-FIT", Shirt, [35, 75], [{ store: "tap", price: 45 }, { store: "unimall", price: 52 }],
        "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/ab1651b7a38b.jpeg"),
      eq("shoes", "shoes", "Adidas", Footprints, [180, 320], [{ store: "tap", price: 215 }, { store: "unimall", price: 239 }, { store: "kontakt", price: 259 }],
        "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/317af329359d.jpg"),
      eq("shorts", "shorts", "Puma", Activity, [40, 80], [{ store: "wolmart", price: 45 }, { store: "tap", price: 52 }],
        "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/965c30ae3190.jpg"),
      eq("hoodie", "hoodie", "Under Armour", Layers, [90, 160], [{ store: "tap", price: 98 }, { store: "unimall", price: 119 }],
        "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/7448e83a00db.jpg"),
      eq("socks", "socks", "Reebok", Footprints, [12, 28], [{ store: "wolmart", price: 12 }, { store: "araz", price: 15 }],
        "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/e41a3a83b634.png"),
      eq("tights", "tights", "Gymshark", Move, [70, 140], [{ store: "tap", price: 84 }, { store: "unimall", price: 99 }],
        "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/99cfbdab0839.jpg"),
      eq("bra", "bra", "Gymshark", Activity, [35, 70], [{ store: "tap", price: 42 }, { store: "unimall", price: 55 }],
        "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/b860c1e31436.jpg"),
      eq("cap", "cap", "Nike", Sun, [18, 40], [{ store: "tap", price: 22 }, { store: "wolmart", price: 26 }],
        "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/dea860b997d3.jpg"),
      eq("jacket", "jacket", "Adidas", Shirt, [110, 220], [{ store: "tap", price: 129 }, { store: "unimall", price: 159 }, { store: "kontakt", price: 175 }],
        "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/eb0e3fddd56b.jpg"),
      eq("swim", "swim", "Speedo", Waves, [30, 90], [{ store: "tap", price: 39 }, { store: "unimall", price: 48 }],
        "https://z-cdn.chatglm.cn/image-search-mcp/images-ppt/652696bf10e1.png"),
    ],
  },
] as const;

/** nameKey is relative to the tab: gymApp.<tabId>.<nameKey>. */
export const productsOf = (tab: ShopTabId) =>
  SHOP_CATALOG.find((c) => c.id === tab)!.items;

/** Cheapest store price for a product — drives the "best price" row
 *  highlight and the sort-by-cheapest order (computed once, server-side,
 *  so the client never re-derives it from the price list). */
export const minPriceOf = (p: Product) =>
  p.at.reduce((min, a) => Math.min(min, a.price), Number.POSITIVE_INFINITY);

/* ── Partner gyms (zallar) ─────────────────────────────────────────────── */

export type GymPlace = {
  id: string;
  /** Which namespace the name/desc keys live in — the three partner halls
   *  reuse the welcome-page copy (gymHome), the v1 additions live in gymApp. */
  ns: "gymHome" | "gymApp";
  nameKey: string;
  descKey: string;
  image: string;
  rating: number;
  /** gymHome feature-chip keys (feat247, featSauna, …). */
  featureKeys: string[];
  /** Street address — proper noun, shown as-is in every locale. */
  address: string;
  /** Opening hours — same digits in all locales, no translation. */
  hours: string;
  /** Day-pass price in ₼ (v1 static). */
  dayPrice: number;
};

const u = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=900&q=80&auto=format&fit=crop`;

export const GYM_PLACES: readonly GymPlace[] = [
  { id: "ironhouse", ns: "gymHome", nameKey: "venueIronName", descKey: "venueIronDesc", image: u("1593079831268-3381b0db4a77"), rating: 4.8, featureKeys: ["feat247", "featSauna", "featPool"], address: "Nərimanov, Ə. Rəcəbli küç.", hours: "24/7", dayPrice: 18 },
  { id: "pulse", ns: "gymHome", nameKey: "venuePulseName", descKey: "venuePulseDesc", image: u("1546483875-ad9014c88eba"), rating: 4.6, featureKeys: ["featClasses", "featCardio", "featParking"], address: "İçərişəhər, Qız Qalası küç.", hours: "07:00–23:00", dayPrice: 15 },
  { id: "vertex", ns: "gymHome", nameKey: "venueVertexName", descKey: "venueVertexDesc", image: u("1571902943202-507ec2618e8f"), rating: 4.9, featureKeys: ["featPlatforms", "featCoaching", "featRecovery"], address: "Xətai, Ə. Qayıbov küç.", hours: "06:30–23:30", dayPrice: 22 },
  { id: "atlas", ns: "gymApp", nameKey: "placeAtlasName", descKey: "placeAtlasDesc", image: u("1534438327276-14e5300c3a48"), rating: 4.7, featureKeys: ["feat247", "featClasses", "featCoaching"], address: "Yasamal, Təbib küç.", hours: "08:00–22:00", dayPrice: 16 },
  { id: "forge", ns: "gymApp", nameKey: "placeForgeName", descKey: "placeForgeDesc", image: u("1541534741688-6078c6bfb5c5"), rating: 4.5, featureKeys: ["featPlatforms", "featParking", "featSauna"], address: "Səbail, S. Əhmədov küç.", hours: "07:00–23:00", dayPrice: 14 },
  { id: "summit", ns: "gymApp", nameKey: "placeSummitName", descKey: "placeSummitDesc", image: u("1517836357463-d25dfeac3438"), rating: 4.8, featureKeys: ["featCardio", "featPool", "featRecovery"], address: "Binəqədi, 6-cı mikrorayon", hours: "07:00–22:00", dayPrice: 20 },
] as const;

/* ── Hall details — the "Ətraflı" dialog content ───────────────────────── */

/** Shared equipment pool — every string is a gymApp.hallEq.<id> message
 *  key; halls reference subsets so translations stay one-per-item. */
export const HALL_EQUIPMENT = [
  "powerRacks", "benches", "dumbbells", "barbells", "plates", "cableStation",
  "smithMachine", "latPulldown", "legPress", "kettlebells", "platforms",
  "functionalZone", "treadmills", "ellipticals", "bikes", "rowing",
  "boxingCorner", "mats", "pool", "sauna", "recoveryZone", "freeWeights",
] as const;
export type HallEquipmentId = (typeof HALL_EQUIPMENT)[number];

/** Trainer specialization — gymApp.hallSpec.<id> message keys. */
export const TRAINER_SPECS = [
  "strength", "powerlifting", "crossfit", "conditioning", "cardio",
  "yoga", "pilates", "boxing", "rehab", "physio", "nutrition", "kids",
] as const;
export type TrainerSpec = (typeof TRAINER_SPECS)[number];

export type HallTrainer = {
  /** Proper noun — rendered as-is, no translation. */
  name: string;
  spec: TrainerSpec;
  /** Years of coaching experience. */
  years: number;
};

/** Per-hall details: the equipment floor list + the coaching team. */
export const HALL_DETAILS: Record<string, { equipment: HallEquipmentId[]; trainers: HallTrainer[] }> = {
  ironhouse: {
    equipment: ["powerRacks", "benches", "dumbbells", "barbells", "plates", "cableStation", "smithMachine", "latPulldown", "legPress", "kettlebells", "treadmills", "ellipticals", "bikes", "sauna", "pool", "freeWeights"],
    trainers: [
      { name: "Rəşad Əliyev", spec: "strength", years: 9 },
      { name: "Nurlan Məmmədov", spec: "powerlifting", years: 12 },
      { name: "Səbinə Quliyeva", spec: "cardio", years: 6 },
    ],
  },
  pulse: {
    equipment: ["dumbbells", "barbells", "benches", "cableStation", "kettlebells", "functionalZone", "treadmills", "ellipticals", "bikes", "rowing", "mats", "boxingCorner"],
    trainers: [
      { name: "Aysel Rəhimova", spec: "yoga", years: 8 },
      { name: "Elvin Səfərov", spec: "conditioning", years: 7 },
      { name: "Kamal Hüseynov", spec: "boxing", years: 10 },
    ],
  },
  vertex: {
    equipment: ["powerRacks", "platforms", "benches", "barbells", "plates", "dumbbells", "cableStation", "latPulldown", "legPress", "kettlebells", "recoveryZone", "sauna", "freeWeights"],
    trainers: [
      { name: "Tural Əhmədov", spec: "powerlifting", years: 14 },
      { name: "Məryəm İsmayılova", spec: "rehab", years: 9 },
      { name: "Orxan Vəliyev", spec: "crossfit", years: 6 },
    ],
  },
  atlas: {
    equipment: ["powerRacks", "smithMachine", "benches", "dumbbells", "barbells", "plates", "cableStation", "latPulldown", "legPress", "treadmills", "ellipticals", "bikes", "functionalZone", "mats"],
    trainers: [
      { name: "Günay Kazımova", spec: "pilates", years: 7 },
      { name: "Fərid Şıxıyev", spec: "strength", years: 8 },
      { name: "Leyla Əskərova", spec: "nutrition", years: 5 },
    ],
  },
  forge: {
    equipment: ["powerRacks", "platforms", "barbells", "plates", "benches", "dumbbells", "kettlebells", "smithMachine", "sauna", "freeWeights"],
    trainers: [
      { name: "Elşad Qarayev", spec: "powerlifting", years: 11 },
      { name: "Zaur Bədəlov", spec: "strength", years: 9 },
    ],
  },
  summit: {
    equipment: ["dumbbells", "barbells", "benches", "cableStation", "smithMachine", "latPulldown", "legPress", "kettlebells", "functionalZone", "treadmills", "ellipticals", "rowing", "pool", "sauna", "recoveryZone", "mats"],
    trainers: [
      { name: "Aytən Mürşüdlü", spec: "physio", years: 10 },
      { name: "Ruslan Ağayev", spec: "conditioning", years: 8 },
      { name: "Nərmin Soltanova", spec: "yoga", years: 6 },
    ],
  },
};

/* ── Training plans ────────────────────────────────────────────────────── */

/** Plans themselves come from worlds.gym (same copy as the welcome page);
 *  this adds the v1 mock progress — week N of M (M = the plan's length from
 *  its meta line). Replaced by real tracking later. */
export const PLAN_WEEKS: Record<string, { week: number; total: number }> = {
  foundation: { week: 3, total: 8 },
  hypertrophy: { week: 5, total: 12 },
  athletic: { week: 2, total: 6 },
};

export const gymPlans = worlds.gym.plans;
export const gymSchedule = worlds.gym.schedule;
export { scheduleDayKeys };

/* ── Workout session — the "İdməna başla" guide ────────────────────────── */

/** The prescription of one planned exercise. Sets/rest are numbers;
 *  `reps` is a structured union the UI renders through message
 *  templates so nothing is hardcoded in a single locale. */
export type Reps =
  | { t: "reps"; a: number; b?: number }   // 8–12 / 12 təkrar
  | { t: "time"; a: number }               // N minutes
  | { t: "secs"; a: number }               // N seconds
  | { t: "each"; a: number };              // N per side

export type PlannedExercise = {
  /** EXERCISES pool id. */
  ex: string;
  sets: number;
  reps: Reps;
  /** Rest between sets, seconds (0 = flow on). */
  rest: number;
};

/** gymApp message key + ICU values for a Reps union — the server page
 *  pre-renders these into plain strings for the client. */
export const repsLabelKey = (r: Reps): string =>
  r.t === "reps" ? (r.b === undefined ? "repSingle" : "repRange")
  : r.t === "time" ? "repTime"
  : r.t === "secs" ? "repSecs"
  : "repEach";

/** A training day: `day` is the ISO-ish weekday 1 (Mon) … 6 (Sat).
 *  Days absent from the plan = rest days. */
export type WorkoutDay = { day: number; exercises: PlannedExercise[] };

/** The exercise pool — every string is a gymApp message key. */
export const EXERCISES: Record<string, { nameKey: string; targetKey: string; guideKey: string }> = {
  run:        { nameKey: "exRunName", targetKey: "exRunTarget", guideKey: "exRunGuide" },
  stretch:    { nameKey: "exStretchName", targetKey: "exStretchTarget", guideKey: "exStretchGuide" },
  squat:      { nameKey: "exSquatName2", targetKey: "exSquatTarget2", guideKey: "exSquatGuide" },
  deadlift:   { nameKey: "exDeadliftName2", targetKey: "exDeadliftTarget2", guideKey: "exDeadliftGuide" },
  bench:      { nameKey: "exBenchName2", targetKey: "exBenchTarget2", guideKey: "exBenchGuide" },
  pullup:     { nameKey: "exPullupName2", targetKey: "exPullupTarget2", guideKey: "exPullupGuide" },
  row:        { nameKey: "exRowName", targetKey: "exRowTarget", guideKey: "exRowGuide" },
  ohp:        { nameKey: "exOhpName", targetKey: "exOhpTarget", guideKey: "exOhpGuide" },
  lunge:      { nameKey: "exLungeName", targetKey: "exLungeTarget", guideKey: "exLungeGuide" },
  plank:      { nameKey: "exPlankName", targetKey: "exPlankTarget", guideKey: "exPlankGuide" },
  swing:      { nameKey: "exSwingName", targetKey: "exSwingTarget", guideKey: "exSwingGuide" },
  legpress:   { nameKey: "exLegpressName", targetKey: "exLegpressTarget", guideKey: "exLegpressGuide" },
  latpull:    { nameKey: "exLatpullName", targetKey: "exLatpullTarget", guideKey: "exLatpullGuide" },
  bicep:      { nameKey: "exBicepName", targetKey: "exBicepTarget", guideKey: "exBicepGuide" },
  triceps:    { nameKey: "exTricepsName", targetKey: "exTricepsTarget", guideKey: "exTricepsGuide" },
};

/** Per-plan weekly structure — what "İdməna başla" walks you through. */
export const WORKOUTS: Record<string, WorkoutDay[]> = {
  foundation: [
    {
      day: 1, exercises: [
        { ex: "run", sets: 1, reps: { t: "time", a: 5 }, rest: 0 },
        { ex: "squat", sets: 3, reps: { t: "reps", a: 8, b: 12 }, rest: 90 },
        { ex: "bench", sets: 3, reps: { t: "reps", a: 8, b: 12 }, rest: 90 },
        { ex: "row", sets: 3, reps: { t: "reps", a: 10, b: 12 }, rest: 75 },
        { ex: "plank", sets: 3, reps: { t: "secs", a: 30 }, rest: 45 },
      ],
    },
    {
      day: 3, exercises: [
        { ex: "run", sets: 1, reps: { t: "time", a: 5 }, rest: 0 },
        { ex: "deadlift", sets: 3, reps: { t: "reps", a: 6, b: 8 }, rest: 120 },
        { ex: "lunge", sets: 3, reps: { t: "each", a: 10 }, rest: 75 },
        { ex: "ohp", sets: 3, reps: { t: "reps", a: 8, b: 10 }, rest: 90 },
        { ex: "stretch", sets: 1, reps: { t: "time", a: 5 }, rest: 0 },
      ],
    },
    {
      day: 5, exercises: [
        { ex: "swing", sets: 3, reps: { t: "reps", a: 15 }, rest: 60 },
        { ex: "latpull", sets: 3, reps: { t: "reps", a: 10, b: 12 }, rest: 75 },
        { ex: "legpress", sets: 3, reps: { t: "reps", a: 10, b: 12 }, rest: 90 },
        { ex: "bicep", sets: 2, reps: { t: "reps", a: 12 }, rest: 60 },
        { ex: "plank", sets: 3, reps: { t: "secs", a: 40 }, rest: 45 },
      ],
    },
  ],
  hypertrophy: [
    {
      day: 1, exercises: [
        { ex: "bench", sets: 4, reps: { t: "reps", a: 8, b: 10 }, rest: 105 },
        { ex: "ohp", sets: 4, reps: { t: "reps", a: 8, b: 10 }, rest: 105 },
        { ex: "triceps", sets: 3, reps: { t: "reps", a: 12 }, rest: 60 },
        { ex: "latpull", sets: 3, reps: { t: "reps", a: 10, b: 12 }, rest: 75 },
      ],
    },
    {
      day: 2, exercises: [
        { ex: "squat", sets: 4, reps: { t: "reps", a: 8, b: 10 }, rest: 120 },
        { ex: "legpress", sets: 4, reps: { t: "reps", a: 10, b: 12 }, rest: 90 },
        { ex: "lunge", sets: 3, reps: { t: "each", a: 10 }, rest: 75 },
        { ex: "plank", sets: 3, reps: { t: "secs", a: 45 }, rest: 45 },
      ],
    },
    {
      day: 4, exercises: [
        { ex: "deadlift", sets: 4, reps: { t: "reps", a: 6, b: 8 }, rest: 150 },
        { ex: "row", sets: 4, reps: { t: "reps", a: 8, b: 10 }, rest: 105 },
        { ex: "pullup", sets: 3, reps: { t: "reps", a: 6, b: 10 }, rest: 105 },
        { ex: "bicep", sets: 3, reps: { t: "reps", a: 10, b: 12 }, rest: 60 },
      ],
    },
    {
      day: 5, exercises: [
        { ex: "swing", sets: 4, reps: { t: "reps", a: 20 }, rest: 60 },
        { ex: "ohp", sets: 3, reps: { t: "reps", a: 10 }, rest: 90 },
        { ex: "triceps", sets: 3, reps: { t: "reps", a: 12 }, rest: 60 },
        { ex: "stretch", sets: 1, reps: { t: "time", a: 7 }, rest: 0 },
      ],
    },
  ],
  athletic: [
    {
      day: 1, exercises: [
        { ex: "run", sets: 1, reps: { t: "time", a: 8 }, rest: 0 },
        { ex: "squat", sets: 5, reps: { t: "reps", a: 5 }, rest: 150 },
        { ex: "plank", sets: 3, reps: { t: "secs", a: 60 }, rest: 45 },
      ],
    },
    {
      day: 2, exercises: [
        { ex: "swing", sets: 5, reps: { t: "reps", a: 20 }, rest: 60 },
        { ex: "pullup", sets: 4, reps: { t: "reps", a: 6, b: 8 }, rest: 120 },
        { ex: "row", sets: 4, reps: { t: "reps", a: 8 }, rest: 105 },
      ],
    },
    {
      day: 3, exercises: [
        { ex: "run", sets: 1, reps: { t: "time", a: 6 }, rest: 0 },
        { ex: "deadlift", sets: 5, reps: { t: "reps", a: 5 }, rest: 180 },
        { ex: "lunge", sets: 3, reps: { t: "each", a: 12 }, rest: 75 },
      ],
    },
    {
      day: 4, exercises: [
        { ex: "bench", sets: 5, reps: { t: "reps", a: 5 }, rest: 150 },
        { ex: "ohp", sets: 4, reps: { t: "reps", a: 6, b: 8 }, rest: 120 },
        { ex: "triceps", sets: 3, reps: { t: "reps", a: 12 }, rest: 60 },
      ],
    },
    {
      day: 5, exercises: [
        { ex: "run", sets: 1, reps: { t: "time", a: 10 }, rest: 0 },
        { ex: "legpress", sets: 4, reps: { t: "reps", a: 10 }, rest: 90 },
        { ex: "bicep", sets: 3, reps: { t: "reps", a: 10 }, rest: 60 },
        { ex: "stretch", sets: 1, reps: { t: "time", a: 8 }, rest: 0 },
      ],
    },
  ],
};

/** Today's weekday in Baku wall time — 1 (Mon) … 7 (Sun); called from
 *  effects only so SSR and hydration never disagree. */
export const bakuWeekday = (): number => {
  const dow = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Asia/Baku" })
    .format(new Date());
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(dow) + 1;
};

/** The workout scheduled for a weekday, or null on rest days. */
export const workoutFor = (planId: string, weekday: number): WorkoutDay | null =>
  (WORKOUTS[planId] ?? []).find((d) => d.day === weekday) ?? null;
