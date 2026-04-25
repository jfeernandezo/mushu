import { z } from 'zod';

/**
 * Mushu flow graph schema. The graph is stored as JSONB in flow.draftGraph
 * and flow.publishedGraph. Validated via Zod on every read/write.
 *
 * Pattern: discriminated union by `type` field (Typebot pattern, but simpler
 * since we don't ship hundreds of block types).
 */

const baseNode = z.object({
  id: z.string().min(1),
  position: z.object({ x: z.number(), y: z.number() }),
});

// ---------- Trigger nodes (entry points) ----------

const commentKeywordTriggerNode = baseNode.extend({
  type: z.literal('trigger.comment_keyword'),
  data: z.object({
    instagramPostId: z.string().min(1),
    keywords: z.array(z.string().min(1)).min(1),
    matchMode: z.enum(['exact', 'contains', 'starts_with', 'any']).default('contains'),
    caseSensitive: z.boolean().default(false),
  }),
});

const dmKeywordTriggerNode = baseNode.extend({
  type: z.literal('trigger.dm_keyword'),
  data: z.object({
    keywords: z.array(z.string().min(1)).min(1),
    matchMode: z.enum(['exact', 'contains', 'starts_with', 'any']).default('contains'),
    caseSensitive: z.boolean().default(false),
  }),
});

// ---------- Action nodes ----------

const sendDmNode = baseNode.extend({
  type: z.literal('action.send_dm'),
  data: z.object({
    text: z.string().min(1).max(1000),
    quickReplies: z.array(z.string().max(20)).max(13).optional(),
  }),
});

const replyCommentNode = baseNode.extend({
  type: z.literal('action.reply_comment'),
  data: z.object({
    text: z.string().min(1).max(500),
  }),
});

const setTagNode = baseNode.extend({
  type: z.literal('action.set_tag'),
  data: z.object({
    tag: z.string().min(1).max(60),
    operation: z.enum(['add', 'remove']).default('add'),
  }),
});

const setCustomFieldNode = baseNode.extend({
  type: z.literal('action.set_custom_field'),
  data: z.object({
    field: z.string().min(1).max(60),
    value: z.union([z.string(), z.number(), z.boolean()]),
  }),
});

// ---------- Logic nodes ----------

const delayNode = baseNode.extend({
  type: z.literal('logic.delay'),
  data: z.object({
    durationSeconds: z.number().int().min(1).max(60 * 60 * 24 * 30), // up to 30 days
  }),
});

const conditionNode = baseNode.extend({
  type: z.literal('logic.condition'),
  data: z.object({
    branches: z
      .array(
        z.object({
          name: z.string(),
          conditions: z.array(
            z.object({
              field: z.string(),
              operator: z.enum([
                'equals',
                'not_equals',
                'contains',
                'starts_with',
                'has_tag',
                'not_has_tag',
                'is_set',
                'is_empty',
                'gt',
                'lt',
              ]),
              value: z.union([z.string(), z.number(), z.boolean()]).optional(),
            }),
          ),
          logical: z.enum(['and', 'or']).default('and'),
        }),
      )
      .min(1),
  }),
});

const endNode = baseNode.extend({
  type: z.literal('control.end'),
  data: z.object({
    reason: z.string().optional(),
  }),
});

export const flowNodeSchema = z.discriminatedUnion('type', [
  commentKeywordTriggerNode,
  dmKeywordTriggerNode,
  sendDmNode,
  replyCommentNode,
  setTagNode,
  setCustomFieldNode,
  delayNode,
  conditionNode,
  endNode,
]);

export const flowEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
  label: z.string().optional(),
});

export const flowGraphSchema = z.object({
  nodes: z.array(flowNodeSchema),
  edges: z.array(flowEdgeSchema),
  viewport: z
    .object({ x: z.number(), y: z.number(), zoom: z.number() })
    .optional(),
});

export type FlowNode = z.infer<typeof flowNodeSchema>;
export type FlowEdge = z.infer<typeof flowEdgeSchema>;
export type FlowGraph = z.infer<typeof flowGraphSchema>;
export type FlowNodeType = FlowNode['type'];

export const TRIGGER_NODE_TYPES = [
  'trigger.comment_keyword',
  'trigger.dm_keyword',
] as const satisfies readonly FlowNodeType[];

export function isTriggerNode(node: FlowNode): boolean {
  return (TRIGGER_NODE_TYPES as readonly string[]).includes(node.type);
}
