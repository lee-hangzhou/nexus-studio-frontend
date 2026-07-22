import { StudioChip } from './StudioChip';

export type StudioSegmentOption<T extends string> = {
  value: T;
  label: string;
};

export type StudioSegmentProps<T extends string> = {
  options: StudioSegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  'aria-label'?: string;
  className?: string;
};

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** 统一分段切换（自动/手动等），内部复用 StudioChip。 */
export function StudioSegment<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  className,
  'aria-label': ariaLabel,
}: StudioSegmentProps<T>) {
  return (
    <div className={cx('studio-segment', className)} role="group" aria-label={ariaLabel}>
      {options.map((opt) => (
        <StudioChip
          key={opt.value}
          size="sm"
          active={value === opt.value}
          disabled={disabled}
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </StudioChip>
      ))}
    </div>
  );
}
