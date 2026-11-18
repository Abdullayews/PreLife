"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * A modal dialog built on the NATIVE <dialog> element: showModal() gives
 * us the focus trap, Escape handling and the ::backdrop scrim for free —
 * this component only adds the shared chrome (sticky header with the X,
 * body scroll lock while open) and the design system's styling.
 *
 * The scrim closes on an outside pointerdown (click on ::backdrop lands
 * on the dialog element itself, target === currentTarget).
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  /* Open/close the native dialog after it mounts/updates. Layout effect
   * so showModal() runs before the browser paints — no flash. */
  useLayoutEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
  }, [open]);

  /* Body scroll lock while open (native dialogs block interaction, not
   * the background scroll). */
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  /* Unmount safety: if the owner removes the dialog while open (e.g. a
   * route change), close() restores the page's interaction state. */
  useEffect(() => {
    const dlg = dialogRef.current;
    return () => {
      if (dlg?.open) dlg.close();
    };
  }, []);

  /* Backdrop click: a click that lands on the dialog element itself is a
   * click on the ::backdrop (the panel content sits above it). Wired via
   * addEventListener — the native-dialog pattern, outside JSX props. */
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    const onBackdrop = (e: MouseEvent) => {
      if (e.target === dlg) onClose();
    };
    dlg.addEventListener("click", onBackdrop);
    return () => dlg.removeEventListener("click", onBackdrop);
  }, [onClose]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      className={wide ? "modal-panel modal-wide" : "modal-panel"}
      aria-label={title}
      onCancel={(e) => {
        /* Escape: let React own the state change, not the native close. */
        e.preventDefault();
        onClose();
      }}
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
    </dialog>
  );
}
