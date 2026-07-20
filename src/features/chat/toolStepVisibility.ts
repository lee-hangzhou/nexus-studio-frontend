import type { ToolStepView } from '../../api/chat';

export const BROWSER_TOOL_NAMES = new Set([
  'browser_exec_script',
  'browser_capture_state',
  'request_user_gate',
  'browser_trigger_otp_send',
  'signal_browser_blocked',
]);

function parseToolResultSuccess(preview: string): boolean | null {
  const text = preview.trim();
  if (!text.startsWith('{')) return null;
  try {
    const raw = JSON.parse(text) as { tool_result?: { success?: boolean } };
    const item = raw.tool_result;
    if (!item || typeof item !== 'object') return null;
    if (typeof item.success === 'boolean') return item.success;
    return null;
  } catch {
    return null;
  }
}

export function isFailedToolStep(step: ToolStepView): boolean {
  if (
    step.result_preview === '执行中…'
    || step.result_preview === '参数异常，正在自动修复…'
    || step.result_preview === '参数已自动修复'
  ) {
    return false;
  }
  if (step.result_preview.startsWith('失败:')) return true;
  const parsed = parseToolResultSuccess(step.result_preview);
  return parsed === false;
}

export function visibleToolSteps(steps: ToolStepView[]): ToolStepView[] {
  return steps.filter((step) => !isFailedToolStep(step));
}

export function isBrowserTool(name: string): boolean {
  return BROWSER_TOOL_NAMES.has(name);
}
