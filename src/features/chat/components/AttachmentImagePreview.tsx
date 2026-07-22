import { CloudDownloadOutlined } from '@ant-design/icons';
import { Image } from 'antd';

type AttachmentImagePreviewProps = {
  url: string;
  filename: string;
  /** 外层容器 class；overflow / 尺寸只放这里，不要绑到 ant-image 根上 */
  className?: string;
  /** ant-image 根 class，仅做展示样式 */
  imageClassName?: string;
  showDownload?: boolean;
};

/**
 * 对话气泡 / 右栏共用的图片预览。
 * Ant Image 预览层依赖根节点不被 overflow、aspect-ratio 锁死，所以裁剪包在外层。
 */
export function AttachmentImagePreview({
  url,
  filename,
  className,
  imageClassName,
  showDownload = false,
}: AttachmentImagePreviewProps) {
  return (
    <div className={className}>
      <Image
        src={url}
        alt={filename}
        preview={{ mask: false }}
        rootClassName={imageClassName}
      />
      {showDownload ? (
        <div className="studio-bubble__attachment-toolbar">
          <a
            className="studio-bubble__attachment-toolbar-btn"
            href={url}
            download={filename}
            title={`下载 ${filename}`}
            aria-label={`下载 ${filename}`}
            onClick={(event) => event.stopPropagation()}
          >
            <CloudDownloadOutlined />
          </a>
        </div>
      ) : null}
    </div>
  );
}
