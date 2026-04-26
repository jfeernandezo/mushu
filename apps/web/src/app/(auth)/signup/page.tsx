import Image from 'next/image';
import Link from 'next/link';
import { SignupForm } from '@/components/auth/signup-form';
import { LegalLinks } from '@/components/legal-links';

export default function SignupPage() {
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
        <LegalLinks className="mt-2" />
      </div>
    </main>
  );
}
