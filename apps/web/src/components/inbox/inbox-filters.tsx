'use client';

import { useTranslations } from 'next-intl';

export interface InboxFiltersValue {
  status: 'open' | 'pending' | 'resolved' | 'snoozed' | 'all';
  igAccountId: string | null;
  assignee: 'me' | 'unassigned' | 'any';
}

interface InboxFiltersProps {
  value: InboxFiltersValue;
  onChange: (next: InboxFiltersValue) => void;
  igAccounts: Array<{ id: string; username: string }>;
}

export function InboxFilters({ value, onChange, igAccounts }: InboxFiltersProps) {
  const t = useTranslations('inbox.filters');
  return (
    <div className="flex flex-col gap-2 border-b border-[var(--color-mushu-border)] p-3">
      <div className="grid grid-cols-2 gap-2">
        <SelectField
          label={t('status')}
          value={value.status}
          onChange={(status) =>
            onChange({ ...value, status: status as InboxFiltersValue['status'] })
          }
          options={[
            { value: 'all', label: t('statuses.all') },
            { value: 'open', label: t('statuses.open') },
            { value: 'pending', label: t('statuses.pending') },
            { value: 'snoozed', label: t('statuses.snoozed') },
            { value: 'resolved', label: t('statuses.resolved') },
          ]}
        />
        <SelectField
          label={t('assignee')}
          value={value.assignee}
          onChange={(assignee) =>
            onChange({ ...value, assignee: assignee as InboxFiltersValue['assignee'] })
          }
          options={[
            { value: 'any', label: t('assignees.any') },
            { value: 'me', label: t('assignees.me') },
            { value: 'unassigned', label: t('assignees.unassigned') },
          ]}
        />
      </div>
      {igAccounts.length > 0 ? (
        <SelectField
          label={t('igAccount')}
          value={value.igAccountId ?? ''}
          onChange={(id) => onChange({ ...value, igAccountId: id || null })}
          options={[
            { value: '', label: t('allAccounts') },
            ...igAccounts.map((a) => ({ value: a.id, label: `@${a.username}` })),
          ]}
        />
      ) : null}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-mushu-faint)]">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-md border border-[var(--color-mushu-border)] bg-[var(--color-mushu-surface)] px-2 text-xs text-[var(--color-mushu-ink)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-mushu-amber)]"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
