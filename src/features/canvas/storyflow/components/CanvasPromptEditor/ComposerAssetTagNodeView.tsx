import { AudioOutlined, FileTextOutlined } from '@ant-design/icons';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';

export function ComposerAssetTagNodeView({ node }: NodeViewProps) {
  const label = String(node.attrs.label ?? '');
  const mentionType = String(node.attrs.mentionType ?? 'image');
  const previewUrl = String(node.attrs.previewUrl ?? '').trim();
  const thumbUrl = String(node.attrs.thumbUrl ?? '').trim();
  const thumbSrc = thumbUrl || previewUrl;

  return (
    <NodeViewWrapper
      as="span"
      className="composer-asset-tag"
      data-id={String(node.attrs.id ?? '')}
      data-type={mentionType}
      data-preview-url={previewUrl}
      contentEditable={false}
    >
      {mentionType === 'audio' ? (
        <span className="composer-asset-audio" aria-hidden>
          <AudioOutlined />
        </span>
      ) : mentionType === 'text' ? (
        <span className="composer-asset-tag-text" aria-hidden>
          <FileTextOutlined />
        </span>
      ) : thumbSrc ? (
        <img src={thumbSrc} alt="" />
      ) : null}
      <span className="tag-label">{label}</span>
    </NodeViewWrapper>
  );
}
