'use client';

import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { changePassword } from '@/actions/user';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function ChangePasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [revokeOthers, setRevokeOthers] = useState(true);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      toast.error("New passwords don't match");
      return;
    }
    setLoading(true);
    const r = await changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: revokeOthers,
    });
    setLoading(false);
    if (r.ok) {
      toast.success(
        revokeOthers
          ? 'Password changed. Other sessions were signed out.'
          : 'Password changed.',
      );
      setCurrent('');
      setNext('');
      setConfirm('');
    } else {
      toast.error(`Could not change password: ${humanize(r.error)}`);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field label="Current password">
        <Input
          type="password"
          autoComplete="current-password"
          required
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </Field>
      <Field label="New password" hint="At least 8 characters.">
        <Input
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
      </Field>
      <Field label="Confirm new password">
        <Input
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm text-[var(--color-mushu-mute)]">
        <input
          type="checkbox"
          checked={revokeOthers}
          onChange={(e) => setRevokeOthers(e.target.checked)}
        />
        Sign me out of other sessions
      </label>
      <div className="flex justify-end">
        <Button type="submit" disabled={loading} className="w-fit">
          {loading ? 'Updating…' : 'Update password'}
        </Button>
      </div>
    </form>
  );
}

function humanize(error: string): string {
  if (error.toLowerCase().includes('password')) return 'check your current password';
  if (error === 'invalid_input') return 'invalid input';
  return error;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-[var(--color-mushu-mute)]">{label}</span>
      {children}
      {hint ? (
        <span className="text-xs text-[var(--color-mushu-faint)]">{hint}</span>
      ) : null}
    </label>
  );
}
