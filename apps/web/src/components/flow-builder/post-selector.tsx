'use client';

import { Check, ChevronDown, ImageIcon, Loader2 } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { listInstagramMedia, type IgMediaItem } from '@/actions/instagram-media';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface PostSelectorProps {
  value: string | null;
  onChange: (postId: string | null) => void;
}

interface State {
  status: 'idle' | 'loading' | 'ready' | 'error' | 'no-account';
  account: { id: string; username: string } | null;
  media: IgMediaItem[];
}

export function PostSelector({ value, onChange }: PostSelectorProps) {
  const t = useTranslations('flowBuilder.postSelector');
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({
    status: 'idle',
    account: null,
    media: [],
  });

  useEffect(() => {
    if (!open || state.status !== 'idle') return;
    setState((s) => ({ ...s, status: 'loading' }));
    listInstagramMedia(25)
      .then((r) => {
        if (r.error === 'no_account') {
          setState({ status: 'no-account', account: null, media: [] });
        } else if (r.error === 'fetch_failed') {
          setState({ status: 'error', account: r.account, media: [] });
        } else {
          setState({ status: 'ready', account: r.account, media: r.media });
        }
      })
      .catch(() => {
        setState((s) => ({ ...s, status: 'error' }));
      });
  }, [open, state.status]);

  const selected = state.media.find((m) => m.id === value) ?? null;
  const isAny = value === null;

  return (
    <div className="flex flex-col gap-2">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <button
            type="button"
            className="flex items-center justify-between gap-2 rounded-md border border-[var(--color-mushu-border)] bg-[var(--color-mushu-surface)] px-3 py-2 text-left text-sm text-[var(--color-mushu-ink)] transition-colors hover:border-[var(--color-mushu-amber)]"
          >
            <span className="truncate">
              {isAny
                ? t('anyPost')
                : selected
                  ? truncate(selected.caption, 60) || t('untitledPost')
                  : value
                    ? t('pinnedToId', { id: value.slice(0, 12) })
                    : t('placeholder')}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-[var(--color-mushu-mute)]" />
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('dialogTitle')}</DialogTitle>
            <DialogDescription>
              {state.account
                ? t('dialogDescription', { username: state.account.username })
                : t('dialogDescriptionNoAccount')}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-2">
            <AnyPostOption
              selected={isAny}
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            />

            <div className="my-2 h-px bg-[var(--color-mushu-border)]" />

            {state.status === 'loading' || state.status === 'idle' ? (
              <Loading />
            ) : state.status === 'no-account' ? (
              <NoAccount />
            ) : state.status === 'error' ? (
              <ErrorState />
            ) : state.media.length === 0 ? (
              <p className="py-4 text-center text-xs text-[var(--color-mushu-faint)]">
                {t('noMedia')}
              </p>
            ) : (
              <div className="grid max-h-[420px] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {state.media.map((m) => (
                  <MediaCard
                    key={m.id}
                    media={m}
                    selected={m.id === value}
                    onClick={() => {
                      onChange(m.id);
                      setOpen(false);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <p className="text-[11px] text-[var(--color-mushu-faint)]">
        {isAny ? t('anyPostHint') : t('specificPostHint')}
      </p>
    </div>
  );
}

function AnyPostOption({ selected, onClick }: { selected: boolean; onClick: () => void }) {
  const t = useTranslations('flowBuilder.postSelector');
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center justify-between rounded-md border px-3 py-2.5 text-left text-sm transition-colors',
        selected
          ? 'border-[var(--color-mushu-scarlet)] bg-[var(--color-mushu-surface)]'
          : 'border-[var(--color-mushu-border)] bg-transparent hover:border-[var(--color-mushu-amber)]',
      )}
    >
      <div className="flex flex-col gap-0.5">
        <span className="font-medium text-[var(--color-mushu-ink)]">{t('anyPost')}</span>
        <span className="text-xs text-[var(--color-mushu-mute)]">{t('anyPostDescription')}</span>
      </div>
      {selected ? <Check className="h-4 w-4 text-[var(--color-mushu-scarlet)]" /> : null}
    </button>
  );
}

function MediaCard({
  media,
  selected,
  onClick,
}: {
  media: IgMediaItem;
  selected: boolean;
  onClick: () => void;
}) {
  const formatter = useFormatter();
  const thumb = media.thumbnailUrl ?? media.mediaUrl;
  const caption = truncate(media.caption, 80) || '—';
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex gap-3 rounded-md border p-2 text-left transition-colors',
        selected
          ? 'border-[var(--color-mushu-scarlet)] bg-[var(--color-mushu-surface)]'
          : 'border-[var(--color-mushu-border)] hover:border-[var(--color-mushu-amber)]',
      )}
    >
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded bg-[var(--color-mushu-surface)]">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="h-full w-full object-cover" />
        ) : (
          <ImageIcon className="h-5 w-5 text-[var(--color-mushu-faint)]" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="line-clamp-2 text-xs text-[var(--color-mushu-ink)]">{caption}</p>
        {media.timestamp ? (
          <p className="text-[10px] text-[var(--color-mushu-faint)]">
            {formatter.dateTime(new Date(media.timestamp), { dateStyle: 'short' })}
          </p>
        ) : null}
      </div>
      {selected ? (
        <Check className="h-4 w-4 shrink-0 text-[var(--color-mushu-scarlet)]" />
      ) : null}
    </button>
  );
}

function Loading() {
  const t = useTranslations('flowBuilder.postSelector');
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-xs text-[var(--color-mushu-mute)]">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>{t('loading')}</span>
    </div>
  );
}

function NoAccount() {
  const t = useTranslations('flowBuilder.postSelector');
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <p className="text-sm text-[var(--color-mushu-ink)]">{t('noAccountTitle')}</p>
      <p className="text-xs text-[var(--color-mushu-mute)]">{t('noAccountBody')}</p>
      <Link
        href="/settings/workspace"
        className="text-xs font-medium text-[var(--color-mushu-amber)] hover:underline"
      >
        {t('connectAccount')}
      </Link>
    </div>
  );
}

function ErrorState() {
  const t = useTranslations('flowBuilder.postSelector');
  return (
    <p className="py-4 text-center text-xs text-[var(--color-mushu-danger)]">{t('error')}</p>
  );
}

function truncate(s: string | null | undefined, n: number): string {
  if (!s) return '';
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
