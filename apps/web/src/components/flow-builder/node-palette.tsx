'use client';

import {
  Clock,
  GitBranch,
  type LucideIcon,
  MessageCircle,
  MessageSquare,
  Send,
  Square,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { DragEvent } from 'react';
import type { FlowNodeType } from '@mushu/shared/flow';

type CategoryKey = 'triggers' | 'actions' | 'logic' | 'control';

interface PaletteItem {
  type: FlowNodeType;
  icon: LucideIcon;
  category: CategoryKey;
}

const ITEMS: PaletteItem[] = [
  { type: 'trigger.comment_keyword', icon: MessageCircle, category: 'triggers' },
  { type: 'trigger.dm_keyword', icon: MessageSquare, category: 'triggers' },
  { type: 'action.send_dm', icon: Send, category: 'actions' },
  { type: 'action.reply_comment', icon: MessageCircle, category: 'actions' },
  { type: 'logic.delay', icon: Clock, category: 'logic' },
  { type: 'logic.condition', icon: GitBranch, category: 'logic' },
  { type: 'control.end', icon: Square, category: 'control' },
];

const CATEGORY_ORDER: CategoryKey[] = ['triggers', 'actions', 'logic', 'control'];

const CATEGORY_LABEL_KEY: Record<CategoryKey, string> = {
  triggers: 'categoryTriggers',
  actions: 'categoryActions',
  logic: 'categoryLogic',
  control: 'categoryControl',
};

export function NodePalette() {
  const tPalette = useTranslations('flowBuilder.palette');
  const tNodes = useTranslations('flowBuilder.nodes');

  function onDragStart(e: DragEvent<HTMLDivElement>, type: FlowNodeType) {
    e.dataTransfer.setData('application/mushu-node-type', type);
    e.dataTransfer.effectAllowed = 'move';
  }

  const grouped = ITEMS.reduce<Record<CategoryKey, PaletteItem[]>>((acc, item) => {
    (acc[item.category] ??= []).push(item);
    return acc;
  }, {} as Record<CategoryKey, PaletteItem[]>);

  return (
    <aside className="flex h-full w-56 flex-col gap-4 overflow-y-auto border-r border-[var(--color-mushu-border)] bg-[var(--color-mushu-bg)] p-4">
      <h2 className="text-xs font-medium uppercase tracking-wider text-[var(--color-mushu-faint)]">
        {tPalette('title')}
      </h2>
      {CATEGORY_ORDER.map((cat) => {
        const items = grouped[cat] ?? [];
        if (items.length === 0) return null;
        return (
          <div key={cat}>
            <p className="mb-1.5 text-[11px] font-medium uppercase text-[var(--color-mushu-faint)]">
              {tPalette(CATEGORY_LABEL_KEY[cat])}
            </p>
            <div className="flex flex-col gap-1">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.type}
                    draggable
                    onDragStart={(e) => onDragStart(e, item.type)}
                    className="flex cursor-grab items-center gap-2 rounded-md border border-transparent bg-[var(--color-mushu-surface)] px-2.5 py-2 text-xs text-[var(--color-mushu-ink)] transition-colors hover:border-[var(--color-mushu-border)] active:cursor-grabbing"
                  >
                    <Icon className="h-3.5 w-3.5 text-[var(--color-mushu-mute)]" />
                    <span>{tNodes(`${item.type}.title`)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <p className="mt-auto text-[11px] leading-relaxed text-[var(--color-mushu-faint)]">
        {tPalette('hint')}
      </p>
    </aside>
  );
}
