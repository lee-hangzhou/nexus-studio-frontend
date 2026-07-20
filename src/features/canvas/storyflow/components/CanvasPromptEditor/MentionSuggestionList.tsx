import { useMemo } from 'react';
import {
  AudioOutlined,
  FileTextOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import type { SuggestionProps } from '@tiptap/suggestion';
import { Menu } from 'antd';
import type { MenuProps } from 'antd';
import {
  parseAssetIdFromMentionId,
  resolveMentionDisplayLabel,
} from '../../providers/canvasMentionProvider';
import type { WorkflowMentionItem, WorkflowMentionMediaType } from './types';

export const AT_POPOVER_MENU_STYLE = {
  width: 220,
  maxHeight: 400,
  overflowY: 'auto',
} as const;

const MENTION_TYPE_ORDER: WorkflowMentionMediaType[] = ['image', 'video', 'audio', 'text'];

function renderMenuThumb(item: WorkflowMentionItem) {
  if (item.type === 'audio') {
    return (
      <span className="asset-menu-thumb asset-menu-thumb--audio" aria-hidden>
        <AudioOutlined />
      </span>
    );
  }
  if (item.type === 'text') {
    return (
      <span className="asset-menu-thumb asset-menu-thumb--text" aria-hidden>
        <FileTextOutlined />
      </span>
    );
  }
  const src = item.previewUrl ?? '';
  if (!src) {
    return null;
  }
  return (
    <span className="asset-menu-thumb-media" aria-hidden>
      <img src={src} alt="" />
      {item.type === 'video' ? (
        <span className="asset-menu-thumb-media__video-badge">
          <PlayCircleOutlined />
        </span>
      ) : null}
    </span>
  );
}

function buildConnectedMenuItems(
  items: WorkflowMentionItem[],
  onSelect: (item: WorkflowMentionItem) => void,
): MenuProps['items'] {
  const connected = items.filter((item) => item.source === 'connected' || !item.source);
  if (connected.length === 0) {
    return undefined;
  }

  const ordered: WorkflowMentionItem[] = [];
  for (const t of MENTION_TYPE_ORDER) {
    ordered.push(...connected.filter((i) => i.type === t));
  }

  return [
    {
      key: 'section-connected',
      type: 'group',
      label: '已连接节点',
      children: ordered.map((item) => ({
        key: item.id,
        label: (
          <div className="asset-menu-item">
            {renderMenuThumb(item)}
            <span className="asset-menu-name">{item.name ?? item.label}</span>
          </div>
        ),
        onClick: () => onSelect(item),
      })),
    },
  ];
}

type MentionSuggestionListProps = SuggestionProps<WorkflowMentionItem> & {
  items: WorkflowMentionItem[];
};

export function MentionSuggestionList(props: MentionSuggestionListProps) {
  const { items, command } = props;

  const menuItems = useMemo(
    () =>
      buildConnectedMenuItems(items, (item) => {
        const assetId =
          typeof item.assetId === 'number' && item.assetId > 0
            ? item.assetId
            : parseAssetIdFromMentionId(item.id);
        const isVideo = item.type === 'video';
        command({
          id: item.id,
          label: resolveMentionDisplayLabel(item),
          mentionType: item.type,
          previewUrl: isVideo ? (item.thumbUrl ?? item.previewUrl ?? '') : (item.previewUrl ?? ''),
          thumbUrl: item.thumbUrl ?? '',
          mediaUrl: isVideo ? (item.previewUrl ?? '') : (item.previewUrl ?? ''),
          textContent: item.textContent ?? '',
          ...(assetId > 0 ? { assetId } : {}),
        });
      }),
    [items, command],
  );

  if (!menuItems?.length) {
    return null;
  }

  return (
    <div className="canvas-prompt-mention-popup">
      <Menu items={menuItems} selectable={false} style={AT_POPOVER_MENU_STYLE} />
    </div>
  );
}
