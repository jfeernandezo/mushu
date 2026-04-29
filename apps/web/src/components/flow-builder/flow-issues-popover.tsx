'use client';

import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { FlowValidationIssue } from '@/lib/validate-flow';

interface FlowIssuesPopoverProps {
  issues: FlowValidationIssue[];
  /** Called when the user clicks an issue tied to a specific node — caller
   *  selects the node so the inspector opens to it. Graph-level issues
   *  (nodeId: null) don't trigger this. */
  onJumpToNode: (nodeId: string) => void;
}

/**
 * Header indicator that shows how many publish-blocking issues the current
 * draft has. Renders as:
 *   - green badge "Pronto pra publicar" when there are 0 issues
 *   - amber pill "N problemas" when >=1, opens a dropdown listing each
 *     issue with a "Jump to node" CTA that selects the offending node.
 *
 * The dropdown uses our existing DropdownMenu primitive (Radix) — no new
 * deps. Sets the bar before the user hits Publish: instead of toast +
 * cancel, the operator can spot what's wrong before clicking.
 */
export function FlowIssuesPopover({ issues, onJumpToNode }: FlowIssuesPopoverProps) {
  const t = useTranslations('flowBuilder.issues');
  const tErrors = useTranslations('flowBuilder.publishErrors');

  if (issues.length === 0) {
    return (
      <Badge
        variant="success"
        className="hidden items-center gap-1 md:inline-flex"
        aria-label={t('readyAriaLabel')}
      >
        <CheckCircle2 className="h-3 w-3" />
        {t('ready')}
      </Badge>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full bg-[var(--color-mushu-amber)]/15 px-2 py-0.5 text-[11px] font-medium text-[var(--color-mushu-amber)] transition-colors hover:bg-[var(--color-mushu-amber)]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-mushu-amber)]"
          aria-label={t('issuesAriaLabel', { count: issues.length })}
        >
          <AlertTriangle className="h-3 w-3" />
          {t('issuesCount', { count: issues.length })}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>{t('listTitle')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {issues.map((issue, i) => (
          <DropdownMenuItem
            // biome-ignore lint/suspicious/noArrayIndexKey: stable list ordered by issue index
            key={i}
            disabled={!issue.nodeId}
            onSelect={() => issue.nodeId && onJumpToNode(issue.nodeId)}
            className="flex items-start gap-2 py-2"
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-mushu-amber)]" />
            <div className="flex flex-1 flex-col gap-0.5">
              <span className="text-xs text-[var(--color-mushu-ink)]">
                {tErrors(issue.kind)}
              </span>
              {issue.nodeId ? (
                <span className="flex items-center gap-1 text-[10px] text-[var(--color-mushu-faint)]">
                  {t('jumpToNode')}
                  <ArrowRight className="h-2.5 w-2.5" />
                </span>
              ) : null}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
