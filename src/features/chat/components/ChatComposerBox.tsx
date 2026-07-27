import { Select } from 'antd';
import { useRef, useState } from 'react';
import type { ChatModelItem } from '../../../api/chat';
import { ComposerSendButton } from '../../../shared/ui/ComposerSendButton';
import { ComposerShell } from '../../../shared/ui/ComposerShell';
import { ComposerPlusMenu } from '../../skills/ComposerPlusMenu';
import { SkillManageModal } from '../../skills/SkillManageModal';
import { SkillPill } from '../../skills/SkillPill';
import {
  ComposerAttachmentList,
  type ComposerAttachmentChip,
} from './ComposerAttachmentList';

export type ChatComposerBoxProps = {
  input: string;
  onInputChange: (value: string) => void;
  models: ChatModelItem[];
  selectedModel: string;
  onModelChange: (modelKey: string) => void;
  attachments: ComposerAttachmentChip[];
  onRemoveAttachment: (attachmentId: string) => void;
  onUploadFile: (file: File) => Promise<unknown> | unknown;
  busy: boolean;
  modelsLoading?: boolean;
  modelVisionHint?: string | null;
  canSend: boolean;
  onSend: () => void;
  onStop?: () => void;
  showDisclaimer?: boolean;
  disabled?: boolean;
  /** 固定输入区高度（首页等与 CreateComposer 对齐的外壳） */
  fixedTextareaHeight?: boolean;
  placeholder?: string;
  'aria-label'?: string;
  selectedSkillPaths?: string[];
  onSelectedSkillPathsChange?: (paths: string[]) => void;
  /** 画布等有项目上下文时传入；Chat/Foyer 不传（仅 user 域技能） */
  projectId?: number | null;
};

/** 对话输入条：附件 / 文本 / 模型 / 发送。ChatPage、Foyer、画布 Agent 共用壳。 */
export function ChatComposerBox({
  input,
  onInputChange,
  models,
  selectedModel,
  onModelChange,
  attachments,
  onRemoveAttachment,
  onUploadFile,
  busy,
  modelsLoading = false,
  modelVisionHint = null,
  canSend,
  onSend,
  onStop,
  showDisclaimer = true,
  disabled = false,
  fixedTextareaHeight = false,
  placeholder = '描述你的想法…',
  'aria-label': ariaLabel = '对话输入',
  selectedSkillPaths = [],
  onSelectedSkillPathsChange,
  projectId = null,
}: ChatComposerBoxProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [skillManageOpen, setSkillManageOpen] = useState(false);
  const hasSkillControls = onSelectedSkillPathsChange != null;

  return (
    <footer className="studio-chat__composer">
      <ComposerShell
        notice={
          modelVisionHint ? (
            <div className="studio-composer-box__notice">{modelVisionHint}</div>
          ) : null
        }
        top={
          <>
            {fixedTextareaHeight && attachments.length === 0 && selectedSkillPaths.length === 0 ? (
              <div className="studio-composer-box__top-spacer" aria-hidden />
            ) : null}
            {selectedSkillPaths.length > 0 ? (
              <div className="studio-composer-box__skill-chips">
                {selectedSkillPaths.map((path) => (
                  <SkillPill
                    key={path}
                    path={path}
                    onRemove={() =>
                      onSelectedSkillPathsChange?.(selectedSkillPaths.filter((item) => item !== path))
                    }
                  />
                ))}
              </div>
            ) : null}
            <ComposerAttachmentList attachments={attachments} onRemove={onRemoveAttachment} />
          </>
        }
        input={
          <textarea
            ref={inputRef}
            className={`studio-composer-box__textarea${fixedTextareaHeight ? ' studio-composer-box__textarea--fixed' : ''}`}
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            placeholder={placeholder}
            disabled={busy || disabled}
            rows={fixedTextareaHeight ? 3 : 1}
            aria-label={ariaLabel}
            onInput={(event) => {
              if (fixedTextareaHeight) return;
              const target = event.currentTarget;
              target.style.height = 'auto';
              target.style.height = `${Math.min(target.scrollHeight, 180)}px`;
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                if (busy) {
                  onStop?.();
                  return;
                }
                if (canSend) onSend();
              }
            }}
          />
        }
        footerLeft={
          <ComposerPlusMenu
            disabled={busy || disabled}
            onUploadFile={onUploadFile}
            skills={
              hasSkillControls
                ? {
                    surface: 'chat',
                    projectId,
                    selectedPaths: selectedSkillPaths,
                    onSelectedPathsChange: onSelectedSkillPathsChange,
                    onManage: () => setSkillManageOpen(true),
                  }
                : null
            }
          />
        }
        footerRight={
          <>
            <Select
              className="studio-composer-box__model"
              popupMatchSelectWidth={false}
              value={selectedModel || undefined}
              onChange={onModelChange}
              disabled={busy || disabled || modelsLoading || models.length === 0}
              loading={modelsLoading}
              options={models.map((item) => ({
                value: item.key,
                label: item.display_name || item.key,
              }))}
              aria-label="对话模型"
            />
            <ComposerSendButton
              busy={busy}
              disabled={!canSend}
              onSend={onSend}
              onStop={onStop}
              title={selectedModel ? '发送' : '暂无可用模型'}
            />
          </>
        }
      />
      {showDisclaimer ? (
        <p className="studio-composer-disclaimer">
          Nexus Studio 由 AI 生成内容，可能出现错误，请核实重要信息。
        </p>
      ) : null}
      {hasSkillControls ? (
        <SkillManageModal
          open={skillManageOpen}
          onClose={() => setSkillManageOpen(false)}
          surface="chat"
          projectId={projectId}
        />
      ) : null}
    </footer>
  );
}
