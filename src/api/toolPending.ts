import type { Stream as GeneratedStreamFrame } from './generated/stream';
import type {
  CanvasNodeView,
  PendingCanvasPatchOperation,
  PendingGenerateOperation,
  PendingSkillWriteOperation,
} from './generated/canvas';

export type {
  PendingCanvasPatchOperation,
  PendingGenerateOperation,
  PendingSkillWriteOperation,
};

export const SKILL_WRITE_OPERATION_TYPE = 'skill_write' as const;

/** 与生成契约 PendingSkillWriteOperation 对齐，不再手写第二套形状 */
export type SkillWriteOperation = PendingSkillWriteOperation;

export type CanvasToolPendingOperation =
  | PendingCanvasPatchOperation
  | PendingGenerateOperation
  | PendingSkillWriteOperation;

export type ToolPendingOperation = CanvasToolPendingOperation;

export type ToolPendingState = {
  call_id: string;
  name: string;
  summary: string;
  operation?: ToolPendingOperation | null;
  enrich_status?: 'ok' | 'skipped' | 'failed' | null;
  /** 前端解析失败时与 enrich_status=failed 对齐；便于区分「未 enrich」与「畸形」 */
  parse_error?: 'malformed_operation' | null;
};

export function parseSkillWriteOperation(raw: unknown): SkillWriteOperation | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const op = raw as Record<string, unknown>;
  if (op.type !== SKILL_WRITE_OPERATION_TYPE) return null;
  if (typeof op.path !== 'string' || !op.path) return null;
  let revision: number | null | undefined;
  if (op.revision == null || op.revision === '') {
    revision = null;
  } else if (typeof op.revision === 'number' && Number.isFinite(op.revision)) {
    revision = op.revision;
  } else if (typeof op.revision === 'string' && op.revision.trim()) {
    const parsed = Number(op.revision);
    revision = Number.isFinite(parsed) ? parsed : null;
  } else {
    revision = null;
  }
  let description: string | null;
  if (!('description' in op) || op.description === null || op.description === undefined) {
    description = null;
  } else {
    description = String(op.description);
  }
  return {
    type: SKILL_WRITE_OPERATION_TYPE,
    path: op.path,
    scope: op.scope === 'project' ? 'project' : 'user',
    surface: op.surface === 'canvas' ? 'canvas' : 'chat',
    name: typeof op.name === 'string' ? op.name : '',
    description,
    content: typeof op.content === 'string' ? op.content : '',
    revision,
    revision_invalid: op.revision_invalid === true,
  };
}

function isNodeLike(raw: unknown): raw is CanvasNodeView {
  if (typeof raw !== 'object' || raw === null) return false;
  const node = raw as Record<string, unknown>;
  if (typeof node.id !== 'string' || !node.id) return false;
  if (typeof node.kind !== 'string' || !node.kind) return false;
  if (typeof node.revision !== 'number' || !Number.isFinite(node.revision)) return false;
  if (!node.position || typeof node.position !== 'object') return false;
  return true;
}

function isGenerateSubmitArgs(raw: unknown): boolean {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return false;
  const args = raw as Record<string, unknown>;
  if (typeof args.node_id !== 'string' || !args.node_id) return false;
  if (typeof args.kind !== 'string' || !args.kind) return false;
  if (typeof args.prompt !== 'string' || !args.prompt) return false;
  if (typeof args.model_id !== 'string' || !args.model_id) return false;
  if ('ref_asset_ids' in args && args.ref_asset_ids != null && !Array.isArray(args.ref_asset_ids)) {
    return false;
  }
  return true;
}

export function parseToolPendingOperation(raw: unknown): ToolPendingOperation | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const op = raw as Record<string, unknown>;
  const type = op.type;
  if (type === SKILL_WRITE_OPERATION_TYPE) {
    return parseSkillWriteOperation(raw);
  }
  if (type === 'create' || type === 'update') {
    if (!Array.isArray(op.nodes) || op.nodes.length !== 1 || !isNodeLike(op.nodes[0])) {
      return null;
    }
    return {
      type,
      nodes: [op.nodes[0]],
      edges: Array.isArray(op.edges) ? (op.edges as PendingCanvasPatchOperation['edges']) : [],
    };
  }
  if (type === 'generate') {
    if (!isNodeLike(op.node)) return null;
    if (!isGenerateSubmitArgs(op.submit_args)) return null;
    return {
      type: 'generate',
      node: op.node,
      submit_args: op.submit_args,
    } as PendingGenerateOperation;
  }
  return null;
}

export function toolPendingFromFrame(frame: {
  type: string;
  call_id?: string;
  name?: string;
  summary?: string | null;
  operation?: unknown;
  enrich_status?: 'ok' | 'skipped' | 'failed' | null;
}): ToolPendingState | null {
  if (frame.type !== 'tool_pending') return null;
  if (!frame.call_id) return null;
  const hasOperationPayload = frame.operation != null;
  const operation = hasOperationPayload ? parseToolPendingOperation(frame.operation) : null;
  const parseFailed = hasOperationPayload && operation == null;
  if (parseFailed) {
    console.warn('[toolPending] malformed operation payload', {
      name: frame.name,
      enrich_status: frame.enrich_status,
      operation: frame.operation,
    });
  }
  let enrichStatus = frame.enrich_status ?? null;
  if (parseFailed) {
    enrichStatus = 'failed';
  }
  return {
    call_id: frame.call_id,
    name: frame.name ?? '',
    summary: frame.summary ?? '待确认的工具操作',
    operation,
    enrich_status: enrichStatus,
    parse_error: parseFailed ? 'malformed_operation' : null,
  };
}

export type StreamFrame = GeneratedStreamFrame;
