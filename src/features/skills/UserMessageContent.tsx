import type { TurnContentBlock, TurnMaterialBlock, TurnUserInput } from './types';
import {
  displayTextFromUserMessage,
  extractSkillPathsFromInput,
  parseUserInputSnapshot,
} from './serializeTurnContent';
import { SkillPill } from './SkillPill';
import { materialListKeys, turnMaterialLabel } from './turnMaterialDisplay';

import styles from './UserMessageContent.module.css';

export type UserMessageContentProps = {
  content: string;
  input?: TurnUserInput | Record<string, unknown> | null;
  /** 已有附件缩略图列表时隐藏 materials 芯片，避免双重展示 */
  hideMaterials?: boolean;
};

function isReferenceBlock(block: TurnContentBlock): block is TurnMaterialBlock {
  return (
    block.type === 'image' ||
    block.type === 'video' ||
    block.type === 'audio' ||
    block.type === 'file' ||
    block.type === 'node'
  );
}

function ReferenceChip({ label }: { label: string }) {
  return <span className={styles.refChip}>{label}</span>;
}

export function UserMessageContent({ content, input, hideMaterials = false }: UserMessageContentProps) {
  const parsed = parseUserInputSnapshot(input ?? null);
  const skillPaths = extractSkillPathsFromInput(parsed);
  const text = displayTextFromUserMessage(parsed, content);
  const inlineRefs = parsed?.content.filter(isReferenceBlock) ?? [];
  const materials = hideMaterials ? [] : (parsed?.materials ?? []);
  const inlineKeys = materialListKeys(inlineRefs, 'inline');
  const materialKeys = materialListKeys(materials, 'material');

  return (
    <div className={styles.root}>
      {skillPaths.length > 0 ? (
        <div className={styles.skills} aria-label="引用的技能">
          {skillPaths.map((path) => (
            <SkillPill key={path} path={path} readOnly />
          ))}
        </div>
      ) : null}
      {inlineRefs.length > 0 ? (
        <div className={styles.refs} aria-label="消息引用">
          {inlineRefs.map((block, i) => (
            <ReferenceChip key={inlineKeys[i]} label={turnMaterialLabel(block)} />
          ))}
        </div>
      ) : null}
      {materials.length > 0 ? (
        <div className={styles.materials} aria-label="附加素材">
          {materials.map((block, i) => (
            <ReferenceChip key={materialKeys[i]} label={turnMaterialLabel(block)} />
          ))}
        </div>
      ) : null}
      {text ? <p className={styles.text}>{text}</p> : null}
    </div>
  );
}
