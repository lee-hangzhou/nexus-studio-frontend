import { CloseOutlined, PlusOutlined, SwapOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';
import type { GenerateKind, GenerateRefImage } from '../types';
import {
  isDualFrameMode,
  isFirstFrameMode,
} from './referenceMode';

export type GenerationRefRailProps = {
  kind: GenerateKind;
  referenceMode?: number;
  assets: (GenerateRefImage | null)[];
  maxOmniAssets?: number;
  uploading?: boolean;
  /** 画布图前任参考等，插入全能轨最前 */
  leadingSlot?: ReactNode;
  onAdd: (slotIndex?: number) => void;
  onRemove: (id: string) => void;
  onRemoveSlot?: (index: 0 | 1) => void;
  onSwapFrames?: () => void;
};

function RefImageThumb({ img, onRemove }: { img: GenerateRefImage; onRemove: () => void }) {
  const isImage = img.mimeType.startsWith('image/');
  return (
    <div className="studio-create__ref-thumb">
      {isImage ? (
        <img src={img.url} alt={img.name} />
      ) : img.mimeType.startsWith('video/') ? (
        <video src={img.url} muted playsInline />
      ) : (
        <div className="studio-create__ref-file" title={img.name}>
          <span className="studio-create__ref-file-mark">@</span>
          <span className="studio-create__ref-file-name">{img.name}</span>
        </div>
      )}
      <button
        type="button"
        className="studio-create__ref-thumb-del"
        aria-label="移除参考图"
        onClick={onRemove}
      >
        <CloseOutlined />
      </button>
    </div>
  );
}

function FrameSlot({
  asset,
  label,
  onAdd,
  onRemove,
}: {
  asset: GenerateRefImage | null;
  label: string;
  onAdd: () => void;
  onRemove: () => void;
}) {
  if (asset) {
    return (
      <div className="studio-create__frame-box" title={asset.name}>
        <img src={asset.url} alt={asset.name} />
        <button
          type="button"
          className="studio-create__frame-del"
          aria-label={`移除${label}`}
          onClick={onRemove}
        >
          <CloseOutlined />
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      className="studio-create__frame-box studio-create__frame-box--empty"
      onClick={onAdd}
      aria-label={`添加${label}`}
    >
      <span className="studio-create__frame-upload">
        <span>+</span>
        <span>{label}</span>
      </span>
    </button>
  );
}

export function GenerationRefRail({
  kind,
  referenceMode,
  assets,
  maxOmniAssets,
  uploading = false,
  leadingSlot,
  onAdd,
  onRemove,
  onRemoveSlot,
  onSwapFrames,
}: GenerationRefRailProps) {
  if (isDualFrameMode(kind, referenceMode)) {
    const slots: [GenerateRefImage | null, GenerateRefImage | null] = [
      assets[0] ?? null,
      assets[1] ?? null,
    ];
    return (
      <div className="studio-create__refs">
        {leadingSlot}
        <div className="studio-create__dual-frame">
          <FrameSlot
            asset={slots[0]}
            label="首帧"
            onAdd={() => onAdd(0)}
            onRemove={() => onRemoveSlot?.(0)}
          />
          <button
            type="button"
            className="studio-create__frame-swap"
            aria-label="交换首帧与尾帧"
            disabled={!slots[0] || !slots[1]}
            onClick={onSwapFrames}
          >
            <SwapOutlined />
          </button>
          <FrameSlot
            asset={slots[1]}
            label="尾帧"
            onAdd={() => onAdd(1)}
            onRemove={() => onRemoveSlot?.(1)}
          />
        </div>
      </div>
    );
  }

  if (isFirstFrameMode(kind, referenceMode)) {
    const asset = assets[0] ?? null;
    return (
      <div className="studio-create__refs">
        {leadingSlot}
        <div className="studio-create__dual-frame studio-create__dual-frame--single">
          <FrameSlot
            asset={asset}
            label="首帧"
            onAdd={() => onAdd(0)}
            onRemove={() => (asset ? onRemove(asset.id) : undefined)}
          />
        </div>
      </div>
    );
  }

  const filled = assets.filter((item): item is GenerateRefImage => item != null);
  const canAdd = maxOmniAssets == null || filled.length < maxOmniAssets;

  return (
    <div className="studio-create__refs">
      {leadingSlot}
      {filled.map((img) => (
        <RefImageThumb key={img.id} img={img} onRemove={() => onRemove(img.id)} />
      ))}
      {canAdd ? (
        <button
          type="button"
          className="studio-create__ref-add"
          onClick={() => onAdd()}
          title="添加参考素材"
          aria-label="添加参考素材"
        >
          <PlusOutlined />
        </button>
      ) : null}
      {filled.length === 0 && uploading ? (
        <span className="studio-create__ref-hint">素材上传中...</span>
      ) : null}
    </div>
  );
}
