import { useCallback, useEffect, useMemo, useState } from 'react';
import { message } from 'antd';

import {
  getUserSkill,
  isUserSkillsApiError,
  listUserSkills,
  mkdirUserSkill,
  removeUserSkill,
  setUserSkillEnabled,
  USER_SKILLS_API_CODE,
  writeUserSkill,
} from './api/userSkillsApi';
import type { DualTreeView, SkillFileDetail, SkillListItem, SkillScope, SkillSurface } from './types';

function flattenEnabledSkills(tree: DualTreeView | null): SkillListItem[] {
  if (!tree) return [];
  // 同 path 时 project 覆盖 user，与后端 resolve 语义一致，菜单不重复
  const byPath = new Map<string, SkillListItem>();
  for (const file of tree.user.files) {
    if (file.enabled) byPath.set(file.path, { ...file, scope: 'user' });
  }
  for (const file of tree.project?.files ?? []) {
    if (file.enabled) byPath.set(file.path, { ...file, scope: 'project' });
  }
  return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
}

export function useUserSkills(options: {
  surface: SkillSurface;
  projectId?: number | null;
  enabled?: boolean;
}) {
  const { surface, projectId, enabled = true } = options;
  const [tree, setTree] = useState<DualTreeView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return null;
    setLoading(true);
    setError(null);
    try {
      const data = await listUserSkills({
        surface,
        ...(projectId != null ? { project_id: projectId } : {}),
      });
      setTree(data);
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载技能失败';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [enabled, projectId, surface]);

  useEffect(() => {
    if (!enabled) {
      setTree(null);
      return;
    }
    void refresh().catch(() => undefined);
  }, [enabled, refresh]);

  const handleRevisionConflict = useCallback(
    async (err: unknown): Promise<boolean> => {
      if (isUserSkillsApiError(err) && err.code === USER_SKILLS_API_CODE.REVISION_CONFLICT) {
        message.warning('技能已被其他操作更新，正在刷新…');
        await refresh().catch(() => undefined);
        return true;
      }
      return false;
    },
    [refresh],
  );

  const withMutation = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | null> => {
      try {
        const result = await fn();
        await refresh().catch(() => undefined);
        return result;
      } catch (err) {
        if (await handleRevisionConflict(err)) return null;
        throw err;
      }
    },
    [handleRevisionConflict, refresh],
  );

  const loadFile = useCallback(
    async (scope: SkillScope, path: string): Promise<SkillFileDetail | null> => {
      try {
        return await getUserSkill({
          surface,
          scope,
          path,
          ...(scope === 'project' && projectId != null ? { project_id: projectId } : {}),
        });
      } catch (err) {
        if (await handleRevisionConflict(err)) return null;
        throw err;
      }
    },
    [handleRevisionConflict, projectId, surface],
  );

  const writeFile = useCallback(
    async (params: {
      scope: SkillScope;
      path: string;
      name: string;
      description?: string;
      content?: string;
      revision?: number | null;
      id?: number | null;
    }) =>
      withMutation(() =>
        writeUserSkill({
          surface,
          ...params,
          ...(params.scope === 'project' && projectId != null ? { project_id: projectId } : {}),
        }),
      ),
    [projectId, surface, withMutation],
  );

  const removeFile = useCallback(
    async (scope: SkillScope, path: string, revision: number) =>
      withMutation(() =>
        removeUserSkill({
          surface,
          scope,
          path,
          revision,
          ...(scope === 'project' && projectId != null ? { project_id: projectId } : {}),
        }),
      ),
    [projectId, surface, withMutation],
  );

  const toggleEnabled = useCallback(
    async (scope: SkillScope, path: string, revision: number, nextEnabled: boolean) =>
      withMutation(() =>
        setUserSkillEnabled({
          surface,
          scope,
          path,
          enabled: nextEnabled,
          revision,
          ...(scope === 'project' && projectId != null ? { project_id: projectId } : {}),
        }),
      ),
    [projectId, surface, withMutation],
  );

  const mkdir = useCallback(
    async (scope: SkillScope, path: string) =>
      withMutation(() =>
        mkdirUserSkill({
          surface,
          scope,
          path,
          ...(scope === 'project' && projectId != null ? { project_id: projectId } : {}),
        }),
      ),
    [projectId, surface, withMutation],
  );

  const enabledSkills = useMemo(() => flattenEnabledSkills(tree), [tree]);

  return {
    tree,
    loading,
    error,
    enabledSkills,
    refresh,
    loadFile,
    writeFile,
    removeFile,
    toggleEnabled,
    mkdir,
    handleRevisionConflict,
  };
}
