import { DownloadOutlined, LoadingOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import { Image } from 'antd';
import type { ChatMessageView, MessageAttachment } from '../../../api/chat';
import { isImageMime, useAttachmentUrl } from '../hooks/useAttachmentUrl';
import { FileTypeIcon, fileTypeLabel } from './FileTypeIcon';
import { getMessageAttachments } from './MessageAttachmentList';

// ── 图片缩略图（生成内容用，16:9 格） ────────────────────────────────────────

function PanelThumb({ attachment }: { attachment: MessageAttachment }) {
  const { url, loading } = useAttachmentUrl(attachment);

  if (loading) {
    return (
      <div className="studio-panel__thumb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#eee' }}>
        <LoadingOutlined style={{ color: 'var(--studio-text-secondary)' }} />
      </div>
    );
  }

  if (!url) {
    return (
      <div className="studio-panel__thumb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <FileTypeIcon mime={attachment.mime_type} filename={attachment.filename} size={18} />
      </div>
    );
  }

  return (
    <Image
      src={url}
      alt={attachment.filename}
      rootClassName="studio-panel__thumb"
      preview={{ mask: false }}
    />
  );
}

// ── 生成文件行（非图片的生成产物，可下载） ───────────────────────────────────

function GeneratedFileItem({ attachment }: { attachment: MessageAttachment }) {
  const { url, loading } = useAttachmentUrl(attachment);

  const content = (
    <>
      <div className="studio-panel__file-icon">
        {loading ? (
          <LoadingOutlined style={{ color: 'var(--studio-text-secondary)', fontSize: 16 }} />
        ) : (
          <FileTypeIcon mime={attachment.mime_type} filename={attachment.filename} size={20} />
        )}
      </div>
      <div className="studio-panel__file-info">
        <div className="studio-panel__file-name">{attachment.filename}</div>
        <div className="studio-panel__file-size">{fileTypeLabel(attachment.mime_type, attachment.filename)}</div>
      </div>
      {url && <DownloadOutlined className="studio-panel__file-download" />}
    </>
  );

  if (!url) {
    return <div className="studio-panel__file">{content}</div>;
  }

  return (
    <a
      className="studio-panel__file studio-panel__file--link"
      href={url}
      target="_blank"
      rel="noreferrer"
      download={attachment.filename}
      title={`下载 ${attachment.filename}`}
    >
      {content}
    </a>
  );
}

// ── 参考素材图片行（有 URL → 缩略图；无则图标） ─────────────────────────────

function DownloadLink({ url, filename }: { url: string; filename: string }) {
  return (
    <a
      className="studio-panel__file-download"
      href={url}
      target="_blank"
      rel="noreferrer"
      download={filename}
      title={`下载 ${filename}`}
      aria-label={`下载 ${filename}`}
      onClick={(e) => e.stopPropagation()}
    >
      <DownloadOutlined />
    </a>
  );
}

function RefImageItem({ attachment }: { attachment: MessageAttachment }) {
  const { url, loading } = useAttachmentUrl(attachment);

  return (
    <div className="studio-panel__file">
      <div className="studio-panel__ref-thumb">
        {loading ? (
          <LoadingOutlined style={{ color: 'var(--studio-text-secondary)', fontSize: 14 }} />
        ) : url ? (
          <Image
            src={url}
            alt={attachment.filename}
            rootClassName="studio-panel__ref-thumb-img"
            preview={{ mask: false }}
          />
        ) : (
          <FileTypeIcon mime={attachment.mime_type} filename={attachment.filename} size={16} />
        )}
      </div>
      <div className="studio-panel__file-info">
        <div className="studio-panel__file-name">{attachment.filename}</div>
        <div className="studio-panel__file-size">{fileTypeLabel(attachment.mime_type, attachment.filename)}</div>
      </div>
      {url && <DownloadLink url={url} filename={attachment.filename} />}
    </div>
  );
}

// ── 参考素材文件行 ────────────────────────────────────────────────────────────

function RefFileItem({ attachment }: { attachment: MessageAttachment }) {
  const { url, loading } = useAttachmentUrl(attachment);

  return (
    <div className="studio-panel__file">
      <div className="studio-panel__file-icon">
        {loading ? (
          <LoadingOutlined style={{ color: 'var(--studio-text-secondary)', fontSize: 16 }} />
        ) : (
          <FileTypeIcon mime={attachment.mime_type} filename={attachment.filename} size={20} />
        )}
      </div>
      <div className="studio-panel__file-info">
        <div className="studio-panel__file-name">{attachment.filename}</div>
        <div className="studio-panel__file-size">{fileTypeLabel(attachment.mime_type, attachment.filename)}</div>
      </div>
      {url && <DownloadLink url={url} filename={attachment.filename} />}
    </div>
  );
}

// ── 参考素材行路由 ─────────────────────────────────────────────────────────────

function RefMaterialItem({ attachment }: { attachment: MessageAttachment }) {
  return isImageMime(attachment.mime_type)
    ? <RefImageItem attachment={attachment} />
    : <RefFileItem attachment={attachment} />;
}

function dedupeById(attachments: MessageAttachment[]): MessageAttachment[] {
  const seen = new Set<number>();
  const result: MessageAttachment[] = [];
  for (const a of attachments) {
    if (seen.has(a.attachment_id)) continue;
    seen.add(a.attachment_id);
    result.push(a);
  }
  return result;
}

// ── 主组件 ───────────────────────────────────────────────────────────────────

interface ChatRightPanelProps {
  messages: ChatMessageView[];
  onAddRef?: () => void;
}

export function ChatRightPanel({ messages, onAddRef }: ChatRightPanelProps) {
  // 生成内容：AI 消息中的所有附件（图片缩略图 + 文件可下载），按 id 去重
  const generatedAll = dedupeById(
    messages
      .filter((m) => m.role === 'assistant')
      .flatMap((m) => getMessageAttachments(m.metadata)),
  );
  const generatedImages = generatedAll.filter((a) => isImageMime(a.mime_type));
  const generatedFiles = generatedAll.filter((a) => !isImageMime(a.mime_type));
  const generatedCount = generatedAll.length;

  // 参考素材：用户上传的所有附件（图片 + 文件混合）
  const refMaterials: MessageAttachment[] = dedupeById(
    messages
      .filter((m) => m.role === 'user')
      .flatMap((m) => getMessageAttachments(m.metadata)),
  );

  return (
    <aside className="studio-chat__panel">
      <div className="studio-panel__title">当前会话资源</div>

      {/* ── 生成内容 ── */}
      <div className="studio-panel__section">
        <div className="studio-panel__section-header">
          <span className="studio-panel__section-title">
            生成内容{generatedCount > 0 ? ` (${generatedCount})` : ''}
          </span>
          {generatedCount > 0 && (
            <button type="button" className="studio-panel__section-link" title="全部保存到资产">
              <SaveOutlined style={{ marginRight: 3 }} />
              全部保存
            </button>
          )}
        </div>

        {generatedCount === 0 ? (
          <div className="studio-panel__placeholder">暂无生成内容</div>
        ) : (
          <>
            {generatedImages.length > 0 && (
              <div className="studio-panel__grid">
                {generatedImages.map((a) => (
                  <PanelThumb key={a.attachment_id} attachment={a} />
                ))}
              </div>
            )}
            {generatedFiles.map((a) => (
              <GeneratedFileItem key={a.attachment_id} attachment={a} />
            ))}
          </>
        )}
      </div>

      {/* ── 参考素材 ── */}
      <div className="studio-panel__section">
        <div className="studio-panel__section-header">
          <span className="studio-panel__section-title">
            参考素材{refMaterials.length > 0 ? ` (${refMaterials.length})` : ''}
          </span>
        </div>

        {refMaterials.length === 0 ? (
          <div className="studio-panel__placeholder">暂无参考素材</div>
        ) : (
          refMaterials.map((a) => (
            <RefMaterialItem key={a.attachment_id} attachment={a} />
          ))
        )}

        <button type="button" className="studio-panel__add-btn" onClick={onAddRef}>
          <PlusOutlined />
          添加参考素材
        </button>
      </div>
    </aside>
  );
}
