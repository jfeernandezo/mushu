import { randomUUID } from 'node:crypto';
import {
  dbAdmin as db,
  instagramAccount,
  member,
  notification,
  user as userTable,
} from '@mushu/db';
import { decryptToken, encryptToken } from '@mushu/shared/crypto';
import { createLogger } from '@mushu/shared/logger';
import { and, eq, gt, inArray, lt, sql } from 'drizzle-orm';
import { sendEmail } from '../lib/email.ts';

const logger = createLogger('worker.refresh-tokens');

/**
 * Renews Meta access tokens that are within the refresh window. IG/Threads
 * long-lived tokens last 60 days; calling refresh inside that window mints a
 * fresh 60-day token. Outside the window (already expired) we mark the row
 * for user attention — the user must reconnect via OAuth.
 *
 * Refresh window: tokens with `expires_at` between (now, now + 7 days].
 * We don't refresh further out than that — gives Meta room to invalidate
 * tokens early if scope changes, without us hammering with refreshes for
 * accounts that don't need it.
 *
 * Endpoints:
 *   IG     : GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=...
 *   Threads: GET https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=...
 *
 * Both return { access_token, token_type, expires_in } shaped identically
 * to the original long-lived token exchange.
 */

const REFRESH_WINDOW_DAYS = 7;

interface RefreshResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export async function refreshMetaTokens(): Promise<void> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + REFRESH_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const candidates = await db
    .select({
      id: instagramAccount.id,
      organizationId: instagramAccount.organizationId,
      channel: instagramAccount.channel,
      igUserId: instagramAccount.igUserId,
      igUsername: instagramAccount.igUsername,
      ciphertext: instagramAccount.accessTokenEncrypted,
      iv: instagramAccount.accessTokenIv,
      authTag: instagramAccount.accessTokenAuthTag,
      expiresAt: instagramAccount.expiresAt,
    })
    .from(instagramAccount)
    .where(
      and(
        gt(instagramAccount.expiresAt, now),
        lt(instagramAccount.expiresAt, windowEnd),
      ),
    );

  logger.info({ count: candidates.length }, 'refreshing tokens');

  let refreshed = 0;
  let failed = 0;

  for (const acc of candidates) {
    let token: string;
    try {
      token = decryptToken({
        ciphertext: acc.ciphertext,
        iv: acc.iv,
        authTag: acc.authTag,
      });
    } catch (err) {
      logger.error({ account_id: acc.id, err }, 'cannot decrypt token — skipping');
      failed += 1;
      continue;
    }

    const result = await callRefresh(acc.channel, token);
    if (!result) {
      // The most common reason refresh fails is that the user already
      // revoked permissions on Meta's side. Mark webhook as not subscribed
      // (we don't have a valid token anymore) and notify the org so they
      // can reconnect before the token's natural expiration.
      await db
        .update(instagramAccount)
        .set({
          webhookSubscribed: false,
          updatedAt: new Date(),
        })
        .where(sql`${instagramAccount.id} = ${acc.id}`);

      await notifyExpiringAccount({
        organizationId: acc.organizationId,
        channel: (acc.channel as 'instagram' | 'threads') ?? 'instagram',
        username: acc.igUsername,
        expiresAt: acc.expiresAt ?? windowEnd,
      });

      failed += 1;
      continue;
    }

    const encrypted = encryptToken(result.access_token);
    await db
      .update(instagramAccount)
      .set({
        accessTokenEncrypted: encrypted.ciphertext,
        accessTokenIv: encrypted.iv,
        accessTokenAuthTag: encrypted.authTag,
        expiresAt: new Date(Date.now() + result.expires_in * 1000),
        updatedAt: new Date(),
      })
      .where(sql`${instagramAccount.id} = ${acc.id}`);
    refreshed += 1;
  }

  logger.info({ refreshed, failed, scanned: candidates.length }, 'refresh complete');
}

/**
 * Drop a `notification` row for every member of the org and send an email to
 * the owner so the reconnect step is impossible to miss. Idempotent within
 * the same hour: we de-duplicate by checking for an existing unread
 * `token_expiring` notification for the same org.
 */
async function notifyExpiringAccount(args: {
  organizationId: string;
  channel: 'instagram' | 'threads';
  username: string;
  expiresAt: Date;
}): Promise<void> {
  const channelLabel = args.channel === 'threads' ? 'Threads' : 'Instagram';

  // De-dupe: if we already raised this in the last 24h for the same org +
  // channel, skip. Avoids spamming the bell every cron tick.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [existing] = await db
    .select({ id: notification.id })
    .from(notification)
    .where(
      and(
        eq(notification.organizationId, args.organizationId),
        eq(notification.type, 'token_expiring'),
        sql`${notification.title} LIKE ${`%@${args.username}%`}`,
        gt(notification.createdAt, since),
      ),
    )
    .limit(1);
  if (existing) return;

  // Find every active member of the org so each gets a bell notification.
  const members = await db
    .select({
      userId: member.userId,
      role: member.role,
    })
    .from(member)
    .where(eq(member.organizationId, args.organizationId));

  const reconnectPath =
    args.channel === 'threads' ? '/api/oauth/threads/start' : '/api/oauth/instagram/start';
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const reconnectUrl = `${baseUrl}${reconnectPath}`;

  const title = `Reconecte sua conta do ${channelLabel} (@${args.username})`;
  const body = `O token de acesso vai expirar em breve e a renovação automática falhou. Clique para reconectar.`;

  for (const m of members) {
    await db.insert(notification).values({
      id: randomUUID(),
      organizationId: args.organizationId,
      userId: m.userId,
      type: 'token_expiring',
      title,
      body,
      link: reconnectPath,
    });
  }

  // Email goes to the owner (or first admin if no owner found). Same heuristic
  // we use elsewhere — the org always has at least one owner unless schema
  // invariants got violated, in which case we just no-op the email.
  const owners = members.filter((m) => m.role === 'owner');
  const recipients = owners.length > 0 ? owners : members.filter((m) => m.role === 'admin');
  if (recipients.length === 0) return;

  const userIds = recipients.map((r) => r.userId);
  const emails = await db
    .select({ email: userTable.email })
    .from(userTable)
    .where(inArray(userTable.id, userIds));

  const formattedDate = args.expiresAt.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const html = `<!doctype html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px 16px;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#111;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px;">
    <h1 style="font-size:20px;font-weight:600;margin:0 0 16px;color:#111;">Sua conta do ${channelLabel} precisa ser reconectada ⚠️</h1>
    <p style="font-size:14px;line-height:1.6;margin:0 0 16px;color:#444;">
      O token de acesso da conta <strong>@${args.username}</strong> vai expirar em <strong>${formattedDate}</strong> e a renovação automática não foi possível — geralmente isso acontece quando a permissão foi revogada na Central de Contas da Meta.
    </p>
    <p style="font-size:14px;line-height:1.6;margin:0 0 16px;color:#444;">
      Pra continuar respondendo comentários e DMs automaticamente, reconecte a conta:
    </p>
    <p style="margin:24px 0;">
      <a href="${reconnectUrl}" style="display:inline-block;background:#c73e1d;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;font-size:14px;">Reconectar ${channelLabel}</a>
    </p>
    <p style="font-size:14px;line-height:1.6;margin:0 0 16px;color:#444;">
      Se nada for feito até a data acima, os flows automáticos vinculados a essa conta param de funcionar. Histórico de conversas e configurações dos flows ficam preservados — basta reconectar pra retomar.
    </p>
  </div>
</body></html>`;

  for (const r of emails) {
    if (!r.email) continue;
    await sendEmail({
      to: r.email,
      subject: `Reconecte sua conta do ${channelLabel} (@${args.username}) — token expirando`,
      html,
    });
  }
}

async function callRefresh(
  channel: 'instagram' | 'threads' | string,
  token: string,
): Promise<RefreshResponse | null> {
  const base =
    channel === 'threads' ? 'https://graph.threads.net' : 'https://graph.instagram.com';
  const grantType = channel === 'threads' ? 'th_refresh_token' : 'ig_refresh_token';

  const url = new URL(`${base}/refresh_access_token`);
  url.searchParams.set('grant_type', grantType);
  url.searchParams.set('access_token', token);

  try {
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.error({ http_status: res.status, body, channel }, 'refresh call failed');
      return null;
    }
    return (await res.json()) as RefreshResponse;
  } catch (err) {
    logger.error({ err, channel }, 'refresh call threw');
    return null;
  }
}
