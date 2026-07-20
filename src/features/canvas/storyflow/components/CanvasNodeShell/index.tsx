import { NodeResizer, useReactFlow, type NodeProps } from '@xyflow/react';
import type { ComponentType } from 'react';
import { memo, useCallback } from 'react';
import { useCanvasActions } from '../../context/CanvasActionsContext';
import { NODE_MIN_SIZE } from '../../constants';
import { workflowNodePropsAreEqual } from '../../utils/nodePropsEqual';
import { BaseCanvasNode } from '../BaseCanvasNode';
import { NodeShellConfig } from '../../nodeTypes';

type MaybeMemoComponent = ComponentType<NodeProps> & {
  $$typeof?: symbol;
};

/**
 * 在 nodeTypes 注册层统一包裹 BaseCanvasNode（含左右 + 连接点）。
 * 仅 shell.resizable === true 的节点（文本）渲染 NodeResizer。
 */
export function createWorkflowNode(
  Content: ComponentType<NodeProps<import('../../../schema/canvasSchema').CanvasFlowNode>>,
  shell: NodeShellConfig,
) {
  const isMemoContent = (Content as MaybeMemoComponent).$$typeof === Symbol.for('react.memo');
  const MemoContent = isMemoContent ? Content : memo(Content, workflowNodePropsAreEqual);

  const WorkflowNode = memo(function WorkflowNode(props: NodeProps<import('../../../schema/canvasSchema').CanvasFlowNode>) {
    const { id, data, selected, dragging } = props;
    const { setNodes } = useReactFlow();
    const { onNodeChange, snapshotBeforeChange } = useCanvasActions();

    const handleTitleChange = useCallback(
      (nextTitle: string) => {
        const current = typeof data.title === 'string' ? data.title : '';
        if (nextTitle === current) {
          return;
        }
        onNodeChange({ nodeId: id, patch: { title: nextTitle }, persist: 'immediate' });
      },
      [data.title, id, onNodeChange]
    );

    const onResizeStart = useCallback(() => {
      snapshotBeforeChange();
    }, [snapshotBeforeChange]);

    const onResizeEnd = useCallback(
      (_: unknown, params: { width: number; height: number }) => {
        setNodes(nds =>
          nds.map(n =>
            n.id === id ? { ...n, width: params.width, height: params.height } : n,
          ),
        );
      },
      [id, setNodes],
    );

    return (
      <>
        {shell.resizable ? (
          <NodeResizer
            isVisible={selected}
            minWidth={NODE_MIN_SIZE.width}
            minHeight={NODE_MIN_SIZE.height}
            onResizeStart={onResizeStart}
            onResizeEnd={onResizeEnd}
          />
        ) : null}
        <BaseCanvasNode
          title={typeof data.title === 'string' ? data.title : ''}
          onTitleChange={handleTitleChange}
          icon={shell.icon}
          variant={shell.variant}
          dragging={!!dragging}
          allowBodyOverflow={shell.allowBodyOverflow}
        >
          <MemoContent {...props} />
        </BaseCanvasNode>
      </>
    );
  }, workflowNodePropsAreEqual);

  return WorkflowNode;
}
