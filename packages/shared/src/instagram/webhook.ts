import { z } from 'zod';

/**
 * Zod schemas for Meta's Instagram webhook payloads.
 *
 * Reference: https://developers.facebook.com/docs/instagram-platform/webhooks
 *
 * The shape varies by event type. We use a permissive top-level schema and
 * let downstream handlers narrow to the specific event they care about.
 *
 * Sample comment-event payload (matches Júlio's n8n flow):
 * {
 *   object: 'instagram',
 *   entry: [{
 *     id: '17841463355176558',                    // IG account id (page id)
 *     time: 1753979120,
 *     changes: [{
 *       value: {
 *         from: { id: '808180894821223', username: 'jfeernandez' },
 *         media: { id: '18069466016328562', media_product_type: 'REELS' },
 *         id: '18051686009565870',                // comment id
 *         text: 'fluxo'
 *       },
 *       field: 'comments'
 *     }]
 *   }]
 * }
 */

// ---------- Common ----------

const fromSchema = z.object({
  id: z.string(),
  username: z.string().optional(),
});

const mediaSchema = z.object({
  id: z.string(),
  media_product_type: z.string().optional(),
});

// ---------- Comments (changes[].field === 'comments') ----------

export const commentChangeSchema = z.object({
  value: z.object({
    from: fromSchema,
    media: mediaSchema,
    id: z.string(),
    text: z.string().optional(),
    parent_id: z.string().optional(),
  }),
  field: z.literal('comments'),
});

// ---------- DMs (entry[].messaging[]) ----------

export const messagingEventSchema = z.object({
  sender: z.object({ id: z.string() }),
  recipient: z.object({ id: z.string() }),
  timestamp: z.number().optional(),
  message: z
    .object({
      mid: z.string().optional(),
      text: z.string().optional(),
      is_echo: z.boolean().optional(),
      attachments: z
        .array(
          z.object({
            type: z.string(),
            payload: z.record(z.string(), z.unknown()).optional(),
          }),
        )
        .optional(),
    })
    .optional(),
  postback: z
    .object({
      mid: z.string().optional(),
      title: z.string().optional(),
      payload: z.string().optional(),
    })
    .optional(),
  reaction: z
    .object({
      mid: z.string(),
      action: z.enum(['react', 'unreact']),
      reaction: z.string().optional(),
      emoji: z.string().optional(),
    })
    .optional(),
  read: z
    .object({
      mid: z.string().optional(),
    })
    .optional(),
  referral: z
    .object({
      ref: z.string(),
      ad_id: z.string().optional(),
      source: z.string().optional(),
      type: z.string().optional(),
    })
    .optional(),
});

// ---------- Top-level ----------

export const webhookEntrySchema = z.object({
  id: z.string(), // page/account id
  time: z.number().optional(),
  changes: z.array(commentChangeSchema).optional(),
  messaging: z.array(messagingEventSchema).optional(),
});

export const webhookPayloadSchema = z.object({
  object: z.literal('instagram'),
  entry: z.array(webhookEntrySchema),
});

export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
export type WebhookEntry = z.infer<typeof webhookEntrySchema>;
export type CommentChange = z.infer<typeof commentChangeSchema>;
export type MessagingEvent = z.infer<typeof messagingEventSchema>;
