import { Button, Input } from 'antd';
import { useEffect, useState } from 'react';

import type { SkillWriteOperation } from './types';

import styles from './SkillWritePendingCard.module.css';

const { TextArea } = Input;

export type SkillWritePendingCardProps = {
  summary: string;
  operation: SkillWriteOperation;
  loading?: boolean;
  onConfirm: (operation: SkillWriteOperation) => void;
  onReject: () => void;
};

export function SkillWritePendingCard({
  summary,
  operation,
  loading = false,
  onConfirm,
  onReject,
}: SkillWritePendingCardProps) {
  const descriptionOmitted = operation.description == null;
  const [name, setName] = useState(operation.name);
  const [description, setDescription] = useState(operation.description ?? '');
  const [content, setContent] = useState(operation.content);

  useEffect(() => {
    setName(operation.name);
    setDescription(operation.description ?? '');
    setContent(operation.content);
  }, [operation]);

  const handleConfirm = () => {
    const nextDescription =
      descriptionOmitted && description.trim() === '' ? null : description;
    onConfirm({
      ...operation,
      name: name.trim() || operation.name,
      description: nextDescription,
      content,
      revision: operation.revision ?? null,
    });
  };

  return (
    <div className={styles.card}>
      <p className={styles.summary}>{summary}</p>
      {operation.revision_invalid ? (
        <p className={styles.summary}>revision 无效，确认将被拒绝；请拒绝后重试</p>
      ) : null}
      <div className={styles.field}>
        <label className={styles.label} htmlFor="skill-write-path">
          路径
        </label>
        <Input id="skill-write-path" value={operation.path} readOnly />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="skill-write-name">
          名称
        </label>
        <Input
          id="skill-write-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="skill-write-description">
          描述
        </label>
        <Input
          id="skill-write-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={loading}
          placeholder={descriptionOmitted ? '留空则保留原描述' : undefined}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="skill-write-content">
          内容
        </label>
        <TextArea
          id="skill-write-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={6}
          disabled={loading}
        />
      </div>
      <div className={styles.actions}>
        <Button size="small" type="primary" loading={loading} onClick={handleConfirm}>
          确认
        </Button>
        <Button size="small" disabled={loading} onClick={onReject}>
          拒绝
        </Button>
      </div>
    </div>
  );
}
