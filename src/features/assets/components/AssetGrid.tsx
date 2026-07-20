import type { AssetBase } from '../../../domains/asset/types';
import { AssetTile } from './AssetTile';

interface AssetGridProps {
  items: AssetBase[];
  selectable?: boolean;
  selectedIds: Set<string>;
  onOpen: (asset: AssetBase) => void;
  onToggleSelect: (id: string) => void;
  onMediaError: (asset: AssetBase) => void;
}

export function AssetGrid({
  items,
  selectable = false,
  selectedIds,
  onOpen,
  onToggleSelect,
  onMediaError,
}: AssetGridProps) {
  return (
    <div className="studio-assets__grid" role="list">
      {items.map((asset) => (
        <AssetTile
          key={asset.id}
          asset={asset}
          selectable={selectable}
          selected={selectedIds.has(asset.id)}
          onMediaError={() => onMediaError(asset)}
          onClick={() => {
            if (selectable) {
              onToggleSelect(asset.id);
              return;
            }
            onOpen(asset);
          }}
        />
      ))}
    </div>
  );
}
