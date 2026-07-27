import type { TurnUserInput } from './types';
import { displayTextFromUserMessage, extractSkillPathsFromInput, parseUserInputSnapshot } from './serializeTurnContent';
import { SkillPill } from './SkillPill';

import styles from './UserMessageContent.module.css';

export type UserMessageContentProps = {
  content: string;
  input?: TurnUserInput | Record<string, unknown> | null;
};

export function UserMessageContent({ content, input }: UserMessageContentProps) {
  const parsed =
    input && 'content' in input && Array.isArray(input.content)
      ? parseUserInputSnapshot(input)
      : parseUserInputSnapshot(input ?? null);
  const skillPaths = extractSkillPathsFromInput(parsed);
  const text = displayTextFromUserMessage(parsed, content);

  return (
    <div className={styles.root}>
      {skillPaths.length > 0 ? (
        <div className={styles.skills} aria-label="引用的技能">
          {skillPaths.map((path) => (
            <SkillPill key={path} path={path} readOnly />
          ))}
        </div>
      ) : null}
      {text ? <p className={styles.text}>{text}</p> : null}
    </div>
  );
}
