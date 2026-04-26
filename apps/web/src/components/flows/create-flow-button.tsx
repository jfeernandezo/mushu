'use client';

import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { createFlow } from '@/actions/flows';
import { Button } from '@/components/ui/button';

export function CreateFlowButton() {
  const t = useTranslations('flows');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const { id } = await createFlow(t('untitled'));
      router.push(`/flows/${id}`);
    });
  }

  return (
    <Button onClick={onClick} disabled={isPending}>
      <Plus className="h-4 w-4" />
      {isPending ? t('creating') : t('newFlow')}
    </Button>
  );
}
