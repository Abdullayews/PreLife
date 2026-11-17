import {
  Activity, Backpack, CalendarDays, Dumbbell, MapPin, Pill, Shirt,
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
  /** Where to buy: STORES slug + typical price there (₼). */
  at: { store: string; price: number }[];
};

export type ShopCategory = { id: ShopTabId; items: Product[] };

const eq = (id: string, nameKey: string, brand: string, icon: LucideIcon,
  price: [number, number], at: Product["at"]): Product =>
  ({ id, nameKey, brand, icon, price, at });

export const SHOP_CATALOG: readonly ShopCategory[] = [
  {
    id: "equipment",
    items: [
      eq("barbell", "barbell", "Torros", Dumbbell, [220, 380], [{ store: "tap", price: 245 }, { store: "unimall", price: 259 }, { store: "kontakt", price: 289 }]),
      eq("dumbbells", "dumbbells", "Demir Fit", BicepsFlexed, [90, 190], [{ store: "tap", price: 110 }, { store: "unimall", price: 98 }, { store: "wolmart", price: 129 }]),
      eq("kettlebell", "kettlebell", "CrossFlow", Flame, [45, 95], [{ store: "tap", price: 52 }, { store: "kontakt", price: 69 }]),
      eq("bands", "bands", "Gym80", Waves, [18, 40], [{ store: "araz", price: 19 }, { store: "wolmart", price: 22 }, { store: "tap", price: 25 }]),
      eq("pullup", "pullup", "Iron Grip", PersonStanding, [55, 120], [{ store: "tap", price: 64 }, { store: "kontakt", price: 79 }]),
      eq("mat", "mat", "Lotos", Layers, [25, 60], [{ store: "tap", price: 27 }, { store: "araz", price: 29 }, { store: "wolmart", price: 34 }]),
    ],
  },
  {
    id: "supplements",
    items: [
      eq("whey", "whey", "Optimum Nutrition", Milk, [95, 145], [{ store: "tap", price: 105 }, { store: "aptek", price: 118 }, { store: "unimall", price: 129 }]),
      eq("creatine", "creatine", "BioTech USA", Zap, [45, 75], [{ store: "tap", price: 49 }, { store: "aptek", price: 58 }]),
      eq("omega3", "omega3", "Solgar", Fish, [28, 48], [{ store: "aptek", price: 34 }, { store: "araz", price: 39 }]),
      eq("vitamind", "vitamind", "Now Foods", Sun, [15, 30], [{ store: "aptek", price: 19 }, { store: "wolmart", price: 23 }]),
      eq("magnesium", "magnesium", "Doctor's Best", Moon, [22, 40], [{ store: "aptek", price: 27 }, { store: "unimall", price: 31 }]),
      eq("proteinbar", "proteinbar", "Oatein", Cookie, [4, 6], [{ store: "wolmart", price: 4 }, { store: "araz", price: 5 }, { store: "tap", price: 6 }]),
    ],
  },
  {
    id: "accessories",
    items: [
      eq("belt", "belt", "Harbinger", Shield, [70, 130], [{ store: "tap", price: 84 }, { store: "kontakt", price: 99 }]),
      eq("gloves", "gloves", "Under Armour", Hand, [25, 55], [{ store: "tap", price: 32 }, { store: "wolmart", price: 39 }]),
      eq("shaker", "shaker", "SmartShake", CupSoda, [12, 25], [{ store: "wolmart", price: 14 }, { store: "araz", price: 15 }, { store: "tap", price: 19 }]),
      eq("bag", "bag", "Nike", Backpack, [60, 120], [{ store: "tap", price: 75 }, { store: "unimall", price: 89 }]),
      eq("rope", "rope", "Reebok", Cable, [15, 35], [{ store: "araz", price: 18 }, { store: "tap", price: 21 }]),
      eq("wraps", "wraps", "Rogue", Grab, [20, 45], [{ store: "tap", price: 28 }, { store: "kontakt", price: 36 }]),
    ],
  },
  {
    id: "clothing",
    items: [
      eq("tshirt", "tshirt", "Nike Dri-FIT", Shirt, [35, 75], [{ store: "tap", price: 45 }, { store: "unimall", price: 52 }]),
      eq("shoes", "shoes", "Adidas", Footprints, [180, 320], [{ store: "tap", price: 215 }, { store: "unimall", price: 239 }, { store: "kontakt", price: 259 }]),
      eq("shorts", "shorts", "Puma", Activity, [40, 80], [{ store: "wolmart", price: 45 }, { store: "tap", price: 52 }]),
      eq("hoodie", "hoodie", "Under Armour", Layers, [90, 160], [{ store: "tap", price: 98 }, { store: "unimall", price: 119 }]),
      eq("socks", "socks", "Reebok", Footprints, [12, 28], [{ store: "wolmart", price: 12 }, { store: "araz", price: 15 }]),
      eq("tights", "tights", "Gymshark", Move, [70, 140], [{ store: "tap", price: 84 }, { store: "unimall", price: 99 }]),
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
