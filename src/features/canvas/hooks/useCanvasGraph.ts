import { useEdgesState, useNodesState, type Node, type NodeChange } from '@xyflow/react';
import { message } from 'antd';
import { useCallback, useEffect, useRef } from 'react';
import type { CanvasNodeKind, CanvasPatchOpInput, CanvasPatchResult } from '../api/canvasTypes';
import { DEFAULT_NODE_META } from '../schema/nodeDefaults';
import type { CanvasFlowEdge, CanvasFlowNode } from '../schema/canvasSchema';
import { buildCreateNodeOpInput, buildUpdateNodeOpInput } from '../schema/patchOps';
import { isCanvasTextEditingTarget } from '../storyflow/utils/canvasKeyboardGuards';
import { isConnectPreviewNodeId } from '../storyflow/utils/connectPreview';

const POSITION_DEBOUNCE_MS = 300;

export function useCanvasGraph(
  commitOps: (ops: CanvasPatchOpInput[]) => Promise<CanvasPatchResult | null>,
) {
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<CanvasFlowEdge>([]);
  const nodesRef = useRef(nodes);
  const positionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPosition = useRef<{ nodeId: string; x: number; y: number } | null>(null);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const flushPosition = useCallback(() => {
    const p = pendingPosition.current;
    pendingPosition.current = null;
    if (!p) return;
    const node = nodesRef.current.find((n) => n.id === p.nodeId);
    void commitOps([
      buildUpdateNodeOpInput(
        p.nodeId,
        { position: { x: p.x, y: p.y } },
        { kind: node?.data.kind ?? 'text', existingPayload: node?.data.payload },
      ),
    ]);
  }, [commitOps]);

  const onNodeDragStop = useCallback(
    (_: unknown, node: CanvasFlowNode | Node) => {
      const n = node as CanvasFlowNode;
      pendingPosition.current = {
        nodeId: n.id,
        x: n.position.x,
        y: n.position.y,
      };
      if (positionTimer.current) clearTimeout(positionTimer.current);
      positionTimer.current = setTimeout(() => {
        positionTimer.current = null;
        flushPosition();
      }, POSITION_DEBOUNCE_MS);
    },
    [flushPosition],
  );

  const addNodeAt = useCallback(
    async (kind: CanvasNodeKind, position: { x: number; y: number }) => {
      const meta = DEFAULT_NODE_META[kind];
      const result = await commitOps([
        buildCreateNodeOpInput(kind, position, {
          title: meta.title,
          input_prompt: '',
          output_text: '',
          model_id: meta.model_id,
          ratio: meta.ratio,
          duration_sec: meta.duration_sec,
        }),
      ]);
      return result != null;
    },
    [commitOps],
  );

  const deleteSelected = useCallback(
    async (selectedIds: string[]) => {
      const deletable: string[] = [];
      let blockedGenerating = false;

      for (const nodeId of selectedIds) {
        if (isConnectPreviewNodeId(nodeId)) {
          continue;
        }
        const node = nodesRef.current.find((item) => item.id === nodeId);
        if (!node) {
          continue;
        }
        if (node.data.generatePending || node.data.status === 'running') {
          blockedGenerating = true;
          continue;
        }
        deletable.push(nodeId);
      }

      if (blockedGenerating && deletable.length === 0) {
        message.warning('生成中的节点不能删除');
        return;
      }
      if (deletable.length === 0) {
        return;
      }

      await commitOps(deletable.map((node_id) => ({ op: 'delete_node', node_id })));
    },
    [commitOps],
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange<CanvasFlowNode>[]) => {
      const removeIds = changes
        .filter((change): change is NodeChange<CanvasFlowNode> & { type: 'remove'; id: string } => change.type === 'remove')
        .map((change) => change.id);
      const otherChanges = changes.filter((change) => change.type !== 'remove');

      if (otherChanges.length > 0) {
        onNodesChange(otherChanges);
      }

      if (removeIds.length === 0) {
        return;
      }
      if (isCanvasTextEditingTarget()) {
        return;
      }
      void deleteSelected(removeIds);
    },
    [deleteSelected, onNodesChange],
  );

  return {
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange: handleNodesChange,
    onEdgesChange,
    onNodeDragStop,
    addNodeAt,
    deleteSelected,
  };
}
