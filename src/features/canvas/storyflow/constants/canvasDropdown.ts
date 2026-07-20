import type { DropdownProps } from 'antd';

export const WORKFLOW_CANVAS_DROPDOWN_OVERLAY = 'workflow-canvas-dropdown';
const MENU_CLASS = 'workflow-canvas-dropdown__menu';

type CanvasDropdownMenu = NonNullable<DropdownProps['menu']>;

export function canvasDropdownMenu(menu: CanvasDropdownMenu): CanvasDropdownMenu {
  const extraClass =
    typeof menu === 'object' && menu !== null && 'className' in menu ? menu.className : undefined;
  return {
    ...menu,
    className: extraClass ? `${MENU_CLASS} ${extraClass}` : MENU_CLASS,
  };
}

export function canvasDropdownProps(
  menu: CanvasDropdownMenu,
): Pick<DropdownProps, 'overlayClassName' | 'menu'> {
  return {
    overlayClassName: WORKFLOW_CANVAS_DROPDOWN_OVERLAY,
    menu: canvasDropdownMenu(menu),
  };
}
