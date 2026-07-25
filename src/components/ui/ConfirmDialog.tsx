"use client";

import { useEffect, useRef } from "react";
import styles from "./ConfirmDialog.module.scss";

interface ConfirmDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/**
 * Подтверждение разрушительного действия.
 *
 * Нативный `<dialog>`, а не свой оверлей: он даёт закрытие по Escape, ловушку
 * фокуса и блокировку фона бесплатно и правильно. Писать это руками — верный
 * способ забыть половину.
 *
 * Отмена стоит первой в разметке и поэтому получает фокус автоматически:
 * случайный тап или нажатие Enter не должны стирать заработанную скидку.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) {
      return;
    }

    if (open) {
      // jsdom не реализует showModal, поэтому в тестах используется атрибут.
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
      return;
    }

    if (typeof dialog.close === "function") {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
    }
  }, [open]);

  return (
    <dialog
      aria-labelledby="confirm-dialog-title"
      className={styles.dialog}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      ref={dialogRef}
    >
      <h2 className={styles.title} id="confirm-dialog-title">
        {title}
      </h2>
      <p className={styles.description}>{description}</p>

      {/* Порядок в разметке важен: `showModal` ставит фокус на первый
          фокусируемый элемент, и это должна быть отмена. */}
      <div className={styles.actions}>
        <button className={styles.cancel} onClick={onCancel} type="button">
          {cancelLabel}
        </button>
        <button className={styles.confirm} onClick={onConfirm} type="button">
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
