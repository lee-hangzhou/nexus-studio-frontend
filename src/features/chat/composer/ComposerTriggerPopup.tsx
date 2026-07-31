import { Avatar } from 'antd';
import {
  useLayoutEffect,
  useState,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

import styles from './ComposerTriggerPopup.module.css';

export type ComposerTriggerOption = {
  key: string;
  label: string;
  description?: string;
  avatarUrl?: string;
};

type AnchorRect = {
  left: number;
  width: number;
  top: number;
};

export function ComposerTriggerPopup(props: {
  kind: 'at' | 'slash';
  options: ComposerTriggerOption[];
  activeIndex: number;
  emptyText: string;
  anchorRef: RefObject<HTMLElement | null>;
  onHover: (index: number) => void;
  onSelect: (key: string) => void;
}) {
  const { kind, options, activeIndex, emptyText, anchorRef, onHover, onSelect } = props;
  const title = kind === 'at' ? '指定专家' : '引用技能';
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);

  useLayoutEffect(() => {
    const update = () => {
      const node = anchorRef.current;
      if (!node) {
        setAnchor(null);
        return;
      }
      const rect = node.getBoundingClientRect();
      setAnchor({
        left: rect.left,
        width: rect.width,
        top: rect.top,
      });
    };
    update();
    window.addEventListener('resize', update);
    // 捕获阶段监听滚动，消息列表滚动时同步位置
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchorRef, options.length, emptyText]);

  if (anchor == null || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`${styles.root} ${styles.rootFixed}`}
      role="listbox"
      aria-label={title}
      style={{
        left: anchor.left,
        width: anchor.width,
        bottom: Math.max(8, window.innerHeight - anchor.top + 6),
      }}
    >
      <div className={styles.head}>{title}</div>
      {options.length === 0 ? (
        <div className={styles.empty}>{emptyText}</div>
      ) : (
        <ul className={styles.list}>
          {options.map((option, index) => (
            <li key={option.key}>
              <button
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={`${styles.item}${index === activeIndex ? ` ${styles.itemActive}` : ''}`}
                onMouseEnter={() => onHover(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  onSelect(option.key);
                }}
              >
                {kind === 'at' ? (
                  <Avatar size={22} src={option.avatarUrl} alt="">
                    {option.label.slice(0, 1)}
                  </Avatar>
                ) : (
                  <span className={styles.skillMark} aria-hidden>
                    /
                  </span>
                )}
                <span className={styles.meta}>
                  <span className={styles.label}>{option.label}</span>
                  {option.description ? (
                    <span className={styles.description}>{option.description}</span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>,
    document.body,
  );
}
