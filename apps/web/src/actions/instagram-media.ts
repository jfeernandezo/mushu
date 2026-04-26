'use server';

import { db, instagramAccount } from '@mushu/db';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { decryptToken } from '@/lib/crypto';

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

  const [acc] = await db
    .select({
      id: instagramAccount.id,
      username: instagramAccount.igUsername,
      ciphertext: instagramAccount.accessTokenEncrypted,
      iv: instagramAccount.accessTokenIv,
      authTag: instagramAccount.accessTokenAuthTag,
    })
    .from(instagramAccount)
    .where(eq(instagramAccount.organizationId, orgId))
    .limit(1);

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
      console.error('[ig-media] graph api failed', await res.text());
      return {
        account: { id: acc.id, username: acc.username },
        media: [],
        error: 'fetch_failed',
      };
    }
    json = (await res.json()) as { data?: IgApiMedia[] };
  } catch (e) {
    console.error('[ig-media] fetch threw', e);
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
