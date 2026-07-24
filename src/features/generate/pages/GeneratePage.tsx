import { useCallback, useEffect, useRef, useState } from 'react';
import { message } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  cancelTask,
  deleteTask,
  favoriteTask,
  getTaskStatus,
  getTasksStatus,
  listGenerateTasks,
  submitGenerate,
} from '../../../api/generate';
import type { GenerateTaskCursor } from '../../../api/generate';
import type { CreateComposerParams, CreateComposerSubmitPayload } from '../components/CreateComposer';
import { CreateComposer } from '../components/CreateComposer';
import { CreateHistoryPanel } from '../components/CreateHistoryPanel';
import { CreateStage } from '../components/CreateStage';
import { StudioChip } from '../../../shared/ui/StudioChip';
import type { GenerateFeedItem, GenerateKind, HistoryFilters } from '../types';
import { DEFAULT_HISTORY_FILTERS } from '../types';
import { toFeedItem, toFeedItemFromTaskList, toHistoryListPatch } from '../utils/feedItemMappers';
import { buildPreviewSlides } from '../utils/previewGallery';
import { buildGenerateTaskListRequest } from '../utils/taskListRequest';
import { isTaskQueued, isTaskTerminal, TASK_STATUS } from '../../../domains/task/types';
import { DEFAULT_CREATE_COMPOSER_PARAMS } from '../composerDefaults';
import {
  FOYER_HANDOFF_STATE_KEY,
  isFoyerCreateHandoff,
  type LocationStateWithFoyerHandoff,
} from '../../home/foyerHandoff';

export type LoadMoreHistoryResult = {
  appendedItems: GenerateFeedItem[];
  has_more: boolean;
};

const POLL_INTERVAL_MS = 5000;
const HISTORY_PAGE_SIZE = 15;
const SEARCH_DEBOUNCE_MS = 350;

function pickDefaultActiveId(items: GenerateFeedItem[]) {
  const latestSuccess = items.find((i) => i.status === TASK_STATUS.SUCCEEDED);
  if (latestSuccess) return latestSuccess.id;
  return items[0]?.id ?? null;
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function GeneratePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [historyItems, setHistoryItems] = useState<GenerateFeedItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeDetail, setActiveDetail] = useState<GenerateFeedItem | null>(null);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [kind, setKind] = useState<GenerateKind>('image');
  const [params, setParams] = useState<CreateComposerParams>(DEFAULT_CREATE_COMPOSER_PARAMS);
  const [historyFilters, setHistoryFilters] = useState<HistoryFilters>(DEFAULT_HISTORY_FILTERS);
  const [historyNextCursor, setHistoryNextCursor] = useState<GenerateTaskCursor | null>(null);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyInitialLoading, setHistoryInitialLoading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [composerDraft, setComposerDraft] = useState<
    { key: string; prompt: string; refImages?: GenerateFeedItem['refImages'] } | null
  >(null);
  const foyerHandoffConsumedRef = useRef(false);
  const handleSubmitRef = useRef<
    ((payload: CreateComposerSubmitPayload) => Promise<void>) | null
  >(null);

  const debouncedQuery = useDebouncedValue(historyFilters.query, SEARCH_DEBOUNCE_MS);
  const effectiveFilters = { ...historyFilters, query: debouncedQuery };

  const historyRequestGenRef = useRef(0);

  const activeItem = activeDetail;
  const pollingTaskKey = Array.from(
    new Set(
      historyItems
        .filter((item) => !isTaskTerminal(item.status))
        .map((item) => Number(item.id))
        .filter(Number.isFinite),
    ),
  ).join(',');

  const patchHistoryItem = useCallback((id: string, patch: Partial<GenerateFeedItem>) => {
    setHistoryItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    setActiveDetail((prev) => (prev?.id === id ? { ...prev, ...patch } : prev));
  }, []);

  const loadHistory = useCallback(
    async (mode: 'reset' | 'more'): Promise<LoadMoreHistoryResult | null> => {
      if (mode === 'more' && (historyLoading || !historyHasMore)) {
        return null;
      }
      setHistoryLoading(true);
      const requestGen = mode === 'reset' ? historyRequestGenRef.current + 1 : historyRequestGenRef.current;
      if (mode === 'reset') {
        historyRequestGenRef.current = requestGen;
        setHistoryInitialLoading(true);
      }
      try {
        const resp = await listGenerateTasks(
          buildGenerateTaskListRequest(
            effectiveFilters,
            mode === 'more' ? historyNextCursor : null,
            HISTORY_PAGE_SIZE,
          ),
        );
        if (mode === 'reset' && requestGen !== historyRequestGenRef.current) {
          return null;
        }
        const feedItems = resp.items
          .map(toFeedItemFromTaskList)
          .filter((item): item is GenerateFeedItem => item !== null);
        let appendedItems: GenerateFeedItem[] = feedItems;
        setHistoryItems((prev) => {
          if (mode === 'reset') return feedItems;
          const existingIds = new Set(prev.map((i) => i.id));
          appendedItems = feedItems.filter((i) => !existingIds.has(i.id));
          return [...prev, ...appendedItems];
        });
        setHistoryNextCursor(resp.next_cursor ?? null);
        setHistoryHasMore(resp.has_more ?? false);
        if (mode === 'reset') {
          setActiveId((current) => {
            if (current && feedItems.some((i) => i.id === current)) return current;
            return pickDefaultActiveId(feedItems);
          });
          return { appendedItems: feedItems, has_more: resp.has_more ?? false };
        }
        return { appendedItems, has_more: resp.has_more ?? false };
      } catch {
        if (mode === 'reset') {
          message.error('加载生成历史失败，请稍后重试');
        }
        return null;
      } finally {
        setHistoryLoading(false);
        if (mode === 'reset') {
          setHistoryInitialLoading(false);
        }
      }
    },
    [effectiveFilters, historyHasMore, historyLoading, historyNextCursor],
  );

  const loadMoreForPreview = useCallback(async () => {
    const beforeSlides = buildPreviewSlides(historyItems).length;
    const result = await loadHistory('more');
    if (!result) {
      return { deltaSlides: 0, hasMore: historyHasMore };
    }
    const merged = [...historyItems, ...result.appendedItems];
    const afterSlides = buildPreviewSlides(merged).length;
    return { deltaSlides: Math.max(0, afterSlides - beforeSlides), hasMore: result.has_more };
  }, [historyItems, historyHasMore, loadHistory]);

  useEffect(() => {
    void loadHistory('reset');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debouncedQuery,
    historyFilters.kind,
    historyFilters.status,
    historyFilters.time,
    historyFilters.favoritesOnly,
  ]);

  useEffect(() => {
    if (!pollingTaskKey) return;

    const taskIds = pollingTaskKey.split(',').map(Number);
    let cancelled = false;
    let inFlight = false;

    const tick = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        const response = await getTasksStatus(taskIds);
        if (cancelled) return;

        const details = new Map<string, GenerateFeedItem>();
        for (const view of response.items) {
          const detail = toFeedItem(view);
          if (detail !== null) details.set(String(view.task_id), detail);
        }
        const missingIds = new Set(response.missing_task_ids.map(String));
        setHistoryItems((prev) =>
          prev.map((item) => {
            const detail = details.get(item.id);
            if (detail) return { ...item, ...toHistoryListPatch(detail) };
            if (missingIds.has(item.id)) {
              return { ...item, status: TASK_STATUS.FAILED, errorMessage: '任务不存在或已删除' };
            }
            return item;
          }),
        );
        setActiveDetail((prev) => {
          if (!prev) return prev;
          const detail = details.get(prev.id);
          if (detail) return detail;
          if (missingIds.has(prev.id)) {
            return { ...prev, status: TASK_STATUS.FAILED, errorMessage: '任务不存在或已删除' };
          }
          return prev;
        });
      } catch {
        // 轮询失败不中断，下次继续
      } finally {
        inFlight = false;
      }
    };

    void tick();
    const intervalId = window.setInterval(() => void tick(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [pollingTaskKey]);

  useEffect(() => {
    if (!activeId?.startsWith('optimistic-')) return;
    setActiveDetail(historyItems.find((i) => i.id === activeId) ?? null);
  }, [activeId, historyItems]);

  useEffect(() => {
    if (!activeId) {
      setActiveDetail(null);
      return;
    }
    if (activeId.startsWith('optimistic-')) return;

    const taskId = Number(activeId);
    if (!Number.isFinite(taskId)) return;

    let cancelled = false;
    getTaskStatus(taskId)
      .then((view) => {
        if (cancelled) return;
        const detail = toFeedItem(view);
        if (detail === null) return;
        setActiveDetail(detail);
        patchHistoryItem(activeId, toHistoryListPatch(detail));
      })
      .catch(() => {
        if (!cancelled) {
          setActiveDetail((prev) => (prev?.id === activeId ? prev : null));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeId, patchHistoryItem]);

  const handleSubmit = useCallback(
    async (payload: CreateComposerSubmitPayload) => {
      const optimisticId = `optimistic-${Date.now()}`;
      const optimisticItem: GenerateFeedItem = {
        id: optimisticId,
        kind: payload.kind,
        status: TASK_STATUS.CREATED,
        prompt: payload.prompt,
        modelId: payload.params.model,
        modelLabel: payload.params.model.replace(/-/g, ' '),
        createdAt: new Date().toISOString(),
        resultCount: 0,
        ratio: payload.params.ratio,
        resolution: payload.params.resolution,
        duration: payload.kind === 'video' ? payload.params.duration : undefined,
        referenceMode: payload.params.referenceMode,
        refImages: payload.refImages,
      };
      setKind(payload.kind);
      setHistoryItems((prev) => [optimisticItem, ...prev]);
      setActiveDetail(optimisticItem);
      setActiveId(optimisticId);

      try {
        const resp = await submitGenerate({
          kind: payload.kind,
          prompt: payload.prompt,
          model_id: payload.params.model,
          ratio: payload.params.ratio,
          resolution: payload.params.resolution,
          count: payload.params.count,
          duration: payload.kind === 'video' ? payload.params.duration : undefined,
          reference_mode: payload.params.referenceMode,
          ref_attachment_ids: payload.refImages
            .map((item) => item.materialId)
            .filter((id): id is number => id != null),
          ref_asset_ids: payload.refImages
            .map((item) => item.assetId)
            .filter((id): id is number => id != null),
        });

        const realId = String(resp.task_id);
        const promote = (item: GenerateFeedItem) =>
          item.id === optimisticId ? { ...item, id: realId, status: resp.status } : item;
        setHistoryItems((prev) => prev.map(promote));
        setActiveDetail((prev) =>
          prev?.id === optimisticId ? { ...prev, id: realId, status: resp.status } : prev,
        );
        setActiveId(realId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : '提交失败，请重试';
        patchHistoryItem(optimisticId, { status: TASK_STATUS.FAILED, errorMessage: msg });
      }
    },
    [patchHistoryItem],
  );

  handleSubmitRef.current = handleSubmit;

  useEffect(() => {
    if (foyerHandoffConsumedRef.current) return;
    const locationState = location.state as LocationStateWithFoyerHandoff | null;
    const handoff = locationState?.[FOYER_HANDOFF_STATE_KEY];
    if (!isFoyerCreateHandoff(handoff)) return;

    foyerHandoffConsumedRef.current = true;
    navigate(location.pathname, { replace: true, state: {} });

    setKind(handoff.payload.kind);
    setParams(handoff.payload.params);
    setComposerDraft({
      key: `foyer-${Date.now()}`,
      prompt: handoff.payload.prompt,
      refImages: handoff.payload.refImages,
    });
    void handleSubmitRef.current?.(handoff.payload);
  }, [location.pathname, location.state, navigate]);

  const buildParamsFromItem = (item: GenerateFeedItem): CreateComposerParams => ({
    model: item.modelId,
    ratio: item.ratio ?? params.ratio,
    resolution: item.resolution ?? params.resolution,
    count:
      item.kind === 'image' && item.status === TASK_STATUS.SUCCEEDED && item.resultCount > 0
        ? item.resultCount
        : params.count,
    duration: item.kind === 'video' ? (item.duration ?? params.duration) : undefined,
    referenceMode: item.referenceMode ?? params.referenceMode,
  });

  const regenerateActive = () => {
    if (!activeItem) return;
    void handleSubmit({
      kind: activeItem.kind,
      prompt: activeItem.prompt,
      params: buildParamsFromItem(activeItem),
      refImages: activeItem.refImages ?? [],
    });
  };

  const editActive = () => {
    if (!activeItem) return;
    setKind(activeItem.kind);
    setParams(buildParamsFromItem(activeItem));
    setComposerDraft({
      key: `${activeItem.id}-${Date.now()}`,
      prompt: activeItem.prompt,
      refImages: activeItem.refImages ?? [],
    });
  };

  const toggleFavorite = useCallback(
    async (id: string) => {
      const target = historyItems.find((i) => i.id === id) ?? (activeDetail?.id === id ? activeDetail : null);
      if (!target) return;
      const nextFavorite = !target.favorite;
      patchHistoryItem(id, { favorite: nextFavorite });
      try {
        await favoriteTask(Number(id), nextFavorite);
        if (historyFilters.favoritesOnly && !nextFavorite) {
          setHistoryItems((prev) => prev.filter((i) => i.id !== id));
          if (activeId === id) {
            setActiveId(null);
            setActiveDetail(null);
          }
        }
      } catch {
        patchHistoryItem(id, { favorite: target.favorite });
      }
    },
    [activeDetail, activeId, historyFilters.favoritesOnly, historyItems, patchHistoryItem],
  );

  const handleCancelTask = useCallback(
    async (id: string) => {
      const taskId = Number(id);
      if (!Number.isFinite(taskId)) return;
      try {
        await cancelTask(taskId);
        patchHistoryItem(id, { status: TASK_STATUS.CANCELLED, errorMessage: '已取消' });
      } catch (err) {
        const msg = err instanceof Error ? err.message : '取消失败，请稍后重试';
        message.warning(msg);
      }
    },
    [patchHistoryItem],
  );

  const handleDeleteTask = useCallback(
    async (id: string) => {
      const taskId = Number(id);
      if (!Number.isFinite(taskId)) {
        setHistoryItems((prev) => prev.filter((i) => i.id !== id));
        if (activeId === id) {
          setActiveId(null);
          setActiveDetail(null);
        }
        return;
      }
      try {
        await deleteTask(taskId);
        setHistoryItems((prev) => {
          const next = prev.filter((i) => i.id !== id);
          if (activeId === id) {
            setActiveId(pickDefaultActiveId(next));
            setActiveDetail(null);
          }
          return next;
        });
        message.success('已删除');
      } catch (err) {
        const msg = err instanceof Error ? err.message : '删除失败，请稍后重试';
        message.warning(msg);
      }
    },
    [activeId],
  );

  const loadMoreHistory = useCallback(() => {
    void loadHistory('more');
  }, [loadHistory]);

  const handleParamsChange = (patch: Partial<CreateComposerParams>) => {
    setParams((p) => ({ ...p, ...patch }));
    if (patch.model?.includes('video')) setKind('video');
  };

  return (
    <div className={`studio-create${historyOpen ? ' studio-create--history-open' : ''}`}>
      <StudioChip
        className="studio-create__history-toggle"
        active={historyOpen}
        icon={<HistoryOutlined aria-hidden />}
        onClick={() => setHistoryOpen((value) => !value)}
      >
        最近生成
      </StudioChip>
      <div className="studio-create__center">
        <CreateStage
          item={activeItem}
          allItems={historyItems}
          previewHasMore={historyHasMore}
          onPreviewLoadMore={loadMoreForPreview}
          previewLoadingMore={historyLoading}
          selectedMediaIndex={activeMediaIndex}
          onMediaIndexChange={setActiveMediaIndex}
          onSelectTask={setActiveId}
          onToggleFavorite={activeItem ? () => toggleFavorite(activeItem.id) : undefined}
          onRegenerate={activeItem ? regenerateActive : undefined}
          onEdit={activeItem ? editActive : undefined}
          onCancel={
            activeItem
            && activeItem.kind !== 'image'
            && isTaskQueued(activeItem.status)
            && Number.isFinite(Number(activeItem.id))
              ? () => handleCancelTask(activeItem.id)
              : undefined
          }
        />
        <CreateComposer
          kind={kind}
          params={params}
          draft={composerDraft}
          onKindChange={setKind}
          onParamsChange={handleParamsChange}
          onSubmit={handleSubmit}
        />
      </div>

      {historyOpen ? (
        <aside className="studio-create__history-panel">
          <CreateHistoryPanel
            items={historyItems}
            filters={historyFilters}
            onFiltersChange={setHistoryFilters}
            activeId={activeId}
            onSelect={(id) => {
              setActiveId(id);
              setActiveMediaIndex(0);
            }}
            onToggleFavorite={toggleFavorite}
            onCancel={handleCancelTask}
            onDelete={handleDeleteTask}
            hasMore={historyHasMore}
            onLoadMore={loadMoreHistory}
            loadingMore={historyLoading}
            initialLoading={historyInitialLoading}
          />
        </aside>
      ) : null}
    </div>
  );
}
