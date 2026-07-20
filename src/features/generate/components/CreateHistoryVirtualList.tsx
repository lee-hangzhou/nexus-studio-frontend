import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { HeartFilled, HeartOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import type { HistoryListRow } from '../types';
import { measureHistoryList, statusLabel } from '../utils/createHistory';
import { CreateThumb } from './CreateThumb';

const OVERSCAN_PX = 240;

interface CreateHistoryVirtualListProps {
  rows: HistoryListRow[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onToggleFavorite: (id: string) => void;
}

export function CreateHistoryVirtualList({
  rows,
  activeId,
  onSelect,
  onToggleFavorite,
}: CreateHistoryVirtualListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewportH, setViewportH] = useState(480);
  const [scrollTop, setScrollTop] = useState(0);

  const layout = useMemo(() => measureHistoryList(rows), [rows]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewportH(el.clientHeight));
    ro.observe(el);
    setViewportH(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const visibleIndices = useMemo(() => {
    if (rows.length === 0) return [];
    const viewTop = Math.max(0, scrollTop - OVERSCAN_PX);
    const viewBottom = scrollTop + viewportH + OVERSCAN_PX;
    const indices: number[] = [];
    for (let i = 0; i < rows.length; i += 1) {
      const top = layout.offsets[i];
      const bottom = top + layout.heights[i];
      if (bottom >= viewTop && top <= viewBottom) {
        indices.push(i);
      }
    }
    return indices;
  }, [layout.heights, layout.offsets, rows.length, scrollTop, viewportH]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (el) setScrollTop(el.scrollTop);
  }, []);

  if (rows.length === 0) {
    return <p className="studio-create-history__empty">没有符合条件的记录</p>;
  }

  return (
    <div ref={scrollRef} className="studio-create-history__list" onScroll={onScroll}>
      <div className="studio-create-history__list-inner" style={{ height: layout.total }}>
        {visibleIndices.map((index) => {
          const row = rows[index];
          const top = layout.offsets[index];
          const height = layout.heights[index];

          if (row.type === 'header') {
            return (
              <div
                key={row.key}
                className="studio-create-history__group"
                style={{ transform: `translateY(${top}px)`, height }}
              >
                {row.label}
              </div>
            );
          }

          const { item } = row;
          const active = item.id === activeId;

          return (
            <div
              key={row.key}
              className={`studio-create-history__row${active ? ' studio-create-history__row--active' : ''}`}
              style={{ transform: `translateY(${top}px)`, height }}
            >
              <CreateThumb
                item={item}
                active={active}
                compact
                onClick={() => onSelect(item.id)}
              />
              <button
                type="button"
                className="studio-create-history__row-main"
                onClick={() => onSelect(item.id)}
              >
                <span className="studio-create-history__row-prompt">{item.prompt}</span>
                <span className="studio-create-history__row-meta">
                  <span>{item.kind === 'image' ? '图片' : '视频'}</span>
                  <span aria-hidden>·</span>
                  <span>{statusLabel(item.status)}</span>
                  <span aria-hidden>·</span>
                  <span>{item.modelLabel}</span>
                </span>
              </button>
              <Button
                type="text"
                className="studio-create-history__fav"
                icon={item.favorite ? <HeartFilled /> : <HeartOutlined />}
                aria-label={item.favorite ? '取消置顶' : '置顶到胶片条'}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(item.id);
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
