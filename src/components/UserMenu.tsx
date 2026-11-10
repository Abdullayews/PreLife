"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Crown, FileText, Home, LogOut, ScrollText } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";

export type MenuUser = { name: string | null; email: string };

/** Basic account menu for signed-in visitors (avatar → dropdown). */
export function UserMenu({ user }: { user: MenuUser }) {
  const t = useTranslations("accountMenu");
  const th = useTranslations("welcomePage");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initials =
    (user.name?.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("") ??
      user.email.slice(0, 2)).toUpperCase();

  const logout = async () => {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setOpen(false);
      router.replace("/welcome");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="user-menu" ref={ref}>
      <button
        type="button"
        className="user-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={user.name ?? user.email}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="avatar" style={{ "--px": "2.1rem" } as React.CSSProperties}>
          {initials}
        </span>
        <ChevronDown size={13} aria-hidden />
      </button>

      {open && (
        <div className="user-pop" role="menu">
          <p className="user-label">
            <b>{user.name ?? user.email}</b>
            <span>{user.email}</span>
          </p>
          <Link role="menuitem" href="/home" onClick={() => setOpen(false)}>
            <Home size={15} aria-hidden />{th("tabs.home")}
          </Link>
          <Link role="menuitem" href="/subscription" onClick={() => setOpen(false)}>
            <Crown size={15} aria-hidden />{t("subscription")}
          </Link>
          <Link role="menuitem" href="/terms" onClick={() => setOpen(false)}>
            <FileText size={15} aria-hidden />{t("terms")}
          </Link>
          <Link role="menuitem" href="/rules" onClick={() => setOpen(false)}>
            <ScrollText size={15} aria-hidden />{t("rules")}
          </Link>
          <button type="button" role="menuitem" onClick={logout} disabled={busy}>
            <LogOut size={15} aria-hidden />{t("logout")}
          </button>
        </div>
      )}
    </div>
  );
}
