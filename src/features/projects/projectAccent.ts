import type { CSSProperties } from 'react';
import type { ProjectView } from '../../api/projects';

const PROJECT_PALETTES = [
  { base: '#26302c', accent: '#485d4f' },
  { base: '#30282d', accent: '#5d4650' },
  { base: '#2b2c35', accent: '#4e5268' },
  { base: '#332d25', accent: '#62513d' },
] as const;

/** 画布卡片缩略底色；Projects / Foyer 共用，避免两处分叉。 */
export function projectAccentStyle(project: Pick<ProjectView, 'id'>): CSSProperties {
  const palette = PROJECT_PALETTES[project.id % PROJECT_PALETTES.length];
  return {
    backgroundColor: palette.base,
    backgroundImage:
      `linear-gradient(135deg, transparent 0 46%, ${palette.accent} 46% 58%, transparent 58%), ` +
      'repeating-linear-gradient(90deg, transparent 0 28px, rgba(255,255,255,0.035) 28px 29px)',
  };
}
