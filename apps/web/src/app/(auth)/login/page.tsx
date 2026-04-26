import Image from 'next/image';
import Link from 'next/link';
import { LoginForm } from '@/components/auth/login-form';
import { LegalLinks } from '@/components/legal-links';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="text-center">
          <Image
            src="/mushu-logo.png"
            alt="Mushu"
            width={56}
            height={56}
            priority
            className="mx-auto mb-2 rounded-xl"
          />
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
        <LegalLinks className="mt-2" />
      </div>
    </main>
  );
}
