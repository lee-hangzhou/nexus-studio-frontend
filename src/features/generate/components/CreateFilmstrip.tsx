import { buildFilmstripWorkset } from '../utils/createHistory';
import { useHorizontalDragScroll } from '../hooks/useHorizontalDragScroll';
import type { GenerateFeedItem } from '../types';
import { CreateThumb } from './CreateThumb';

interface CreateFilmstripProps {
  items: GenerateFeedItem[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onOpenHistory?: () => void;
}

/** 最近生成批次列表（横向拖动滚动，无翻页箭头） */
export function CreateFilmstrip({ items, activeId, onSelect }: CreateFilmstripProps) {
  const workset = buildFilmstripWorkset(items, activeId);

  const {
    trackRef,
    dragging,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    shouldSuppressClick,
  } = useHorizontalDragScroll();

  const selectItem = (id: string) => {
    if (shouldSuppressClick()) return;
    onSelect(id);
  };

  return (
    <div className="studio-create__filmstrip" aria-label="最近生成">
      <div className="studio-create__filmstrip-scroller">
        <div
          ref={trackRef}
          className={`studio-create__filmstrip-track${dragging ? ' studio-create__filmstrip-track--dragging' : ''}`}
          role="listbox"
          aria-label="拖动或滑动浏览历史批次"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        >
          {workset.map((item) => (
            <CreateThumb
              key={item.id}
              item={item}
              active={item.id === activeId}
              onClick={() => selectItem(item.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
