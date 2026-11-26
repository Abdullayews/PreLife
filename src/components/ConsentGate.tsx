"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { LoaderCircle, ShieldCheck } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { fetchConsents, setConsent, type DataScope } from "@/lib/data-consent";
import { toast } from "@/components/Toaster";

/**
 * The explicit-consent gate for the health-adjacent features (GDPR
 * Art. 9 / AZ PDPA / 152-FZ): the gated feature renders ONLY after its
 * scope is granted. Until then the visitor sees an informed consent card
 * — grant enables the feature for this visit and everywhere else;
 * "not now" keeps a compact locked card. The server enforces the same
 * gate on the API (403 consent_required_<scope>), so this UI is
 * convenience, not the enforcement layer.
 */

export function useDataConsent(scope: DataScope) {
  const [state, setState] = useState<"loading" | "granted" | "refused" | "error">("loading");

  useEffect(() => {
    let alive = true;
    (async () => {
      const map = await fetchConsents();
      if (!alive) return;
      if (map === null) setState("error");
      else setState(map[scope] ? "granted" : "refused");
    })();
    return () => { alive = false; };
  }, [scope]);

  const allow = useCallback(async () => {
    const map = await setConsent(scope, true);
    if (map === null) {
      setState("error");
      return false;
    }
    setState(map[scope] ? "granted" : "refused");
    return map[scope] === true;
  }, [scope]);

  return { state, allow };
}

/** A full-width informed-consent card used inside feature areas. */
export function ConsentCard({ scope, onAllowed, compact = false }: { scope: DataScope; onAllowed?: () => void; compact?: boolean }) {
  const t = useTranslations("consentGate");
  const { state, allow } = useDataConsent(scope);
  const [busy, setBusy] = useState(false);

  if (state === "granted") return null;

  const grant = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await allow();
    setBusy(false);
    if (ok) {
      toast(t("granted"));
      onAllowed?.();
    }
  };

  if (state === "error") {
    return (
      <div className="consent-card card" data-compact={compact || undefined} role="alert">
        <p>{t("error")}</p>
        <button type="button" className="btn btn-sm" onClick={() => window.location.reload()}>{t("retry")}</button>
      </div>
    );
  }

  return (
    <div className="consent-card card" data-compact={compact || undefined}>
      <span className="chip-ico tinted"><ShieldCheck size={20} aria-hidden /></span>
      <div>
        <b>{t(`scopes.${scope}.title`)}</b>
        <p>{t(`scopes.${scope}.body`)}</p>
      </div>
      <div className="consent-card-actions">
        <button type="button" className="btn btn-sm" onClick={() => void grant()} disabled={busy}>
          {busy ? <LoaderCircle size={14} className="spin" aria-hidden /> : <ShieldCheck size={14} aria-hidden />}
          {t("allow")}
        </button>
        {!compact && (
          <Link href="/settings" className="btn btn-sm btn-ghost">{t("manage")}</Link>
        )}
      </div>
      <p className="consent-card-note">{t("note")}</p>
    </div>
  );
}

/** Wraps a gated feature: the feature renders only after the scope is
 *  granted; until then the consent card (and, after "not now", a compact
 *  locked card) takes its place. `enabled=false` renders the children
 *  directly (the guest surface — no account is attached, nothing to gate). */
export function ConsentGate({ scope, enabled = true, compact = false, children }: { scope: DataScope; enabled?: boolean; compact?: boolean; children: React.ReactNode }) {
  const t = useTranslations("consentGate");
  const { state, allow } = useDataConsent(scope);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (!enabled) return <>{children}</>;

  if (state === "loading" || state === "error") {
    // The gate must not flash the feature before the state is known.
    return <div className="consent-card card" data-compact={compact || undefined} aria-busy={state === "loading"}>{state === "error" ? <p>{t("error")}</p> : <p className="consent-card-note">{t("loading")}</p>}</div>;
  }
  if (state === "granted") return <>{children}</>;

  const grant = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await allow();
    setBusy(false);
    if (ok) toast(t("granted"));
  };

  if (dismissed || compact) {
    return (
      <div className="consent-card card" data-compact="true">
        <span className="chip-ico tinted"><ShieldCheck size={20} aria-hidden /></span>
        <div>
          <b>{compact ? t(`scopes.${scope}.title`) : t("locked")}</b>
          {compact && <p>{t(`scopes.${scope}.body`)}</p>}
        </div>
        <div className="consent-card-actions">
          <button type="button" className="btn btn-sm" onClick={() => void grant()} disabled={busy}>
            {busy ? <LoaderCircle size={14} className="spin" aria-hidden /> : <ShieldCheck size={14} aria-hidden />}
            {t("allow")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="consent-card card">
      <span className="chip-ico tinted"><ShieldCheck size={20} aria-hidden /></span>
      <div>
        <b>{t(`scopes.${scope}.title`)}</b>
        <p>{t(`scopes.${scope}.body`)}</p>
      </div>
      <div className="consent-card-actions">
        <button type="button" className="btn btn-sm" onClick={() => void grant()} disabled={busy}>
          {busy ? <LoaderCircle size={14} className="spin" aria-hidden /> : <ShieldCheck size={14} aria-hidden />}
          {t("allow")}
        </button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setDismissed(true)} disabled={busy}>
          {t("notNow")}
        </button>
      </div>
      <p className="consent-card-note">{t("note")}</p>
    </div>
  );
}
