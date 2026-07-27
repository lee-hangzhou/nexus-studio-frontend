import type { Stream as GeneratedStreamFrame } from './generated/stream';

export const SKILL_WRITE_OPERATION_TYPE = 'skill_write' as const;

export type SkillWriteOperation = {
  type: typeof SKILL_WRITE_OPERATION_TYPE;
  path: string;
  scope: 'user' | 'project';
  surface: 'chat' | 'canvas';
  name: string;
  /** null = 省略，覆盖时保留原描述 */
  description: string | null;
  content: string;
  revision?: number | null;
  revision_invalid?: boolean;
};

export type ToolPendingState = {
  call_id: string;
  name: string;
  summary: string;
  operation?: SkillWriteOperation | null;
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

export function toolPendingFromFrame(frame: {
  type: string;
  call_id?: string;
  name?: string;
  summary?: string | null;
  operation?: unknown;
}): ToolPendingState | null {
  if (frame.type !== 'tool_pending') return null;
  if (!frame.call_id) return null;
  return {
    call_id: frame.call_id,
    name: frame.name ?? '',
    summary: frame.summary ?? '待确认的工具操作',
    operation: parseSkillWriteOperation(frame.operation),
  };
}

export type StreamFrame = GeneratedStreamFrame;
