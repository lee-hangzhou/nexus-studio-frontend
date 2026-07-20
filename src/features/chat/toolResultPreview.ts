const MEMORY_RECALL_TOOLS = new Set([
  'recall_user_memory',
  'recall_conversation_memory',
  'recall_project_memory',
]);

const MEMORY_LIST_TOOLS = new Set(['list_user_memories', 'list_conversation_memories']);

const MEMORY_MANAGE_TOOLS = new Set(['manage_user_memory', 'manage_conversation_memory']);

export const MEMORY_TOOL_NAMES = new Set([
  ...MEMORY_RECALL_TOOLS,
  ...MEMORY_LIST_TOOLS,
  ...MEMORY_MANAGE_TOOLS,
]);

import { BROWSER_TOOL_NAMES } from './toolStepVisibility';

export { BROWSER_TOOL_NAMES, isBrowserTool } from './toolStepVisibility';

export function isMemoryTool(name: string): boolean {
  return MEMORY_TOOL_NAMES.has(name);
}

function parseToolResultOutput(preview: string): { success: boolean; output: string } | null {
  const text = preview.trim();
  if (!text.startsWith('{')) return null;
  try {
    const raw = JSON.parse(text) as { tool_result?: { success?: boolean; output?: string } };
    const item = raw.tool_result;
    if (!item || typeof item !== 'object') return null;
    return {
      success: item.success !== false,
      output: typeof item.output === 'string' ? item.output : '',
    };
  } catch {
    return null;
  }
}

function countMemoryItems(output: string): number {
  const trimmed = output.trim();
  if (!trimmed || trimmed === '[]') return 0;
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  }
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return parsed && typeof parsed === 'object' ? 1 : 0;
    } catch {
      return 0;
    }
  }
  return 0;
}

export function sanitizeToolResultPreview(toolName: string, preview: string, ok?: boolean): string {
  if (preview === '执行中…' || preview === '参数异常，正在自动修复…' || preview === '参数已自动修复') {
    return preview;
  }
  if (BROWSER_TOOL_NAMES.has(toolName)) {
    if (ok === false) {
      if (toolName === 'request_user_gate' && preview.includes('gate_setup_failed')) {
        return '交互面板不可用';
      }
      return '页面操作未完成';
    }
    if (toolName === 'browser_capture_state') return '已记录排查快照';
    if (toolName === 'signal_browser_blocked') return '页面需要验证';
    if (toolName === 'request_user_gate') return '正在准备操作面板';
    return '已检查页面';
  }

  if (!isMemoryTool(toolName)) return preview;
  if (preview.startsWith('失败:')) return preview;

  const parsed = parseToolResultOutput(preview);
  const output = parsed?.output ?? preview;
  const success = parsed?.success ?? true;
  const count = countMemoryItems(output);

  if (!success) {
    return '记忆操作未完成';
  }

  if (MEMORY_RECALL_TOOLS.has(toolName)) {
    return count > 0 ? `已找到 ${count} 条相关记忆` : '未找到相关记忆';
  }
  if (MEMORY_LIST_TOOLS.has(toolName)) {
    return count > 0 ? `共 ${count} 条已存记忆` : '暂无已存记忆';
  }
  if (MEMORY_MANAGE_TOOLS.has(toolName)) {
    return '已更新长期记忆';
  }
  return '已完成';
}
