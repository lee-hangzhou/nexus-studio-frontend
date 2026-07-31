import {
  PaperClipOutlined,
  PlusOutlined,
  SettingOutlined,
  TeamOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { Avatar, Dropdown } from 'antd';
import { useMemo, useRef, useState } from 'react';

import type { ExpertDirectoryEntry } from '../workshop/utils/expertDirectory';
import {
  buildComposerPlusMenuSpecs,
  toAntdMenuItems,
} from './buildComposerPlusMenuItems';
import type { SkillListItem, SkillSurface } from './types';
import { useUserSkills } from './useUserSkills';

import styles from './ComposerPlusMenu.module.css';

export type ComposerPlusMenuSkillsProps = {
  surface: SkillSurface;
  projectId?: number | null;
  selectedPaths: string[];
  onSelectedPathsChange: (paths: string[]) => void;
  onManage: () => void;
  /** 由外层统一拉取时传入，避免与输入框 / 触发各拉一份 */
  enabledSkills?: SkillListItem[];
  skillsLoading?: boolean;
};

export type ComposerPlusMenuExpertsProps = {
  loading?: boolean;
  items: ExpertDirectoryEntry[];
  selectedKey?: string | null;
  onSelect: (expertKey: string) => void;
  onBrowseMore: () => void;
  menuLabel?: string;
};

export type ComposerPlusMenuProps = {
  disabled?: boolean;
  onUploadFile?: (file: File) => Promise<unknown> | unknown;
  skills?: ComposerPlusMenuSkillsProps | null;
  experts?: ComposerPlusMenuExpertsProps | null;
};

/**
 * Composer「+」入口：添加文件 / 发给 / 技能。
 * 邀请专家与连接器在右侧详情面板管理，不出现在此处。
 */
export function ComposerPlusMenu({
  disabled = false,
  onUploadFile,
  skills = null,
  experts = null,
}: ComposerPlusMenuProps) {
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ownsSkillQuery = skills != null && skills.enabledSkills == null;
  const skillQuery = useUserSkills({
    surface: skills?.surface ?? 'chat',
    projectId: skills?.projectId,
    enabled: ownsSkillQuery,
  });
  const enabledSkills = skills?.enabledSkills ?? skillQuery.enabledSkills;
  const skillsLoading = skills?.skillsLoading ?? skillQuery.loading;

  const available = useMemo(() => {
    if (!skills) return [] as SkillListItem[];
    return enabledSkills.filter((item) => !skills.selectedPaths.includes(item.path));
  }, [enabledSkills, skills]);

  const menuSpecs = useMemo(
    () =>
      buildComposerPlusMenuSpecs({
        onUploadFile,
        skillsEnabled: skills != null,
        skillsLoading,
        availableSkillLabels: available.map((item) => ({
          key: `skill:${item.scope}:${item.path}`,
          name: item.name,
          path: item.path,
        })),
        onSkillSelect: (path) => skills?.onSelectedPathsChange([...skills.selectedPaths, path]),
        onSkillsManage: () => skills?.onManage(),
        experts: experts
          ? {
              loading: experts.loading ?? false,
              items: experts.items,
              selectedKey: experts.selectedKey,
              onSelect: experts.onSelect,
              onBrowseMore: experts.onBrowseMore,
              menuLabel: experts.menuLabel,
            }
          : null,
        inviteExperts: null,
        connectors: null,
      }),
    [available, experts, onUploadFile, skills, skillsLoading],
  );

  const items = useMemo(
    () =>
      toAntdMenuItems(menuSpecs, {
        onUpload: () => {
          setOpen(false);
          window.setTimeout(() => fileInputRef.current?.click(), 0);
        },
        onExpert: (key) => {
          experts?.onSelect(key);
          setOpen(false);
        },
        onExpertsMore: () => {
          experts?.onBrowseMore();
          setOpen(false);
        },
        onSkill: (path) => {
          if (!skills) return;
          skills.onSelectedPathsChange([...skills.selectedPaths, path]);
          setOpen(false);
        },
        onSkillsManage: () => {
          skills?.onManage();
          setOpen(false);
        },
      })?.map((item) => {
        if (item && 'key' in item && item.key === 'upload') {
          return {
            ...item,
            icon: <PaperClipOutlined aria-hidden />,
            label: '添加文件',
          };
        }
        if (item && 'key' in item && item.key === 'experts' && 'children' in item) {
          const expertChildren = item.children ?? [];
          return {
            ...item,
            icon: <TeamOutlined aria-hidden />,
            children: expertChildren.map((child) => {
              if (!child || !('key' in child)) return child;
              if (typeof child.key !== 'string' || !child.key.startsWith('expert:')) return child;
              const expertKey = child.key.slice('expert:'.length);
              const expert = experts?.items.find((row) => row.key === expertKey);
              if (!expert) return child;
              return {
                ...child,
                label: (
                  <span className={styles.expertItem}>
                    <Avatar size={20} src={expert.avatar_url} alt="">
                      {expert.name.slice(0, 1)}
                    </Avatar>
                    <span className={styles.expertName}>{expert.name}</span>
                  </span>
                ),
              };
            }),
          };
        }
        if (item && 'key' in item && item.key === 'skills') {
          return {
            ...item,
            icon: <ThunderboltOutlined aria-hidden />,
            children: ('children' in item ? item.children ?? [] : []).map((child) => {
              if (!child || !('key' in child)) return child;
              if (child.key !== 'skills-manage') return child;
              return { ...child, icon: <SettingOutlined aria-hidden /> };
            }),
          };
        }
        return item;
      }),
    [experts, menuSpecs, skills],
  );

  if (!onUploadFile && !skills && !experts) {
    return null;
  }

  return (
    <>
      {onUploadFile ? (
        <input
          ref={fileInputRef}
          type="file"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void onUploadFile(file);
          }}
        />
      ) : null}
      <Dropdown
        trigger={['click']}
        placement="topLeft"
        open={open}
        onOpenChange={setOpen}
        disabled={disabled}
        menu={{ items, className: styles.menu }}
      >
        <button
          type="button"
          className={styles.trigger}
          disabled={disabled}
          aria-label="添加内容"
          aria-expanded={open}
        >
          <PlusOutlined aria-hidden />
        </button>
      </Dropdown>
    </>
  );
}
