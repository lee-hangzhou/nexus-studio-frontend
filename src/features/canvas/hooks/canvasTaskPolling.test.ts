import { describe, expect, it } from 'vitest';
import { TASK_STATUS } from '../../../domains/task/types';
import type { GenerateTaskView } from '../../../api/generate';
import type { CanvasFlowNode } from '../schema/canvasSchema';
import { activePollTaskIds, terminalPollTaskIds } from './canvasTaskPolling';

function runningNode(id: string, taskId: number): CanvasFlowNode {
  return {
    id,
    type: 'image',
    position: { x: 0, y: 0 },
    data: {
      kind: 'image',
      revision: 1,
      title: '',
      input_prompt: '',
      output_text: '',
      status: 'running',
      task_id: taskId,
      payload: { status: 'running', generate_task_id: taskId },
    },
  } as unknown as CanvasFlowNode;
}

function terminalNode(id: string, taskId: number): CanvasFlowNode {
  return {
    id,
    type: 'image',
    position: { x: 0, y: 0 },
    data: {
      kind: 'image',
      revision: 1,
      title: '',
      input_prompt: '',
      output_text: '',
      status: 'success',
      task_id: taskId,
      payload: { status: 'success', generate_task_id: taskId },
    },
  } as unknown as CanvasFlowNode;
}

describe('activePollTaskIds', () => {
  it('返回未落终态节点的 task_id 并按序去重', () => {
    const nodes = [runningNode('a', 3), runningNode('b', 1), runningNode('c', 3)];
    expect(activePollTaskIds(nodes, new Set())).toEqual([1, 3]);
  });

  it('排除已做终态对齐的任务', () => {
    const nodes = [runningNode('a', 3), runningNode('b', 1)];
    expect(activePollTaskIds(nodes, new Set([1]))).toEqual([3]);
  });

  it('节点已展示 success/failed 时不轮询', () => {
    expect(activePollTaskIds([terminalNode('a', 1)], new Set())).toEqual([]);
  });

  it('有 task_id 但 status 非终态时仍轮询', () => {
    const idleWithTask = {
      ...runningNode('a', 9),
      data: { ...runningNode('a', 9).data, status: 'idle' as const },
    };
    expect(activePollTaskIds([idleWithTask], new Set())).toEqual([9]);
  });
});

describe('terminalPollTaskIds', () => {
  function view(taskId: number, status: number): GenerateTaskView {
    return {
      task_id: taskId,
      kind: 'image',
      status,
      prompt: '',
      model_id: 'm',
      result_count: 0,
      result_asset_ids: [],
      result_urls: [],
      is_favorited: false,
      created_at: '2026-08-06T00:00:00Z',
    };
  }

  it('收集已终态与缺失任务并去重', () => {
    const items = [
      view(1, TASK_STATUS.SUCCEEDED),
      view(2, TASK_STATUS.RUNNING),
      view(3, TASK_STATUS.FAILED),
    ];
    expect(terminalPollTaskIds(items, [4, 1])).toEqual([1, 3, 4]);
  });

  it('全部仍运行时返回空', () => {
    const items = [view(2, TASK_STATUS.RUNNING), view(5, TASK_STATUS.QUEUED)];
    expect(terminalPollTaskIds(items, [])).toEqual([]);
  });
});
