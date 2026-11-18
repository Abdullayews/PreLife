"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Crown, Minus, Plus, Sparkles, Zap } from "lucide-react";

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

/**
 * The subscription configurator: three template tiers (Plus / Pro /
 * Ultra) as starting points, plus the "Şəxsi plan" builder where ONLY
 * the features the user wants can be selected — the live total simply
 * sums the picked features (1 ₼ minimum, so a plan is never empty).
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
    customCta: string;
    tierCta: string;
    current: string;
  };
}) {
  const t = useTranslations("subscription");
  const [mode, setMode] = useState<"tier" | "custom">("tier");
  const [tier, setTier] = useState<string>("pro");
  const [picked, setPicked] = useState<string[]>(features.slice(0, 2).map((f) => f.id));

  const priceOf = useMemo(
    () => new Map(features.map((f) => [f.id, f.price])),
    [features],
  );

  const customTotal = picked.reduce((sum, id) => sum + (priceOf.get(id) ?? 0), 0);

  const toggle = (id: string) =>
    setPicked((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

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
            <b>{customTotal} ₼ <em>/ {ui.perMonth}</em></b>
          </div>
          <button type="button" className="btn subcustom-cta" disabled={picked.length === 0}>
            {ui.customCta}
          </button>
          {picked.length === 0 && <p className="subcustom-hint">{t("customPickHint")}</p>}
        </div>
      )}
    </div>
  );
}
