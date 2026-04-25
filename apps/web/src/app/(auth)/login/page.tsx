import Link from 'next/link';
import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="text-center">
          <div className="mb-2 text-4xl">🐲</div>
          <h1 className="text-xl font-semibold">Welcome back to Mushu</h1>
          <p className="text-sm text-[var(--color-mushu-mute)]">
            Sign in to manage your Instagram automations.
          </p>
        </div>
        <LoginForm />
        <p className="text-center text-xs text-[var(--color-mushu-faint)]">
          New here?{' '}
          <Link href="/signup" className="text-[var(--color-mushu-amber)] hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
