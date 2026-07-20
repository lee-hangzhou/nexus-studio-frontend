import { useCallback, useEffect, useMemo, useRef } from 'react';
import Document from '@tiptap/extension-document';
import HardBreak from '@tiptap/extension-hard-break';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { EditorContent, useEditor } from '@tiptap/react';
import { emptyCanvasMentionProvider } from '../../providers/canvasMentionProvider';
import type { WorkflowPromptContent } from '../../types';
import { createWorkflowMentionExtension } from './extensions/workflowMention';
import {
  resolvePlainDocInput,
  resolvePromptDocInput,
  serializeEditorJsonToPayload,
  serializeEditorJsonToPrompt,
  serializePlainEditorPayload,
  type CanvasPromptEditorPayload,
} from './utils/promptSerialize';
import type { CanvasMentionProvider } from './types';
import './CanvasPromptEditor.less';

export type { CanvasPromptEditorPayload };

export type CanvasPromptEditorProps = {
  content?: WorkflowPromptContent;
  prompt?: string;
  placeholder?: string;
  enableMention?: boolean;
  mentionProvider?: CanvasMentionProvider;
  onChange: (payload: CanvasPromptEditorPayload) => void;
  className?: string;
  readOnly?: boolean;
};

function contentEquals(a: WorkflowPromptContent | undefined, b: WorkflowPromptContent): boolean {
  return JSON.stringify(a ?? []) === JSON.stringify(b);
}

function plainTextToInsertNodes(plain: string): Array<{ type: string; text?: string }> {
  const lines = plain.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const nodes: Array<{ type: string; text?: string }> = [];
  lines.forEach((line, index) => {
    if (index > 0) {
      nodes.push({ type: 'hardBreak' });
    }
    if (line) {
      nodes.push({ type: 'text', text: line });
    }
  });
  return nodes;
}

export function CanvasPromptEditor({
  content,
  prompt = '',
  placeholder = '描述任何你想要生成的内容',
  enableMention = true,
  mentionProvider = emptyCanvasMentionProvider,
  onChange,
  className,
  readOnly = false,
}: CanvasPromptEditorProps) {
  const providerRef = useRef(mentionProvider);
  providerRef.current = mentionProvider;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const mentionExtension = useMemo(
    () => createWorkflowMentionExtension(() => providerRef.current),
    [],
  );

  const extensions = useMemo(
    () =>
      enableMention
        ? [Document, Paragraph, Text, HardBreak, mentionExtension]
        : [Document, Paragraph, Text, HardBreak],
    [enableMention, mentionExtension],
  );

  const editorRef = useRef<ReturnType<typeof useEditor>>(null);

  const editor = useEditor(
    {
      editable: !readOnly,
      extensions,
      content: enableMention
        ? resolvePromptDocInput({ content, prompt }, mentionProvider.getReferenceAssets())
        : resolvePlainDocInput({ content, prompt }),
      editorProps: {
        attributes: {
          class: 'canvas-prompt-editor__prosemirror',
          'data-placeholder': placeholder,
        },
        handlePaste: (view, event) => {
          const text = event.clipboardData?.getData('text/plain') ?? '';
          if (!text) {
            return false;
          }
          event.preventDefault();
          const ed = editorRef.current;
          if (!ed) {
            return true;
          }
          const { from, to } = view.state.selection;
          ed.chain()
            .focus()
            .deleteRange({ from, to })
            .insertContent(plainTextToInsertNodes(text))
            .run();
          return true;
        },
        clipboardTextSerializer: (slice) => {
          const json = {
            type: 'doc',
            content: [{ type: 'paragraph', content: slice.content.toJSON() }],
          };
          return serializeEditorJsonToPrompt(
            json as Parameters<typeof serializeEditorJsonToPrompt>[0],
            enableMention ? providerRef.current.getReferenceAssets() : [],
          );
        },
      },
      onUpdate: ({ editor: ed }) => {
        onChangeRef.current(
          enableMention
            ? serializeEditorJsonToPayload(ed.getJSON(), providerRef.current.getReferenceAssets())
            : serializePlainEditorPayload(ed.getJSON()),
        );
      },
    },
    [enableMention],
  );

  editorRef.current = editor;

  useEffect(() => {
    if (!editor) {
      return;
    }
    if (editor.isFocused) {
      return;
    }
    if (enableMention) {
      const current = serializeEditorJsonToPayload(
        editor.getJSON(),
        providerRef.current.getReferenceAssets(),
      );
      if (contentEquals(content, current.content) && prompt === current.prompt) {
        return;
      }
      editor.commands.setContent(
        resolvePromptDocInput({ content, prompt }, providerRef.current.getReferenceAssets()),
        false,
      );
      return;
    }
    const current = serializePlainEditorPayload(editor.getJSON());
    if (current.prompt === prompt) {
      return;
    }
    editor.commands.setContent(resolvePlainDocInput({ content, prompt }), false);
  }, [editor, content, prompt, enableMention]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    const syncEmpty = () => {
      const root = editor.view.dom.closest('.canvas-prompt-editor');
      if (root instanceof HTMLElement) {
        root.dataset.empty = editor.isEmpty ? 'true' : 'false';
      }
    };
    syncEmpty();
    editor.on('update', syncEmpty);
    return () => {
      editor.off('update', syncEmpty);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    editor.view.dom.setAttribute('data-placeholder', placeholder);
  }, [editor, placeholder]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div
      className={`canvas-prompt-editor composer-input-area nodrag nowheel${className ? ` ${className}` : ''}`}
      data-mention-enabled={enableMention ? 'true' : 'false'}
      onPointerDown={handlePointerDown}
    >
      <EditorContent editor={editor} />
    </div>
  );
}
