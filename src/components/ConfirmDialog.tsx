"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, LoaderCircle } from "lucide-react";
import { Modal } from "@/components/Modal";

/**
 * The shared "are you sure?" guard for every destructive action on the
 * site (delete / cancel / reset / revoke). A thin layer over the native
 * <dialog> Modal: one question line + a two-button footer — İmtina and
 * the confirm button, red when the action destroys data.
 *
 * Focus lands on the CANCEL button (the safe choice) right after the
 * dialog opens, so Enter alone can never confirm a delete. `busy` keeps
 * the dialog open and its buttons inert while the confirmed request runs.
 */
export function ConfirmDialog({
  open, onClose, onConfirm, message, title, confirmLabel, cancelLabel, closeLabel, tone = "danger", busy = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** The question line, e.g. "Bu yazını silmək istədiyinizə əminsiniz?" */
  message: string;
  /** Dialog heading — defaults to moduleCommon.confirmTitle. */
  title?: string;
  /** The confirming CTA — defaults to moduleCommon.confirmYes. */
  confirmLabel?: string;
  cancelLabel?: string;
  closeLabel?: string;
  /** "danger" renders the red confirm button (destructive actions). */
  tone?: "danger" | "default";
  /** True while the confirmed request is in flight. */
  busy?: boolean;
}) {
  const t = useTranslations("moduleCommon");
  const cancelRef = useRef<HTMLButtonElement>(null);

  /* Focus the SAFE choice when the dialog opens — the Modal itself puts
   * focus on its X button; the cancel button takes it a beat later. */
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => cancelRef.current?.focus(), 120);
    return () => window.clearTimeout(id);
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={title ?? t("confirmTitle")}
      closeLabel={closeLabel ?? t("navClose")}
    >
      <div className="confirm-body">
        <p className="confirm-msg">
          {tone === "danger" && <AlertTriangle size={18} aria-hidden className="confirm-ico" />}
          {message}
        </p>
        <div className="confirm-actions">
          <button
            type="button"
            ref={cancelRef}
            className="btn btn-sm btn-ghost"
            onClick={onClose}
            disabled={busy}
          >
            {cancelLabel ?? t("confirmNo")}
          </button>
          <button
            type="button"
            className={`btn btn-sm${tone === "danger" ? " btn-danger" : ""}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy && <LoaderCircle size={14} className="spin" aria-hidden />}
            {confirmLabel ?? t("confirmYes")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
