import { Select } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { ChatModelItem } from '../../../api/chat';
import { ComposerSendButton } from '../../../shared/ui/ComposerSendButton';
import { ComposerShell } from '../../../shared/ui/ComposerShell';
import { ComposerPlusMenu, type ComposerPlusMenuExpertsProps } from '../../skills/ComposerPlusMenu';
import { ExpertPill } from '../../skills/ExpertPill';
import { SkillManageModal } from '../../skills/SkillManageModal';
import { SkillPill } from '../../skills/SkillPill';
import { useUserSkills } from '../../skills/useUserSkills';
import { ComposerTriggerPopup } from '../composer/ComposerTriggerPopup';
import {
  detectComposerTrigger,
  filterByQuery,
  stripComposerTrigger,
} from '../composer/detectComposerTrigger';
import triggerStyles from '../composer/ComposerTriggerPopup.module.css';
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
  selectedExpert?: { key: string; name: string; avatarUrl: string } | null;
  onSelectedExpertChange?: (expert: { key: string; name: string; avatarUrl: string } | null) => void;
  expertTargetPrefix?: string | null;
  composerExperts?: ComposerPlusMenuExpertsProps | null;
  /** 画布等有项目上下文时传入；Chat/Foyer 不传（仅 user 域技能） */
  projectId?: number | null;
};

function buildComposerPlaceholder(input: {
  selectedExpert: boolean;
  canAt: boolean;
  canSlash: boolean;
  override?: string;
}): string {
  if (input.override) return input.override;
  if (input.selectedExpert && input.canSlash) return '描述你的想法… 输入 / 引用技能';
  if (input.selectedExpert) return '描述你的想法…';
  if (input.canAt && input.canSlash) return '描述你的想法… 输入 @ 指定专家，/ 引用技能';
  if (input.canAt) return '描述你的想法… 输入 @ 指定专家';
  if (input.canSlash) return '描述你的想法… 输入 / 引用技能';
  return '描述你的想法…';
}

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
  placeholder: placeholderOverride,
  'aria-label': ariaLabel = '对话输入',
  selectedSkillPaths = [],
  onSelectedSkillPathsChange,
  selectedExpert = null,
  onSelectedExpertChange,
  expertTargetPrefix = null,
  composerExperts = null,
  projectId = null,
}: ChatComposerBoxProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const inputWrapRef = useRef<HTMLDivElement>(null);
  const [skillManageOpen, setSkillManageOpen] = useState(false);
  const [caret, setCaret] = useState(0);
  const [activeOptionIndex, setActiveOptionIndex] = useState(0);
  const [dismissedTriggerKey, setDismissedTriggerKey] = useState<string | null>(null);
  const hasSkillControls = onSelectedSkillPathsChange != null;
  const skillQuery = useUserSkills({
    surface: 'chat',
    projectId,
    enabled: hasSkillControls,
  });
  const skillNameByPath = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of skillQuery.enabledSkills) {
      map.set(item.path, item.name);
    }
    return map;
  }, [skillQuery.enabledSkills]);
  const hasChips = selectedSkillPaths.length > 0 || Boolean(selectedExpert);

  const resolvedPlaceholder = buildComposerPlaceholder({
    selectedExpert: Boolean(selectedExpert),
    canAt: composerExperts != null,
    canSlash: hasSkillControls,
    override: placeholderOverride,
  });

  // 光标状态偶发落后于受控 value 时，用 value 长度兜底，避免刚输入 @ / 却检测不到
  const effectiveCaret =
    caret > 0 || input.length === 0
      ? Math.min(caret, input.length)
      : input.length;

  const rawTrigger = useMemo(
    () => detectComposerTrigger(input, effectiveCaret),
    [effectiveCaret, input],
  );
  const rawTriggerKey =
    rawTrigger == null ? null : `${rawTrigger.kind}:${rawTrigger.start}:${rawTrigger.query}`;
  const trigger =
    rawTrigger == null || rawTriggerKey === dismissedTriggerKey
      ? null
      : rawTrigger.kind === 'at' && composerExperts
        ? rawTrigger
        : rawTrigger.kind === 'slash' && hasSkillControls
          ? rawTrigger
          : null;

  const triggerOptions = useMemo(() => {
    if (!trigger) return [];
    if (trigger.kind === 'at') {
      return filterByQuery(composerExperts?.items ?? [], trigger.query, (item) => item.name).map(
        (item) => ({
          key: item.key,
          label: item.name,
          avatarUrl: item.avatar_url,
        }),
      );
    }
    return filterByQuery(
      skillQuery.enabledSkills.filter((item) => !selectedSkillPaths.includes(item.path)),
      trigger.query,
      (item) => `${item.name} ${item.path}`,
    ).map((item) => ({
      key: item.path,
      label: item.name,
      description: item.path !== item.name ? item.path : undefined,
    }));
  }, [
    composerExperts?.items,
    selectedSkillPaths,
    skillQuery.enabledSkills,
    trigger,
  ]);

  const triggerEmptyText = useMemo(() => {
    if (!trigger) return '';
    if (trigger.kind === 'at') {
      if (composerExperts?.loading) return '专家列表加载中…';
      if ((composerExperts?.items.length ?? 0) === 0) {
        return '还没有可指定的专家，先在右侧邀请进房间';
      }
      return '没有匹配的专家';
    }
    if (skillQuery.loading) return '技能加载中…';
    if (skillQuery.enabledSkills.length === 0) {
      return '还没有启用的技能，点左下角 + → 管理技能';
    }
    if (selectedSkillPaths.length >= skillQuery.enabledSkills.length) {
      return '已引用全部启用技能';
    }
    return '没有匹配的技能';
  }, [
    composerExperts?.items.length,
    composerExperts?.loading,
    selectedSkillPaths.length,
    skillQuery.enabledSkills.length,
    skillQuery.loading,
    trigger,
  ]);

  useEffect(() => {
    setActiveOptionIndex(0);
  }, [trigger?.kind, trigger?.query, triggerOptions.length]);

  const syncCaretFromNode = (node: HTMLTextAreaElement | null) => {
    if (!node) return;
    setCaret(node.selectionStart ?? node.value.length);
  };

  const applySelection = (key: string) => {
    if (!trigger) return;
    const nextValue = stripComposerTrigger(input, trigger, effectiveCaret);
    onInputChange(nextValue);
    const nextCaret = trigger.start;
    window.requestAnimationFrame(() => {
      const node = inputRef.current;
      if (!node) return;
      node.focus();
      node.setSelectionRange(nextCaret, nextCaret);
      setCaret(nextCaret);
    });
    if (trigger.kind === 'at') {
      composerExperts?.onSelect(key);
      return;
    }
    if (!selectedSkillPaths.includes(key)) {
      onSelectedSkillPathsChange?.([...selectedSkillPaths, key]);
    }
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    syncCaretFromNode(event.currentTarget);
    if (trigger) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (triggerOptions.length === 0) return;
        setActiveOptionIndex((index) => (index + 1) % triggerOptions.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (triggerOptions.length === 0) return;
        setActiveOptionIndex((index) =>
          index <= 0 ? triggerOptions.length - 1 : index - 1,
        );
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setDismissedTriggerKey(`${trigger.kind}:${trigger.start}:${trigger.query}`);
        return;
      }
      if ((event.key === 'Enter' || event.key === 'Tab') && !event.shiftKey) {
        if (triggerOptions.length > 0) {
          event.preventDefault();
          const option = triggerOptions[activeOptionIndex] ?? triggerOptions[0];
          if (option) applySelection(option.key);
          return;
        }
      }
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (busy) {
        onStop?.();
        return;
      }
      if (canSend) onSend();
    }
  };

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
            {fixedTextareaHeight && attachments.length === 0 && !hasChips ? (
              <div className="studio-composer-box__top-spacer" aria-hidden />
            ) : null}
            {hasChips ? (
              <div className="studio-composer-box__skill-chips">
                {selectedExpert ? (
                  <ExpertPill
                    name={selectedExpert.name}
                    avatarUrl={selectedExpert.avatarUrl}
                    prefix={expertTargetPrefix ?? undefined}
                    onRemove={() => onSelectedExpertChange?.(null)}
                  />
                ) : null}
                {selectedSkillPaths.map((path) => (
                  <SkillPill
                    key={path}
                    path={path}
                    name={skillNameByPath.get(path)}
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
          <div className={triggerStyles.inputWrap} ref={inputWrapRef}>
            {trigger ? (
              <ComposerTriggerPopup
                kind={trigger.kind}
                options={triggerOptions}
                activeIndex={activeOptionIndex}
                emptyText={triggerEmptyText}
                anchorRef={inputWrapRef}
                onHover={setActiveOptionIndex}
                onSelect={applySelection}
              />
            ) : null}
            <textarea
              ref={inputRef}
              className={`studio-composer-box__textarea${fixedTextareaHeight ? ' studio-composer-box__textarea--fixed' : ''}`}
              value={input}
              onChange={(event) => {
                const node = event.currentTarget;
                onInputChange(node.value);
                setCaret(node.selectionStart ?? node.value.length);
                setDismissedTriggerKey(null);
              }}
              onClick={(event) => syncCaretFromNode(event.currentTarget)}
              onKeyUp={(event) => syncCaretFromNode(event.currentTarget)}
              onSelect={(event) => syncCaretFromNode(event.currentTarget)}
              onCompositionEnd={(event) => syncCaretFromNode(event.currentTarget)}
              placeholder={resolvedPlaceholder}
              disabled={busy || disabled}
              rows={fixedTextareaHeight ? 3 : 1}
              aria-label={ariaLabel}
              onInput={(event) => {
                if (fixedTextareaHeight) return;
                const target = event.currentTarget;
                target.style.height = 'auto';
                target.style.height = `${Math.min(target.scrollHeight, 180)}px`;
              }}
              onKeyDown={handleKeyDown}
            />
          </div>
        }
        footerLeft={
          <ComposerPlusMenu
            disabled={busy || disabled}
            onUploadFile={onUploadFile}
            experts={composerExperts}
            skills={
              hasSkillControls
                ? {
                    surface: 'chat',
                    projectId,
                    selectedPaths: selectedSkillPaths,
                    onSelectedPathsChange: onSelectedSkillPathsChange,
                    onManage: () => setSkillManageOpen(true),
                    enabledSkills: skillQuery.enabledSkills,
                    skillsLoading: skillQuery.loading,
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
          onClose={() => {
            setSkillManageOpen(false);
            void skillQuery.refresh().catch(() => undefined);
          }}
          surface="chat"
          projectId={projectId}
        />
      ) : null}
    </footer>
  );
}
