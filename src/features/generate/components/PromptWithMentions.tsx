import type { CSSProperties, ReactNode } from 'react';
import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GenerateRefImage } from '../types';

interface PromptWithMentionsProps {
  prompt: string;
  refs?: GenerateRefImage[];
  /** 紧凑模式：历史列表里只显示名字，不渲染缩略图 */
  compact?: boolean;
}

type HoverPreview = {
  url: string;
  isVideo: boolean;
  style: CSSProperties;
};

function PromptMentionChip({
  material,
  compact,
  onPreview,
  onPreviewEnd,
}: {
  material: GenerateRefImage;
  compact?: boolean;
  onPreview: (material: GenerateRefImage, el: HTMLElement) => void;
  onPreviewEnd: () => void;
}) {
  const isImage = material.mimeType.startsWith('image/');
  const isVideo = material.mimeType.startsWith('video/');
  const canPreview = !compact && (isImage || isVideo) && Boolean(material.url);

  return (
    <span
      className={`studio-prompt-mention${compact ? ' studio-prompt-mention--compact' : ''}`}
      onMouseEnter={(e) => {
        if (canPreview) onPreview(material, e.currentTarget);
      }}
      onMouseLeave={onPreviewEnd}
    >
      {!compact && (
        <span className="studio-prompt-mention__thumb">
          {isImage ? (
            <img src={material.url} alt="" />
          ) : isVideo ? (
            <video src={material.url} muted preload="metadata" />
          ) : (
            <span>@</span>
          )}
        </span>
      )}
      <span className="studio-prompt-mention__name">{material.name}</span>
    </span>
  );
}

// 只读展示：把 prompt 里的 @素材名 还原成内联引用 chip（与输入框 chip 视觉一致）
export function PromptWithMentions({ prompt, refs, compact }: PromptWithMentionsProps) {
  const named = (refs ?? []).filter((r) => r.name);
  const [preview, setPreview] = useState<HoverPreview | null>(null);

  const showPreview = useCallback((material: GenerateRefImage, el: HTMLElement) => {
    const isVideo = material.mimeType.startsWith('video/');
    const rect = el.getBoundingClientRect();
    setPreview({
      url: material.url,
      isVideo,
      style: {
        position: 'fixed',
        left: Math.max(12, Math.min(rect.left, window.innerWidth - 260)),
        top: Math.max(12, rect.top - 8),
        transform: 'translateY(-100%)',
        zIndex: 10001,
      },
    });
  }, []);

  const hidePreview = useCallback(() => setPreview(null), []);

  if (named.length === 0) return <>{prompt}</>;

  const nodes: ReactNode[] = [];
  const orphanRefs = named.filter((m) => !prompt.includes(`@${m.name}`));
  if (orphanRefs.length > 0) {
    nodes.push(<span key="ref-label">参考 </span>);
    orphanRefs.forEach((material) => {
      nodes.push(
        <PromptMentionChip
          key={`orphan-${material.id}`}
          material={material}
          compact={compact}
          onPreview={showPreview}
          onPreviewEnd={hidePreview}
        />,
      );
    });
    nodes.push(' ');
  }

  let buffer = '';
  let key = 0;
  const flush = () => {
    if (buffer) {
      nodes.push(buffer);
      buffer = '';
    }
  };

  let i = 0;
  while (i < prompt.length) {
    if (prompt[i] === '@') {
      const rest = prompt.slice(i + 1);
      const matched = named
        .filter((m) => rest.startsWith(m.name))
        .sort((a, b) => b.name.length - a.name.length)[0];
      if (matched) {
        flush();
        nodes.push(
          <PromptMentionChip
            key={`m-${key++}`}
            material={matched}
            compact={compact}
            onPreview={showPreview}
            onPreviewEnd={hidePreview}
          />,
        );
        i += 1 + matched.name.length;
        continue;
      }
    }
    buffer += prompt[i];
    i += 1;
  }
  flush();

  return (
    <>
      {nodes}
      {preview
        ? createPortal(
            <div className="studio-mention-preview" style={preview.style}>
              {preview.isVideo ? (
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
}
