import type { CSSProperties } from 'react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import type { RefImage } from './CreateComposer';

export interface MentionEditorHandle {
  clear: () => void;
  setText: (text: string) => void;
  /** 用素材列表把纯文本里的 @素材名 还原成富 chip（用于"重新编辑"回填） */
  setContent: (text: string, materials: RefImage[]) => void;
  focus: () => void;
  openMention: () => void;
}

interface MentionEditorProps {
  materials: RefImage[];
  placeholder?: string;
  className?: string;
  onChange: (text: string) => void;
  onEnterSubmit: () => void;
  onMaterialSelect?: (material: RefImage) => void;
}

type MaterialKind = 'image' | 'video' | 'file';

function materialKind(mime: string): MaterialKind {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return 'file';
}

interface MentionContext {
  node: Text;
  atIndex: number;
  caretOffset: number;
  query: string;
}

const CHIP_CLASS = 'studio-mention-chip';

// 把 @ 引用渲染成不可编辑的 chip（缩略图 + 名称），原始 DOM 由编辑器自行维护
function createChipElement(material: RefImage): HTMLSpanElement {
  const kind = materialKind(material.mimeType);
  const chip = document.createElement('span');
  chip.className = CHIP_CLASS;
  chip.contentEditable = 'false';
  chip.dataset.mentionName = material.name;
  chip.dataset.mentionId = String(material.assetId ?? material.id);
  chip.dataset.url = material.url;
  chip.dataset.kind = kind;

  const thumb = document.createElement('span');
  thumb.className = 'studio-mention-chip__thumb';
  if (kind === 'image') {
    const img = document.createElement('img');
    img.src = material.url;
    img.alt = '';
    thumb.appendChild(img);
  } else if (kind === 'video') {
    const video = document.createElement('video');
    video.src = material.url;
    video.muted = true;
    video.preload = 'metadata';
    thumb.appendChild(video);
  } else {
    thumb.textContent = '@';
  }

  const name = document.createElement('span');
  name.className = 'studio-mention-chip__name';
  name.textContent = material.name;

  chip.append(thumb, name);
  return chip;
}

// 把纯文本（含 @素材名）解析为编辑器 DOM 片段：能匹配到素材名的 @token → chip，其余按文本
function buildContentFragment(text: string, materials: RefImage[]): DocumentFragment {
  const frag = document.createDocumentFragment();
  const named = materials.filter((m) => m.name);
  let buffer = '';
  const flush = () => {
    if (buffer) {
      frag.appendChild(document.createTextNode(buffer));
      buffer = '';
    }
  };
  let i = 0;
  while (i < text.length) {
    if (text[i] === '@') {
      const rest = text.slice(i + 1);
      // 同名取最长匹配，避免 "图" 抢先匹配 "图1"
      const matched = named
        .filter((m) => rest.startsWith(m.name))
        .sort((a, b) => b.name.length - a.name.length)[0];
      if (matched) {
        flush();
        frag.appendChild(createChipElement(matched));
        i += 1 + matched.name.length;
        continue;
      }
    }
    buffer += text[i];
    i += 1;
  }
  flush();
  return frag;
}

// 序列化编辑器内容为纯文本：chip → @名称，<br>/块元素 → 换行
function serialize(root: HTMLElement): string {
  let out = '';
  const walk = (node: ChildNode) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? '';
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    if (el.classList.contains(CHIP_CLASS)) {
      out += `@${el.dataset.mentionName ?? ''}`;
      return;
    }
    if (el.tagName === 'BR') {
      out += '\n';
      return;
    }
    const isBlock = el.tagName === 'DIV' || el.tagName === 'P';
    if (isBlock && out.length > 0 && !out.endsWith('\n')) {
      out += '\n';
    }
    el.childNodes.forEach(walk);
  };
  root.childNodes.forEach(walk);
  return out.replace(/\u00a0/g, ' ');
}

export const MentionEditor = forwardRef<MentionEditorHandle, MentionEditorProps>(
  function MentionEditor({ materials, placeholder, className, onChange, onEnterSubmit, onMaterialSelect }, ref) {
    const rootRef = useRef<HTMLDivElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);
    const ctxRef = useRef<MentionContext | null>(null);
    const suppressRef = useRef(false);

    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const [popupStyle, setPopupStyle] = useState<CSSProperties | null>(null);
    const [empty, setEmpty] = useState(true);
    const [preview, setPreview] = useState<{ url: string; kind: MaterialKind; style: CSSProperties } | null>(null);

    const items = open
      ? materials.filter((m) => m.name.toLowerCase().includes(query.toLowerCase()))
      : [];

    const closeMention = useCallback(() => {
      setOpen(false);
      setQuery('');
      setActiveIndex(0);
      ctxRef.current = null;
    }, []);

    const emitChange = useCallback(() => {
      const root = rootRef.current;
      if (!root) return;
      const text = serialize(root);
      setEmpty(text.trim().length === 0);
      onChange(text);
    }, [onChange]);

    const positionPopupAtCaret = useCallback(() => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      const root = rootRef.current;
      const anchorRect = rect.width || rect.height ? rect : root?.getBoundingClientRect();
      if (!anchorRect) return;
      const viewportPadding = 12;
      const width = Math.min(300, window.innerWidth - viewportPadding * 2);
      const left = Math.max(
        viewportPadding,
        Math.min(anchorRect.left, window.innerWidth - width - viewportPadding),
      );
      setPopupStyle({
        position: 'fixed',
        top: Math.max(viewportPadding, anchorRect.top - 8),
        left,
        width,
        transform: 'translateY(-100%)',
      });
    }, []);

    // 基于当前光标位置探测正在输入的 @ 触发词（光标在文字中间同样生效）
    const detectMention = useCallback(() => {
      if (suppressRef.current) return;
      const root = rootRef.current;
      const sel = window.getSelection();
      if (!root || !sel || sel.rangeCount === 0 || !sel.isCollapsed) {
        closeMention();
        return;
      }
      const range = sel.getRangeAt(0);
      const node = range.startContainer;
      if (node.nodeType !== Node.TEXT_NODE || !root.contains(node)) {
        closeMention();
        return;
      }
      const textNode = node as Text;
      const caretOffset = range.startOffset;
      const before = (textNode.textContent ?? '').slice(0, caretOffset);
      const atIndex = before.lastIndexOf('@');
      if (atIndex === -1) {
        closeMention();
        return;
      }
      const nextQuery = before.slice(atIndex + 1);
      if (/\s/.test(nextQuery)) {
        closeMention();
        return;
      }
      ctxRef.current = { node: textNode, atIndex, caretOffset, query: nextQuery };
      setQuery(nextQuery);
      setActiveIndex(0);
      setOpen(true);
      positionPopupAtCaret();
    }, [closeMention, positionPopupAtCaret]);

    const selectMention = useCallback(
      (material: RefImage) => {
        const root = rootRef.current;
        const ctx = ctxRef.current;
        if (!root || !ctx) {
          closeMention();
          return;
        }
        const range = document.createRange();
        range.setStart(ctx.node, ctx.atIndex);
        range.setEnd(ctx.node, ctx.caretOffset);
        range.deleteContents();

        const chip = createChipElement(material);
        range.insertNode(chip);
        onMaterialSelect?.(material);

        const spacer = document.createTextNode('\u00a0');
        chip.after(spacer);

        const sel = window.getSelection();
        const after = document.createRange();
        after.setStart(spacer, 1);
        after.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(after);

        closeMention();
        emitChange();
        root.focus();
      },
      [closeMention, emitChange, onMaterialSelect],
    );

    const insertAtToken = useCallback(() => {
      const root = rootRef.current;
      if (!root) return;
      root.focus();
      const sel = window.getSelection();
      if (!sel) return;
      if (sel.rangeCount === 0 || !root.contains(sel.anchorNode)) {
        const range = document.createRange();
        range.selectNodeContents(root);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      // 若前一个字符不是空白则补一个空格，避免和已有文字粘连
      let needSpace = false;
      const anchor = sel.anchorNode;
      const offset = sel.anchorOffset;
      if (anchor && anchor.nodeType === Node.TEXT_NODE && offset > 0) {
        const ch = (anchor.textContent ?? '')[offset - 1];
        needSpace = !!ch && !/\s/.test(ch);
      } else if (anchor && anchor.nodeType === Node.ELEMENT_NODE && offset > 0) {
        const prev = (anchor as HTMLElement).childNodes[offset - 1] as HTMLElement | undefined;
        needSpace = !!prev && prev.nodeType === Node.ELEMENT_NODE && prev.classList?.contains(CHIP_CLASS);
      }
      suppressRef.current = false;
      document.execCommand('insertText', false, `${needSpace ? ' ' : ''}@`);
      emitChange();
      detectMention();
    }, [detectMention, emitChange]);

    useImperativeHandle(
      ref,
      () => ({
        clear: () => {
          const root = rootRef.current;
          if (root) root.innerHTML = '';
          setEmpty(true);
          closeMention();
          onChange('');
        },
        setText: (text: string) => {
          const root = rootRef.current;
          if (!root) return;
          root.textContent = text;
          setEmpty(text.trim().length === 0);
          onChange(text);
        },
        setContent: (text: string, mats: RefImage[]) => {
          const root = rootRef.current;
          if (!root) return;
          closeMention();
          root.innerHTML = '';
          root.appendChild(buildContentFragment(text, mats));
          // 用 serialize 回算文本，保证 @素材名 与内部 chip 一致
          emitChange();
        },
        focus: () => rootRef.current?.focus(),
        openMention: insertAtToken,
      }),
      [closeMention, emitChange, insertAtToken, onChange],
    );

    // 下拉定位跟随滚动/缩放
    useEffect(() => {
      if (!open) return;
      const handler = () => positionPopupAtCaret();
      window.addEventListener('resize', handler);
      window.addEventListener('scroll', handler, true);
      return () => {
        window.removeEventListener('resize', handler);
        window.removeEventListener('scroll', handler, true);
      };
    }, [open, positionPopupAtCaret]);

    // 点击外部关闭下拉
    useEffect(() => {
      if (!open) return;
      const handler = (e: MouseEvent) => {
        const target = e.target as Node;
        if (
          popupRef.current && !popupRef.current.contains(target) &&
          rootRef.current && !rootRef.current.contains(target)
        ) {
          closeMention();
        }
      };
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }, [open, closeMention]);

    // chip 悬停预览（事件委托：chip 由原始 DOM 创建）
    useEffect(() => {
      const root = rootRef.current;
      if (!root) return;
      const onOver = (e: Event) => {
        const target = (e.target as HTMLElement).closest?.(`.${CHIP_CLASS}`) as HTMLElement | null;
        if (!target || !root.contains(target)) return;
        const url = target.dataset.url;
        const kind = (target.dataset.kind ?? 'file') as MaterialKind;
        if (!url || kind === 'file') {
          setPreview(null);
          return;
        }
        const rect = target.getBoundingClientRect();
        setPreview({
          url,
          kind,
          style: {
            position: 'fixed',
            left: Math.max(12, rect.left),
            top: Math.max(12, rect.top - 8),
            transform: 'translateY(-100%)',
          },
        });
      };
      const onOut = (e: Event) => {
        const related = (e as MouseEvent).relatedTarget as HTMLElement | null;
        if (related && related.closest?.(`.${CHIP_CLASS}`)) return;
        setPreview(null);
      };
      root.addEventListener('mouseover', onOver);
      root.addEventListener('mouseout', onOut);
      return () => {
        root.removeEventListener('mouseover', onOver);
        root.removeEventListener('mouseout', onOut);
      };
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (open) {
        if (e.key === 'Escape') {
          e.preventDefault();
          suppressRef.current = true;
          closeMention();
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setActiveIndex((i) => (items.length ? Math.min(i + 1, items.length - 1) : 0));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setActiveIndex((i) => Math.max(i - 1, 0));
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          if (items.length > 0) {
            selectMention(items[activeIndex] ?? items[0]);
          } else {
            closeMention();
          }
          return;
        }
      }

      if (e.key === 'Backspace') {
        const sel = window.getSelection();
        if (sel && sel.isCollapsed && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          let prev: ChildNode | null = null;
          const { startContainer, startOffset } = range;
          if (startContainer.nodeType === Node.TEXT_NODE && startOffset === 0) {
            prev = startContainer.previousSibling;
          } else if (startContainer.nodeType === Node.ELEMENT_NODE && startOffset > 0) {
            prev = (startContainer as HTMLElement).childNodes[startOffset - 1] ?? null;
          }
          if (prev && prev.nodeType === Node.ELEMENT_NODE && (prev as HTMLElement).classList.contains(CHIP_CLASS)) {
            e.preventDefault();
            prev.remove();
            emitChange();
            return;
          }
        }
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onEnterSubmit();
      }
    };

    const handleInput = () => {
      suppressRef.current = false;
      emitChange();
      detectMention();
    };

    return (
      <>
        <div
          ref={rootRef}
          className={`studio-mention-editor${className ? ` ${className}` : ''}${empty ? ' studio-mention-editor--empty' : ''}`}
          contentEditable
          role="textbox"
          aria-multiline="true"
          data-placeholder={placeholder}
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onMouseUp={detectMention}
          onBlur={() => setPreview(null)}
        />

        {open && popupStyle
          ? createPortal(
              <div ref={popupRef} className="studio-create__mention-popup" style={popupStyle}>
                <div className="studio-create__mention-title">引用参考素材</div>
                {items.length === 0 ? (
                  <div className="studio-create__mention-empty">
                    {materials.length === 0 ? '暂无参考素材，请先点击 + 上传' : '没有匹配的参考素材'}
                  </div>
                ) : (
                  <div className="studio-create__mention-list">
                    {items.map((m, index) => {
                      const kind = materialKind(m.mimeType);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          className={`studio-create__mention-item${index === activeIndex ? ' studio-create__mention-item--active' : ''}`}
                          onMouseEnter={() => setActiveIndex(index)}
                          // mousedown 阻止编辑器失焦，避免选区丢失
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => selectMention(m)}
                        >
                          <span className="studio-create__mention-thumb">
                            {kind === 'image' ? (
                              <img src={m.url} alt={m.name} />
                            ) : kind === 'video' ? (
                              <video src={m.url} muted preload="metadata" />
                            ) : (
                              <span>@</span>
                            )}
                          </span>
                          <span className="studio-create__mention-name">{m.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>,
              document.body,
            )
          : null}

        {preview
          ? createPortal(
              <div className="studio-mention-preview" style={preview.style}>
                {preview.kind === 'video' ? (
                  <video src={preview.url} muted autoPlay loop playsInline />
                ) : (
                  <img src={preview.url} alt="" />
                )}
              </div>,
              document.body,
            )
          : null}
      </>
    );
  },
);
