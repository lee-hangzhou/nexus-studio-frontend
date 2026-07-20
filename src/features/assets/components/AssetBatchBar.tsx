import { Button } from 'antd';

interface AssetBatchBarProps {
  count: number;
  onDelete: () => void;
  onCancel: () => void;
}

export function AssetBatchBar({ count, onDelete, onCancel }: AssetBatchBarProps) {
  if (count === 0) return null;

  return (
    <div className="studio-assets__batch" role="status">
      <span className="studio-assets__batch-count">已选 {count} 项</span>
      <div className="studio-assets__batch-actions">
        <Button type="text" danger onClick={onDelete}>
          删除
        </Button>
        <Button type="text" onClick={onCancel}>
          取消
        </Button>
      </div>
    </div>
  );
}
