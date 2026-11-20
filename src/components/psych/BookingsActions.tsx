"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Banknote, LoaderCircle, X } from "lucide-react";
import { apiUrl } from "@/lib/api-url";
import { toast } from "@/components/Toaster";

/** Row actions on the "My sessions" page. Since v3.4 a booking flows
 *  requested → confirmed (psychologist) → upcoming+paid (client pays), so
 *  the Pay button only exists on CONFIRMED unpaid rows — before that the
 *  psychologist has not accepted the request yet. Cancel works on any
 *  future row. */
export function BookingsActions({
  id, payment, status, canCancel,
}: { id: string; payment: string; status: string; canCancel: boolean }) {
  const t = useTranslations("psychApp");
  const router = useRouter();
  const [busy, setBusy] = useState<"pay" | "cancel" | null>(null);
  const [, start] = useTransition();

  const canPay = payment === "unpaid" && status === "confirmed";

  const post = (path: string, kind: "pay" | "cancel") =>
    start(async () => {
      setBusy(kind);
      const res = await fetch(apiUrl(path), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setBusy(null);
      if (!res.ok) {
        // e.g. 409 not_confirmed — the row changed under us; say so. A code
        // the catalog has no string for falls back to the generic message
        // instead of rendering a raw i18n key.
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        const code = data.error && t.has(`bookError_${data.error}`) ? `bookError_${data.error}` : "errorGeneric";
        toast(t(code), "error");
      }
      router.refresh();
    });

  return (
    <span className="psy-actions" style={{ margin: 0, gap: ".45rem" }}>
      {status === "confirmed" && (
        <p className="avail-note" style={{ margin: "0 0 .3rem", flexBasis: "100%" }}>
          {t("payHint")}
        </p>
      )}
      {canPay && (
        <button type="button" className="btn btn-sm btn-quiet" onClick={() => post("/api/psych/pay", "pay")} disabled={busy !== null}>
          {busy === "pay" ? <LoaderCircle size={14} className="spin" aria-hidden /> : <Banknote size={14} aria-hidden />}
          {t("payMark")}
        </button>
      )}
      {canCancel && (
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => post("/api/psych/cancel", "cancel")} disabled={busy !== null}>
          {busy === "cancel" ? <LoaderCircle size={14} className="spin" aria-hidden /> : <X size={14} aria-hidden />}
          {t("bookingCancel")}
        </button>
      )}
    </span>
  );
}
