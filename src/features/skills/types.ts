export type { TurnContentBlock, TurnMaterialBlock, TurnMediaBlock, TurnMediaOrigin, TurnMediaType, TurnNodeBlock, TurnSkillBlock, TurnTextBlock, TurnUserInput } from '../../api/turnContent';
export type { SkillWriteOperation, ToolPendingState } from '../../api/toolPending';

export type SkillSurface = 'chat' | 'canvas';

export type SkillScope = 'user' | 'project';

export type SkillDirMeta = {
  id: number;
  path: string;
  revision: number;
};

export type SkillFileMeta = {
  id: number;
  path: string;
  name: string;
  revision: number;
  enabled: boolean;
  description: string;
};

export type SkillTreeView = {
  dirs: SkillDirMeta[];
  files: SkillFileMeta[];
};

export type DualTreeView = {
  user: SkillTreeView;
  project: SkillTreeView | null;
};

export type SkillFileDetail = SkillFileMeta & {
  content: string;
};

export type SkillListItem = SkillFileMeta & {
  scope: SkillScope;
};
