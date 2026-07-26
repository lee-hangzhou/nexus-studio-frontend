import { message } from 'antd';
import { useCallback, useEffect, useRef } from 'react';
import { patchCanvas } from '../api/canvas';
import type { CanvasPatchOp, CanvasPatchResult } from '../api/canvasTypes';
import { useCanvasProject } from '../context/CanvasProjectContext';
import { applyCanvasPatchDelta } from '../lib/applyCanvasPatchDelta';
import type { CanvasFlowEdge, CanvasFlowNode } from '../schema/canvasSchema';

export function useCanvasPatch(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  setNodes: (n: CanvasFlowNode[]) => void,
  setEdges: (e: CanvasFlowEdge[]) => void,
  onRevisionConflict: () => void | Promise<void>,
) {
  const { episodeId, revisionRef, setRevision } = useCanvasProject();
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [nodes, edges]);

  const applyResult = useCallback(
    (result: CanvasPatchResult) => {
      setRevision(result.revision);
      const prevNodes = nodesRef.current;
      const prevIds = new Set(prevNodes.map((n) => n.id));
      const merged = applyCanvasPatchDelta(prevNodes, edgesRef.current, {
        revision: result.revision,
        nodes: result.nodes,
        edges: result.edges,
        deleted_node_ids: result.deleted_node_ids,
        deleted_edge_ids: result.deleted_edge_ids,
      });
      nodesRef.current = merged.nodes;
      edgesRef.current = merged.edges;
      const createdIds = new Set(merged.nodes.filter((n) => !prevIds.has(n.id)).map((n) => n.id));
      setNodes(
        merged.nodes.map((n) => ({
          ...n,
          selected: createdIds.size > 0 ? createdIds.has(n.id) : (n.selected ?? false),
        })),
      );
      setEdges(merged.edges);
    },
    [setNodes, setEdges, setRevision],
  );

  const commitOps = useCallback(
    async (ops: CanvasPatchOp[]): Promise<CanvasPatchResult | null> => {
      if (ops.length === 0) return null;
      try {
        const result = await patchCanvas(episodeId, {
          expected_revision: revisionRef.current,
          ops,
        });
        applyResult(result);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('revision') || msg.includes('冲突') || msg.includes('409')) {
          void onRevisionConflict();
        } else {
          message.error(msg || '保存画布失败');
        }
        return null;
      }
    },
    [episodeId, revisionRef, applyResult, onRevisionConflict],
  );

  return { commitOps, applyResult };
}
