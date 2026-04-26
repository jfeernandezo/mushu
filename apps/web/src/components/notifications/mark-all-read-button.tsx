'use client';

import { CheckCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { markAllAsRead } from '@/actions/notifications';
import { Button } from '@/components/ui/button';

export function MarkAllReadButton() {
  const t = useTranslations('notificationsPage');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const r = await markAllAsRead();
      if (r.ok) {
        toast.success(t('marked'));
        router.refresh();
      } else {
        toast.error(t('couldNotMarkAll'));
      }
    });
  }

  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={onClick}>
      <CheckCheck className="h-3.5 w-3.5" />
      {t('markAllRead')}
    </Button>
  );
}
