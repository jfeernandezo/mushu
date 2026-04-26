import type { FlowGraph, FlowNode } from '@mushu/shared/flow';

export interface FlowTemplate {
  id: string;
  nameKey: string;
  descriptionKey: string;
  iconName: 'comment' | 'lead' | 'wave';
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
  triggerKeywords: string;
  replyMessage?: string;
  dmMessage: string;
}

const POS_TRIGGER = { x: 80, y: 80 };
const POS_ACTION_1 = { x: 80, y: 240 };
const POS_ACTION_2 = { x: 80, y: 400 };
const POS_END = { x: 80, y: 560 };

function uid(): string {
  return crypto.randomUUID();
}

function splitKeywords(csv: string): string[] {
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
