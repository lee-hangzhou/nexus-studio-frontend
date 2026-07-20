import { CheckOutlined, StarFilled } from '@ant-design/icons';
import type { AssetBase } from '../../../domains/asset/types';
import { ASSET_SOURCE_LABEL } from '../constants';

interface AssetTileProps {
  asset: AssetBase;
  selected?: boolean;
  selectable?: boolean;
  onClick: () => void;
  onMediaError?: () => void;
}

export function AssetTile({
  asset,
  selected = false,
  selectable = false,
  onClick,
  onMediaError,
}: AssetTileProps) {
  return (
    <button
      type="button"
      className={`studio-assets__tile${selected ? ' studio-assets__tile--selected' : ''}`}
      onClick={onClick}
      aria-label={asset.title}
    >
      <div className="studio-assets__tile-visual">
        {asset.kind === 'video' && asset.previewUrl ? (
          <video
            className="studio-assets__tile-media"
            src={asset.previewUrl}
            muted
            playsInline
            onError={onMediaError}
          />
        ) : asset.previewUrl ? (
          <img
            className="studio-assets__tile-media"
            src={asset.previewUrl}
            alt=""
            loading="lazy"
            onError={onMediaError}
          />
        ) : (
          <span className="studio-assets__tile-media" data-kind={asset.kind} />
        )}
        <span className="studio-assets__tile-kind">{asset.kind === 'video' ? '视频' : '图片'}</span>
        {asset.favorite ? <StarFilled className="studio-assets__tile-fav" aria-label="已收藏" /> : null}
        {selectable ? (
          <span className={`studio-assets__tile-check${selected ? ' studio-assets__tile-check--on' : ''}`}>
            {selected ? <CheckOutlined /> : null}
          </span>
        ) : null}
      </div>
      <span className="studio-assets__tile-info">
        <span className="studio-assets__tile-title">{asset.title}</span>
        <span className="studio-assets__tile-sub">{ASSET_SOURCE_LABEL[asset.source]}</span>
      </span>
    </button>
  );
}
