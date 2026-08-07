import { UploadOutlined } from '@ant-design/icons';
import { message } from 'antd';
import { useCallback, useRef, useState } from 'react';
import { useCanvasProject } from '../../../context/CanvasProjectContext';
import { uploadCanvasNodeAsset } from '../../../api/canvas';

/** 无图时节点上方「上传」入口：上传素材并写回节点 data(output_source=upload) */
export function ImageUploadEntry({ nodeId }: { nodeId: string }) {
  const { episodeId } = useCanvasProject();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const openPicker = useCallback(() => {
    if (uploading) return;
    inputRef.current?.click();
  }, [uploading]);

  const onFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        message.warning('请上传图片文件');
        return;
      }
      setUploading(true);
      uploadCanvasNodeAsset(episodeId, nodeId, file).catch((err) => {
        message.error(err instanceof Error ? err.message : '上传失败');
      }).finally(() => setUploading(false));
    },
    [episodeId, nodeId],
  );

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="workflow-image-node__upload-input"
        onChange={onFileChange}
      />
      <button
        type="button"
        className="workflow-image-node__upload-btn nodrag nopan"
        disabled={uploading}
        onClick={openPicker}
      >
        <UploadOutlined />
        <span>{uploading ? '上传中…' : '上传图片'}</span>
      </button>
    </>
  );
}
