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
  /** undefined=不改; null=清空本地旧 task_id */
  task_id?: number | null;
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
      const revision = op.node.revision ?? nodeRev.get(op.node.id);
      if (revision == null) {
        throw new MissingLocalRevisionError(`missing node revision for ${op.node.id}`);
      }
      return { ...op, node: { ...op.node, revision } };
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
  const seenOpIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [nodes, edges]);

  const enqueue = useCallback(<T,>(run: () => Promise<T>): Promise<T> => {
    const queued = commitQueueRef.current.then(run, run);
    commitQueueRef.current = queued.then(
      () => undefined,
      () => undefined,
    );
    return queued;
  }, []);

  const applyResultNow = useCallback(
    (delta: CanvasPatchEvent | CanvasPatchResult) => {
      const opId = 'op_id' in delta && delta.op_id != null ? String(delta.op_id) : null;
      if (opId) {
        if (seenOpIdsRef.current.has(opId)) return;
        seenOpIdsRef.current.add(opId);
        if (seenOpIdsRef.current.size > 200) {
          const oldest = seenOpIdsRef.current.values().next().value;
          if (oldest != null) seenOpIdsRef.current.delete(oldest);
        }
      }
      const prevNodes = nodesRef.current;
      const prevIds = new Set(prevNodes.map((n) => n.id));
      const prevRev = new Map(prevNodes.map((n) => [n.id, n.data.revision]));
      // 同 revision 不重复合并, 避免 HTTP 回写与 events 自回声双闪
      const filteredNodes = (delta.nodes ?? []).filter((n) => {
        const cur = prevRev.get(n.id);
        return cur == null || n.revision > cur;
      });
      const prevEdgeRev = new Map(edgesRef.current.map((e) => [e.id, e.data?.revision]));
      const filteredEdges = (delta.edges ?? []).filter((e) => {
        const cur = prevEdgeRev.get(e.id);
        return cur == null || e.revision > cur;
      });
      if (
        filteredNodes.length === 0 &&
        filteredEdges.length === 0 &&
        !(delta.deleted_node_ids?.length) &&
        !(delta.deleted_edge_ids?.length)
      ) {
        return;
      }
      const merged = applyCanvasPatchDelta(prevNodes, edgesRef.current, {
        nodes: filteredNodes,
        edges: filteredEdges,
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

  const applyResult = useCallback(
    (delta: CanvasPatchEvent | CanvasPatchResult) => {
      void enqueue(async () => {
        applyResultNow(delta);
      });
    },
    [enqueue, applyResultNow],
  );

  const applyNodeProgressNow = useCallback(
    (progress: GenerationProgressPatch) => {
      const current = nodesRef.current.find((n) => n.id === progress.node_id);
      if (current && progress.revision < current.data.revision) return;
      const nextNodes = nodesRef.current.map((n) => {
        if (n.id !== progress.node_id) return n;
        const payload = {
          ...(n.data.payload ?? {}),
          ...(progress.status ? { status: progress.status } : {}),
          ...(progress.task_id !== undefined
            ? { generate_task_id: progress.task_id ?? null }
            : {}),
        };
        const nextData: CanvasNodeData = {
          ...n.data,
          revision: progress.revision,
          ...(progress.status ? { status: progress.status } : {}),
          payload,
        };
        if (progress.task_id !== undefined) {
          nextData.task_id = progress.task_id ?? undefined;
        }
        return { ...n, data: nextData };
      });
      nodesRef.current = nextNodes;
      setNodes(nextNodes);
    },
    [setNodes],
  );

  const applyNodeProgress = useCallback(
    (progress: GenerationProgressPatch) => {
      void enqueue(async () => {
        applyNodeProgressNow(progress);
      });
    },
    [enqueue, applyNodeProgressNow],
  );

  const patchNodeData = useCallback(
    (nodeId: string, data: Partial<CanvasNodeData>) => {
      void enqueue(async () => {
        const current = nodesRef.current.find((n) => n.id === nodeId);
        if (current && data.revision != null && data.revision <= current.data.revision) {
          return;
        }
        const nextNodes = nodesRef.current.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n,
        );
        nodesRef.current = nextNodes;
        setNodes(nextNodes);
      });
    },
    [enqueue, setNodes],
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

  const replaceGraphQueued = useCallback(
    (nextNodes: CanvasFlowNode[], nextEdges: CanvasFlowEdge[]) =>
      enqueue(async () => {
        replaceGraph(nextNodes, nextEdges);
        return { nodes: nextNodes, edges: nextEdges };
      }),
    [enqueue, replaceGraph],
  );

  const commitOps = useCallback(
    (ops: CanvasPatchOpInput[]): Promise<CanvasPatchResult | null> => {
      if (ops.length === 0) return Promise.resolve(null);

      return enqueue(async (): Promise<CanvasPatchResult | null> => {
        try {
          const enriched = withExpectedRevisions(ops, nodesRef.current, edgesRef.current);
          const result = await patchCanvas(episodeId, { ops: enriched });
          applyResultNow(result);
          return result;
        } catch (err) {
          if (err instanceof MissingLocalRevisionError) {
            message.error(err.message || '本地缺少 revision，请刷新画布');
            return null;
          }
          if (isRevisionConflictError(err)) {
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
      });
    },
    [episodeId, applyResultNow, onRevisionConflict, enqueue],
  );

  return {
    commitOps,
    applyResult,
    applyNodeProgress,
    patchNodeData,
    replaceGraph,
    replaceGraphQueued,
  };
}
