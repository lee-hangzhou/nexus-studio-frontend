import type { CanvasNodeKind } from '../api/canvasTypes';
import type { CanvasFlowNode } from '../schema/canvasSchema';

/** Nexus 画布节点均为可引用 id；空串不可选 */
export function isAgentPickableNodeId(nodeId: string): boolean {
  return nodeId.trim().length > 0;
}

export type AgentCanvasNodeRefView = {
  nodeId: string;
  kind: CanvasNodeKind | 'unknown';
  label: string;
  thumbSrc?: string;
  mediaType: 'text' | 'image' | 'video' | 'audio';
};

function kindFromNode(node?: CanvasFlowNode): CanvasNodeKind | 'unknown' {
  if (!node) return 'unknown';
  const kind = node.type ?? node.data.kind;
  if (kind === 'text' || kind === 'image' || kind === 'video' || kind === 'audio') {
    return kind;
  }
  return 'unknown';
}

/** 解析画布节点在 Agent 引用轨上的展示信息 */
export function resolveAgentCanvasNodeRefView(
  nodeId: string,
  node?: CanvasFlowNode,
): AgentCanvasNodeRefView {
  const kind = kindFromNode(node);
  const title = typeof node?.data.title === 'string' ? node.data.title.trim() : '';
  const thumbSrc = node?.data.output_asset_urls?.[0]?.trim() || undefined;

  if (kind === 'text') {
    return {
      nodeId,
      kind,
      mediaType: 'text',
      label: title || '文本',
    };
  }
  if (kind === 'image') {
    return {
      nodeId,
      kind,
      mediaType: 'image',
      label: title || '图片',
      thumbSrc,
    };
  }
  if (kind === 'video') {
    return {
      nodeId,
      kind,
      mediaType: 'video',
      label: title || '视频',
      thumbSrc,
    };
  }
  if (kind === 'audio') {
    return {
      nodeId,
      kind,
      mediaType: 'audio',
      label: title || '音频',
    };
  }
  return {
    nodeId,
    kind: 'unknown',
    mediaType: 'text',
    label: title || nodeId,
    thumbSrc,
  };
}
