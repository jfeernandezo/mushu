'use client';

import { Handle, Position } from '@xyflow/react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface BaseNodeProps {
  icon: LucideIcon;
  iconColor?: string;
  title: string;
  category: 'trigger' | 'action' | 'logic' | 'control';
  children?: ReactNode;
  selected?: boolean;
  hasInput?: boolean;
  hasOutput?: boolean;
}

const CATEGORY_BORDER: Record<BaseNodeProps['category'], string> = {
  trigger: 'border-[var(--color-mushu-amber)]/40',
  action: 'border-[var(--color-mushu-scarlet)]/40',
  logic: 'border-purple-500/40',
  control: 'border-[var(--color-mushu-faint)]/40',
};

export function BaseNode({
  icon: Icon,
  iconColor,
  title,
  category,
  children,
  selected,
  hasInput = true,
  hasOutput = true,
}: BaseNodeProps) {
  return (
    <div
      className={cn(
        'min-w-[200px] rounded-lg border bg-[var(--color-mushu-surface)] text-[var(--color-mushu-ink)] shadow-sm transition-all',
        CATEGORY_BORDER[category],
        selected && 'ring-2 ring-[var(--color-mushu-amber)] ring-offset-2 ring-offset-[var(--color-mushu-bg)]',
      )}
    >
      <div className="flex items-center gap-2 border-b border-[var(--color-mushu-border)] px-3 py-2">
        <Icon className="h-3.5 w-3.5" style={iconColor ? { color: iconColor } : undefined} />
        <span className="text-xs font-medium">{title}</span>
      </div>
      {children ? (
        <div className="px-3 py-2 text-xs text-[var(--color-mushu-mute)]">{children}</div>
      ) : null}

      {hasInput ? (
        <Handle
          type="target"
          position={Position.Top}
          className="!h-2 !w-2 !border-[var(--color-mushu-border)] !bg-[var(--color-mushu-bg)]"
        />
      ) : null}
      {hasOutput ? (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!h-2 !w-2 !border-[var(--color-mushu-border)] !bg-[var(--color-mushu-bg)]"
        />
      ) : null}
    </div>
  );
}
