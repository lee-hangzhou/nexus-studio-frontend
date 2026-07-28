import { CloseOutlined, FileOutlined } from '@ant-design/icons';

import type { TurnMaterialBlock } from '../../skills/types';
import { materialListKeys, turnMaterialLabel } from '../../skills/turnMaterialDisplay';

import styles from './CanvasMaterialChipList.module.css';

export type CanvasMaterialChipListProps = {
  materials: TurnMaterialBlock[];
  previewUrlsByAssetId: ReadonlyMap<number, string>;
  onRemove: (index: number) => void;
};

export function CanvasMaterialChipList({
  materials,
  previewUrlsByAssetId,
  onRemove,
}: CanvasMaterialChipListProps) {
  if (materials.length === 0) {
    return null;
  }

  const keys = materialListKeys(materials, 'chip');

  return (
    <div className={styles.root}>
      {materials.map((item, index) => {
        const label = turnMaterialLabel(item);
        const previewUrl =
          item.type === 'image' ? previewUrlsByAssetId.get(item.assetId) : undefined;
        return (
          <div key={keys[index]} className={styles.chip}>
            {previewUrl ? (
              <img className={styles.thumb} src={previewUrl} alt={label} />
            ) : (
              <span className={styles.icon} aria-hidden>
                <FileOutlined />
              </span>
            )}
            <span className={styles.name} title={label}>
              {label}
            </span>
            <button
              type="button"
              className={styles.remove}
              aria-label={`移除 ${label}`}
              onClick={() => onRemove(index)}
            >
              <CloseOutlined />
            </button>
          </div>
        );
      })}
    </div>
  );
}
