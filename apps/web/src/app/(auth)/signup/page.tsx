import Link from 'next/link';
import { SignupForm } from '@/components/auth/signup-form';

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="text-center">
          <div className="mb-2 text-4xl">🐲</div>
          <h1 className="text-xl font-semibold">Create your Mushu account</h1>
          <p className="text-sm text-[var(--color-mushu-mute)]">
            Free forever — start automating Instagram in minutes.
          </p>
        </div>
        <SignupForm />
        <p className="text-center text-xs text-[var(--color-mushu-faint)]">
          Already have one?{' '}
          <Link href="/login" className="text-[var(--color-mushu-amber)] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
