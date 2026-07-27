import { DeleteOutlined, EditOutlined, FolderAddOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Form, Input, Modal, Switch, Tabs, message } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { SkillFileDetail, SkillFileMeta, SkillScope, SkillSurface } from './types';
import { useUserSkills } from './useUserSkills';

import styles from './SkillManageModal.module.css';

const { TextArea } = Input;

type SkillManageModalProps = {
  open: boolean;
  onClose: () => void;
  surface: SkillSurface;
  projectId?: number | null;
};

type EditorState = {
  scope: SkillScope;
  path: string;
  name: string;
  description: string;
  content: string;
  revision: number | null;
  id: number | null;
  isNew: boolean;
};

function emptyEditor(scope: SkillScope): EditorState {
  return {
    scope,
    path: '',
    name: '',
    description: '',
    content: '',
    revision: null,
    id: null,
    isNew: true,
  };
}

function editorFromDetail(scope: SkillScope, detail: SkillFileDetail): EditorState {
  return {
    scope,
    path: detail.path,
    name: detail.name,
    description: detail.description,
    content: detail.content,
    revision: detail.revision,
    id: detail.id,
    isNew: false,
  };
}

function filesForScope(
  tree: ReturnType<typeof useUserSkills>['tree'],
  scope: SkillScope,
): SkillFileMeta[] {
  if (!tree) return [];
  if (scope === 'user') return tree.user.files;
  return tree.project?.files ?? [];
}

export function SkillManageModal({ open, onClose, surface, projectId }: SkillManageModalProps) {
  const skills = useUserSkills({ surface, projectId, enabled: open });
  const [activeScope, setActiveScope] = useState<SkillScope>('user');
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [mkdirPath, setMkdirPath] = useState('');

  useEffect(() => {
    if (!open) {
      setEditor(null);
      setMkdirPath('');
      setActiveScope('user');
    }
  }, [open]);

  const files = useMemo(() => filesForScope(skills.tree, activeScope), [activeScope, skills.tree]);

  const openCreate = useCallback(() => {
    setEditor(emptyEditor(activeScope));
  }, [activeScope]);

  const openEdit = useCallback(
    async (file: SkillFileMeta) => {
      setLoadingFile(true);
      try {
        const detail = await skills.loadFile(activeScope, file.path);
        if (!detail) return;
        setEditor(editorFromDetail(activeScope, detail));
      } catch (err) {
        message.error(err instanceof Error ? err.message : '读取技能失败');
      } finally {
        setLoadingFile(false);
      }
    },
    [activeScope, skills],
  );

  const handleSave = async () => {
    if (!editor) return;
    const path = editor.path.trim();
    const name = editor.name.trim();
    if (!path || !name) {
      message.warning('请填写路径和名称');
      return;
    }
    setSaving(true);
    try {
      const result = await skills.writeFile({
        scope: editor.scope,
        path,
        name,
        description: editor.description,
        content: editor.content,
        revision: editor.isNew ? null : editor.revision,
        id: editor.isNew ? null : editor.id,
      });
      if (result == null) return;
      message.success(editor.isNew ? '技能已创建' : '技能已保存');
      setEditor(null);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (file: SkillFileMeta) => {
    Modal.confirm({
      title: '删除技能',
      content: `确定删除「${file.name}」（${file.path}）？此操作不可撤销。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const result = await skills.removeFile(activeScope, file.path, file.revision);
          if (result == null) return;
          message.success('已删除');
          if (editor?.path === file.path) setEditor(null);
        } catch (err) {
          message.error(err instanceof Error ? err.message : '删除失败');
        }
      },
    });
  };

  const handleToggle = async (file: SkillFileMeta, enabled: boolean) => {
    try {
      await skills.toggleEnabled(activeScope, file.path, file.revision, enabled);
    } catch (err) {
      message.error(err instanceof Error ? err.message : '更新启用状态失败');
    }
  };

  const handleMkdir = async () => {
    const path = mkdirPath.trim();
    if (!path) {
      message.warning('请输入目录路径');
      return;
    }
    try {
      const result = await skills.mkdir(activeScope, path);
      if (result == null) return;
      message.success('目录已创建');
      setMkdirPath('');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '创建目录失败');
    }
  };

  const tabItems = [
    {
      key: 'user',
      label: '个人',
      children: null,
    },
    ...(projectId != null
      ? [
          {
            key: 'project',
            label: '项目',
            children: null,
          },
        ]
      : []),
  ];

  return (
    <Modal
      title="管理技能"
      open={open}
      onCancel={onClose}
      footer={null}
      width={720}
      destroyOnHidden
      className={styles.modal}
    >
      <Tabs
        activeKey={activeScope}
        items={tabItems}
        onChange={(key) => {
          setActiveScope(key as SkillScope);
          setEditor(null);
        }}
      />

      <div className={styles.layout}>
        <section className={styles.listPane} aria-label="技能列表">
          <div className={styles.toolbar}>
            <Button size="small" icon={<PlusOutlined />} onClick={openCreate}>
              新建
            </Button>
            <div className={styles.mkdirRow}>
              <Input
                size="small"
                value={mkdirPath}
                onChange={(e) => setMkdirPath(e.target.value)}
                placeholder="目录路径，如 prompts/"
                aria-label="新建目录路径"
              />
              <Button size="small" icon={<FolderAddOutlined />} onClick={() => void handleMkdir()}>
                目录
              </Button>
            </div>
          </div>

          {skills.loading ? <p className={styles.hint}>加载中…</p> : null}
          {!skills.loading && files.length === 0 ? (
            <p className={styles.hint}>暂无技能文件</p>
          ) : null}

          <ul className={styles.fileList}>
            {files.map((file) => (
              <li key={file.id} className={styles.fileItem}>
                <div className={styles.fileMeta}>
                  <span className={styles.fileName}>{file.name}</span>
                  <span className={styles.filePath}>{file.path}</span>
                </div>
                <Switch
                  size="small"
                  checked={file.enabled}
                  onChange={(checked) => void handleToggle(file, checked)}
                  aria-label={`${file.enabled ? '禁用' : '启用'} ${file.name}`}
                />
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  aria-label={`编辑 ${file.name}`}
                  loading={loadingFile}
                  onClick={() => void openEdit(file)}
                />
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  aria-label={`删除 ${file.name}`}
                  onClick={() => handleDelete(file)}
                />
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.editorPane} aria-label="技能编辑">
          {editor ? (
            <Form layout="vertical" onFinish={() => void handleSave()}>
              <Form.Item label="路径" required>
                <Input
                  value={editor.path}
                  onChange={(e) => setEditor({ ...editor, path: e.target.value })}
                  disabled={!editor.isNew || saving}
                  placeholder="例如 demo/my-skill.md"
                />
              </Form.Item>
              <Form.Item label="名称" required>
                <Input
                  value={editor.name}
                  onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                  disabled={saving}
                />
              </Form.Item>
              <Form.Item label="描述">
                <Input
                  value={editor.description}
                  onChange={(e) => setEditor({ ...editor, description: e.target.value })}
                  disabled={saving}
                />
              </Form.Item>
              <Form.Item label="内容">
                <TextArea
                  value={editor.content}
                  onChange={(e) => setEditor({ ...editor, content: e.target.value })}
                  rows={10}
                  disabled={saving}
                />
              </Form.Item>
              <div className={styles.editorActions}>
                <Button type="primary" htmlType="submit" loading={saving}>
                  保存
                </Button>
                <Button disabled={saving} onClick={() => setEditor(null)}>
                  取消
                </Button>
              </div>
            </Form>
          ) : (
            <p className={styles.hint}>选择文件编辑，或点击「新建」创建技能。</p>
          )}
        </section>
      </div>
    </Modal>
  );
}
