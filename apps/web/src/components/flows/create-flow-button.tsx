'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { createFlow } from '@/actions/flows';
import { Button } from '@/components/ui/button';

export function CreateFlowButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const { id } = await createFlow('Untitled flow');
      router.push(`/flows/${id}`);
    });
  }

  return (
    <Button onClick={onClick} disabled={isPending}>
      <Plus className="h-4 w-4" />
      {isPending ? 'Creating…' : 'New flow'}
    </Button>
  );
}
