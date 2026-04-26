'use client';

import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { TemplatePickerDialog } from './template-picker-dialog';

export function CreateFlowButton() {
  const t = useTranslations('flows');

  return (
    <TemplatePickerDialog
      trigger={
        <Button>
          <Plus className="h-4 w-4" />
          {t('newFlow')}
        </Button>
      }
    />
  );
}
