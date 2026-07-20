import {
  collectReferencedAssetIds,
  parseAssetIdFromMentionId,
  resolveMentionDisplayLabel,
} from '../../../providers/canvasMentionProvider';
import type { WorkflowMentionItem } from '../types';
import type {
  WorkflowPromptContent,
  WorkflowPromptContentSegment,
} from '../../../types';

function resolveMentionAssetId(item: Pick<WorkflowMentionItem, 'id' | 'assetId'>): number {
  if (typeof item.assetId === 'number' && item.assetId > 0) {
    return item.assetId;
  }
  return parseAssetIdFromMentionId(item.id);
}

/** 画布 @ 引用 token：在 BottomComposer 基础上增加「文本」 */
export const WORKFLOW_PROMPT_MENTION_RE = /@(图片|视频|音频|文本)(\d+)/g;

const MEDIA_URL_TYPE: Record<'image' | 'video' | 'audio', 'image_url' | 'video_url' | 'audio_url'> =
  {
    image: 'image_url',
    video: 'video_url',
    audio: 'audio_url',
  };

const URL_TYPE_TO_MEDIA: Record<
  'image_url' | 'video_url' | 'audio_url',
  'image' | 'video' | 'audio'
> = {
  image_url: 'image',
  video_url: 'video',
  audio_url: 'audio',
};

function resolveMediaUrl(seg: {
  type: 'image_url' | 'video_url' | 'audio_url';
  url?: string;
}): string {
  return typeof seg.url === 'string' ? seg.url : '';
}

function buildMediaContentSegment(
  asset: WorkflowMentionItem & { type: 'image' | 'video' | 'audio' },
  overrides?: { url?: string; assetId?: number }
) {
  const assetId = overrides?.assetId ?? resolveMentionAssetId(asset);
  return {
    type: MEDIA_URL_TYPE[asset.type],
    ...(assetId > 0 ? { assetId } : {}),
    url: overrides?.url ?? asset.previewUrl ?? '',
  };
}

function buildReferenceContentSegment(
  asset: WorkflowMentionItem,
  overrides?: { url?: string; text?: string; assetId?: number }
): WorkflowPromptContentSegment {
  if (asset.type === 'text') {
    return {
      type: 'text_ref',
      text: overrides?.text ?? asset.textContent ?? '',
    };
  }
  return buildMediaContentSegment(
    asset as WorkflowMentionItem & { type: 'image' | 'video' | 'audio' },
    { url: overrides?.url, assetId: overrides?.assetId }
  );
}

/** content 分段 → 可 @ 的引用项（优先 assetId，其次 url / 文本快照） */
function resolveAssetFromContentSegment(
  seg: Exclude<WorkflowPromptContentSegment, { type: 'text' }>,
  referenceAssets: WorkflowMentionItem[]
): WorkflowMentionItem | undefined {
  if (seg.type === 'text_ref') {
    const text = seg.text?.trim();
    if (!text) {
      return undefined;
    }
    return referenceAssets.find(a => a.type === 'text' && a.textContent === text);
  }

  const assetId =
    'assetId' in seg && typeof seg.assetId === 'number' && seg.assetId > 0 ? seg.assetId : undefined;
  if (assetId) {
    const byId = referenceAssets.find(a => resolveMentionAssetId(a) === assetId);
    if (byId) {
      return byId;
    }
  }

  const storedUrl = resolveMediaUrl(seg);
  if (storedUrl) {
    return referenceAssets.find(a => a.previewUrl === storedUrl);
  }

  return undefined;
}

const TYPE_LABEL_CN: Record<WorkflowMentionItem['type'], string> = {
  image: '图片',
  video: '视频',
  audio: '音频',
  text: '文本',
};

const TYPE_MAP_CN: Record<string, WorkflowMentionItem['type']> = {
  图片: 'image',
  视频: 'video',
  音频: 'audio',
  文本: 'text',
};

function resolveWorkflowMentionByOrdinal(
  assets: WorkflowMentionItem[],
  mediaType: WorkflowMentionItem['type'],
  ordinal: number
): WorkflowMentionItem | undefined {
  let n = 0;
  for (const asset of assets) {
    if (asset.type !== mediaType) {
      continue;
    }
    n += 1;
    if (n === ordinal) {
      return asset;
    }
  }
  return undefined;
}

/** 视频 tag/content：previewUrl 存预览图；mediaUrl 存成片（悬浮播放、提交由 assetId 解析） */
function resolveVideoTagPreviewUrl(
  item: WorkflowMentionItem,
  storedContentUrl?: string
): string {
  const stored = (storedContentUrl ?? '').trim();
  if (stored) {
    return stored;
  }
  const thumb = (item.thumbUrl ?? '').trim();
  if (thumb) {
    return thumb;
  }
  return (item.previewUrl ?? '').trim();
}

function mentionAttrsFromItem(
  item: WorkflowMentionItem,
  overrides?: { previewUrl?: string; textContent?: string; assetId?: number }
) {
  const assetId = overrides?.assetId ?? resolveMentionAssetId(item);
  const mediaUrl = (item.previewUrl ?? '').trim();

  if (item.type === 'video') {
    const previewUrl = resolveVideoTagPreviewUrl(item, overrides?.previewUrl);
    const thumbUrl = (item.thumbUrl ?? '').trim() || previewUrl;
    return {
      id: String(item.id),
      label: resolveMentionDisplayLabel(item),
      mentionType: item.type,
      previewUrl,
      thumbUrl,
      mediaUrl,
      textContent: overrides?.textContent ?? item.textContent ?? '',
      ...(assetId > 0 ? { assetId } : {}),
    };
  }

  const previewUrl = overrides?.previewUrl ?? item.previewUrl ?? '';
  return {
    id: String(item.id),
    label: resolveMentionDisplayLabel(item),
    mentionType: item.type,
    previewUrl,
    thumbUrl: item.thumbUrl ?? '',
    mediaUrl: previewUrl.trim() || mediaUrl,
    textContent: overrides?.textContent ?? item.textContent ?? '',
    ...(assetId > 0 ? { assetId } : {}),
  };
}

function mentionTokenForAsset(
  assets: WorkflowMentionItem[],
  asset: WorkflowMentionItem
): string {
  let imageCount = 0;
  let videoCount = 0;
  let audioCount = 0;
  let textCount = 0;
  for (const a of assets) {
    if (a.type === 'image') {
      imageCount += 1;
      if (a.id === asset.id && a.type === asset.type) {
        return `@图片${imageCount}`;
      }
    } else if (a.type === 'video') {
      videoCount += 1;
      if (a.id === asset.id && a.type === asset.type) {
        return `@视频${videoCount}`;
      }
    } else if (a.type === 'audio') {
      audioCount += 1;
      if (a.id === asset.id && a.type === asset.type) {
        return `@音频${audioCount}`;
      }
    } else if (a.type === 'text') {
      textCount += 1;
      if (a.id === asset.id && a.type === asset.type) {
        return `@文本${textCount}`;
      }
    }
  }
  return `@${asset.label}`;
}

export type TiptapInlineNode =
  | { type: 'text'; text: string }
  | { type: 'hardBreak' }
  | {
      type: 'workflowMention';
      attrs: {
        id: string;
        label: string;
        mentionType: WorkflowMentionItem['type'];
        assetId?: number;
        previewUrl?: string;
        thumbUrl?: string;
        /** 视频成片地址；不落 content.url */
        mediaUrl?: string;
        textContent?: string;
      };
    };

export type TiptapDocContent = {
  type: 'doc';
  content: { type: 'paragraph'; content: TiptapInlineNode[] }[];
};

/** content 分段 → Tiptap JSON（与 BottomComposer fillComposerEditorFromTaskContent 对齐） */
export function parseContentToDoc(
  content: WorkflowPromptContent | undefined,
  referenceAssets: WorkflowMentionItem[]
): TiptapDocContent {
  const inline: TiptapInlineNode[] = [];
  if (!content?.length) {
    return wrapParagraph(inline);
  }
  for (const seg of content) {
    if (seg.type === 'text') {
      if (seg.text) {
        appendTextWithBreaks(inline, seg.text);
      }
      continue;
    }
    const asset = resolveAssetFromContentSegment(seg, referenceAssets);

    if (seg.type === 'text_ref') {
      if (!asset && !seg.text) {
        continue;
      }
      inline.push({
        type: 'workflowMention',
        attrs: mentionAttrsFromItem(asset ?? {
          id: '',
          type: 'text',
          label: '文本',
          textContent: seg.text,
        }, { textContent: seg.text }),
      });
      continue;
    }

    const storedUrl = resolveMediaUrl(seg);
    const mentionType = asset?.type ?? URL_TYPE_TO_MEDIA[seg.type];
    const storedAssetId =
      'assetId' in seg && typeof seg.assetId === 'number' && seg.assetId > 0
        ? seg.assetId
        : undefined;
    if (!asset && !storedUrl) {
      continue;
    }
    inline.push({
      type: 'workflowMention',
      attrs: mentionAttrsFromItem(
        asset ?? {
          id: storedAssetId ? `asset-${storedAssetId}` : '',
          assetId: storedAssetId,
          type: mentionType,
          label: TYPE_LABEL_CN[mentionType],
        },
        { previewUrl: storedUrl || asset?.previewUrl, assetId: storedAssetId }
      ),
    });
  }
  return wrapParagraph(inline);
}

/** 关闭 @ 引用时，仅用纯文本段或 prompt 初始化编辑器 */
export function resolvePlainDocInput(
  input: { content?: WorkflowPromptContent; prompt?: string }
): TiptapDocContent {
  const text =
    input.prompt?.trim() ||
    (input.content ?? [])
      .filter((seg): seg is { type: 'text'; text: string } => seg.type === 'text')
      .map(seg => seg.text)
      .join('\n');
  return parsePromptToDoc(text, []);
}

/** 纯文本模式：输出单段 text 的 content */
export function serializePlainEditorPayload(
  json: { type?: string; content?: unknown[] } | null | undefined
): CanvasPromptEditorPayload {
  const prompt = serializeEditorJsonToPrompt(json, []);
  const trimmed = prompt.trim();
  return {
    prompt,
    content: trimmed ? [{ type: 'text', text: trimmed }] : [],
  };
}

/** 优先 content，无 content 时回退旧 prompt 字符串 */
export function resolvePromptDocInput(
  input: { content?: WorkflowPromptContent; prompt?: string },
  referenceAssets: WorkflowMentionItem[]
): TiptapDocContent {
  if (input.content?.length) {
    return parseContentToDoc(input.content, referenceAssets);
  }
  return parsePromptToDoc(input.prompt ?? '', referenceAssets);
}

/** content → 含 @图片1 的纯文本（与 serializeDocToPrompt 一致） */
export function contentToPrompt(
  content: WorkflowPromptContent | undefined,
  referenceAssets: WorkflowMentionItem[]
): string {
  if (!content?.length) {
    return '';
  }
  return serializeDocToPrompt(parseContentToDoc(content, referenceAssets), referenceAssets);
}

/** prompt 字符串 → Tiptap JSON（单段落 + hardBreak 表示换行） */
export function parsePromptToDoc(
  promptText: string,
  referenceAssets: WorkflowMentionItem[]
): TiptapDocContent {
  const inline: TiptapInlineNode[] = [];
  const mentions = [...promptText.matchAll(WORKFLOW_PROMPT_MENTION_RE)];

  if (mentions.length === 0) {
    appendTextWithBreaks(inline, promptText);
    return wrapParagraph(inline);
  }

  let lastIndex = 0;
  for (const m of mentions) {
    const full = m[0];
    const idx = m.index ?? 0;
    const labelCn = m[1];
    const ordinal = Number(m[2]);
    const before = promptText.slice(lastIndex, idx);
    if (before) {
      appendTextWithBreaks(inline, before);
    }
    const mediaType = TYPE_MAP_CN[labelCn];
    const workflowItem =
      mediaType && Number.isFinite(ordinal) && ordinal > 0
        ? resolveWorkflowMentionByOrdinal(referenceAssets, mediaType, ordinal)
        : undefined;
    if (workflowItem) {
      inline.push({
        type: 'workflowMention',
        attrs: mentionAttrsFromItem(workflowItem),
      });
    } else {
      appendTextWithBreaks(inline, full);
    }
    lastIndex = idx + full.length;
  }
  const tail = promptText.slice(lastIndex);
  if (tail) {
    appendTextWithBreaks(inline, tail);
  }
  return wrapParagraph(inline);
}

function appendTextWithBreaks(inline: TiptapInlineNode[], text: string): void {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const parts = normalized.split('\n');
  for (let i = 0; i < parts.length; i++) {
    if (i > 0) {
      inline.push({ type: 'hardBreak' });
    }
    if (parts[i]) {
      inline.push({ type: 'text', text: parts[i] });
    }
  }
}

function wrapParagraph(inline: TiptapInlineNode[]): TiptapDocContent {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: inline.length ? inline : [] }],
  };
}

/** 遍历 Tiptap doc JSON，输出 prompt 纯文本（含 @图片1 token） */
export function serializeDocToPrompt(
  doc: TiptapDocContent | null | undefined,
  referenceAssets: WorkflowMentionItem[]
): string {
  if (!doc?.content?.length) {
    return '';
  }
  let out = '';
  for (const block of doc.content) {
    if (block.type !== 'paragraph' || !block.content) {
      continue;
    }
    for (const node of block.content) {
      if (node.type === 'text') {
        out += node.text;
      } else if (node.type === 'hardBreak') {
        out += '\n';
      } else if (node.type === 'workflowMention') {
        const item = referenceAssets.find(
          a => String(a.id) === String(node.attrs.id) && a.type === node.attrs.mentionType
        );
        if (item) {
          out += mentionTokenForAsset(referenceAssets, item);
        } else {
          out += node.attrs.label ? `@${node.attrs.label}` : '';
        }
      }
    }
  }
  return out;
}

/** 遍历 Tiptap doc，输出 GenerateItem.content 结构（对齐 parseEditorContentToPayload） */
export function serializeDocToContent(
  doc: TiptapDocContent | null | undefined,
  referenceAssets: WorkflowMentionItem[]
): WorkflowPromptContent {
  const result: WorkflowPromptContent = [];
  if (!doc?.content?.length) {
    return result;
  }

  let currentText = '';
  const flushText = () => {
    const trimmed = currentText.trim();
    if (trimmed) {
      result.push({ type: 'text', text: trimmed });
    }
    currentText = '';
  };

  for (const block of doc.content) {
    if (block.type !== 'paragraph' || !block.content) {
      continue;
    }
    for (const node of block.content) {
      if (node.type === 'text') {
        currentText += node.text;
      } else if (node.type === 'hardBreak') {
        currentText += '\n';
      } else if (node.type === 'workflowMention') {
        flushText();
        const asset = referenceAssets.find(
          a =>
            String(a.id) === String(node.attrs.id) && a.type === node.attrs.mentionType
        );
        if (asset) {
          const nodeAssetId =
            typeof node.attrs.assetId === 'number' && node.attrs.assetId > 0
              ? node.attrs.assetId
              : undefined;
          const contentUrl =
            asset.type === 'video'
              ? (
                  String(node.attrs.previewUrl ?? '').trim() ||
                  (asset.thumbUrl ?? '').trim() ||
                  ''
                )
              : String(node.attrs.previewUrl || asset.previewUrl || '').trim();
          result.push(
            buildReferenceContentSegment(asset, {
              url: contentUrl,
              text: node.attrs.textContent || asset.textContent,
              assetId: nodeAssetId ?? resolveMentionAssetId(asset),
            })
          );
        }
      }
    }
  }
  flushText();
  return result;
}

export type CanvasPromptEditorPayload = {
  content: WorkflowPromptContent;
  prompt: string;
};

function isMediaContentSegment(
  seg: WorkflowPromptContentSegment
): seg is Exclude<WorkflowPromptContentSegment, { type: 'text' } | { type: 'text_ref' }> {
  return seg.type === 'image_url' || seg.type === 'video_url' || seg.type === 'audio_url';
}

/**
 * 顶栏参考图变更后，从 prompt content 中移除已不在 previewImageRefs 中的连线/资产库引用；
 * 主体库与 text_ref 不受顶栏删图影响。
 */
export function filterPromptContentByPreviewRefs(
  content: WorkflowPromptContent | undefined,
  previewImageRefs: WorkflowMentionItem[],
  referenceAssets: WorkflowMentionItem[]
): WorkflowPromptContent {
  if (!content?.length) {
    return [];
  }

  const validPreviewIds = new Set(previewImageRefs.map(item => String(item.id)));
  const validPreviewAssetIds = collectReferencedAssetIds(previewImageRefs);
  const subjectItems = referenceAssets.filter(item => item.source === 'subject');
  const validSubjectIds = new Set(subjectItems.map(item => String(item.id)));
  const validSubjectAssetIds = collectReferencedAssetIds(subjectItems);

  const isPreviewRailMedia = (asset: WorkflowMentionItem | undefined, segAssetId: number) => {
    if (asset?.source === 'subject') {
      return (
        validSubjectIds.has(String(asset.id)) ||
        (segAssetId > 0 && validSubjectAssetIds.has(segAssetId))
      );
    }
    if (asset?.source === 'connected' || asset?.source === 'project') {
      return (
        validPreviewIds.has(String(asset.id)) ||
        (segAssetId > 0 && validPreviewAssetIds.has(segAssetId))
      );
    }
    return (
      validPreviewIds.has(String(asset?.id ?? '')) ||
      (segAssetId > 0 && validPreviewAssetIds.has(segAssetId))
    );
  };

  const filtered: WorkflowPromptContent = [];
  for (const seg of content) {
    if (seg.type === 'text' || seg.type === 'text_ref') {
      filtered.push(seg);
      continue;
    }
    if (!isMediaContentSegment(seg)) {
      continue;
    }
    const segAssetId =
      typeof seg.assetId === 'number' && seg.assetId > 0 ? seg.assetId : 0;
    const asset = resolveAssetFromContentSegment(seg, referenceAssets);
    if (isPreviewRailMedia(asset, segAssetId)) {
      filtered.push(seg);
    }
  }
  return filtered;
}

/** ProseMirror / Editor getJSON() → content + 派生 prompt */
export function serializeEditorJsonToPayload(
  json: { type?: string; content?: unknown[] } | null | undefined,
  referenceAssets: WorkflowMentionItem[]
): CanvasPromptEditorPayload {
  if (!json || json.type !== 'doc') {
    return { content: [], prompt: '' };
  }
  const doc = json as TiptapDocContent;
  const content = serializeDocToContent(doc, referenceAssets);
  return {
    content,
    prompt: serializeDocToPrompt(doc, referenceAssets),
  };
}

/** ProseMirror / Editor getJSON() 结果序列化 */
export function serializeEditorJsonToPrompt(
  json: { type?: string; content?: unknown[] } | null | undefined,
  referenceAssets: WorkflowMentionItem[]
): string {
  if (!json || json.type !== 'doc') {
    return '';
  }
  return serializeDocToPrompt(json as TiptapDocContent, referenceAssets);
}
