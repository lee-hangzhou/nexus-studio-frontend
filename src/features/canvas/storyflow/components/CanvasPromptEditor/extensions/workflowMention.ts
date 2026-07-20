import Mention from '@tiptap/extension-mention';
import { ReactNodeViewRenderer, ReactRenderer, type Editor } from '@tiptap/react';
import type { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion';
import { ComposerAssetTagNodeView } from '../ComposerAssetTagNodeView';
import { MentionSuggestionList } from '../MentionSuggestionList';
import type { CanvasMentionProvider, WorkflowMentionItem } from '../types';

function positionSuggestionHost(
  host: HTMLDivElement,
  clientRect?: (() => DOMRect | null) | null,
) {
  if (!clientRect) {
    return;
  }
  const rect = clientRect();
  if (!rect) {
    return;
  }
  host.style.left = `${rect.left}px`;
  host.style.top = `${Math.max(8, rect.top - 8)}px`;
  host.style.transform = 'translateY(-100%)';
}

function dismissActiveSuggestion(editor: Editor, range: { from: number; to: number }) {
  editor.chain().setTextSelection(range.from).run();
}

export function createWorkflowMentionExtension(getProvider: () => CanvasMentionProvider) {
  const suggestion: Omit<SuggestionOptions<WorkflowMentionItem>, 'editor'> = {
    char: '@',
    allowedPrefixes: null,
    allowSpaces: true,
    items: ({ query }) => getProvider().getItems(query),
    render: () => {
      let component: ReactRenderer | null = null;
      let host: HTMLDivElement | null = null;
      let lastSuggestionProps: SuggestionProps<WorkflowMentionItem> | null = null;
      let activeSuggestionRange: { from: number; to: number } | null = null;
      let dismissOnPointerDown: ((event: PointerEvent) => void) | null = null;

      const teardownSuggestionUi = () => {
        if (dismissOnPointerDown) {
          document.removeEventListener('pointerdown', dismissOnPointerDown, true);
          dismissOnPointerDown = null;
        }
        component?.destroy();
        host?.remove();
        component = null;
        host = null;
        lastSuggestionProps = null;
        activeSuggestionRange = null;
      };

      const attachOutsideDismiss = (editor: Editor) => {
        if (dismissOnPointerDown) {
          return;
        }
        dismissOnPointerDown = (event: PointerEvent) => {
          const target = event.target;
          if (!(target instanceof Node)) {
            return;
          }
          if (editor.view.dom.contains(target)) {
            return;
          }
          if (host?.contains(target)) {
            return;
          }
          if (!activeSuggestionRange) {
            return;
          }
          dismissActiveSuggestion(editor, activeSuggestionRange);
        };
        document.addEventListener('pointerdown', dismissOnPointerDown, true);
      };

      return {
        onStart: (props) => {
          lastSuggestionProps = props;
          activeSuggestionRange = props.range;
          attachOutsideDismiss(props.editor);

          host = document.createElement('div');
          host.className = 'canvas-prompt-mention-popup-host';
          host.style.position = 'fixed';
          host.style.zIndex = '1100';
          document.body.appendChild(host);

          component = new ReactRenderer(MentionSuggestionList, {
            props,
            editor: props.editor,
          });
          host.appendChild(component.element);
          positionSuggestionHost(host, props.clientRect);
        },

        onUpdate(props) {
          lastSuggestionProps = props;
          activeSuggestionRange = props.range;
          component?.updateProps({
            ...props,
            items: getProvider().getItems(props.query),
          });
          if (host) {
            positionSuggestionHost(host, props.clientRect);
          }
        },

        onKeyDown(props) {
          if (props.event.key === 'Escape' && lastSuggestionProps) {
            dismissActiveSuggestion(lastSuggestionProps.editor, props.range);
            return true;
          }
          return false;
        },

        onExit() {
          teardownSuggestionUi();
        },
      };
    },
  };

  return Mention.extend({
    name: 'workflowMention',

    addAttributes() {
      return {
        id: {
          default: null,
          parseHTML: (element) => element.getAttribute('data-id'),
          renderHTML: (attributes) => (attributes.id ? { 'data-id': attributes.id } : {}),
        },
        label: {
          default: null,
          parseHTML: (element) => element.getAttribute('data-label'),
          renderHTML: (attributes) => (attributes.label ? { 'data-label': attributes.label } : {}),
        },
        mentionType: {
          default: 'image',
          parseHTML: (element) => element.getAttribute('data-type') ?? 'image',
          renderHTML: (attributes) => ({ 'data-type': attributes.mentionType ?? 'image' }),
        },
        previewUrl: {
          default: null,
          parseHTML: (element) => element.getAttribute('data-preview-url'),
          renderHTML: (attributes) =>
            attributes.previewUrl ? { 'data-preview-url': attributes.previewUrl } : {},
        },
        thumbUrl: {
          default: null,
          parseHTML: (element) => element.getAttribute('data-thumb-url'),
          renderHTML: (attributes) =>
            attributes.thumbUrl ? { 'data-thumb-url': attributes.thumbUrl } : {},
        },
        mediaUrl: {
          default: null,
          parseHTML: (element) => element.getAttribute('data-media-url'),
          renderHTML: (attributes) =>
            attributes.mediaUrl ? { 'data-media-url': attributes.mediaUrl } : {},
        },
        textContent: {
          default: null,
          parseHTML: (element) => element.getAttribute('data-text-content'),
          renderHTML: (attributes) =>
            attributes.textContent ? { 'data-text-content': attributes.textContent } : {},
        },
        assetId: {
          default: null,
          parseHTML: (element) => {
            const raw = element.getAttribute('data-asset-id');
            if (!raw) {
              return null;
            }
            const n = Number(raw);
            return Number.isFinite(n) && n > 0 ? n : null;
          },
          renderHTML: (attributes) =>
            attributes.assetId ? { 'data-asset-id': String(attributes.assetId) } : {},
        },
      };
    },

    addNodeView() {
      return ReactNodeViewRenderer(ComposerAssetTagNodeView);
    },

    renderText({ node }) {
      return `@${node.attrs.label ?? ''}`;
    },
  }).configure({
    HTMLAttributes: {
      class: 'composer-asset-tag',
    },
    suggestion: suggestion as SuggestionOptions,
  });
}
