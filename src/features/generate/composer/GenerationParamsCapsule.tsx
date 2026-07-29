import type { ReactNode } from 'react';
import { useState } from 'react';
import { Popover } from 'antd';
import type { GenerateKind, GenerateRatio, GenerateResolution } from '../types';
import { GenerationParamsPanel } from './GenerationParamsPanel';

export type GenerationParamsCapsuleProps = {
  kind: GenerateKind;
  label: string;
  ratio: GenerateRatio;
  resolution: GenerateResolution;
  count: number;
  duration?: number;
  referenceMode?: number;
  ratioOptions: { value: GenerateRatio; w: number; h: number }[];
  resolutionOptions: GenerateResolution[];
  countOptions: number[];
  durationOptions: number[];
  referenceModeOptions: { value: number; label: string }[];
  disabled?: boolean;
  className?: string;
  onRatioChange: (v: GenerateRatio) => void;
  onResolutionChange: (v: GenerateResolution) => void;
  onCountChange: (v: number) => void;
  onDurationChange: (v: number) => void;
  onReferenceModeChange: (v: number) => void;
  leading?: ReactNode;
};

/**
 * 参数胶囊 + 面板。对齐 storyflow-web ImageOutputSettings：antd Popover + click trigger。
 * 禁止自研 portal/外点监听（画布 SSE 整图同步时极易误关或随 Prompt 卸载）。
 */
export function GenerationParamsCapsule({
  kind,
  label,
  ratio,
  resolution,
  count,
  duration,
  referenceMode,
  ratioOptions,
  resolutionOptions,
  countOptions,
  durationOptions,
  referenceModeOptions,
  disabled = false,
  className,
  onRatioChange,
  onResolutionChange,
  onCountChange,
  onDurationChange,
  onReferenceModeChange,
  leading,
}: GenerationParamsCapsuleProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {leading}
      <Popover
        trigger="click"
        placement="top"
        arrow={false}
        open={disabled ? false : open}
        onOpenChange={(next) => {
          if (!disabled) setOpen(next);
        }}
        overlayClassName="studio-create__params-popover-overlay"
        destroyOnHidden
        content={
          <div className="studio-create__params-popup studio-create__params-popup--popover">
            <GenerationParamsPanel
              kind={kind}
              ratio={ratio}
              resolution={resolution}
              count={count}
              duration={duration}
              referenceMode={referenceMode}
              ratioOptions={ratioOptions}
              resolutionOptions={resolutionOptions}
              countOptions={countOptions}
              durationOptions={durationOptions}
              referenceModeOptions={referenceModeOptions}
              onRatioChange={onRatioChange}
              onResolutionChange={onResolutionChange}
              onCountChange={onCountChange}
              onDurationChange={onDurationChange}
              onReferenceModeChange={onReferenceModeChange}
            />
          </div>
        }
      >
        <button
          type="button"
          className={`studio-create__params-capsule${open ? ' studio-create__params-capsule--active' : ''}${className ? ` ${className}` : ''}`}
          disabled={disabled}
          title="展开参数配置"
          aria-expanded={open}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <span className="studio-create__params-ratio-ico" aria-hidden />
          {label}
        </button>
      </Popover>
    </>
  );
}
