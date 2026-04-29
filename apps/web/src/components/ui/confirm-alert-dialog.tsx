'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface ConfirmAlertDialogProps {
  /** Element that opens the dialog (button, menu item, etc.). Wrapped via
   *  `asChild` so the trigger keeps its native semantics. */
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  /** Label for the destructive action button. Defaults to 'Confirm'. */
  confirmLabel: string;
  /** Optional in-flight label (e.g. "Disconnecting…"). Falls back to confirmLabel. */
  pendingLabel?: string;
  /** Label for the cancel button. Defaults to 'Cancel'. */
  cancelLabel: string;
  /** Color treatment for the action button. Use 'destructive' for delete-style
   *  actions (red bg). Defaults to 'destructive' since most callers ARE
   *  destructive — the rare non-destructive caller passes 'default'. */
  variant?: 'destructive' | 'default';
  /** Async callback invoked when the user confirms. Dialog stays open until
   *  the promise resolves; if the callback returns false, dialog stays open
   *  (caller is responsible for showing an error toast). */
  onConfirm: () => void | Promise<unknown>;
}

/**
 * Standard "are you sure?" dialog for destructive or irreversible actions.
 * Use everywhere a `window.confirm` would otherwise live — gets us focus
 * trap, esc-to-cancel, screen-reader labels, and consistent styling.
 *
 * Caller passes the trigger element (typically a Button with Trash2 icon)
 * and the dialog wires up Radix AlertDialog around it. The action callback
 * runs while the dialog is in pending state — disable both buttons and show
 * the pendingLabel — then closes on success.
 */
export function ConfirmAlertDialog({
  trigger,
  title,
  description,
  confirmLabel,
  pendingLabel,
  cancelLabel,
  variant = 'destructive',
  onConfirm,
}: ConfirmAlertDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleConfirm() {
    setPending(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setPending(false);
    }
  }

  const actionClass =
    variant === 'destructive'
      ? 'bg-[var(--color-mushu-danger)] text-white hover:opacity-90'
      : '';

  return (
    <AlertDialog open={open} onOpenChange={(next) => (pending ? null : setOpen(next))}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void handleConfirm();
            }}
            disabled={pending}
            className={actionClass}
          >
            {pending ? (pendingLabel ?? confirmLabel) : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
