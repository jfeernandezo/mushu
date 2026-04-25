'use client';

import type { Node } from '@xyflow/react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface NodeInspectorProps {
  node: Node | null;
  onChange: (id: string, data: Record<string, unknown>) => void;
  onClose: () => void;
  onDelete: (id: string) => void;
}

export function NodeInspector({ node, onChange, onClose, onDelete }: NodeInspectorProps) {
  if (!node) {
    return (
      <aside className="flex h-full w-72 flex-col items-center justify-center border-l border-[var(--color-mushu-border)] bg-[var(--color-mushu-bg)] p-6 text-center text-xs text-[var(--color-mushu-faint)]">
        Select a block to edit its settings.
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
          {nodeTitle(node.type)}
        </h3>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onClose}>
          <X className="h-3 w-3" />
        </Button>
      </div>

      <div className="flex flex-col gap-3">{renderForm(node.type, data, update)}</div>

      <Button
        variant="outline"
        size="sm"
        className="mt-auto text-xs text-[var(--color-mushu-danger)]"
        onClick={() => onDelete(node.id)}
      >
        Delete block
      </Button>
    </aside>
  );
}

function nodeTitle(type: string | undefined): string {
  switch (type) {
    case 'trigger.comment_keyword':
      return 'Comment trigger';
    case 'trigger.dm_keyword':
      return 'DM keyword trigger';
    case 'action.send_dm':
      return 'Send DM';
    case 'action.reply_comment':
      return 'Reply comment';
    case 'logic.delay':
      return 'Delay';
    case 'logic.condition':
      return 'Condition';
    case 'control.end':
      return 'End';
    default:
      return 'Block';
  }
}

function renderForm(
  type: string | undefined,
  data: Record<string, unknown>,
  update: (key: string, value: unknown) => void,
) {
  if (type === 'trigger.comment_keyword') {
    return (
      <>
        <Field label="Instagram post ID">
          <Input
            value={(data.instagramPostId as string) ?? ''}
            onChange={(e) => update('instagramPostId', e.target.value)}
            placeholder="18069466016328562"
          />
        </Field>
        <Field label="Keywords (comma-separated)">
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
      <Field label="Keywords (comma-separated)">
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
      <Field label="Message text">
        <textarea
          value={(data.text as string) ?? ''}
          onChange={(e) => update('text', e.target.value)}
          rows={5}
          className="w-full rounded-md border border-[var(--color-mushu-border)] bg-[var(--color-mushu-surface)] px-3 py-2 text-sm text-[var(--color-mushu-ink)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-mushu-amber)]"
          placeholder="Hey! Here's the link…"
        />
      </Field>
    );
  }

  if (type === 'logic.delay') {
    return (
      <Field label="Duration (seconds)">
        <Input
          type="number"
          value={String(data.durationSeconds ?? 30)}
          onChange={(e) => update('durationSeconds', Number.parseInt(e.target.value, 10) || 0)}
          placeholder="30"
        />
      </Field>
    );
  }

  if (type === 'logic.condition') {
    return (
      <p className="text-xs text-[var(--color-mushu-faint)]">
        Condition editor lands in v0.2. For now, this block always takes the first branch.
      </p>
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
