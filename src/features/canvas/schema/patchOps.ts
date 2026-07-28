import type { CanvasNodeKind, CanvasPatchOpInput } from '../api/canvasTypes';
import type { CanvasNodeData as ApiCanvasNodeData } from '../../../api/generated/canvas';
import {
  CLIENT_WRITABLE_FLAT_KEYS,
  foldFlatIntoNodeData,
  type FlatNodeFields,
} from './nodeFields';

type FlatPatch = Partial<FlatNodeFields> & {
  position?: { x: number; y: number };
  width?: number;
  height?: number;
  data?: ApiCanvasNodeData;
};

type UpdateOpOptions = {
  kind: CanvasNodeKind;
  existingPayload?: ApiCanvasNodeData | null;
  revision?: number;
};

/** 把 UI 扁平 patch 转成契约 update_node（revision 可稍后注入） */
export function buildUpdateNodeOpInput(
  nodeId: string,
  patch: FlatPatch,
  options: UpdateOpOptions,
): CanvasPatchOpInput {
  const flat: Partial<FlatNodeFields> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (CLIENT_WRITABLE_FLAT_KEYS.has(key)) {
      (flat as Record<string, unknown>)[key] = value;
    }
  }
  const hasFlat = Object.keys(flat).length > 0;
  if (patch.data && hasFlat) {
    throw new Error('update patch cannot mix data and flat fields');
  }
  const data =
    patch.data ??
    (hasFlat ? foldFlatIntoNodeData(options.kind, flat, options.existingPayload) : undefined);
  return {
    op: 'update_node',
    node: {
      id: nodeId,
      ...(options.revision != null ? { revision: options.revision } : {}),
      ...(patch.position ? { position: patch.position } : {}),
      ...(patch.width != null ? { width: patch.width } : {}),
      ...(patch.height != null ? { height: patch.height } : {}),
      ...(data ? { data } : {}),
    },
  };
}

export function buildCreateNodeOpInput(
  kind: CanvasNodeKind,
  position: { x: number; y: number },
  flat: Partial<FlatNodeFields> & { title?: string },
): CanvasPatchOpInput {
  return {
    op: 'create_node',
    node: {
      kind,
      position,
      data: foldFlatIntoNodeData(kind, {
        title: flat.title ?? '',
        input_prompt: flat.input_prompt ?? '',
        output_text: flat.output_text ?? '',
        model_id: flat.model_id,
        ratio: flat.ratio,
        duration_sec: flat.duration_sec,
        voice_id: flat.voice_id,
        resolution: flat.resolution,
      }),
    },
  };
}
