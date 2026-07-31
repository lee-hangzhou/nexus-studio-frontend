import { DownloadOutlined, LoadingOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';

import type { ChatMessageView, MessageAttachment } from '../../../api/chat';
import { StudioButton } from '../../../shared/ui/StudioButton';
import { isImageAttachment, useAttachmentUrl } from '../hooks/useAttachmentUrl';
import { AttachmentImagePreview } from './AttachmentImagePreview';
import { FileTypeIcon, fileTypeLabel } from './FileTypeIcon';
import { getMessageAttachments } from './MessageAttachmentList';

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
      onClick={(event) => event.stopPropagation()}
    >
      <DownloadOutlined />
    </a>
  );
}

function PanelAttachmentRow({ attachment }: { attachment: MessageAttachment }) {
  const { url, loading } = useAttachmentUrl(attachment);
  const image = isImageAttachment(attachment);

  return (
    <div className="studio-panel__file">
      <div className={`studio-panel__ref-thumb${image ? '' : ' studio-panel__ref-thumb--icon'}`}>
        {loading ? (
          <LoadingOutlined className="studio-panel__ref-thumb-loading" />
        ) : image && url ? (
          <AttachmentImagePreview
            url={url}
            filename={attachment.filename}
            className="studio-panel__ref-thumb-frame"
            imageClassName="studio-panel__ref-thumb-img"
          />
        ) : (
          <FileTypeIcon mime={attachment.mime_type} filename={attachment.filename} size={16} />
        )}
      </div>
      <div className="studio-panel__file-info">
        <div className="studio-panel__file-name" title={attachment.filename}>
          {attachment.filename}
        </div>
        <div className="studio-panel__file-size">
          {fileTypeLabel(attachment.mime_type, attachment.filename)}
        </div>
      </div>
      {url ? <DownloadLink url={url} filename={attachment.filename} /> : null}
    </div>
  );
}

function dedupeById(attachments: MessageAttachment[]): MessageAttachment[] {
  const seen = new Set<number>();
  const result: MessageAttachment[] = [];
  for (const attachment of attachments) {
    if (seen.has(attachment.attachment_id)) continue;
    seen.add(attachment.attachment_id);
    result.push(attachment);
  }
  return result;
}

/** 会话生成内容 / 参考附件正文，供统一侧栏「资源」Tab 嵌入 */
export function SessionResourcesBody(props: {
  messages: ChatMessageView[];
  /** 项目侧产物（报告、Diff 回执等），并入「生成内容」 */
  projectArtifacts?: ReactNode;
  projectArtifactCount?: number;
}) {
  const { messages, projectArtifacts, projectArtifactCount = 0 } = props;
  const generated = dedupeById(
    messages
      .filter((message) => message.role === 'assistant')
      .flatMap((message) => getMessageAttachments(message.metadata)),
  );

  const refMaterials = dedupeById(
    messages
      .filter((message) => message.role === 'user')
      .flatMap((message) => getMessageAttachments(message.metadata)),
  );

  const generatedCount = generated.length + projectArtifactCount;
  const hasGenerated = generatedCount > 0;

  return (
    <div>
      <div className="studio-panel__section">
        <div className="studio-panel__section-header">
          <span className="studio-panel__section-title">
            生成内容{generatedCount > 0 ? ` (${generatedCount})` : ''}
          </span>
          {generated.length > 0 ? (
            <StudioButton variant="text" title="全部保存到资产">
              全部保存
            </StudioButton>
          ) : null}
        </div>

        {projectArtifacts}

        {!hasGenerated ? (
          <div className="studio-panel__placeholder">暂无生成内容</div>
        ) : (
          generated.map((attachment) => (
            <PanelAttachmentRow key={attachment.attachment_id} attachment={attachment} />
          ))
        )}
      </div>

      <div className="studio-panel__section">
        <div className="studio-panel__section-header">
          <span className="studio-panel__section-title">
            参考资源{refMaterials.length > 0 ? ` (${refMaterials.length})` : ''}
          </span>
        </div>

        {refMaterials.length === 0 ? (
          <div className="studio-panel__placeholder">暂无参考资源</div>
        ) : (
          refMaterials.map((attachment) => (
            <PanelAttachmentRow key={attachment.attachment_id} attachment={attachment} />
          ))
        )}
      </div>
    </div>
  );
}
