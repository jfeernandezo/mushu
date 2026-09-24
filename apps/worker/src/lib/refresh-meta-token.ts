import { createLogger } from '@mushu/shared/logger';
import { z } from 'zod';

const logger = createLogger('worker.refresh-meta-token');
const responseSchema = z.object({
  access_token: z.string().trim().min(1),
  expires_in: z
    .number()
    .int()
    .positive()
    .max(365 * 24 * 60 * 60),
});

export type RefreshResult =
  | { status: 'refreshed'; accessToken: string; expiresIn: number }
  | { status: 'invalid' }
  | { status: 'retry' };

export async function refreshMetaToken(channel: string, token: string): Promise<RefreshResult> {
  if (channel !== 'instagram' && channel !== 'threads') return { status: 'retry' };
  const url = new URL(
    channel === 'threads'
      ? 'https://graph.threads.net/refresh_access_token'
      : 'https://graph.instagram.com/refresh_access_token',
  );
  url.searchParams.set(
    'grant_type',
    channel === 'threads' ? 'th_refresh_token' : 'ig_refresh_token',
  );
  url.searchParams.set('access_token', token);
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000), cache: 'no-store' });
    const body: unknown = await response.json();
    if (!response.ok) {
      // Never log the response body or an exception containing the request URL.
      logger.warn({ channel, http_status: response.status }, 'token refresh rejected');
      const error = z.object({ error: z.object({ code: z.literal(190) }) }).safeParse(body);
      return {
        status:
          (response.status === 400 || response.status === 401) && error.success
            ? 'invalid'
            : 'retry',
      };
    }
    const result = responseSchema.safeParse(body);
    if (!result.success) {
      logger.warn({ channel }, 'invalid token refresh response');
      return { status: 'retry' };
    }
    return {
      status: 'refreshed',
      accessToken: result.data.access_token,
      expiresIn: result.data.expires_in,
    };
  } catch {
    logger.warn({ channel }, 'token refresh unavailable');
    return { status: 'retry' };
  }
}
