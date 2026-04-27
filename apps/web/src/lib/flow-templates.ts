import type { FlowGraph, FlowNode } from '@mushu/shared/flow';

export interface FlowTemplate {
  id: string;
  nameKey: string;
  descriptionKey: string;
  iconName: 'comment' | 'lead' | 'wave' | 'sparkles' | 'tag' | 'image';
  /**
   * Builds a FlowGraph for this template, generating fresh node/edge UUIDs so
   * multiple flows from the same template don't share IDs.
   *
   * Default texts for trigger keywords and action messages live in the i18n
   * dictionary at flowTemplates.<id>.defaults.* — the user is expected to
   * replace them in the inspector before publishing.
   */
  build: (texts: TemplateTexts) => FlowGraph;
}

export interface TemplateTexts {
  /** Optional for first-DM template (no keyword). */
  triggerKeywords?: string;
  replyMessage?: string;
  dmMessage: string;
  /** Optional tag set on the contact (set_tag node template). */
  tag?: string;
}

const POS_TRIGGER = { x: 80, y: 80 };
const POS_ACTION_1 = { x: 80, y: 240 };
const POS_ACTION_2 = { x: 80, y: 400 };
const POS_END = { x: 80, y: 560 };

function uid(): string {
  return crypto.randomUUID();
}

function splitKeywords(csv: string | undefined): string[] {
  if (!csv) return [];
  return csv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export const FLOW_TEMPLATES: FlowTemplate[] = [
  {
    id: 'comment-to-dm',
    nameKey: 'flowTemplates.commentToDm.name',
    descriptionKey: 'flowTemplates.commentToDm.description',
    iconName: 'comment',
    build: (texts) => {
      const triggerId = uid();
      const replyId = uid();
      const dmId = uid();
      const endId = uid();
      const nodes: FlowNode[] = [
        {
          id: triggerId,
          type: 'trigger.comment_keyword',
          position: POS_TRIGGER,
          data: {
            // null = react to any post by default; user can pin to a specific
            // post via the post selector in the inspector.
            instagramPostId: null,
            keywords: splitKeywords(texts.triggerKeywords),
            matchMode: 'contains',
            caseSensitive: false,
          },
        },
        {
          id: replyId,
          type: 'action.reply_comment',
          position: POS_ACTION_1,
          data: { text: texts.replyMessage ?? '' },
        },
        {
          id: dmId,
          type: 'action.send_dm',
          position: POS_ACTION_2,
          data: { text: texts.dmMessage },
        },
        {
          id: endId,
          type: 'control.end',
          position: POS_END,
          data: {},
        },
      ];
      return {
        nodes,
        edges: [
          { id: uid(), source: triggerId, target: replyId },
          { id: uid(), source: replyId, target: dmId },
          { id: uid(), source: dmId, target: endId },
        ],
      };
    },
  },
  {
    id: 'lead-from-dm',
    nameKey: 'flowTemplates.leadFromDm.name',
    descriptionKey: 'flowTemplates.leadFromDm.description',
    iconName: 'lead',
    build: (texts) => buildDmKeywordTemplate(texts),
  },
  {
    id: 'welcome-dm',
    nameKey: 'flowTemplates.welcomeDm.name',
    descriptionKey: 'flowTemplates.welcomeDm.description',
    iconName: 'wave',
    build: (texts) => buildDmKeywordTemplate(texts),
  },
  {
    id: 'welcome-on-first-dm',
    nameKey: 'flowTemplates.welcomeOnFirstDm.name',
    descriptionKey: 'flowTemplates.welcomeOnFirstDm.description',
    iconName: 'sparkles',
    build: (texts) => {
      const triggerId = uid();
      const tagId = uid();
      const dmId = uid();
      const endId = uid();
      const tag = (texts.tag ?? '').trim() || 'novo-lead';
      const nodes: FlowNode[] = [
        {
          id: triggerId,
          type: 'trigger.first_dm',
          position: POS_TRIGGER,
          data: {},
        },
        {
          id: tagId,
          type: 'action.set_tag',
          position: POS_ACTION_1,
          data: { tag, operation: 'add' },
        },
        {
          id: dmId,
          type: 'action.send_dm',
          position: POS_ACTION_2,
          data: { text: texts.dmMessage },
        },
        {
          id: endId,
          type: 'control.end',
          position: POS_END,
          data: {},
        },
      ];
      return {
        nodes,
        edges: [
          { id: uid(), source: triggerId, target: tagId },
          { id: uid(), source: tagId, target: dmId },
          { id: uid(), source: dmId, target: endId },
        ],
      };
    },
  },
  {
    id: 'comment-first-time',
    nameKey: 'flowTemplates.commentFirstTime.name',
    descriptionKey: 'flowTemplates.commentFirstTime.description',
    iconName: 'tag',
    build: (texts) => {
      // Comment trigger with no keyword filter (matchMode 'any' matches any
      // comment). Tags the contact so a future condition node can branch on
      // "is this their first comment?" — combined with `set_tag remove` later
      // in another flow when they've been "warmed up".
      const triggerId = uid();
      const tagId = uid();
      const replyId = uid();
      const endId = uid();
      const tag = (texts.tag ?? '').trim() || 'novo-comentarista';
      const nodes: FlowNode[] = [
        {
          id: triggerId,
          type: 'trigger.comment_keyword',
          position: POS_TRIGGER,
          data: {
            instagramPostId: null,
            // Single empty-ish keyword + matchMode 'any' = match every comment.
            // The schema requires keywords.min(1), so we use a wildcard token.
            keywords: ['*'],
            matchMode: 'any',
            caseSensitive: false,
          },
        },
        {
          id: tagId,
          type: 'action.set_tag',
          position: POS_ACTION_1,
          data: { tag, operation: 'add' },
        },
        {
          id: replyId,
          type: 'action.reply_comment',
          position: POS_ACTION_2,
          data: { text: texts.replyMessage ?? '' },
        },
        {
          id: endId,
          type: 'control.end',
          position: POS_END,
          data: {},
        },
      ];
      return {
        nodes,
        edges: [
          { id: uid(), source: triggerId, target: tagId },
          { id: uid(), source: tagId, target: replyId },
          { id: uid(), source: replyId, target: endId },
        ],
      };
    },
  },
  {
    id: 'story-mention-thanks',
    nameKey: 'flowTemplates.storyMentionThanks.name',
    descriptionKey: 'flowTemplates.storyMentionThanks.description',
    iconName: 'image',
    build: (texts) => {
      const triggerId = uid();
      const tagId = uid();
      const dmId = uid();
      const endId = uid();
      const tag = (texts.tag ?? '').trim() || 'mencionou-no-story';
      const nodes: FlowNode[] = [
        {
          id: triggerId,
          type: 'trigger.story_mention',
          position: POS_TRIGGER,
          data: {},
        },
        {
          id: tagId,
          type: 'action.set_tag',
          position: POS_ACTION_1,
          data: { tag, operation: 'add' },
        },
        {
          id: dmId,
          type: 'action.send_dm',
          position: POS_ACTION_2,
          data: { text: texts.dmMessage },
        },
        {
          id: endId,
          type: 'control.end',
          position: POS_END,
          data: {},
        },
      ];
      return {
        nodes,
        edges: [
          { id: uid(), source: triggerId, target: tagId },
          { id: uid(), source: tagId, target: dmId },
          { id: uid(), source: dmId, target: endId },
        ],
      };
    },
  },
];

function buildDmKeywordTemplate(texts: TemplateTexts): FlowGraph {
  const triggerId = uid();
  const dmId = uid();
  const endId = uid();
  const nodes: FlowNode[] = [
    {
      id: triggerId,
      type: 'trigger.dm_keyword',
      position: POS_TRIGGER,
      data: {
        keywords: splitKeywords(texts.triggerKeywords),
        matchMode: 'contains',
        caseSensitive: false,
      },
    },
    {
      id: dmId,
      type: 'action.send_dm',
      position: POS_ACTION_1,
      data: { text: texts.dmMessage },
    },
    {
      id: endId,
      type: 'control.end',
      position: POS_ACTION_2,
      data: {},
    },
  ];
  return {
    nodes,
    edges: [
      { id: uid(), source: triggerId, target: dmId },
      { id: uid(), source: dmId, target: endId },
    ],
  };
}

export function getTemplate(id: string): FlowTemplate | undefined {
  return FLOW_TEMPLATES.find((t) => t.id === id);
}
