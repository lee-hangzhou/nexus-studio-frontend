import { UploadOutlined } from '@ant-design/icons';
import { message } from 'antd';
import { useCallback, useRef } from 'react';

/** 无图时节点上方「上传」入口（视觉对齐 storyflow，上传能力待后端素材接口） */
export function ImageUploadEntry({ nodeId }: { nodeId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const onFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        message.warning('请上传图片文件');
        return;
      }
      message.info(`节点 ${nodeId}：本地上传待接入素材服务`);
    },
    [nodeId],
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
      <button type="button" className="workflow-image-node__upload-btn nodrag nopan" onClick={openPicker}>
        <UploadOutlined />
        <span>上传图片</span>
      </button>
    </>
  );
}
