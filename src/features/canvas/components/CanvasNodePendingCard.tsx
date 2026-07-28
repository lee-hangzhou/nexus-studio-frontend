import { Button, Input, Select } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import type {
  PendingCanvasPatchOperation,
  PendingGenerateOperation,
  ToolPendingOperation,
} from '../../../api/toolPending';
import styles from './CanvasNodePendingCard.module.css';

type Props = {
  summary: string;
  operation: PendingCanvasPatchOperation | PendingGenerateOperation;
  loading?: boolean;
  onConfirm: (operation: ToolPendingOperation) => void;
  onReject: () => void;
};

function segmentText(content: unknown): string {
  if (!Array.isArray(content)) return '';
  const parts: string[] = [];
  for (const seg of content) {
    if (!seg || typeof seg !== 'object') continue;
    const row = seg as { type?: string; text?: string };
    if (row.type === 'text' && typeof row.text === 'string') parts.push(row.text);
  }
  return parts.join('');
}

function hasNonTextSegments(content: unknown): boolean {
  if (!Array.isArray(content)) return false;
  return content.some(
    (seg) => seg && typeof seg === 'object' && (seg as { type?: string }).type !== 'text',
  );
}

function readBody(operation: PendingCanvasPatchOperation | PendingGenerateOperation): string {
  const node =
    operation.type === 'generate' ? operation.node : operation.nodes?.[0];
  if (!node?.data) return '';
  const data = node.data;
  // text create/update：只读生成输入（prompt / prompt_content），禁止回退 content 正文
  if (node.kind === 'text' && operation.type !== 'generate') {
    if (typeof data.prompt === 'string' && data.prompt) return data.prompt;
    if (Array.isArray(data.prompt_content)) {
      const fromPromptContent = data.prompt_content
        .filter((s) => s && typeof s === 'object' && (s as { type?: string }).type === 'text')
        .map((s) => String((s as { text?: string }).text ?? ''))
        .filter(Boolean)
        .join('\n');
      if (fromPromptContent) return fromPromptContent;
    }
    return '';
  }
  if (typeof data.prompt === 'string' && data.prompt) return data.prompt;
  if (Array.isArray(data.prompt_content)) {
    const fromPromptContent = data.prompt_content
      .filter((s) => s && typeof s === 'object' && (s as { type?: string }).type === 'text')
      .map((s) => String((s as { text?: string }).text ?? ''))
      .filter(Boolean)
      .join('\n');
    if (fromPromptContent) return fromPromptContent;
  }
  return segmentText(data.content);
}

function readConfig(operation: PendingCanvasPatchOperation | PendingGenerateOperation) {
  const node =
    operation.type === 'generate' ? operation.node : operation.nodes?.[0];
  const config = node?.data?.config ?? {};
  return {
    model: node?.data?.model ?? config.model ?? '',
    ratio: config.ratio ?? '',
    resolution: config.resolution ?? '',
    duration: config.duration_sec ?? (config.duration ? Number(config.duration) : undefined),
    voice_id: config.voice_id ?? '',
  };
}

export function CanvasNodePendingCard({ summary, operation, loading, onConfirm, onReject }: Props) {
  const initialBody = useMemo(() => readBody(operation), [operation]);
  const initialConfig = useMemo(() => readConfig(operation), [operation]);
  const [bodyText, setBodyText] = useState(initialBody);
  const [model, setModel] = useState(initialConfig.model);
  const [ratio, setRatio] = useState(initialConfig.ratio);
  const [resolution, setResolution] = useState(initialConfig.resolution);
  const [duration, setDuration] = useState<number | undefined>(initialConfig.duration);
  const [voiceId, setVoiceId] = useState(initialConfig.voice_id);

  useEffect(() => {
    setBodyText(initialBody);
    setModel(initialConfig.model);
    setRatio(initialConfig.ratio);
    setResolution(initialConfig.resolution);
    setDuration(initialConfig.duration);
    setVoiceId(initialConfig.voice_id);
  }, [initialBody, initialConfig]);

  const title =
    operation.type === 'create' ? '创建节点' : operation.type === 'update' ? '更新节点' : '确认生成';

  const confirmLabel =
    operation.type === 'create' ? '创建' : operation.type === 'update' ? '更新' : '确认';

  const mediaNode =
    operation.type === 'generate'
      ? operation.node
      : operation.nodes?.[0];
  const textOnlyHint =
    mediaNode &&
    mediaNode.kind !== 'text' &&
    operation.type !== 'generate' &&
    hasNonTextSegments(mediaNode.data?.content);

  const buildEdited = (): ToolPendingOperation => {
    if (operation.type === 'generate') {
      const node = structuredClone(operation.node);
      const data = { ...(node.data ?? {}) };
      const config = { ...(data.config ?? {}) };
      // generate 仅媒体；确认卡只改 prompt / config，不写 content 正文
      data.prompt = bodyText;
      if (model) {
        data.model = model;
        config.model = model;
      }
      if (ratio) config.ratio = ratio;
      if (resolution) config.resolution = resolution;
      if (duration != null) {
        config.duration_sec = duration;
        config.duration = String(duration);
      }
      if (voiceId) config.voice_id = voiceId;
      data.config = config;
      node.data = data;
      return {
        type: 'generate',
        node,
        submit_args: operation.submit_args,
      };
    }
    const nodes = structuredClone(operation.nodes ?? []);
    const node = nodes[0];
    if (node) {
      const data = { ...(node.data ?? {}) };
      if (node.kind === 'text') {
        // text 确认卡编辑生成输入：写 prompt + prompt_content，不碰正文 content
        data.prompt = bodyText;
        data.prompt_content = bodyText.trim()
          ? [{ type: 'text' as const, text: bodyText.trim() }]
          : [];
      } else {
        data.prompt = bodyText;
        const existingContent = Array.isArray(data.content) ? [...data.content] : [];
        const nonText = existingContent.filter(
          (seg) => seg && typeof seg === 'object' && (seg as { type?: string }).type !== 'text',
        );
        data.content = bodyText
          ? [{ type: 'text' as const, text: bodyText }, ...nonText]
          : nonText.length
            ? nonText
            : null;
      }
      node.data = data;
      nodes[0] = node;
    }
    return { type: operation.type, nodes, edges: operation.edges ?? [] };
  };

  return (
    <div className={`workflow-canvas-agent-panel__pending-card ${styles.card}`}>
      <p className="workflow-canvas-agent-panel__text">
        <strong>{title}</strong>
        {summary ? ` · ${summary}` : null}
      </p>
      <label className={styles.field}>
        <span className={styles.label}>
          {operation.type === 'generate'
            ? '提示词'
            : mediaNode?.kind === 'text'
              ? '生成输入（不改正文）'
              : '提示词 / 正文'}
        </span>
        <Input.TextArea
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          rows={4}
          disabled={loading}
          aria-label="提示词或正文"
        />
      </label>
      {textOnlyHint ? (
        <p className={styles.hint} role="note">
          仅编辑文本段；图片/视频/音频引用段确认后仍保留，无法在此卡修改
        </p>
      ) : null}
      {operation.type === 'generate' ? (
        <div className={styles.fields}>
          <label className={styles.field}>
            <span className={styles.label}>模型</span>
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={loading}
              aria-label="模型"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>比例</span>
            <Input
              value={ratio}
              onChange={(e) => setRatio(e.target.value)}
              disabled={loading}
              aria-label="比例"
              className={styles.narrow}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>分辨率</span>
            <Input
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              disabled={loading}
              aria-label="分辨率"
              className={styles.narrow}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>时长</span>
            <Select
              allowClear
              disabled={loading}
              aria-label="时长"
              className={styles.narrow}
              value={duration}
              onChange={(v) => setDuration(v)}
              options={[3, 5, 8, 10, 15].map((d) => ({ value: d, label: `${d}s` }))}
            />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>音色</span>
            <Input
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              disabled={loading}
              aria-label="音色"
            />
          </label>
        </div>
      ) : null}
      <div className={`workflow-canvas-agent-panel__gate ${styles.actions}`}>
        <Button size="small" type="primary" loading={loading} onClick={() => onConfirm(buildEdited())}>
          {confirmLabel}
        </Button>
        <Button size="small" disabled={loading} onClick={onReject}>
          拒绝
        </Button>
      </div>
    </div>
  );
}
