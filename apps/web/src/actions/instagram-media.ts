'use server';

import { instagramAccount, withOrgTx } from '@mushu/db';
import { createLogger } from '@mushu/shared/logger';
import { and, eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { decryptToken } from '@/lib/crypto';

const logger = createLogger('web.instagram-media');

export interface IgMediaItem {
  id: string;
  caption: string | null;
  mediaType: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  timestamp: string | null;
}

export interface ListMediaResult {
  account: { id: string; username: string } | null;
  media: IgMediaItem[];
  error?: 'no_account' | 'fetch_failed';
}

interface IgApiMedia {
  id: string;
  caption?: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
}

/**
 * Lists recent Instagram media for the active organization's connected
 * account. Used by the post selector in the flow builder so users can pick
 * which post a comment-keyword trigger watches.
 *
 * Returns gracefully — never throws. The UI shows a friendly empty state if
 * the user has no IG account connected, or an error toast if Graph API fails.
 */
export async function listInstagramMedia(limit = 25): Promise<ListMediaResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');
  const orgId = session.session.activeOrganizationId;
  if (!orgId) return { account: null, media: [], error: 'no_account' };

  // The post selector currently fetches IG media only — Threads doesn't have
  // a comparable list-media surface in our flow builder yet, and Threads
  // accounts can still create flows with no specific post filter.
  const [acc] = await withOrgTx(orgId, (tx) =>
    tx
      .select({
        id: instagramAccount.id,
        username: instagramAccount.igUsername,
        ciphertext: instagramAccount.accessTokenEncrypted,
        iv: instagramAccount.accessTokenIv,
        authTag: instagramAccount.accessTokenAuthTag,
      })
      .from(instagramAccount)
      .where(
        and(
          eq(instagramAccount.organizationId, orgId),
          eq(instagramAccount.channel, 'instagram'),
        ),
      )
      .limit(1),
  );

  if (!acc) return { account: null, media: [], error: 'no_account' };

  let token: string;
  try {
    token = decryptToken({
      ciphertext: acc.ciphertext,
      iv: acc.iv,
      authTag: acc.authTag,
    });
  } catch {
    return {
      account: { id: acc.id, username: acc.username },
      media: [],
      error: 'fetch_failed',
    };
  }

  const url = new URL('https://graph.instagram.com/me/media');
  url.searchParams.set(
    'fields',
    'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp',
  );
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('access_token', token);

  let json: { data?: IgApiMedia[] };
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      logger.error(
        { account_id: acc.id, http_status: res.status, body: await res.text() },
        'graph api failed',
      );
      return {
        account: { id: acc.id, username: acc.username },
        media: [],
        error: 'fetch_failed',
      };
    }
    json = (await res.json()) as { data?: IgApiMedia[] };
  } catch (err) {
    logger.error({ account_id: acc.id, err }, 'fetch threw');
    return {
      account: { id: acc.id, username: acc.username },
      media: [],
      error: 'fetch_failed',
    };
  }

  const media: IgMediaItem[] = (json.data ?? []).map((m) => ({
    id: m.id,
    caption: m.caption ?? null,
    mediaType: m.media_type ?? null,
    mediaUrl: m.media_url ?? null,
    thumbnailUrl: m.thumbnail_url ?? null,
    permalink: m.permalink ?? null,
    timestamp: m.timestamp ?? null,
  }));

  return {
    account: { id: acc.id, username: acc.username },
    media,
  };
}
