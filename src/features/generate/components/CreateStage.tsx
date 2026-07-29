import type { CSSProperties } from 'react';
import {
  CloseOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  LeftOutlined,
  ReloadOutlined,
  RightOutlined,
  StarFilled,
  StarOutlined,
} from '@ant-design/icons';
import { Modal } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GenerateFeedItem, GenerateResultMedia } from '../types';
import { isTaskInProgress, TASK_STATUS } from '../../../domains/task/types';
import { StudioButton } from '../../../shared/ui/StudioButton';
import { buildPreviewSlides, findPreviewIndex } from '../utils/previewGallery';
import { CreateResultPreview } from './CreateResultPreview';
import { PromptWithMentions } from './PromptWithMentions';

export type PreviewLoadMoreResult = { deltaSlides: number; hasMore: boolean };

interface CreateStageProps {
  item: GenerateFeedItem | null;
  allItems?: GenerateFeedItem[];
  previewHasMore?: boolean;
  onPreviewLoadMore?: () => Promise<PreviewLoadMoreResult>;
  previewLoadingMore?: boolean;
  selectedMediaIndex?: number;
  onMediaIndexChange?: (index: number) => void;
  onSelectTask?: (taskId: string) => void;
  onToggleFavorite?: () => void;
  onRegenerate?: () => void;
  onEdit?: () => void;
  onCancel?: () => void;
  onDelete?: () => void;
}

const VIDEO_REFERENCE_MODE_LABELS: Record<number, string> = {
  1: '首帧参考',
  2: '首尾帧参考',
  3: '全能参考',
  4: '视频编辑',
};

export function CreateStage({
  item,
  allItems = [],
  previewHasMore = false,
  onPreviewLoadMore,
  previewLoadingMore = false,
  selectedMediaIndex = 0,
  onMediaIndexChange,
  onSelectTask,
  onToggleFavorite,
  onRegenerate,
  onEdit,
  onCancel,
  onDelete,
}: CreateStageProps) {
  if (!item) {
    return (
      <div className="studio-create__viewer" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="studio-create__stage-empty">
          <div className="studio-create__stage-glow" aria-hidden />
          <h1 className="studio-create__stage-title">把想象变成画面</h1>
          <p className="studio-create__stage-lead">
            在下方写一句描述，或点选灵感快速开始。一起开始探索吧
          </p>
        </div>
      </div>
    );
  }

  const pending = isTaskInProgress(item.status);
  const failed = item.status === TASK_STATUS.FAILED;
  const cancelled = item.status === TASK_STATUS.CANCELLED;
  const success = item.status === TASK_STATUS.SUCCEEDED;

  const showResultLayout = success || failed || cancelled || pending;

  return (
    <div className={`studio-create__viewer${showResultLayout ? ' studio-create__viewer--result' : ''}`}>
      {pending && (
        <StagePending
          item={item}
          onRegenerate={onRegenerate}
          onEdit={onEdit}
          onCancel={onCancel}
        />
      )}
      {failed && (
        <StageFailed
          item={item}
          onRegenerate={onRegenerate}
          onEdit={onEdit}
        />
      )}
      {cancelled && <StageCancelled item={item} onRegenerate={onRegenerate} onEdit={onEdit} />}
      {success && (
        <StageResults
          item={item}
          allItems={allItems}
          previewHasMore={previewHasMore}
          onPreviewLoadMore={onPreviewLoadMore}
          previewLoadingMore={previewLoadingMore}
          selectedMediaIndex={selectedMediaIndex}
          onMediaIndexChange={onMediaIndexChange}
          onSelectTask={onSelectTask}
          onToggleFavorite={onToggleFavorite}
          onRegenerate={onRegenerate}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}

function formatWait(seconds?: number | null) {
  if (!seconds || seconds <= 0) return null;
  if (seconds < 60) return `预计等待 ${seconds} 秒`;
  const minutes = Math.ceil(seconds / 60);
  return `预计等待约 ${minutes} 分钟`;
}

function StagePending({
  item,
  onRegenerate,
  onEdit,
  onCancel,
}: {
  item: GenerateFeedItem;
  onRegenerate?: () => void;
  onEdit?: () => void;
  onCancel?: () => void;
}) {
  const isRunning = item.status === TASK_STATUS.RUNNING;
  let statusTitle = '排队中';
  if (item.status === TASK_STATUS.CREATED) statusTitle = '已创建';
  if (item.status === TASK_STATUS.WAITING) statusTitle = '等待中';
  if (isRunning) statusTitle = '正在生成';
  const queueText = item.queuePosition && item.queueTotal
    ? `队列第 ${item.queuePosition}/${item.queueTotal} 位`
    : null;
  const waitText = formatWait(item.estimatedWaitSeconds);
  const statusSub = [queueText, waitText].filter(Boolean).join(' · ')
    || (isRunning ? '通常需要 1–2 分钟' : '稍候，马上开始渲染');

  return (
    <div className="studio-create__result-stack studio-create__result-stack--state">
      <div className="studio-create__viewer-frame studio-create__state-frame studio-create__viewer-frame--pending">
        <div className="studio-create__state-art studio-create__state-art--pending" aria-hidden />
        <div className="studio-create__status studio-create__status--overlay" role="status">
          <span className="studio-create__status-dot" aria-hidden />
          <div>
            <p className="studio-create__status-title">
              {statusTitle}
            </p>
            <p className="studio-create__status-sub">{statusSub}</p>
          </div>
          {onCancel && !isRunning && (
            <button type="button" className="studio-create__status-cancel" onClick={onCancel}>
              <CloseOutlined />
              取消
            </button>
          )}
        </div>
      </div>
      <StageResultInfo item={item} onRegenerate={onRegenerate} onEdit={onEdit} />
    </div>
  );
}

function buildConfigParts(item: GenerateFeedItem): string[] {
  const countPart =
    item.status === TASK_STATUS.SUCCEEDED && item.resultCount > 0
      ? item.kind === 'video'
        ? `${item.resultCount}个视频`
        : `${item.resultCount}张`
      : undefined;

  return [
    item.kind === 'video' && item.referenceMode
      ? VIDEO_REFERENCE_MODE_LABELS[item.referenceMode]
      : undefined,
    item.ratio,
    item.resolution ? `高清 ${item.resolution.toUpperCase()}` : undefined,
    item.kind === 'video' && item.duration ? `${item.duration}秒` : undefined,
    countPart,
  ].filter(Boolean) as string[];
}

function StageResultInfo({
  item,
  onRegenerate,
  onEdit,
  errorMessage,
}: {
  item: GenerateFeedItem;
  onRegenerate?: () => void;
  onEdit?: () => void;
  errorMessage?: string;
}) {
  const configParts = buildConfigParts(item);

  return (
    <div className="studio-create__result-info" aria-label="生成信息">
      {errorMessage ? (
        <p className="studio-create__result-error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <div className="studio-create__result-prompt">
        <span className="studio-create__result-meta-label">提示词</span>
        <span className="studio-create__result-prompt-text" title={item.prompt}>
          <PromptWithMentions prompt={item.prompt} refs={item.refImages} />
        </span>
      </div>

      <div className="studio-create__result-footer">
        <div className="studio-create__result-meta">
          <div className="studio-create__result-meta-group studio-create__result-meta-group--model">
            <span className="studio-create__result-meta-label">模型</span>
            <span
              className="studio-create__result-meta-value"
              title={item.modelLabel}
            >
              {item.modelLabel}
            </span>
          </div>
          <div className="studio-create__result-meta-group">
            <span className="studio-create__result-meta-label">配置</span>
            <span className="studio-create__result-meta-value" title={configParts.join(' · ')}>
              {configParts.join(' · ') || '—'}
            </span>
          </div>
        </div>

        <div className="studio-create__result-actions">
          {onRegenerate && (
            <StudioButton variant="ghost" size="sm" icon={<ReloadOutlined />} onClick={onRegenerate}>
              再次生成
            </StudioButton>
          )}
          {onEdit && (
            <StudioButton variant="ghost" size="sm" icon={<EditOutlined />} onClick={onEdit}>
              重新编辑
            </StudioButton>
          )}
        </div>
      </div>
    </div>
  );
}

function StageFailed({
  item,
  onRegenerate,
  onEdit,
}: {
  item: GenerateFeedItem;
  onRegenerate?: () => void;
  onEdit?: () => void;
}) {
  return (
    <div className="studio-create__result-stack studio-create__result-stack--state">
      <div className="studio-create__viewer-frame studio-create__state-frame studio-create__viewer-frame--failed">
        <div className="studio-create__state-art studio-create__state-art--failed" aria-hidden />
        <div className="studio-create__status studio-create__status--failed studio-create__status--failed-overlay">
          <p className="studio-create__status-title">生成失败</p>
        </div>
      </div>
      <StageResultInfo
        item={item}
        onRegenerate={onRegenerate}
        onEdit={onEdit}
        errorMessage={item.errorMessage ?? '网络或模型暂时不可用'}
      />
    </div>
  );
}

function StageCancelled({
  item,
  onRegenerate,
  onEdit,
}: {
  item: GenerateFeedItem;
  onRegenerate?: () => void;
  onEdit?: () => void;
}) {
  return (
    <div className="studio-create__result-stack studio-create__result-stack--state">
      <div className="studio-create__viewer-frame studio-create__state-frame studio-create__viewer-frame--pending">
        <div className="studio-create__status studio-create__status--overlay">
          <p className="studio-create__status-title">任务已取消</p>
        </div>
      </div>
      <StageResultInfo
        item={item}
        onRegenerate={onRegenerate}
        onEdit={onEdit}
        errorMessage={item.errorMessage ?? '任务已取消'}
      />
    </div>
  );
}

function StageResults({
  item,
  allItems,
  previewHasMore,
  onPreviewLoadMore,
  previewLoadingMore,
  selectedMediaIndex,
  onMediaIndexChange,
  onSelectTask,
  onToggleFavorite,
  onRegenerate,
  onEdit,
  onDelete,
}: {
  item: GenerateFeedItem;
  allItems: GenerateFeedItem[];
  previewHasMore: boolean;
  onPreviewLoadMore?: () => Promise<PreviewLoadMoreResult>;
  previewLoadingMore: boolean;
  selectedMediaIndex: number;
  onMediaIndexChange?: (index: number) => void;
  onSelectTask?: (taskId: string) => void;
  onToggleFavorite?: () => void;
  onRegenerate?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const media: GenerateResultMedia[] = item.resultImages ?? [];
  const total = Math.max(media.length, 1);
  const [previewOpen, setPreviewOpen] = useState(false);
  const pendingPreviewAdvanceRef = useRef(false);

  const previewSlides = useMemo(() => buildPreviewSlides(allItems), [allItems]);
  const selected = media.length > 0
    ? Math.min(Math.max(selectedMediaIndex, 0), media.length - 1)
    : 0;
  const [previewIndex, setPreviewIndex] = useState(() =>
    findPreviewIndex(previewSlides, item.id, selected),
  );

  const openPreview = () => {
    const idx = findPreviewIndex(previewSlides, item.id, selected);
    setPreviewIndex(idx);
    setPreviewOpen(true);
  };

  const handlePreviewIndexChange = useCallback((index: number) => {
    setPreviewIndex(index);
    const slide = previewSlides[index];
    if (!slide) return;
    if (slide.taskId !== item.id) {
      onSelectTask?.(slide.taskId);
    }
    onMediaIndexChange?.(slide.mediaIndex);
  }, [item.id, onMediaIndexChange, onSelectTask, previewSlides]);

  useEffect(() => {
    if (!pendingPreviewAdvanceRef.current) return;
    const nextIndex = previewIndex + 1;
    if (nextIndex < previewSlides.length) {
      handlePreviewIndexChange(nextIndex);
      pendingPreviewAdvanceRef.current = false;
    }
  }, [previewSlides.length, previewIndex, handlePreviewIndexChange]);

  const handlePreviewNext = useCallback(async () => {
    const slideTotal = previewSlides.length;
    if (slideTotal === 0) return;

    if (previewIndex < slideTotal - 1) {
      handlePreviewIndexChange(previewIndex + 1);
      return;
    }

    if (previewHasMore && onPreviewLoadMore) {
      const maxAttempts = 5;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const { deltaSlides, hasMore } = await onPreviewLoadMore();
        if (deltaSlides > 0) {
          pendingPreviewAdvanceRef.current = true;
          return;
        }
        if (!hasMore) break;
      }
      return;
    }

    handlePreviewIndexChange(0);
  }, [
    handlePreviewIndexChange,
    onPreviewLoadMore,
    previewHasMore,
    previewIndex,
    previewSlides.length,
  ]);

  const handlePreviewPrev = useCallback(() => {
    const slideTotal = previewSlides.length;
    if (slideTotal <= 1) return;
    handlePreviewIndexChange((previewIndex - 1 + slideTotal) % slideTotal);
  }, [handlePreviewIndexChange, previewIndex, previewSlides.length]);

  const setSelected = (updater: number | ((i: number) => number)) => {
    const next = typeof updater === 'function' ? updater(selected) : updater;
    onMediaIndexChange?.(next);
  };

  const currentMedia = media[selected];
  const isVideo = item.kind === 'video' || currentMedia?.type === 3;
  const currentAspectRatio = currentMedia?.width && currentMedia.height
    ? `${currentMedia.width} / ${currentMedia.height}`
    : undefined;
  const showBatchNav = media.length > 1;
  const goPrev = () => setSelected((i) => (i - 1 + media.length) % media.length);
  const goNext = () => setSelected((i) => (i + 1) % media.length);

  return (
    <div className="studio-create__result-stack">
      {/* 主图预览 */}
      <div className="studio-create__viewer-frame studio-create__viewer-frame--media">
        {currentMedia ? (
          <div
            className="studio-create__viewer-media"
            style={{ aspectRatio: currentAspectRatio } as CSSProperties}
          >
            {isVideo ? (
              <video
                key={`${item.id}-${selected}`}
                src={currentMedia.url}
                className="studio-create__viewer-img studio-create__viewer-video"
                controls
                playsInline
                preload="metadata"
                title="点击画面放大预览"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const inControls = e.clientY - rect.top > rect.height - 48;
                  if (inControls) return;
                  e.preventDefault();
                  openPreview();
                }}
              />
            ) : (
              <button
                type="button"
                className="studio-create__viewer-media-button"
                title="点击查看大图"
                onClick={openPreview}
              >
                <img
                  key={`${item.id}-${selected}`}
                  src={currentMedia.url}
                  alt={`生成结果 ${selected + 1}`}
                  className="studio-create__viewer-img"
                />
              </button>
            )}
          </div>
        ) : (
          <div
            className="studio-create__viewer-placeholder"
            key={`${item.id}-${selected}`}
            style={{ animation: 'studio-create-fade 200ms ease' } as CSSProperties}
            aria-label={`生成结果 ${selected + 1}/${total}`}
          />
        )}

        {/* 右上角操作区 */}
        <div className="studio-create__viewer-actions">
          {showBatchNav && (
            <span
              className="studio-create__viewer-badge"
              style={{ position: 'static', background: 'rgba(0,0,0,0.42)' }}
            >
              {selected + 1}/{total}
            </span>
          )}
          {onToggleFavorite && (
            <button
              type="button"
              className="studio-create__viewer-action"
              title={item.favorite ? '已收藏' : '收藏'}
              onClick={onToggleFavorite}
            >
              {item.favorite ? <StarFilled style={{ color: '#f59e0b' }} /> : <StarOutlined />}
            </button>
          )}
          {currentMedia && (
            <a
              href={currentMedia.url}
              download
              className="studio-create__viewer-action"
              title="下载"
            >
              <DownloadOutlined />
            </a>
          )}
          {onDelete && (
            <button
              type="button"
              className="studio-create__viewer-action"
              title="删除"
              onClick={() => {
                Modal.confirm({
                  title: '删除这条生成记录？',
                  content: '删除后无法恢复，进行中的任务会先尝试取消。',
                  okText: '删除',
                  okType: 'danger',
                  cancelText: '取消',
                  onOk: onDelete,
                });
              }}
            >
              <DeleteOutlined />
            </button>
          )}
        </div>

        {showBatchNav && (
          <>
            <button
              type="button"
              className="studio-create__viewer-nav studio-create__viewer-nav--prev"
              title="上一张"
              onClick={goPrev}
            >
              <LeftOutlined />
            </button>
            <button
              type="button"
              className="studio-create__viewer-nav studio-create__viewer-nav--next"
              title="下一张"
              onClick={goNext}
            >
              <RightOutlined />
            </button>
          </>
        )}
      </div>

      <CreateResultPreview
        open={previewOpen && previewSlides.length > 0}
        slides={previewSlides}
        currentIndex={previewIndex}
        loadingMore={previewLoadingMore}
        onClose={() => setPreviewOpen(false)}
        onIndexChange={handlePreviewIndexChange}
        onGoNext={handlePreviewNext}
        onGoPrev={handlePreviewPrev}
      />

      <StageResultInfo item={item} onRegenerate={onRegenerate} onEdit={onEdit} />
    </div>
  );
}
