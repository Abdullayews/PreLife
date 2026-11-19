"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Crown, Minus, Plus, Sparkles, Zap } from "lucide-react";
import { apiUrl } from "@/lib/api-url";

/** One feature row of the custom builder — id, translated name and
 *  monthly price arrive from the server page. */
export type SubFeature = {
  id: string;
  name: string;
  /** Monthly price in ₼ — 0 = included with anything. */
  price: number;
};

/** A template tier — the ids of the features it bundles + its flat
 *  monthly price (beats the sum when selected as-is). */
export type SubTier = {
  /** Tier code (plus / pro / ultra) — content-driven from the DB now. */
  id: string;
  name: string;
  price: number;
  features: string[];
};

/** One saved custom-package request — the shape GET/POST
 *  /api/subscription/custom speaks (see src/lib/server/packages.ts). */
export type CustomPackage = {
  id: string;
  features: string[];
  months: number;
  monthlyPrice: number;
  totalPrice: number;
  status: string;
  createdAt: string;
};

/** Allowed durations — must mirror PACKAGE_MONTHS server-side. */
const MONTHS_OPTIONS = [1, 3, 6, 12] as const;

/** Duration multipliers, mirroring monthsDiscount() in
 *  src/lib/server/packages.ts (1 → 1, 3 → .95, 6 → .90, 12 → .85).
 *  Display only — the POST endpoint recomputes the price
 *  authoritatively, never trusting this table. */
const MONTHS_MULTIPLIER: Record<number, number> = { 1: 1, 3: 0.95, 6: 0.9, 12: 0.85 };

/** Fills a single "{name}" placeholder in a pre-resolved ui template. */
const fill = (tpl: string, key: string, val: string | number): string =>
  tpl.replaceAll(`{${key}}`, String(val));

/**
 * The subscription configurator: three template tiers (Plus / Pro /
 * Ultra) as starting points, plus the "Şəxsi plan" builder where ONLY
 * the features the user wants can be selected. The live total sums
 * the picked features and applies the duration discount (1 ₼ minimum,
 * so a plan is never empty); "Paketi tələb et" POSTs the picks — the
 * server prices them again — and every request is listed under the
 * builder with its status chip.
 */
export function SubscriptionBuilder({
  tiers, features, ui,
}: {
  tiers: SubTier[];
  features: SubFeature[];
  ui: {
    perMonth: string;
    templateTag: string;
    customTag: string;
    customTitle: string;
    customDesc: string;
    total: string;
    included: string;
    tierCta: string;
    current: string;
    months: string;
    monthsUnit: string;
    discountNote: string;
    requestCta: string;
    requesting: string;
    requested: string;
    requestedNote: string;
    myTitle: string;
    myEmpty: string;
    statusRequested: string;
    statusActive: string;
    quoteTotal: string;
  };
}) {
  const t = useTranslations("subscription");
  /* Generic retry line for a failed request — the subscription
   * namespace has no error string and messages are frozen this phase. */
  const tErr = useTranslations("settingsPage.devices");
  const [mode, setMode] = useState<"tier" | "custom">("tier");
  const [tier, setTier] = useState<string>("pro");
  const [picked, setPicked] = useState<string[]>(features.slice(0, 2).map((f) => f.id));
  const [months, setMonths] = useState<number>(1);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [created, setCreated] = useState<CustomPackage | null>(null);
  const [mine, setMine] = useState<CustomPackage[] | null>(null);

  const priceOf = useMemo(
    () => new Map(features.map((f) => [f.id, f.price])),
    [features],
  );
  /* Codes → localized names, for summarizing saved requests. */
  const nameOf = useMemo(
    () => new Map(features.map((f) => [f.id, f.name])),
    [features],
  );

  const monthlyTotal = picked.reduce((sum, id) => sum + (priceOf.get(id) ?? 0), 0);
  const multiplier = MONTHS_MULTIPLIER[months] ?? 1;
  const discountPct = Math.round((1 - multiplier) * 100);
  const grandTotal = Math.round(monthlyTotal * months * multiplier * 100) / 100;

  /* My saved requests — loaded once on mount, reloaded after each
   * successful POST so the new row appears immediately. */
  const loadMine = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/subscription/custom"), { cache: "no-store" });
      if (!res.ok) throw new Error();
      const body = (await res.json()) as { packages: CustomPackage[] };
      setMine(body.packages);
    } catch {
      setMine([]);
    }
  }, []);

  useEffect(() => { loadMine(); }, [loadMine]);

  const toggle = (id: string) => {
    setFailed(false);
    setCreated(null);
    setPicked((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const pickMonths = (m: number) => {
    setFailed(false);
    setCreated(null);
    setMonths(m);
  };

  const request = async () => {
    if (busy || picked.length === 0) return;
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch(apiUrl("/api/subscription/custom"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ features: picked, months }),
      });
      if (!res.ok) throw new Error();
      const body = (await res.json()) as { package: CustomPackage };
      setCreated(body.package);
      await loadMine();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  /* Feature codes → localized names, joined for one-line summaries. */
  const namesOf = (codes: string[]) => codes.map((c) => nameOf.get(c) ?? c).join(", ");

  return (
    <div className="subcfg">
      {/* ── Template tiers ── */}
      <div className="subcfg-modes" role="tablist" aria-label={t("title")}>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "tier"}
          className="chip-f"
          onClick={() => setMode("tier")}
        >
          <Crown size={14} aria-hidden />{ui.templateTag}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "custom"}
          className="chip-f"
          onClick={() => setMode("custom")}
        >
          <Sparkles size={14} aria-hidden />{ui.customTag}
        </button>
      </div>

      {mode === "tier" ? (
        <ul className="subtiers">
          {tiers.map((tr) => {
            const active = tier === tr.id;
            return (
              <li key={tr.id} className="card subtier" data-active={active || undefined}>
                <div className="card-top">
                  <span className="tag">{tr.name}</span>
                  {tr.id === "pro" && <span className="tag tag-solid">{t("bestValue")}</span>}
                </div>
                <p className="subprice">
                  <b>{tr.price} ₼</b>
                  <span>{ui.perMonth}</span>
                </p>
                <ul className="subfeat">
                  {features.map((f) => {
                    const on = tr.features.includes(f.id);
                    return (
                      <li key={f.id} data-on={on || undefined}>
                        {on
                          ? <Check size={15} aria-hidden />
                          : <Minus size={15} aria-hidden />}
                        <span>{f.name}</span>
                      </li>
                    );
                  })}
                </ul>
                <button
                  type="button"
                  className={active ? "btn btn-sm" : "btn btn-sm btn-quiet"}
                  onClick={() => setTier(tr.id)}
                >
                  {active ? ui.current : ui.tierCta}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        /* ── The personal builder — pick ONLY what you want ── */
        <div className="card subcustom">
          <div className="card-top">
            <span className="chip-ico tinted"><Zap size={20} aria-hidden /></span>
            <span className="eyebrow">{ui.customTag}</span>
          </div>
          <h3 className="h4">{ui.customTitle}</h3>
          <p className="subcustom-desc">{ui.customDesc}</p>

          <div className="subcustom-dur">
            <span className="subcustom-lbl">{ui.months}</span>
            <div className="seg" role="group" aria-label={ui.months}>
              {MONTHS_OPTIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={months === m}
                  onClick={() => pickMonths(m)}
                >
                  {m} {ui.monthsUnit}
                </button>
              ))}
            </div>
          </div>
          {discountPct > 0 && (
            <p className="subcustom-hint subcustom-disc">
              {fill(ui.discountNote, "pct", discountPct)}
            </p>
          )}

          <ul className="subpick">
            {features.map((f) => {
              const on = picked.includes(f.id);
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    className="subpick-row"
                    aria-pressed={on}
                    onClick={() => toggle(f.id)}
                  >
                    <span className="subpick-box" aria-hidden>
                      {on ? <Check size={16} /> : <Plus size={16} />}
                    </span>
                    <span className="subpick-name">{f.name}</span>
                    <span className="subpick-price">
                      {f.price === 0 ? ui.included : `+${f.price} ₼`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="subcustom-total">
            <span>{ui.total}</span>
            <b>
              {grandTotal} ₼{" "}
              <em>/ {months > 1 ? `${months} ${ui.monthsUnit}` : ui.perMonth}</em>
            </b>
          </div>
          <button
            type="button"
            className="btn subcustom-cta"
            disabled={busy || picked.length === 0}
            onClick={request}
          >
            {busy ? ui.requesting : ui.requestCta}
          </button>
          {picked.length === 0 && <p className="subcustom-hint">{t("customPickHint")}</p>}
          {failed && <p className="subcustom-hint" role="alert">{tErr("error")}</p>}

          {created && (
            /* <output> carries the implicit role="status" — the receipt
             * of the request just made is announced politely. */
            <output className="submy-ok">
              <b>{ui.requested}</b>
              <span>
                {namesOf(created.features)} · {created.months} {ui.monthsUnit} ·{" "}
                {fill(ui.quoteTotal, "total", created.totalPrice)}
              </span>
              <span className="subcustom-hint">{ui.requestedNote}</span>
            </output>
          )}
        </div>
      )}

      {/* ── My requests — every custom package this account sent ── */}
      <section className="submy" aria-label={ui.myTitle}>
        <h2 className="h4">{ui.myTitle}</h2>
        {mine === null ? null : mine.length === 0 ? (
          <p className="subcustom-hint">{ui.myEmpty}</p>
        ) : (
          <ul className="submy-list" aria-live="polite">
            {mine.map((p, i) => (
              <li key={p.id || `pkg-${i}`} className="submy-row">
                <span className="submy-feats">{namesOf(p.features)}</span>
                <span className="submy-meta">
                  {p.months} {ui.monthsUnit} · {fill(ui.quoteTotal, "total", p.totalPrice)}
                </span>
                <span className={p.status === "active" ? "tag tag-solid" : "tag"}>
                  {p.status === "active" ? ui.statusActive : ui.statusRequested}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
