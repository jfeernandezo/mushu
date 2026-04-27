'use client';

import type { Node } from '@xyflow/react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type KeyboardEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KeywordChipsInput } from './keyword-chips-input';
import { PostSelector } from './post-selector';

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
    case 'trigger.first_dm':
    case 'trigger.story_reply':
    case 'trigger.story_mention':
    case 'action.send_dm':
    case 'action.reply_comment':
    case 'action.ask_question':
    case 'action.set_tag':
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
    const postId = typeof data.instagramPostId === 'string' ? data.instagramPostId : null;
    return (
      <>
        <Field label={tFields('instagramPostId')}>
          <PostSelector
            value={postId}
            onChange={(id) => update('instagramPostId', id)}
          />
        </Field>
        <Field label={tFields('keywordsCommaSeparated')}>
          <KeywordChipsInput
            value={Array.isArray(data.keywords) ? (data.keywords as string[]) : []}
            onChange={(next) => update('keywords', next)}
          />
        </Field>
      </>
    );
  }

  if (type === 'trigger.dm_keyword') {
    return (
      <Field label={tFields('keywordsCommaSeparated')}>
        <KeywordChipsInput
          value={Array.isArray(data.keywords) ? (data.keywords as string[]) : []}
          onChange={(next) => update('keywords', next)}
        />
      </Field>
    );
  }

  if (type === 'trigger.first_dm') {
    // No editable fields — the trigger fires on first DM regardless of content.
    return (
      <p className="text-xs leading-relaxed text-[var(--color-mushu-mute)]">
        {tInspector('firstDmDescription')}
      </p>
    );
  }

  if (type === 'trigger.story_reply') {
    return (
      <p className="text-xs leading-relaxed text-[var(--color-mushu-mute)]">
        {tInspector('storyReplyDescription')}
      </p>
    );
  }

  if (type === 'trigger.story_mention') {
    return (
      <p className="text-xs leading-relaxed text-[var(--color-mushu-mute)]">
        {tInspector('storyMentionDescription')}
      </p>
    );
  }

  if (type === 'action.send_dm' || type === 'action.reply_comment') {
    const isDm = type === 'action.send_dm';
    const quickReplies = Array.isArray(data.quickReplies) ? (data.quickReplies as string[]) : [];
    return (
      <>
        <Field label={tFields('messageText')}>
          <textarea
            value={(data.text as string) ?? ''}
            onChange={(e) => update('text', e.target.value)}
            rows={5}
            className="w-full rounded-md border border-[var(--color-mushu-border)] bg-[var(--color-mushu-surface)] px-3 py-2 text-sm text-[var(--color-mushu-ink)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-mushu-amber)]"
            placeholder={tPh('messageText')}
          />
        </Field>
        {isDm ? (
          <Field label={tFields('quickReplies')}>
            <QuickRepliesEditor
              value={quickReplies}
              onChange={(next) => update('quickReplies', next)}
            />
            <p className="text-[10px] text-[var(--color-mushu-faint)]">
              {tInspector('quickRepliesHint')}
            </p>
          </Field>
        ) : null}
      </>
    );
  }

  if (type === 'action.ask_question') {
    const questionText = (data.questionText as string) ?? '';
    const variableName = (data.variableName as string) ?? '';
    const inputType = (data.inputType as 'text' | 'email' | 'number' | 'phone') ?? 'text';
    const fallbackText = (data.fallbackText as string) ?? '';
    const maxAttempts = (data.maxAttempts as number) ?? 3;
    return (
      <>
        <Field label={tFields('questionText')}>
          <textarea
            value={questionText}
            onChange={(e) => update('questionText', e.target.value)}
            rows={3}
            className="w-full rounded-md border border-[var(--color-mushu-border)] bg-[var(--color-mushu-surface)] px-3 py-2 text-sm text-[var(--color-mushu-ink)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-mushu-amber)]"
            placeholder={tPh('questionText')}
          />
        </Field>
        <Field label={tFields('variableName')}>
          <Input
            value={variableName}
            onChange={(e) =>
              update(
                'variableName',
                e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 40),
              )
            }
            placeholder="email"
          />
          <p className="text-[10px] text-[var(--color-mushu-faint)]">
            {tInspector('variableHint', { example: `{{${variableName || 'email'}}}` })}
          </p>
        </Field>
        <Field label={tFields('inputType')}>
          <select
            value={inputType}
            onChange={(e) => update('inputType', e.target.value)}
            className="w-full rounded-md border border-[var(--color-mushu-border)] bg-[var(--color-mushu-surface)] px-3 py-2 text-sm text-[var(--color-mushu-ink)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-mushu-amber)]"
          >
            <option value="text">{tInspector('inputTypes.text')}</option>
            <option value="email">{tInspector('inputTypes.email')}</option>
            <option value="number">{tInspector('inputTypes.number')}</option>
            <option value="phone">{tInspector('inputTypes.phone')}</option>
          </select>
        </Field>
        <Field label={tFields('fallbackText')}>
          <Input
            value={fallbackText}
            onChange={(e) => update('fallbackText', e.target.value)}
            placeholder={tPh('fallbackText')}
          />
        </Field>
        <Field label={tFields('maxAttempts')}>
          <Input
            type="number"
            min={1}
            max={5}
            value={String(maxAttempts)}
            onChange={(e) =>
              update('maxAttempts', Math.max(1, Math.min(5, Number.parseInt(e.target.value, 10) || 3)))
            }
          />
        </Field>
      </>
    );
  }

  if (type === 'action.set_tag') {
    const tag = (data.tag as string) ?? '';
    const operation = (data.operation as 'add' | 'remove') ?? 'add';
    return (
      <>
        <Field label={tFields('tag')}>
          <Input
            value={tag}
            onChange={(e) =>
              update(
                'tag',
                e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40).toLowerCase(),
              )
            }
            placeholder={tPh('tag')}
          />
          <p className="text-[10px] text-[var(--color-mushu-faint)]">{tInspector('tagHint')}</p>
        </Field>
        <Field label={tFields('tagOperation')}>
          <select
            value={operation}
            onChange={(e) => update('operation', e.target.value)}
            className="w-full rounded-md border border-[var(--color-mushu-border)] bg-[var(--color-mushu-surface)] px-3 py-2 text-sm text-[var(--color-mushu-ink)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-mushu-amber)]"
          >
            <option value="add">{tInspector('tagOps.add')}</option>
            <option value="remove">{tInspector('tagOps.remove')}</option>
          </select>
        </Field>
      </>
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
    return <ConditionForm data={data} update={update} />;
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

const QUICK_REPLY_MAX_LEN = 20;
const QUICK_REPLY_MAX_COUNT = 13;

/**
 * Chip-style editor for `action.send_dm.quickReplies`. Caps at 13 chips
 * (Meta hard limit) and 20 chars per title (Meta hard limit). Each chip
 * becomes a button under the DM; the click sends back the title as the
 * user's reply text, so downstream `dm_keyword` triggers can match it.
 */
function QuickRepliesEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const t = useTranslations('flowBuilder.quickReplies');
  const [draft, setDraft] = useState('');

  function commit() {
    const trimmed = draft.trim().slice(0, QUICK_REPLY_MAX_LEN);
    if (!trimmed) return;
    if (value.includes(trimmed)) {
      setDraft('');
      return;
    }
    if (value.length >= QUICK_REPLY_MAX_COUNT) return;
    onChange([...value, trimmed]);
    setDraft('');
  }

  function removeAt(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      e.preventDefault();
      removeAt(value.length - 1);
    }
  }

  const isFull = value.length >= QUICK_REPLY_MAX_COUNT;

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="flex flex-wrap items-center gap-1.5 rounded-md border border-[var(--color-mushu-border)] bg-[var(--color-mushu-surface)] px-2 py-1.5 focus-within:border-[var(--color-mushu-amber)]"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            (e.currentTarget.querySelector('input') as HTMLInputElement | null)?.focus();
          }
        }}
      >
        {value.map((label, i) => (
          <span
            key={`${label}-${i}`}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--color-mushu-border)] bg-[var(--color-mushu-bg)] px-2 py-0.5 text-xs text-[var(--color-mushu-ink)]"
          >
            {label}
            <button
              type="button"
              onClick={() => removeAt(i)}
              aria-label={t('remove', { label })}
              className="text-[var(--color-mushu-mute)] hover:text-[var(--color-mushu-ink)]"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {!isFull ? (
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, QUICK_REPLY_MAX_LEN))}
            onKeyDown={onKeyDown}
            onBlur={commit}
            maxLength={QUICK_REPLY_MAX_LEN}
            placeholder={value.length === 0 ? t('placeholder') : t('addAnother')}
            className="min-w-[80px] flex-1 bg-transparent text-xs text-[var(--color-mushu-ink)] outline-none placeholder:text-[var(--color-mushu-faint)]"
          />
        ) : null}
      </div>
      <p className="px-1 text-[10px] text-[var(--color-mushu-faint)]">
        {t('counter', { count: value.length, max: QUICK_REPLY_MAX_COUNT })}
      </p>
    </div>
  );
}

interface ConditionLeaf {
  field: string;
  operator:
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'starts_with'
    | 'has_tag'
    | 'not_has_tag'
    | 'is_set'
    | 'is_empty'
    | 'gt'
    | 'lt';
  value?: string | number | boolean;
}

interface ConditionBranch {
  name: string;
  conditions: ConditionLeaf[];
  logical: 'and' | 'or';
}

const OPERATORS: ConditionLeaf['operator'][] = [
  'equals',
  'not_equals',
  'contains',
  'starts_with',
  'gt',
  'lt',
  'is_set',
  'is_empty',
  'has_tag',
  'not_has_tag',
];

const VALUELESS_OPS: ConditionLeaf['operator'][] = ['is_set', 'is_empty'];

function ConditionForm({
  data,
  update,
}: {
  data: Record<string, unknown>;
  update: (key: string, value: unknown) => void;
}) {
  const t = useTranslations('flowBuilder.condition');
  const branches = (Array.isArray(data.branches) ? data.branches : []) as ConditionBranch[];

  function setBranches(next: ConditionBranch[]) {
    update('branches', next);
  }

  function addBranch() {
    setBranches([
      ...branches,
      { name: t('defaultBranchName', { n: branches.length + 1 }), conditions: [], logical: 'and' },
    ]);
  }

  function removeBranch(i: number) {
    setBranches(branches.filter((_, idx) => idx !== i));
  }

  function updateBranch(i: number, patch: Partial<ConditionBranch>) {
    setBranches(branches.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  }

  if (branches.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs text-[var(--color-mushu-mute)]">{t('emptyHint')}</p>
        <Button size="sm" variant="outline" onClick={addBranch}>
          {t('addBranch')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[10px] text-[var(--color-mushu-faint)]">{t('explainer')}</p>

      {branches.map((branch, i) => (
        <div
          key={i}
          className="flex flex-col gap-2 rounded-md border border-[var(--color-mushu-border)] bg-[var(--color-mushu-surface)] p-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <Input
              value={branch.name}
              onChange={(e) => updateBranch(i, { name: e.target.value })}
              placeholder={t('branchNamePlaceholder')}
              className="h-7 text-xs"
            />
            {branches.length > 1 ? (
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-[var(--color-mushu-danger)]"
                onClick={() => removeBranch(i)}
                aria-label={t('removeBranch')}
              >
                <X className="h-3 w-3" />
              </Button>
            ) : null}
          </div>

          <BranchEditor
            branch={branch}
            onChange={(next) => updateBranch(i, next)}
          />
        </div>
      ))}

      <Button size="sm" variant="outline" onClick={addBranch}>
        {t('addBranch')}
      </Button>

      <p className="text-[10px] text-[var(--color-mushu-faint)]">{t('lastBranchIsDefault')}</p>
    </div>
  );
}

function BranchEditor({
  branch,
  onChange,
}: {
  branch: ConditionBranch;
  onChange: (next: Partial<ConditionBranch>) => void;
}) {
  const t = useTranslations('flowBuilder.condition');

  function updateConditions(next: ConditionLeaf[]) {
    onChange({ conditions: next });
  }

  function addCondition() {
    updateConditions([
      ...branch.conditions,
      { field: '', operator: 'equals', value: '' },
    ]);
  }

  function updateCondition(i: number, patch: Partial<ConditionLeaf>) {
    updateConditions(branch.conditions.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  function removeCondition(i: number) {
    updateConditions(branch.conditions.filter((_, idx) => idx !== i));
  }

  return (
    <div className="flex flex-col gap-2">
      {branch.conditions.length > 1 ? (
        <select
          value={branch.logical}
          onChange={(e) => onChange({ logical: e.target.value as 'and' | 'or' })}
          className="h-7 rounded-md border border-[var(--color-mushu-border)] bg-[var(--color-mushu-bg)] px-2 text-[11px] text-[var(--color-mushu-ink)]"
        >
          <option value="and">{t('logical.and')}</option>
          <option value="or">{t('logical.or')}</option>
        </select>
      ) : null}

      {branch.conditions.map((c, i) => (
        <div
          key={i}
          className="flex flex-wrap items-center gap-1.5 rounded bg-[var(--color-mushu-bg)] p-1.5"
        >
          {c.operator === 'has_tag' || c.operator === 'not_has_tag' ? (
            <Input
              value={typeof c.value === 'string' ? c.value : ''}
              onChange={(e) => updateCondition(i, { value: e.target.value, field: 'tag' })}
              placeholder={t('tagPlaceholder')}
              className="h-7 flex-1 text-xs"
            />
          ) : (
            <Input
              value={c.field}
              onChange={(e) => updateCondition(i, { field: e.target.value })}
              placeholder={t('fieldPlaceholder')}
              className="h-7 w-24 text-xs"
            />
          )}

          <select
            value={c.operator}
            onChange={(e) =>
              updateCondition(i, { operator: e.target.value as ConditionLeaf['operator'] })
            }
            className="h-7 rounded-md border border-[var(--color-mushu-border)] bg-[var(--color-mushu-surface)] px-1 text-[11px] text-[var(--color-mushu-ink)]"
          >
            {OPERATORS.map((op) => (
              <option key={op} value={op}>
                {t(`operators.${op}`)}
              </option>
            ))}
          </select>

          {!VALUELESS_OPS.includes(c.operator) &&
          c.operator !== 'has_tag' &&
          c.operator !== 'not_has_tag' ? (
            <Input
              value={c.value !== undefined ? String(c.value) : ''}
              onChange={(e) => updateCondition(i, { value: e.target.value })}
              placeholder={t('valuePlaceholder')}
              className="h-7 flex-1 text-xs"
            />
          ) : null}

          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-[var(--color-mushu-danger)]"
            onClick={() => removeCondition(i)}
            aria-label={t('removeCondition')}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}

      <Button size="sm" variant="outline" onClick={addCondition} className="self-start">
        {t('addCondition')}
      </Button>
    </div>
  );
}
