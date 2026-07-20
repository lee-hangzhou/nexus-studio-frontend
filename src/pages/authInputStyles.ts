import type { CSSProperties } from 'react';

export const authInputTheme = {
  components: {
    Input: {
      colorBgContainer: 'transparent',
      hoverBg: 'transparent',
      activeBg: 'transparent',
      colorBorder: 'rgba(255,255,255,0.15)',
      colorText: '#ffffff',
      colorTextPlaceholder: 'rgba(255,255,255,0.4)',
      colorIcon: 'rgba(255,255,255,0.5)',
      colorIconHover: 'rgba(255,255,255,0.8)',
      activeBorderColor: 'rgba(99,179,237,0.7)',
      hoverBorderColor: 'rgba(255,255,255,0.28)',
      activeShadow: '0 0 0 2px rgba(99,179,237,0.12)',
    },
  },
};

/** affix wrapper（或独立 input）的行内样式 */
export const inputWrapperStyle: CSSProperties = {
  background: 'rgba(255, 255, 255, 0.08)',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  borderRadius: 12,
  height: 44,
  boxShadow: 'none',
  color: '#fff',
};

/** 内层原生 <input> 的行内样式 */
export const inputInnerStyle: CSSProperties = {
  background: 'transparent',
  backgroundColor: 'transparent',
  color: '#fff',
};
