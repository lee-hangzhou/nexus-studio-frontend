import { describe, expect, it } from 'vitest';
import { parseToolPendingOperation, toolPendingFromFrame } from '../../../api/toolPending';
import {
  foldFlatIntoNodeData,
  flattenNodeData,
  foldSubmitContentIntoNodeData,
} from './nodeFields';
import { buildCreateNodeOpInput, buildUpdateNodeOpInput } from './patchOps';

describe('nodeFields fold/flatten', () => {
  it('keeps text prompt and content independent', () => {
    const flat = flattenNodeData('text', {
      content: 'hello',
      prompt: 'draft',
      prompt_content: [{ type: 'text', text: 'draft' }],
      title: 't',
      status: 'idle',
    });
    expect(flat.input_prompt).toBe('draft');
    expect(flat.output_text).toBe('hello');
    expect(flat.title).toBe('t');
  });

  it('folds media prompt into structured data and keeps non-text segments', () => {
    const data = foldFlatIntoNodeData(
      'video',
      { input_prompt: 'clip', model_id: 'm1', ratio: '16:9' },
      { content: [{ type: 'image_url', url: 'https://x' }] },
    );
    expect(data.prompt).toBe('clip');
    expect(data.model).toBe('m1');
    expect(data.config?.ratio).toBe('16:9');
    expect(data.content).toEqual([
      { type: 'text', text: 'clip' },
      { type: 'image_url', url: 'https://x' },
    ]);
  });

  it('text input_prompt writes prompt_content not content', () => {
    const data = foldFlatIntoNodeData(
      'text',
      { input_prompt: 'next prompt' },
      { content: 'keep body', prompt: 'old' },
    );
    expect(data.prompt).toBe('next prompt');
    expect(data.prompt_content).toEqual([{ type: 'text', text: 'next prompt' }]);
    expect(data.content).toBe('keep body');
  });

  it('foldSubmitContent persists media segments', () => {
    const data = foldSubmitContentIntoNodeData(
      'image',
      {
        plain_prompt: 'a cat',
        submit_content: [
          { type: 'text', text: 'a cat' },
          { type: 'image_url', url: 'https://ref', assetId: 9 },
        ],
      },
      { content: [] },
    );
    expect(data.prompt).toBe('a cat');
    expect(data.content).toEqual([
      { type: 'text', text: 'a cat' },
      { type: 'image_url', url: 'https://ref', assetId: 9 },
    ]);
  });
});

describe('patchOps', () => {
  it('builds create_node with data blob', () => {
    const op = buildCreateNodeOpInput('image', { x: 1, y: 2 }, { title: 'img', input_prompt: 'p' });
    expect(op.op).toBe('create_node');
    if (op.op !== 'create_node') return;
    expect(op.node.data?.title).toBe('img');
    expect(op.node.data?.prompt).toBe('p');
  });

  it('builds update_node text input_prompt into data.prompt + prompt_content', () => {
    const op = buildUpdateNodeOpInput(
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      { input_prompt: 'next' },
      { kind: 'text', existingPayload: { content: 'body' } },
    );
    expect(op.op).toBe('update_node');
    if (op.op !== 'update_node') return;
    expect(op.node.id).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    expect(op.node.data?.prompt).toBe('next');
    expect(op.node.data?.prompt_content).toEqual([{ type: 'text', text: 'next' }]);
    expect(op.node.data?.content).toBe('body');
  });
});

describe('tool pending parse', () => {
  it('parses create/update/generate/skill_write', () => {
    const node = { id: '1', kind: 'image', revision: 1, position: { x: 0, y: 0 }, data: {} };
    expect(parseToolPendingOperation({ type: 'create', nodes: [node], edges: [] })?.type).toBe('create');
    expect(parseToolPendingOperation({ type: 'update', nodes: [node], edges: [] })?.type).toBe('update');
    expect(parseToolPendingOperation({ type: 'create', nodes: [], edges: [] })).toBeNull();
    expect(
      parseToolPendingOperation({
        type: 'generate',
        node,
        submit_args: {
          node_id: '1',
          kind: 'image',
          prompt: 'a cat',
          model_id: 'm1',
          ref_asset_ids: [1],
        },
      })?.type,
    ).toBe('generate');
    expect(
      parseToolPendingOperation({
        type: 'generate',
        node,
        submit_args: { ref_asset_ids: [1] },
      }),
    ).toBeNull();
    expect(
      parseToolPendingOperation({
        type: 'skill_write',
        path: 'skills/a.md',
        name: 'a',
        content: 'x',
      })?.type,
    ).toBe('skill_write');
  });

  it('builds toolPending from frame', () => {
    const node = { id: '1', kind: 'text', revision: 1, position: { x: 0, y: 0 }, data: {} };
    const state = toolPendingFromFrame({
      type: 'tool_pending',
      call_id: 'c1',
      name: 'apply_canvas_patch',
      summary: 'create',
      operation: { type: 'create', nodes: [node], edges: [] },
      enrich_status: 'ok',
    });
    expect(state?.operation?.type).toBe('create');
    expect(state?.enrich_status).toBe('ok');
  });

  it('marks malformed operation as enrich failed', () => {
    const state = toolPendingFromFrame({
      type: 'tool_pending',
      call_id: 'c2',
      name: 'submit_node_generation',
      summary: 'gen',
      operation: { type: 'generate', node: { id: '1' } },
      enrich_status: 'ok',
    });
    expect(state?.operation).toBeNull();
    expect(state?.enrich_status).toBe('failed');
    expect(state?.parse_error).toBe('malformed_operation');
  });
});
