import { supaSelect, supaInsert } from "./supa";
import { ApiCode } from "./psych-data";

/**
 * Custom subscription packages (v3.3) — the "Öz paketini yarat" flow.
 *
 * The à-la-carte features and their monthly prices live in
 * subscription_features (the same table the tier cards read). A custom
 * package is a user's picked feature set + duration; the price is
 * computed SERVER-SIDE (never trusted from the client):
 *
 *   monthly  = Σ feature prices
 *   total    = monthly × months × discount(months)
 *   discount = 1 / .95 / .90 / .85  for 1 / 3 / 6 / 12 months
 *
 * Rows land in custom_packages with status 'requested' (a team member
 * activates them after payment — same as the tier CTA flow for now).
 */

type Row = Record<string, unknown>;

export const PACKAGE_MONTHS = [1, 3, 6, 12] as const;
export type PackageMonths = (typeof PACKAGE_MONTHS)[number];

export function monthsDiscount(months: number): number {
  if (months >= 12) return 0.85;
  if (months >= 6) return 0.9;
  if (months >= 3) return 0.95;
  return 1;
}

export type FeaturePrice = { code: string; price: number };

/** The à-la-carte feature list (TTL-free: one small query, cached callers). */
export async function featurePrices(): Promise<FeaturePrice[]> {
  const rows = (await supaSelect("subscription_features", [
    ["select", "code,price"],
    ["order", "sort_order.asc"],
  ])) as Row[];
  return rows
    .filter((r) => typeof r.code === "string" && typeof r.price === "number")
    .map((r) => ({ code: r.code as string, price: r.price as number }));
}

export type PackageQuote = {
  features: string[];
  months: number;
  monthlyPrice: number;
  discountPct: number;
  totalPrice: number;
};

export async function quotePackage(
  featureCodes: unknown,
  months: unknown,
): Promise<PackageQuote> {
  if (!Array.isArray(featureCodes) || featureCodes.length === 0
    || featureCodes.some((c) => typeof c !== "string")) {
    throw new ApiCode(400, "features");
  }
  const m = Number(months);
  if (!PACKAGE_MONTHS.includes(m as PackageMonths)) throw new ApiCode(400, "months");

  const prices = await featurePrices();
  const byCode = new Map(prices.map((f) => [f.code, f.price]));
  const unique = [...new Set(featureCodes as string[])];
  const unknown = unique.filter((c) => !byCode.has(c));
  if (unknown.length) throw new ApiCode(400, "unknown_feature");

  const monthly = unique.reduce((sum, c) => sum + (byCode.get(c) ?? 0), 0);
  const discount = monthsDiscount(m);
  const total = Math.round(monthly * m * discount * 100) / 100;
  return {
    features: unique,
    months: m,
    monthlyPrice: Math.round(monthly * 100) / 100,
    discountPct: Math.round((1 - discount) * 100),
    totalPrice: total,
  };
}

export type CustomPackageView = {
  id: string;
  features: string[];
  months: number;
  monthlyPrice: number;
  totalPrice: number;
  status: string;
  createdAt: string;
};

export async function createCustomPackage(
  userId: string,
  featureCodes: unknown,
  months: unknown,
): Promise<CustomPackageView> {
  const quote = await quotePackage(featureCodes, months);
  const row = await supaInsert("custom_packages", {
    user_id: userId,
    features: quote.features,
    months: quote.months,
    monthly_price: quote.monthlyPrice,
    total_price: quote.totalPrice,
    status: "requested",
  });
  return {
    id: typeof row?.id === "string" ? row.id : "",
    features: quote.features,
    months: quote.months,
    monthlyPrice: quote.monthlyPrice,
    totalPrice: quote.totalPrice,
    status: "requested",
    createdAt: typeof row?.created_at === "string" ? row.created_at : new Date().toISOString(),
  };
}

export async function listCustomPackages(userId: string): Promise<CustomPackageView[]> {
  let rows: Row[];
  try {
    rows = (await supaSelect("custom_packages", [
      ["select", "*"],
      ["user_id", `eq.${userId}`],
      ["order", "created_at.desc"],
    ])) as Row[];
  } catch {
    /* The table lives behind the v3.3 migration — before it is applied
     * (or during an outage) the user simply has no custom packages. */
    return [];
  }
  return rows.map((r) => ({
    id: typeof r.id === "string" ? r.id : "",
    features: Array.isArray(r.features) ? (r.features as string[]) : [],
    months: typeof r.months === "number" ? r.months : 1,
    monthlyPrice: typeof r.monthly_price === "number" ? r.monthly_price : 0,
    totalPrice: typeof r.total_price === "number" ? r.total_price : 0,
    status: typeof r.status === "string" ? r.status : "requested",
    createdAt: typeof r.created_at === "string" ? r.created_at : "",
  }));
}

/** One-line subscription summary for the AI context prompt. */
export async function packageSummaryLine(userId: string): Promise<string> {
  try {
    const list = await listCustomPackages(userId);
    if (!list.length) return "free tier, no custom package yet";
    const latest = list[0]!;
    return `custom package request: ${latest.features.join("+")} for ${latest.months} months (${latest.totalPrice} ₼ total, status: ${latest.status})`;
  } catch {
    return "unavailable";
  }
}
