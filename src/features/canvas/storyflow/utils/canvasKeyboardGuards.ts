/** 焦点在节点内可编辑区域时，不响应画布级 Delete 删节点 */
export function isCanvasTextEditingTarget(): boolean {
  const el = document.activeElement;
  if (!(el instanceof HTMLElement)) {
    return false;
  }
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
    return true;
  }
  if (el.isContentEditable) {
    return true;
  }
  return Boolean(
    el.closest(
      '.canvas-prompt-editor, .workflow-text-rich-editor__textarea, .base-canvas-node__title-input',
    ),
  );
}
