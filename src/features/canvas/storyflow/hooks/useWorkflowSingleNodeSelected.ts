import { useCallback } from 'react';
import { useStore } from '@xyflow/react';
import { CONNECT_PREVIEW_NODE_ID } from '../constants';
import { isConnectPreviewNodeId } from '../utils/connectPreview';

/**
 * 当前节点是否为画布上唯一选中的节点。
 * 多选时各节点 props.selected 仍为 true，需结合 store 判断，避免浮层 Prompt 叠多个。
 */
export function useWorkflowSingleNodeSelected(
  nodeId: string,
  selected: boolean,
): boolean {
  return useStore(
    useCallback(
      state => {
        if (!selected) {
          return false;
        }
        let count = 0;
        let soleId: string | undefined;
        for (const node of state.nodes) {
          if (isConnectPreviewNodeId(node.id) || node.id === CONNECT_PREVIEW_NODE_ID) {
            continue;
          }
          if (!node.selected) {
            continue;
          }
          count += 1;
          soleId = node.id;
          if (count > 1) {
            return false;
          }
        }
        return count === 1 && soleId === nodeId;
      },
      [nodeId, selected],
    ),
  );
}
