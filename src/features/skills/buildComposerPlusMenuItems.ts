import type { MenuProps } from 'antd';

import type { ExpertDirectoryEntry, WorkshopConnectorEntry } from '../workshop/utils/expertDirectory';

export type ComposerPlusMenuBuildInput = {
  onUploadFile?: (file: File) => Promise<unknown> | unknown;
  skillsEnabled: boolean;
  skillsLoading: boolean;
  availableSkillLabels: Array<{ key: string; name: string; path: string }>;
  onSkillSelect: (path: string) => void;
  onSkillsManage: () => void;
  experts?: {
    loading: boolean;
    items: ExpertDirectoryEntry[];
    selectedKey?: string | null;
    onSelect: (key: string) => void;
    onBrowseMore: () => void;
    /** 子菜单标题；项目内发给房间成员时用「发给」 */
    menuLabel?: string;
  } | null;
  inviteExperts?: {
    loading: boolean;
    items: ExpertDirectoryEntry[];
    onInvite: (key: string) => void;
    onBrowseMore: () => void;
  } | null;
  connectors?: {
    loading: boolean;
    items: WorkshopConnectorEntry[];
    onSelect: (key: string) => void;
    onOpenDataSources?: () => void;
  } | null;
};

export type ComposerPlusMenuItemSpec = {
  key: string;
  label: string;
  children?: Array<{ key: string; label: string }>;
};

export function buildComposerPlusMenuSpecs(input: ComposerPlusMenuBuildInput): ComposerPlusMenuItemSpec[] {
  const items: ComposerPlusMenuItemSpec[] = [];

  if (input.onUploadFile) {
    items.push({ key: 'upload', label: '添加文件' });
  }

  if (input.experts) {
    const children: Array<{ key: string; label: string }> = [];
    if (input.experts.loading) {
      children.push({ key: 'experts-loading', label: '加载中…' });
    } else if (input.experts.items.length === 0) {
      children.push({ key: 'experts-empty', label: '暂无在场专家，请先邀请' });
    } else {
      for (const expert of input.experts.items) {
        children.push({
          key: `expert:${expert.key}`,
          label: expert.name,
        });
      }
    }
    children.push({ key: 'experts-more', label: '更多专家' });
    items.push({
      key: 'experts',
      label: input.experts.menuLabel ?? '专家',
      children,
    });
  }

  if (input.inviteExperts) {
    const children: Array<{ key: string; label: string }> = [];
    if (input.inviteExperts.loading) {
      children.push({ key: 'invite-loading', label: '加载中…' });
    } else if (input.inviteExperts.items.length === 0) {
      children.push({ key: 'invite-empty', label: '没有更多专家' });
    } else {
      for (const expert of input.inviteExperts.items) {
        children.push({
          key: `invite:${expert.key}`,
          label: expert.name,
        });
      }
    }
    children.push({ key: 'invite-more', label: '打开可邀请列表' });
    items.push({ key: 'invite', label: '邀请进项目', children });
  }

  if (input.skillsEnabled) {
    const children: Array<{ key: string; label: string }> = [];
    if (input.skillsLoading) {
      children.push({ key: 'skills-loading', label: '加载中…' });
    } else if (input.availableSkillLabels.length === 0) {
      children.push({ key: 'skills-empty', label: '暂无已启用的技能' });
    } else {
      for (const skill of input.availableSkillLabels) {
        children.push({ key: skill.key, label: skill.name });
      }
    }
    children.push({ key: 'skills-manage', label: '管理技能' });
    items.push({ key: 'skills', label: '技能', children });
  }

  if (input.connectors) {
    const children: Array<{ key: string; label: string }> = [];
    if (input.connectors.loading) {
      children.push({ key: 'connectors-loading', label: '加载中…' });
    } else if (input.connectors.items.length === 0) {
      children.push({ key: 'connectors-empty', label: '暂无连接器' });
    } else {
      for (const connector of input.connectors.items) {
        children.push({ key: `connector:${connector.key}`, label: connector.name });
      }
    }
    items.push({ key: 'connectors', label: '连接器', children });
  }

  return items;
}

export function composerPlusMenuHasRequiredEntries(specs: ComposerPlusMenuItemSpec[]): boolean {
  const labels = specs.map((item) => item.label);
  return (
    labels.includes('添加文件') &&
    (labels.includes('发给') || labels.includes('专家')) &&
    labels.includes('技能') &&
    !labels.includes('连接器') &&
    !labels.includes('邀请进项目')
  );
}

export function flattenMenuLabels(specs: ComposerPlusMenuItemSpec[]): string[] {
  const labels: string[] = [];
  for (const item of specs) {
    labels.push(item.label);
    for (const child of item.children ?? []) labels.push(child.label);
  }
  return labels;
}

/** 将菜单规格转为 antd Menu items */
export function toAntdMenuItems(
  specs: ComposerPlusMenuItemSpec[],
  handlers: {
    onUpload?: () => void;
    onExpert?: (key: string) => void;
    onExpertsMore?: () => void;
    onInviteExpert?: (key: string) => void;
    onInviteMore?: () => void;
    onSkill?: (path: string) => void;
    onSkillsManage?: () => void;
    onConnector?: (key: string) => void;
  },
): MenuProps['items'] {
  return specs.map((spec) => {
    if (spec.key === 'upload') {
      return { key: spec.key, label: spec.label, onClick: handlers.onUpload };
    }
    if (spec.key === 'experts') {
      return {
        key: spec.key,
        label: spec.label,
        children: spec.children?.map((child) => ({
          key: child.key,
          label: child.label,
          disabled: child.key === 'experts-loading' || child.key === 'experts-empty',
          onClick: () => {
            if (child.key === 'experts-more') handlers.onExpertsMore?.();
            else if (child.key.startsWith('expert:')) {
              handlers.onExpert?.(child.key.slice('expert:'.length));
            }
          },
        })),
      };
    }
    if (spec.key === 'invite') {
      return {
        key: spec.key,
        label: spec.label,
        children: spec.children?.map((child) => ({
          key: child.key,
          label: child.label,
          disabled: child.key === 'invite-loading' || child.key === 'invite-empty',
          onClick: () => {
            if (child.key === 'invite-more') handlers.onInviteMore?.();
            else if (child.key.startsWith('invite:')) {
              handlers.onInviteExpert?.(child.key.slice('invite:'.length));
            }
          },
        })),
      };
    }
    if (spec.key === 'skills') {
      return {
        key: spec.key,
        label: spec.label,
        children: spec.children?.map((child) => ({
          key: child.key,
          label: child.label,
          disabled: child.key === 'skills-loading' || child.key === 'skills-empty',
          onClick: () => {
            if (child.key === 'skills-manage') handlers.onSkillsManage?.();
            else if (child.key.startsWith('skill:')) {
              const path = child.key.split(':').slice(2).join(':');
              handlers.onSkill?.(path);
            }
          },
        })),
      };
    }
    if (spec.key === 'connectors') {
      return {
        key: spec.key,
        label: spec.label,
        children: spec.children?.map((child) => ({
          key: child.key,
          label: child.label,
          disabled: child.key === 'connectors-loading' || child.key === 'connectors-empty',
          onClick: () => {
            if (child.key.startsWith('connector:')) {
              handlers.onConnector?.(child.key.slice('connector:'.length));
            }
          },
        })),
      };
    }
    return { key: spec.key, label: spec.label };
  });
}
