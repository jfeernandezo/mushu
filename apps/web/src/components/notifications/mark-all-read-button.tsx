'use client';

import { CheckCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { markAllAsRead } from '@/actions/notifications';
import { Button } from '@/components/ui/button';

export function MarkAllReadButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const r = await markAllAsRead();
      if (r.ok) {
        toast.success('All notifications marked as read');
        router.refresh();
      } else {
        toast.error('Could not mark all as read');
      }
    });
  }

  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={onClick}>
      <CheckCheck className="h-3.5 w-3.5" />
      Mark all read
    </Button>
  );
}
