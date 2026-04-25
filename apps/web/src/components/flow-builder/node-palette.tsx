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
import type { DragEvent } from 'react';
import type { FlowNodeType } from '@mushu/shared/flow';

interface PaletteItem {
  type: FlowNodeType;
  label: string;
  icon: LucideIcon;
  category: 'Triggers' | 'Actions' | 'Logic' | 'Control';
}

const ITEMS: PaletteItem[] = [
  { type: 'trigger.comment_keyword', label: 'Comment trigger', icon: MessageCircle, category: 'Triggers' },
  { type: 'trigger.dm_keyword', label: 'DM keyword trigger', icon: MessageSquare, category: 'Triggers' },
  { type: 'action.send_dm', label: 'Send DM', icon: Send, category: 'Actions' },
  { type: 'action.reply_comment', label: 'Reply comment', icon: MessageCircle, category: 'Actions' },
  { type: 'logic.delay', label: 'Delay', icon: Clock, category: 'Logic' },
  { type: 'logic.condition', label: 'Condition', icon: GitBranch, category: 'Logic' },
  { type: 'control.end', label: 'End', icon: Square, category: 'Control' },
];

export function NodePalette() {
  function onDragStart(e: DragEvent<HTMLDivElement>, type: FlowNodeType) {
    e.dataTransfer.setData('application/mushu-node-type', type);
    e.dataTransfer.effectAllowed = 'move';
  }

  const grouped = ITEMS.reduce<Record<string, PaletteItem[]>>((acc, item) => {
    (acc[item.category] ??= []).push(item);
    return acc;
  }, {});

  return (
    <aside className="flex h-full w-56 flex-col gap-4 overflow-y-auto border-r border-[var(--color-mushu-border)] bg-[var(--color-mushu-bg)] p-4">
      <h2 className="text-xs font-medium uppercase tracking-wider text-[var(--color-mushu-faint)]">
        Blocks
      </h2>
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat}>
          <p className="mb-1.5 text-[11px] font-medium uppercase text-[var(--color-mushu-faint)]">
            {cat}
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
                  <span>{item.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <p className="mt-auto text-[11px] leading-relaxed text-[var(--color-mushu-faint)]">
        Drag a block onto the canvas to add it. Connect blocks by dragging from the bottom dot to the next block's top dot.
      </p>
    </aside>
  );
}
