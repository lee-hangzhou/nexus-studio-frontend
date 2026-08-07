import { PlusOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';
import { useCallback, useRef, useState } from 'react';
import type { CanvasNodeKind } from '../api/canvasTypes';
import { CanvasAssetLibraryPanel } from './CanvasAssetLibraryPanel';
import { CanvasFolderIcon } from './CanvasFolderIcon';
import { CanvasOperationAddMenu } from './CanvasOperationAddMenu';

type CanvasOperationBarProps = {
  disabled?: boolean;
  onAddNode: (kind: CanvasNodeKind) => void;
};

/** 画布左侧悬浮操作栏：新增节点 + 素材库 */
export function CanvasOperationBar({ disabled = false, onAddNode }: CanvasOperationBarProps) {
  const addNodeBtnRef = useRef<HTMLButtonElement>(null);
  const [addNodeMenuOpen, setAddNodeMenuOpen] = useState(false);
  const [assetLibraryOpen, setAssetLibraryOpen] = useState(false);

  const handleToggleAddNodeMenu = useCallback(() => {
    if (disabled) {
      return;
    }
    setAssetLibraryOpen(false);
    setAddNodeMenuOpen((open) => !open);
  }, [disabled]);

  const handleToggleAssetLibrary = useCallback(() => {
    if (disabled) {
      return;
    }
    setAddNodeMenuOpen(false);
    setAssetLibraryOpen((open) => !open);
  }, [disabled]);

  const handleSelectNode = useCallback(
    (kind: CanvasNodeKind) => {
      onAddNode(kind);
    },
    [onAddNode],
  );

  return (
    <>
      <aside className="canvas-operation-bar nodrag nopan" aria-label="画布操作栏">
        <Tooltip title="新增节点" placement="right" mouseEnterDelay={0.4}>
          <button
            ref={addNodeBtnRef}
            type="button"
            className={`canvas-operation-bar__btn${
              addNodeMenuOpen ? ' canvas-operation-bar__btn--active' : ''
            }`}
            aria-label="新增节点"
            aria-expanded={addNodeMenuOpen}
            aria-haspopup="menu"
            disabled={disabled}
            onClick={handleToggleAddNodeMenu}
          >
            <PlusOutlined />
          </button>
        </Tooltip>
        <Tooltip title="素材库" placement="right" mouseEnterDelay={0.4}>
          <button
            type="button"
            className={`canvas-operation-bar__btn${
              assetLibraryOpen ? ' canvas-operation-bar__btn--active' : ''
            }`}
            aria-label="素材库"
            aria-pressed={assetLibraryOpen}
            disabled={disabled}
            onClick={handleToggleAssetLibrary}
          >
            <CanvasFolderIcon />
          </button>
        </Tooltip>
      </aside>

      <CanvasOperationAddMenu
        open={addNodeMenuOpen}
        anchorRef={addNodeBtnRef}
        disabled={disabled}
        onSelectNode={handleSelectNode}
        onClose={() => setAddNodeMenuOpen(false)}
      />

      {assetLibraryOpen ? (
        <CanvasAssetLibraryPanel onClose={() => setAssetLibraryOpen(false)} />
      ) : null}
    </>
  );
}
