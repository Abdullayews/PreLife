"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Banknote, LoaderCircle, X } from "lucide-react";

/** Row actions on the "My sessions" page: pay (demo flag) and cancel
 *  (only before the session starts). */
export function BookingsActions({ id, payment, canCancel }: { id: string; payment: string; canCancel: boolean }) {
  const t = useTranslations("psychApp");
  const router = useRouter();
  const [busy, setBusy] = useState<"pay" | "cancel" | null>(null);
  const [, start] = useTransition();

  const post = (path: string, kind: "pay" | "cancel") =>
    start(async () => {
      setBusy(kind);
      await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setBusy(null);
      router.refresh();
    });

  return (
    <span className="psy-actions" style={{ margin: 0, gap: ".45rem" }}>
      {payment === "unpaid" && (
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
