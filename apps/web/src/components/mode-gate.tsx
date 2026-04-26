import type { ReactNode } from 'react';
import { type MushuMode, getMode } from '@/lib/mode';

interface ModeGateProps {
  /** Render `children` only when running in this mode. */
  mode: MushuMode;
  children: ReactNode;
  /** What to render when the mode does NOT match. Defaults to nothing. */
  fallback?: ReactNode;
}

/**
 * Server-component conditional renderer keyed off MUSHU_MODE.
 *
 * Use to hide hosted-only UI (pricing cards, billing nav links, upgrade CTAs)
 * from self-hosted forks without splattering `if (isHosted())` across pages.
 *
 * <ModeGate mode="hosted">
 *   <PricingCards />
 * </ModeGate>
 *
 * For client components that need the same gating, pass the result of
 * `isHosted()` down as a prop from a server component — don't call `getMode()`
 * in the browser (the env var is server-only).
 */
export function ModeGate({ mode, children, fallback = null }: ModeGateProps) {
  return getMode() === mode ? <>{children}</> : <>{fallback}</>;
}
