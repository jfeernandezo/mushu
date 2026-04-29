import { z } from 'zod';

/**
 * Zod schemas for Meta's Threads webhook payloads.
 *
 * Reference: https://developers.facebook.com/docs/threads/webhooks/
 *
 * Subscribed events: `replies`, `mentions`. We don't act on `delete` or
 * `publish` for now — they'd be useful for syncing deletions back into the
 * inbox, but the inbox is read-mostly and a delete sync isn't user-visible.
 *
 * Sample payload (replies):
 * {
 *   object: 'threads',
 *   entry: [{
 *     id: '17841463355176558',                  // Threads user id
 *     time: 1753979120,
 *     changes: [{
 *       value: {
 *         from: { id: '808180894821223', username: 'jfeernandez' },
 *         media: { id: '18069466016328562' },   // root post id
 *         id: '18051686009565870',              // reply id (Threads media id)
 *         text: 'fluxo',
 *         post_owner: { id: '17841463355176558' },
 *       },
 *       field: 'replies'
 *     }]
 *   }]
 * }
 *
 * Mentions have the same shape but with field='mentions'.
 */

const fromSchema = z.object({
  id: z.string(),
  username: z.string().optional(),
});

const mediaSchema = z.object({
  id: z.string(),
});

export const threadsChangeValueSchema = z.object({
  from: fromSchema,
  media: mediaSchema.optional(),
  id: z.string(),
  text: z.string().optional(),
  post_owner: z
    .object({
      id: z.string().optional(),
    })
    .optional(),
  parent_id: z.string().optional(),
});

export const threadsChangeSchema = z.object({
  value: threadsChangeValueSchema,
  field: z.enum(['replies', 'mentions']),
});

export const threadsWebhookEntrySchema = z.object({
  id: z.string(), // Threads user id
  time: z.number().optional(),
  changes: z.array(threadsChangeSchema).optional(),
});

export const threadsWebhookPayloadSchema = z.object({
  object: z.literal('threads'),
  entry: z.array(threadsWebhookEntrySchema),
});

export type ThreadsWebhookPayload = z.infer<typeof threadsWebhookPayloadSchema>;
export type ThreadsWebhookEntry = z.infer<typeof threadsWebhookEntrySchema>;
export type ThreadsChange = z.infer<typeof threadsChangeSchema>;
export type ThreadsChangeValue = z.infer<typeof threadsChangeValueSchema>;
