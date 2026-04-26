'use client';

import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { exportMyData } from '@/actions/data-export';
import { Button } from '@/components/ui/button';

export function DataExportButton() {
  const t = useTranslations('settings.privacy');
  const [loading, setLoading] = useState(false);

  async function onClick() {
    setLoading(true);
    const r = await exportMyData();
    setLoading(false);
    if (!r.ok) {
      if (r.error === 'rate_limited') {
        toast.error(t('rateLimited'));
      } else {
        toast.error(t('couldNotExport', { error: r.error }));
      }
      return;
    }
    const blob = new Blob([JSON.stringify(r.data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ts = new Date().toISOString().slice(0, 10);
    a.download = `mushu-export-${ts}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(t('exported'));
  }

  return (
    <Button onClick={onClick} disabled={loading} variant="secondary" className="w-fit">
      <Download className="h-4 w-4" />
      {loading ? t('exporting') : t('exportButton')}
    </Button>
  );
}
