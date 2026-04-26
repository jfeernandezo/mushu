'use client';

import { MoreVertical, Power, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { deleteFlow, setFlowEnabled } from '@/actions/flows';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface FlowCardMenuProps {
  flowId: string;
  isEnabled: boolean;
}

export function FlowCardMenu({ flowId, isEnabled }: FlowCardMenuProps) {
  const t = useTranslations('flows.actions');
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onToggle(e: Event) {
    e.preventDefault();
    if (pending) return;
    startTransition(async () => {
      try {
        const next = !isEnabled;
        await setFlowEnabled(flowId, next);
        toast.success(next ? t('enabled') : t('disabled'));
        router.refresh();
      } catch {
        toast.error(t('couldNotToggle'));
      }
    });
  }

  function onConfirmDelete() {
    if (pending) return;
    startTransition(async () => {
      try {
        await deleteFlow(flowId);
        toast.success(t('deleted'));
        setConfirmOpen(false);
        router.refresh();
      } catch {
        toast.error(t('couldNotDelete'));
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={t('menuLabel')}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-mushu-mute)] transition-colors hover:bg-[var(--color-mushu-surface-hover)] hover:text-[var(--color-mushu-ink)]"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            disabled={pending}
            onSelect={onToggle}
          >
            <Power className="h-3.5 w-3.5" />
            <span>{isEnabled ? t('disable') : t('enable')}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={pending}
            onSelect={(e) => {
              e.preventDefault();
              setConfirmOpen(true);
            }}
            className="text-[var(--color-mushu-danger)] focus:text-[var(--color-mushu-danger)]"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{t('delete')}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('confirmDeleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('confirmDeleteBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={onConfirmDelete}
              className="bg-[var(--color-mushu-danger)] hover:opacity-90"
            >
              {t('confirmDelete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
