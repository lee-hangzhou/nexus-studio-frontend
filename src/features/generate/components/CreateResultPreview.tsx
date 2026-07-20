import { DownOutlined, LoadingOutlined, UpOutlined } from '@ant-design/icons';
import { useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { PreviewSlide } from '../utils/previewGallery';

interface CreateResultPreviewProps {
  open: boolean;
  slides: PreviewSlide[];
  currentIndex: number;
  loadingMore?: boolean;
  onClose: () => void;
  onIndexChange: (index: number) => void;
  onGoNext?: () => void | Promise<void>;
  onGoPrev?: () => void | Promise<void>;
}

export function CreateResultPreview({
  open,
  slides,
  currentIndex,
  loadingMore = false,
  onClose,
  onIndexChange,
  onGoNext,
  onGoPrev,
}: CreateResultPreviewProps) {
  const total = slides.length;
  const slide = total > 0 ? slides[Math.min(currentIndex, total - 1)] : null;
  const canNavigate = total > 1 || Boolean(onGoNext);

  const goPrev = useCallback(() => {
    if (onGoPrev) {
      void onGoPrev();
      return;
    }
    if (total <= 1) return;
    onIndexChange((currentIndex - 1 + total) % total);
  }, [currentIndex, onGoPrev, onIndexChange, total]);

  const goNext = useCallback(() => {
    if (loadingMore) return;
    if (onGoNext) {
      void onGoNext();
      return;
    }
    if (total <= 1) return;
    onIndexChange((currentIndex + 1) % total);
  }, [currentIndex, loadingMore, onGoNext, onIndexChange, total]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        goPrev();
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose, goPrev, goNext]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !slide) return null;

  return createPortal(
    <div
      className="studio-create__preview-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="生成结果预览"
      onClick={onClose}
    >
      <div
        className="studio-create__preview-shell"
        onClick={(e) => e.stopPropagation()}
      >
        {canNavigate && (
          <button
            type="button"
            className="studio-create__preview-nav studio-create__preview-nav--up"
            title="上一条（更新的任务）"
            aria-label="上一条，更新的任务或同批上一张"
            onClick={goPrev}
          >
            <UpOutlined />
          </button>
        )}

        <div className="studio-create__preview-media-wrap">
          {slide.isVideo ? (
            <video
              key={slide.url}
              src={slide.url}
              className="studio-create__preview-media studio-create__preview-media--video"
              controls
              autoPlay
              playsInline
            />
          ) : (
            <img
              key={slide.url}
              src={slide.url}
              alt=""
              className="studio-create__preview-media"
            />
          )}
          <span className="studio-create__preview-counter">
            {currentIndex + 1} / {total}
          </span>
        </div>

        {canNavigate && (
          <button
            type="button"
            className="studio-create__preview-nav studio-create__preview-nav--down"
            title={loadingMore ? '加载更多历史…' : '下一条（更早的任务）'}
            aria-label={loadingMore ? '加载更多历史' : '下一条，更早的任务或同批下一张'}
            disabled={loadingMore}
            onClick={goNext}
          >
            {loadingMore ? <LoadingOutlined spin /> : <DownOutlined />}
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
