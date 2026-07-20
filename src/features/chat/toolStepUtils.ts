import type { ToolStepView } from '../../api/chat';

export function updateToolStepResult(
  steps: ToolStepView[],
  callId: string,
  name: string,
  preview: string,
): ToolStepView[] {
  if (callId && steps.some((step) => step.call_id === callId)) {
    return steps.map((step) =>
      step.call_id === callId ? { ...step, result_preview: preview } : step,
    );
  }
  let matched = false;
  return steps.map((step) => {
    if (!matched && step.name === name && step.result_preview === '执行中…') {
      matched = true;
      return { ...step, call_id: callId || step.call_id, result_preview: preview };
    }
    return step;
  });
}

export function appendToolStepStart(
  steps: ToolStepView[],
  callId: string,
  name: string,
  args: Record<string, unknown>,
): ToolStepView[] {
  const id = callId || `local-${steps.length}`;
  const next: ToolStepView = {
    call_id: id,
    name,
    args,
    result_preview: '执行中…',
  };
  if (callId && steps.some((step) => step.call_id === callId)) {
    return steps.map((step) => (step.call_id === callId ? { ...step, ...next } : step));
  }
  return [...steps, next];
}
