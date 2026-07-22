import type { CSSProperties } from 'react';

export const authInputTheme = {
  components: {
    Input: {
      colorBgContainer: 'transparent',
      hoverBg: 'transparent',
      activeBg: 'transparent',
      colorBorder: 'rgba(255,255,255,0.12)',
      colorText: 'var(--studio-text)',
      colorTextPlaceholder: 'var(--studio-text-muted)',
      colorIcon: 'var(--studio-text-secondary)',
      colorIconHover: 'var(--studio-text)',
      activeBorderColor: 'rgba(240,179,91,0.7)',
      hoverBorderColor: 'rgba(255,255,255,0.28)',
      activeShadow: '0 0 0 2px rgba(240,179,91,0.14)',
    },
    Checkbox: {
      colorPrimary: 'var(--studio-primary)',
      colorPrimaryHover: 'var(--studio-primary-hover)',
    },
  },
};

/** affix wrapper（或独立 input）的行内样式 */
export const inputWrapperStyle: CSSProperties = {
  background: 'var(--studio-bg)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: 11,
  height: 46,
  boxShadow: 'none',
  color: 'var(--studio-text)',
};

/** 内层原生 <input> 的行内样式 */
export const inputInnerStyle: CSSProperties = {
  background: 'transparent',
  backgroundColor: 'transparent',
  color: 'var(--studio-text)',
};
