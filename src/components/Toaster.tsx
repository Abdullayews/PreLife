"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Info, TriangleAlert } from "lucide-react";

/**
 * The global action-feedback layer — one <Toaster /> in the [locale]
 * layout, called from anywhere via the exported toast() helper (client
 * only). Design: bottom-center above the safe area, deep surface, kind
 * carried by the icon color; enters with @starting-style rise+scale
 * (300ms ease-out), exits faster (180ms). Polite live region — errors
 * stay longer. Max 3 visible; newest wins.
 */

export type ToastKind = "success" | "error" | "info";

export type ToastPayload = { msg: string; kind?: ToastKind };

const EVENT = "pl-toast";
const SHOW_MS = 3200;
const SHOW_ERROR_MS = 5200;

/** Fire a toast from any client component: toast("Saved"), toast("Failed", "error"). */
export function toast(msg: string, kind: ToastKind = "success") {
  window.dispatchEvent(new CustomEvent<ToastPayload>(EVENT, { detail: { msg, kind } }));
}

type Item = { id: number; msg: string; kind: ToastKind; out: boolean };

let seq = 0;

export function Toaster() {
  const t = useTranslations("moduleCommon");
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    const timers: number[] = [];
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent<ToastPayload>).detail;
      if (!detail?.msg) return;
      const id = ++seq;
      const kind = detail.kind ?? "success";
      setItems((prev) => [...prev.slice(-2), { id, msg: detail.msg, kind, out: false }]);
      timers.push(
        window.setTimeout(
          () => {
            setItems((prev) => prev.map((it) => (it.id === id ? { ...it, out: true } : it)));
            timers.push(
              window.setTimeout(
                () => setItems((prev) => prev.filter((it) => it.id !== id)),
                220,
              ),
            );
          },
          kind === "error" ? SHOW_ERROR_MS : SHOW_MS,
        ),
      );
    };
    window.addEventListener(EVENT, onToast);
    return () => {
      window.removeEventListener(EVENT, onToast);
      for (const t of timers) window.clearTimeout(t);
    };
  }, []);

  return (
    <section className="pl-toaster" aria-label={t("notifications")}>
      {items.map((it) => (
        <output key={it.id} className="pl-toast" data-kind={it.kind} data-out={it.out || undefined}>
          {it.kind === "error"
            ? <TriangleAlert size={17} aria-hidden />
            : it.kind === "info"
              ? <Info size={17} aria-hidden />
              : <CheckCircle2 size={17} aria-hidden />}
          <span>{it.msg}</span>
        </output>
      ))}
    </section>
  );
}
