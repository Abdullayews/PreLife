"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * A minimal, dependency-free modal dialog in the design system's own
 * language: a scrim, a centered surface panel, an X close, Escape to
 * dismiss and a click on the scrim to dismiss. Body scroll locks while
 * open; the close button receives focus on open (a light focus trap —
 * Tab cycles naturally because the dialog sits last in the DOM order).
 */
export function Modal({
  open, onClose, title, closeLabel, children, wide,
}: {
  open: boolean;
  onClose: () => void;
  /** Rendered in the dialog's own <h2> heading. */
  title: string;
  /** aria-label for the close button. */
  closeLabel: string;
  children: ReactNode;
  /** Wider panel (gym details / plan picker). */
  wide?: boolean;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  /* Escape closes; focus lands on the close button when opened. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panelRef.current) {
        // Soft focus trap: keep Tab inside the open panel.
        const items = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(
            "a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex='-1'])",
          ),
        ).filter((el) => el.offsetParent !== null);
        if (!items.length) return;
        const first = items[0]!;
        const last = items[items.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-root" role="presentation">
      {/* The scrim: pointerdown (not click) closes it — Escape and the X
          cover keyboard users, so it stays aria-hidden. */}
      <div
        className="modal-scrim"
        aria-hidden="true"
        onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      />
      <div
        className={wide ? "modal-panel modal-wide" : "modal-panel"}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={panelRef}
      >
        <header className="modal-head">
          <h2>{title}</h2>
          <button
            type="button"
            ref={closeRef}
            className="modal-x"
            aria-label={closeLabel}
            onClick={onClose}
          >
            <X size={18} aria-hidden />
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
