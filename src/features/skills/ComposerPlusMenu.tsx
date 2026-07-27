import {
  PaperClipOutlined,
  PlusOutlined,
  SettingOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { useMemo, useRef, useState } from 'react';

import type { SkillListItem, SkillSurface } from './types';
import { useUserSkills } from './useUserSkills';

import styles from './ComposerPlusMenu.module.css';

export type ComposerPlusMenuSkillsProps = {
  surface: SkillSurface;
  projectId?: number | null;
  selectedPaths: string[];
  onSelectedPathsChange: (paths: string[]) => void;
  onManage: () => void;
};

export type ComposerPlusMenuProps = {
  disabled?: boolean;
  onUploadFile?: (file: File) => Promise<unknown> | unknown;
  skills?: ComposerPlusMenuSkillsProps | null;
};

/**
 * Composer「+」入口：一级菜单挂上传/技能，技能走二级列表。
 */
export function ComposerPlusMenu({
  disabled = false,
  onUploadFile,
  skills = null,
}: ComposerPlusMenuProps) {
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const skillQuery = useUserSkills({
    surface: skills?.surface ?? 'chat',
    projectId: skills?.projectId,
    enabled: skills != null,
  });

  const available = useMemo(() => {
    if (!skills) return [] as SkillListItem[];
    return skillQuery.enabledSkills.filter((item) => !skills.selectedPaths.includes(item.path));
  }, [skillQuery.enabledSkills, skills]);

  const items = useMemo(() => {
    const next: MenuProps['items'] = [];
    if (onUploadFile) {
      next.push({
        key: 'upload',
        icon: <PaperClipOutlined aria-hidden />,
        label: '图片 / 文件',
        onClick: () => {
          setOpen(false);
          // 等 dropdown 关闭后再唤起文件选择，避免焦点被菜单抢走
          window.setTimeout(() => fileInputRef.current?.click(), 0);
        },
      });
    }
    if (skills) {
      const skillChildren: MenuProps['items'] = [];
      if (skillQuery.loading) {
        skillChildren.push({ key: 'skills-loading', label: '加载中…', disabled: true });
      } else if (available.length === 0) {
        skillChildren.push({ key: 'skills-empty', label: '暂无已启用的技能', disabled: true });
      } else {
        for (const item of available) {
          skillChildren.push({
            key: `skill:${item.scope}:${item.path}`,
            label: (
              <span className={styles.skillItem}>
                <span className={styles.skillName}>{item.name}</span>
                <span className={styles.skillPath}>{item.path}</span>
              </span>
            ),
            onClick: () => {
              skills.onSelectedPathsChange([...skills.selectedPaths, item.path]);
              setOpen(false);
            },
          });
        }
      }
      skillChildren.push({ type: 'divider' });
      skillChildren.push({
        key: 'skills-manage',
        icon: <SettingOutlined aria-hidden />,
        label: '管理技能',
        onClick: () => {
          setOpen(false);
          skills.onManage();
        },
      });
      next.push({
        key: 'skills',
        icon: <ThunderboltOutlined aria-hidden />,
        label: '技能',
        children: skillChildren,
      });
    }
    return next;
  }, [available, onUploadFile, skillQuery.loading, skills]);

  if (!onUploadFile && !skills) {
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
