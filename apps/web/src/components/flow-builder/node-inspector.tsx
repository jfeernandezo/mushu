'use client';

import type { Node } from '@xyflow/react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface NodeInspectorProps {
  node: Node | null;
  onChange: (id: string, data: Record<string, unknown>) => void;
  onClose: () => void;
  onDelete: (id: string) => void;
}

export function NodeInspector({ node, onChange, onClose, onDelete }: NodeInspectorProps) {
  const tInspector = useTranslations('flowBuilder.inspector');
  const tNodes = useTranslations('flowBuilder.nodes');

  if (!node) {
    return (
      <aside className="flex h-full w-72 flex-col items-center justify-center border-l border-[var(--color-mushu-border)] bg-[var(--color-mushu-bg)] p-6 text-center text-xs text-[var(--color-mushu-faint)]">
        {tInspector('selectBlock')}
      </aside>
    );
  }

  const data = (node.data ?? {}) as Record<string, unknown>;

  function update(key: string, value: unknown) {
    if (!node) return;
    onChange(node.id, { ...data, [key]: value });
  }

  return (
    <aside className="flex h-full w-72 flex-col gap-4 border-l border-[var(--color-mushu-border)] bg-[var(--color-mushu-bg)] p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--color-mushu-faint)]">
          {nodeTitle(node.type, tNodes)}
        </h3>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onClose}>
          <X className="h-3 w-3" />
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <Form type={node.type} data={data} update={update} />
      </div>

      <Button
        variant="outline"
        size="sm"
        className="mt-auto text-xs text-[var(--color-mushu-danger)]"
        onClick={() => onDelete(node.id)}
      >
        {tInspector('deleteBlock')}
      </Button>
    </aside>
  );
}

function nodeTitle(type: string | undefined, tNodes: (key: string) => string): string {
  switch (type) {
    case 'trigger.comment_keyword':
    case 'trigger.dm_keyword':
    case 'action.send_dm':
    case 'action.reply_comment':
    case 'logic.delay':
    case 'logic.condition':
    case 'control.end':
      return tNodes(`${type}.title`);
    default:
      return tNodes('block');
  }
}

function Form({
  type,
  data,
  update,
}: {
  type: string | undefined;
  data: Record<string, unknown>;
  update: (key: string, value: unknown) => void;
}) {
  const tFields = useTranslations('flowBuilder.inspector.fields');
  const tPh = useTranslations('flowBuilder.inspector.placeholders');
  const tInspector = useTranslations('flowBuilder.inspector');

  if (type === 'trigger.comment_keyword') {
    return (
      <>
        <Field label={tFields('instagramPostId')}>
          <Input
            value={(data.instagramPostId as string) ?? ''}
            onChange={(e) => update('instagramPostId', e.target.value)}
            placeholder="18069466016328562"
          />
        </Field>
        <Field label={tFields('keywordsCommaSeparated')}>
          <Input
            value={Array.isArray(data.keywords) ? (data.keywords as string[]).join(', ') : ''}
            onChange={(e) =>
              update(
                'keywords',
                e.target.value
                  .split(',')
                  .map((k) => k.trim())
                  .filter(Boolean),
              )
            }
            placeholder="fluxo, n8n"
          />
        </Field>
      </>
    );
  }

  if (type === 'trigger.dm_keyword') {
    return (
      <Field label={tFields('keywordsCommaSeparated')}>
        <Input
          value={Array.isArray(data.keywords) ? (data.keywords as string[]).join(', ') : ''}
          onChange={(e) =>
            update(
              'keywords',
              e.target.value
                .split(',')
                .map((k) => k.trim())
                .filter(Boolean),
            )
          }
          placeholder="agenda, template"
        />
      </Field>
    );
  }

  if (type === 'action.send_dm' || type === 'action.reply_comment') {
    return (
      <Field label={tFields('messageText')}>
        <textarea
          value={(data.text as string) ?? ''}
          onChange={(e) => update('text', e.target.value)}
          rows={5}
          className="w-full rounded-md border border-[var(--color-mushu-border)] bg-[var(--color-mushu-surface)] px-3 py-2 text-sm text-[var(--color-mushu-ink)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-mushu-amber)]"
          placeholder={tPh('messageText')}
        />
      </Field>
    );
  }

  if (type === 'logic.delay') {
    return (
      <Field label={tFields('durationSeconds')}>
        <Input
          type="number"
          value={String(data.durationSeconds ?? 30)}
          onChange={(e) => update('durationSeconds', Number.parseInt(e.target.value, 10) || 0)}
          placeholder={tPh('delaySeconds')}
        />
      </Field>
    );
  }

  if (type === 'logic.condition') {
    return (
      <p className="text-xs text-[var(--color-mushu-faint)]">{tInspector('conditionV2')}</p>
    );
  }

  return null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-[var(--color-mushu-mute)]">{label}</span>
      {children}
    </label>
  );
}
