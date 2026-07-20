import type { WorkflowNodeType } from '../types';

/** 画布全部节点类型（顺序稳定，供菜单渲染） */
export const WORKFLOW_NODE_TYPES: WorkflowNodeType[] = ['text', 'image', 'video', 'audio'];

/**
 * 某类型节点允许的前置节点类型（边：前置 → 当前）。
 * text：text、image、video；image：text、image；audio：text；video：text、image、audio、video
 */
const ALLOWED_PREDECESSORS: Record<WorkflowNodeType, readonly WorkflowNodeType[]> = {
  text: ['text'],
  image: ['text', 'image'],
  audio: ['text'],
  video: ['text', 'image', 'audio', 'video'],
};

/**
 * 某类型节点允许的后置节点类型（边：当前 → 后置）。
 * text：全部；image：text、image、video；audio：video；video：text、video
 */
const ALLOWED_SUCCESSORS: Record<WorkflowNodeType, readonly WorkflowNodeType[]> = {
  text: ['text', 'image', 'video', 'audio'],
  image: ['text', 'image', 'video'],
  audio: ['video'],
  video: ['video'],
};

/** 可作为 anchor 的前置节点类型（左侧拉出 / target handle） */
export function getAllowedPredecessorTypes(anchorType: WorkflowNodeType): WorkflowNodeType[] {
  return [...ALLOWED_PREDECESSORS[anchorType]];
}

/** 可作为 anchor 的后置节点类型（右侧拉出 / source handle） */
export function getAllowedSuccessorTypes(anchorType: WorkflowNodeType): WorkflowNodeType[] {
  return [...ALLOWED_SUCCESSORS[anchorType]];
}

/** 拖线落点新建节点时，按 handle 方向返回可选类型 */
export function getSpawnTypesForHandle(
  anchorType: WorkflowNodeType,
  handleSide: 'left' | 'right'
): WorkflowNodeType[] {
  return handleSide === 'left'
    ? getAllowedPredecessorTypes(anchorType)
    : getAllowedSuccessorTypes(anchorType);
}

/** 已有节点之间连线：source → target，source 须为 target 的合法前置类型 */
export function canConnectNodes(
  sourceType: WorkflowNodeType,
  targetType: WorkflowNodeType
): boolean {
  return ALLOWED_PREDECESSORS[targetType].includes(sourceType);
}

/** 是否已存在相同 source → target 的有向边（禁止重复连线） */
export function hasDirectedEdge(
  edges: readonly { source: string; target: string }[],
  source: string,
  target: string
): boolean {
  return edges.some(e => e.source === source && e.target === target);
}

/** 根据拉出 handle 方向得到有向边的 source / target */
export function getConnectionEndpoints(
  fromNodeId: string,
  fromHandleId: 'left' | 'right',
  toNodeId: string
): { source: string; target: string } {
  return fromHandleId === 'right'
    ? { source: fromNodeId, target: toNodeId }
    : { source: toNodeId, target: fromNodeId };
}

/** 校验两节点间是否允许建立一条有向连线（类型、重复边、自环） */
export function isValidNodeConnection(
  source: string,
  target: string,
  nodes: readonly { id: string; type?: string | null }[],
  edges: readonly { source: string; target: string }[]
): boolean {
  if (!source || !target || source === target) {
    return false;
  }
  if (hasDirectedEdge(edges, source, target)) {
    return false;
  }
  const sourceType = getNodeWorkflowType(nodes.find(n => n.id === source));
  const targetType = getNodeWorkflowType(nodes.find(n => n.id === target));
  if (!sourceType || !targetType) {
    return false;
  }
  return canConnectNodes(sourceType, targetType);
}

/** 两节点间连线的 source/target 与左右 handle（与预览边一致） */
export function buildNodePairConnection(
  fromNodeId: string,
  fromHandleId: 'left' | 'right',
  toNodeId: string,
): { source: string; target: string; sourceHandle: 'right'; targetHandle: 'left' } {
  const { source, target } = getConnectionEndpoints(fromNodeId, fromHandleId, toNodeId);
  return { source, target, sourceHandle: 'right', targetHandle: 'left' };
}

export function buildDataDependencyPorts(
  sourceType: WorkflowNodeType,
  _targetType: WorkflowNodeType,
): {
  source_port: 'output_text' | 'output_asset';
  target_port: 'prompt_input' | 'reference_asset';
  edge_type: 'dependency';
} {
  if (sourceType === 'text') {
    return { source_port: 'output_text', target_port: 'prompt_input', edge_type: 'dependency' };
  }
  return { source_port: 'output_asset', target_port: 'reference_asset', edge_type: 'dependency' };
}

/** 拖线时悬停目标节点：该节点是否可作为合法连线终点 */
export function canConnectNodePair(
  fromNodeId: string,
  fromHandleId: 'left' | 'right',
  toNodeId: string,
  nodes: readonly { id: string; type?: string | null }[],
  edges: readonly { source: string; target: string }[]
): boolean {
  const { source, target } = getConnectionEndpoints(fromNodeId, fromHandleId, toNodeId);
  return isValidNodeConnection(source, target, nodes, edges);
}

export function getNodeWorkflowType(
  node: { type?: string | null } | undefined
): WorkflowNodeType | null {
  const t = node?.type;
  if (t === 'text' || t === 'image' || t === 'video' || t === 'audio') {
    return t;
  }
  return null;
}
