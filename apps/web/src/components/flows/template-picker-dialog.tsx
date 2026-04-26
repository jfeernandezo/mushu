'use client';

import { Hand, MessageCircle, MessageSquare, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { createFlow } from '@/actions/flows';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { FLOW_TEMPLATES, type FlowTemplate } from '@/lib/flow-templates';
import { cn } from '@/lib/utils';

interface TemplatePickerDialogProps {
  trigger: React.ReactNode;
}

const ICONS: Record<FlowTemplate['iconName'], LucideIcon> = {
  comment: MessageCircle,
  lead: MessageSquare,
  wave: Hand,
};

export function TemplatePickerDialog({ trigger }: TemplatePickerDialogProps) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function pick(templateId: string | null) {
    if (pending) return;
    startTransition(async () => {
      try {
        let result: { id: string };
        if (templateId) {
          const template = FLOW_TEMPLATES.find((tpl) => tpl.id === templateId);
          if (!template) throw new Error('template_not_found');
          result = await createFlow(t(template.nameKey), {
            templateId,
            templateTexts: {
              triggerKeywords: t(`flowTemplates.${idCamel(templateId)}.defaults.triggerKeywords`),
              dmMessage: t(`flowTemplates.${idCamel(templateId)}.defaults.dmMessage`),
              replyMessage: hasReplyMessage(templateId)
                ? t(`flowTemplates.${idCamel(templateId)}.defaults.replyMessage`)
                : undefined,
            },
          });
        } else {
          result = await createFlow(t('flows.untitled'));
        }
        setOpen(false);
        router.push(`/flows/${result.id}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown_error';
        toast.error(msg);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('flowTemplates.dialogTitle')}</DialogTitle>
          <DialogDescription>{t('flowTemplates.dialogDescription')}</DialogDescription>
        </DialogHeader>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FLOW_TEMPLATES.map((tpl) => {
            const Icon = ICONS[tpl.iconName];
            return (
              <TemplateCard
                key={tpl.id}
                icon={Icon}
                title={t(tpl.nameKey)}
                description={t(tpl.descriptionKey)}
                disabled={pending}
                onClick={() => pick(tpl.id)}
              />
            );
          })}
          <TemplateCard
            icon={Sparkles}
            title={t('flowTemplates.fromScratch.name')}
            description={t('flowTemplates.fromScratch.description')}
            variant="ghost"
            disabled={pending}
            onClick={() => pick(null)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TemplateCard({
  icon: Icon,
  title,
  description,
  variant = 'solid',
  disabled,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  variant?: 'solid' | 'ghost';
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex flex-col items-start gap-2 rounded-md border p-4 text-left transition-colors disabled:pointer-events-none disabled:opacity-50',
        variant === 'solid'
          ? 'border-[var(--color-mushu-border)] bg-[var(--color-mushu-surface)] hover:border-[var(--color-mushu-scarlet)]'
          : 'border-dashed border-[var(--color-mushu-border)] bg-transparent hover:border-[var(--color-mushu-amber)]',
      )}
    >
      <Icon className="h-5 w-5 text-[var(--color-mushu-amber)]" />
      <p className="font-medium text-[var(--color-mushu-ink)]">{title}</p>
      <p className="text-xs text-[var(--color-mushu-mute)]">{description}</p>
    </button>
  );
}

function idCamel(id: string): string {
  // 'comment-to-dm' → 'commentToDm'
  return id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function hasReplyMessage(id: string): boolean {
  return id === 'comment-to-dm';
}
