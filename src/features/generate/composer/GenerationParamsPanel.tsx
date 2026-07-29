import type { GenerateKind, GenerateRatio, GenerateResolution } from '../types';
import { resolutionLabel } from './paramUtils';

export type GenerationParamsPanelProps = {
  ratio: GenerateRatio;
  resolution: GenerateResolution;
  count: number;
  duration?: number;
  referenceMode?: number;
  kind: GenerateKind;
  ratioOptions: { value: GenerateRatio; w: number; h: number }[];
  resolutionOptions: GenerateResolution[];
  countOptions: number[];
  durationOptions: number[];
  referenceModeOptions: { value: number; label: string }[];
  onRatioChange: (v: GenerateRatio) => void;
  onResolutionChange: (v: GenerateResolution) => void;
  onCountChange: (v: number) => void;
  onDurationChange: (v: number) => void;
  onReferenceModeChange: (v: number) => void;
};

export function GenerationParamsPanel({
  ratio,
  resolution,
  count,
  duration,
  referenceMode,
  kind,
  ratioOptions,
  resolutionOptions,
  countOptions,
  durationOptions,
  referenceModeOptions,
  onRatioChange,
  onResolutionChange,
  onCountChange,
  onDurationChange,
  onReferenceModeChange,
}: GenerationParamsPanelProps) {
  return (
    <>
      <div className="studio-create__params-section">
        <div className="studio-create__params-label">选择比例</div>
        <div className="studio-create__ratio-grid">
          {ratioOptions.map((opt) => {
            const scale = 22;
            const w = Math.round((opt.w / Math.max(opt.w, opt.h)) * scale);
            const h = Math.round((opt.h / Math.max(opt.w, opt.h)) * scale);
            return (
              <button
                key={opt.value}
                type="button"
                className={`studio-create__ratio-btn${ratio === opt.value ? ' studio-create__ratio-btn--active' : ''}`}
                onClick={() => onRatioChange(opt.value)}
              >
                <span
                  className="studio-create__ratio-icon"
                  style={{ width: w, height: h }}
                  aria-hidden
                />
                <span className="studio-create__ratio-label">{opt.value}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="studio-create__params-section">
        <div className="studio-create__params-label">选择分辨率</div>
        <div className="studio-create__pill-row studio-create__pill-row--resolution">
          {resolutionOptions.map((value) => (
            <button
              key={value}
              type="button"
              className={`studio-create__option-pill${resolution === value ? ' studio-create__option-pill--active' : ''}`}
              onClick={() => onResolutionChange(value)}
            >
              {resolutionLabel(value)}
            </button>
          ))}
        </div>
      </div>

      {kind === 'image' && countOptions.length > 0 && (
        <div className="studio-create__params-section">
          <div className="studio-create__params-label">选择图片数量</div>
          <div className="studio-create__pill-row studio-create__pill-row--count">
            {countOptions.map((n) => (
              <button
                key={n}
                type="button"
                className={`studio-create__option-pill${count === n ? ' studio-create__option-pill--active' : ''}`}
                onClick={() => onCountChange(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {kind === 'video' && referenceModeOptions.length > 0 && (
        <div className="studio-create__params-section">
          <div className="studio-create__params-label">选择参考模式</div>
          <div className="studio-create__pill-row studio-create__pill-row--reference">
            {referenceModeOptions.map((mode) => (
              <button
                key={mode.value}
                type="button"
                className={`studio-create__option-pill${referenceMode === mode.value ? ' studio-create__option-pill--active' : ''}`}
                onClick={() => onReferenceModeChange(mode.value)}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {kind === 'video' && durationOptions.length > 0 && (
        <div className="studio-create__params-section">
          <div className="studio-create__params-label">选择视频时长</div>
          <div className="studio-create__pill-row studio-create__pill-row--duration">
            {durationOptions.map((n) => (
              <button
                key={n}
                type="button"
                className={`studio-create__option-pill${duration === n ? ' studio-create__option-pill--active' : ''}`}
                onClick={() => onDurationChange(n)}
              >
                {n}s
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
