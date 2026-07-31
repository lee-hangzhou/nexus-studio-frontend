import { CheckOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { Dropdown } from 'antd';
import { useMemo, useState, type ReactNode } from 'react';

export type CanvasAgentMode = 'auto' | 'manual';

type TurnModeOption = {
  value: CanvasAgentMode;
  label: string;
  description: string;
  icon: ReactNode;
};

function HandIcon() {
  return (
    <svg width="1em" height="1em" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3.83328 4.33301C3.83331 3.87629 4.01456 3.43819 4.33751 3.11523C4.66047 2.79228 5.09856 2.61102 5.55528 2.611C5.81881 2.611 6.07597 2.6717 6.30854 2.78483C6.3732 2.44946 6.53688 2.13825 6.78185 1.89323C7.10483 1.57025 7.54318 1.38867 7.99994 1.38867C8.45665 1.38871 8.89478 1.57029 9.21772 1.89323C9.46267 2.13824 9.62603 2.44948 9.6907 2.78483C9.92334 2.67161 10.1806 2.611 10.4443 2.611C10.901 2.61101 11.3391 2.79229 11.6621 3.11523C11.9071 3.36028 12.0704 3.67172 12.135 4.00716C12.3677 3.89391 12.625 3.83302 12.8886 3.83301C13.3454 3.83301 13.7834 4.01461 14.1064 4.33757C14.4294 4.66054 14.6109 5.09858 14.6109 5.55534V9.22201C14.6109 10.6512 14.0431 12.0219 13.0325 13.0326C12.0219 14.0431 10.6512 14.611 9.22195 14.611H7.99994C6.15443 14.611 4.98945 14.0313 3.98692 13.0355L3.98562 13.0345L1.78575 10.8343C1.77978 10.8283 1.77383 10.8223 1.76817 10.8161C1.47193 10.488 1.31319 10.0584 1.32481 9.61654C1.33647 9.17459 1.51751 8.75379 1.83067 8.44173C2.14384 8.12969 2.56514 7.9502 3.00711 7.9401C3.29644 7.9335 3.58004 8.00011 3.83328 8.13021V4.33301ZM6.27761 7.08301V4.33301L6.27403 4.26172C6.25761 4.09639 6.18453 3.94077 6.06603 3.82227C5.93059 3.68688 5.74679 3.611 5.55528 3.611C5.36377 3.61102 5.17997 3.68685 5.04454 3.82227C4.90912 3.95768 4.83331 4.1415 4.83328 4.33301V9.01497L5.2978 9.47949C5.49303 9.67473 5.49298 9.99126 5.2978 10.1865C5.10253 10.3818 4.78603 10.3818 4.59077 10.1865L3.98269 9.57845C3.9805 9.5763 3.97833 9.57413 3.97618 9.57194L3.53022 9.12598C3.39329 9.00234 3.21439 8.93557 3.02989 8.93978C2.84461 8.94401 2.66804 9.01929 2.53673 9.15007C2.4054 9.28093 2.32938 9.45757 2.32449 9.6429C2.3197 9.82581 2.38465 10.0034 2.5058 10.1403L4.69135 12.3262H4.69168C5.51025 13.1392 6.42327 13.611 7.99994 13.611H9.22195C10.3859 13.611 11.5024 13.1486 12.3255 12.3255C13.1485 11.5024 13.6109 10.386 13.6109 9.22201V5.55534C13.6109 5.36379 13.5348 5.18004 13.3994 5.0446C13.2639 4.90917 13.0801 4.83301 12.8886 4.83301C12.6971 4.83302 12.5133 4.90917 12.3779 5.0446C12.2425 5.18004 12.1666 5.36381 12.1666 5.55534V7.38867C12.1666 7.66476 11.9427 7.88859 11.6666 7.88867C11.3905 7.88867 11.1666 7.66481 11.1666 7.38867V4.33301C11.1666 4.1415 11.0904 3.95768 10.955 3.82227C10.8196 3.68685 10.6358 3.61101 10.4443 3.611C10.2528 3.611 10.069 3.68687 9.93354 3.82227C9.79812 3.95768 9.72198 4.1415 9.72195 4.33301V6.77767C9.72189 7.05376 9.49806 7.27767 9.22195 7.27767C8.94587 7.27764 8.72201 7.05374 8.72195 6.77767V3.111C8.72195 2.91946 8.6458 2.7357 8.51036 2.60026C8.37496 2.46487 8.19142 2.38871 7.99994 2.38867C7.80841 2.38867 7.62464 2.46483 7.4892 2.60026C7.35376 2.7357 7.27761 2.91946 7.27761 3.111V7.08301C7.27761 7.35913 7.05374 7.58298 6.77761 7.58301C6.50147 7.58301 6.27761 7.35915 6.27761 7.08301Z"
        fill="currentColor"
      />
    </svg>
  );
}

const TURN_MODE_OPTIONS: TurnModeOption[] = [
  {
    value: 'auto',
    label: '自动生成',
    description: '自动规划并执行',
    icon: <ThunderboltOutlined />,
  },
  {
    value: 'manual',
    label: '手动确认',
    description: '执行写操作前先征求你的确认',
    icon: <HandIcon />,
  },
];

export type CanvasAgentTurnModeMenuProps = {
  value: CanvasAgentMode;
  onChange: (value: CanvasAgentMode) => void;
  disabled?: boolean;
};

/** 运行模式：chip 触发 + 纵向选项列表（对齐 storyflow CanvasAgentTurnModeMenu） */
export function CanvasAgentTurnModeMenu({
  value,
  onChange,
  disabled = false,
}: CanvasAgentTurnModeMenuProps) {
  const [open, setOpen] = useState(false);
  const active = useMemo(
    () => TURN_MODE_OPTIONS.find((item) => item.value === value) ?? TURN_MODE_OPTIONS[0],
    [value],
  );

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      trigger={['click']}
      placement="topLeft"
      disabled={disabled}
      overlayClassName="workflow-canvas-agent-panel__turn-mode-dropdown"
      dropdownRender={() => (
        <div className="workflow-canvas-agent-panel__turn-mode-menu" role="menu">
          {TURN_MODE_OPTIONS.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                className={`workflow-canvas-agent-panel__turn-mode-menu-item${
                  selected ? ' is-active' : ''
                }`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span className="workflow-canvas-agent-panel__turn-mode-menu-icon" aria-hidden>
                  {option.icon}
                </span>
                <span className="workflow-canvas-agent-panel__turn-mode-menu-text">
                  <span className="workflow-canvas-agent-panel__turn-mode-menu-title">
                    {option.label}
                  </span>
                  <span className="workflow-canvas-agent-panel__turn-mode-menu-desc">
                    {option.description}
                  </span>
                </span>
                <span className="workflow-canvas-agent-panel__turn-mode-menu-check" aria-hidden>
                  {selected ? <CheckOutlined /> : null}
                </span>
              </button>
            );
          })}
        </div>
      )}
    >
      <button
        type="button"
        className="workflow-canvas-agent-panel__turn-mode-chip"
        disabled={disabled}
        aria-label="运行模式"
        aria-expanded={open}
      >
        <span className="workflow-canvas-agent-panel__turn-mode-chip-icon" aria-hidden>
          {active.icon}
        </span>
        <span>{active.label}</span>
      </button>
    </Dropdown>
  );
}
