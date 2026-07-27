import { message } from 'antd';
import { useCallback, useEffect, useRef } from 'react';
import { patchCanvas } from '../api/canvas';
import { CANVAS_API_CODE, isCanvasApiError } from '../api/canvasErrors';
import type {
  CanvasNodeStatus,
  CanvasPatchEvent,
  CanvasPatchOp,
  CanvasPatchOpInput,
  CanvasPatchResult,
} from '../api/canvasTypes';
import { useCanvasProject } from '../context/CanvasProjectContext';
import { applyCanvasPatchDelta } from '../lib/applyCanvasPatchDelta';
import type { CanvasFlowEdge, CanvasFlowNode, CanvasNodeData } from '../schema/canvasSchema';

class MissingLocalRevisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MissingLocalRevisionError';
  }
}

export type CanvasRevisionSyncResult = {
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
};

export type GenerationProgressPatch = {
  node_id: string;
  revision: number;
  status?: CanvasNodeStatus;
  task_id?: number;
};

function isRevisionConflictError(err: unknown): boolean {
  if (!isCanvasApiError(err)) return false;
  if (err.code === CANVAS_API_CODE.REVISION_CONFLICT) return true;
  const details = err.details;
  if (!details || typeof details !== 'object') return false;
  if (details.error_type === 'revision_conflict') return true;
  return Array.isArray(details.conflicts) && details.conflicts.length > 0;
}

function withExpectedRevisions(
  ops: CanvasPatchOpInput[],
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): CanvasPatchOp[] {
  const nodeRev = new Map(nodes.map((n) => [n.id, n.data.revision]));
  const edgeRev = new Map(edges.map((e) => [e.id, e.data?.revision]));
  return ops.map((op): CanvasPatchOp => {
    if (op.op === 'update_node') {
      const expected_revision = nodeRev.get(op.node_id);
      if (expected_revision == null) {
        throw new MissingLocalRevisionError(`missing node revision for ${op.node_id}`);
      }
      return { ...op, expected_revision };
    }
    if (op.op === 'delete_node') {
      const expected_revision = nodeRev.get(op.node_id);
      if (expected_revision == null) {
        throw new MissingLocalRevisionError(`missing node revision for ${op.node_id}`);
      }
      return { ...op, expected_revision };
    }
    if (op.op === 'disconnect') {
      const expected_revision = edgeRev.get(op.edge_id);
      if (expected_revision == null) {
        throw new MissingLocalRevisionError(`missing edge revision for ${op.edge_id}`);
      }
      return { ...op, expected_revision };
    }
    return op;
  });
}

export function useCanvasPatch(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  setNodes: (n: CanvasFlowNode[]) => void,
  setEdges: (e: CanvasFlowEdge[]) => void,
  onRevisionConflict: () => Promise<CanvasRevisionSyncResult | null | void> | CanvasRevisionSyncResult | null | void,
) {
  const { episodeId } = useCanvasProject();
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const commitQueueRef = useRef(Promise.resolve());
  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [nodes, edges]);

  const applyResult = useCallback(
    (delta: CanvasPatchEvent | CanvasPatchResult) => {
      const prevNodes = nodesRef.current;
      const prevIds = new Set(prevNodes.map((n) => n.id));
      const merged = applyCanvasPatchDelta(prevNodes, edgesRef.current, {
        nodes: delta.nodes ?? [],
        edges: delta.edges ?? [],
        deleted_node_ids: delta.deleted_node_ids ?? [],
        deleted_edge_ids: delta.deleted_edge_ids ?? [],
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
    [setNodes, setEdges],
  );

  const applyNodeProgress = useCallback(
    (progress: GenerationProgressPatch) => {
      // 必须基于 nodesRef: 同次 hub 可能先 canvas_patch 再 progress, graphRef 常尚未跟上
      const nextNodes = nodesRef.current.map((n) =>
        n.id === progress.node_id
          ? {
              ...n,
              data: {
                ...n.data,
                revision: progress.revision,
                ...(progress.status ? { status: progress.status } : {}),
                ...(progress.task_id != null ? { task_id: progress.task_id } : {}),
              },
            }
          : n,
      );
      nodesRef.current = nextNodes;
      setNodes(nextNodes);
    },
    [setNodes],
  );

  const patchNodeData = useCallback(
    (nodeId: string, data: Partial<CanvasNodeData>) => {
      const nextNodes = nodesRef.current.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n,
      );
      nodesRef.current = nextNodes;
      setNodes(nextNodes);
    },
    [setNodes],
  );

  const replaceGraph = useCallback(
    (nextNodes: CanvasFlowNode[], nextEdges: CanvasFlowEdge[]) => {
      nodesRef.current = nextNodes;
      edgesRef.current = nextEdges;
      setNodes(nextNodes);
      setEdges(nextEdges);
    },
    [setNodes, setEdges],
  );

  const commitOps = useCallback(
    (ops: CanvasPatchOpInput[]): Promise<CanvasPatchResult | null> => {
      if (ops.length === 0) return Promise.resolve(null);

      const run = async (): Promise<CanvasPatchResult | null> => {
        try {
          const enriched = withExpectedRevisions(ops, nodesRef.current, edgesRef.current);
          const result = await patchCanvas(episodeId, { ops: enriched });
          applyResult(result);
          return result;
        } catch (err) {
          if (err instanceof MissingLocalRevisionError) {
            message.error(err.message || '本地缺少 revision，请刷新画布');
            return null;
          }
          if (isRevisionConflictError(err)) {
            // 必须 await 并同步写入 refs, 否则队列下一笔仍用旧 revision 自撞 409
            const refreshed = await onRevisionConflict();
            if (refreshed) {
              nodesRef.current = refreshed.nodes;
              edgesRef.current = refreshed.edges;
            }
            return null;
          }
          const msg = err instanceof Error ? err.message : '';
          message.error(msg || '保存画布失败');
          return null;
        }
      };

      const queued = commitQueueRef.current.then(run, run);
      commitQueueRef.current = queued.then(
        () => undefined,
        () => undefined,
      );
      return queued;
    },
    [episodeId, applyResult, onRevisionConflict],
  );

  return { commitOps, applyResult, applyNodeProgress, patchNodeData, replaceGraph };
}
