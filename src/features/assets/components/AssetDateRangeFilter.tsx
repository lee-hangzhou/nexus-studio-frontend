import { DatePicker } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import locale from 'antd/es/date-picker/locale/zh_CN';
import { useState } from 'react';
import { StudioChip } from '../../../shared/ui/StudioChip';

const { RangePicker } = DatePicker;

dayjs.locale('zh-cn');

export type AssetDateQuick = 'all' | 'today' | 'week' | 'month' | 'custom';

const QUICK_OPTIONS: { key: AssetDateQuick; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'today', label: '今天' },
  { key: 'week', label: '近一周' },
  { key: 'month', label: '近一月' },
];

function rangeForQuick(key: Exclude<AssetDateQuick, 'all' | 'custom'>): [Dayjs, Dayjs] {
  const end = dayjs().endOf('day');
  if (key === 'today') {
    return [dayjs().startOf('day'), end];
  }
  if (key === 'week') {
    return [dayjs().subtract(7, 'day').startOf('day'), end];
  }
  return [dayjs().subtract(1, 'month').startOf('day'), end];
}

interface AssetDateRangeFilterProps {
  value: [Dayjs, Dayjs] | null;
  onChange: (range: [Dayjs, Dayjs] | null) => void;
}

export function AssetDateRangeFilter({ value, onChange }: AssetDateRangeFilterProps) {
  const [quick, setQuick] = useState<AssetDateQuick>('all');

  const pickQuick = (key: AssetDateQuick) => {
    setQuick(key);
    if (key === 'all') {
      onChange(null);
      return;
    }
    if (key === 'custom') {
      return;
    }
    onChange(rangeForQuick(key));
  };

  return (
    <div className="studio-assets__date-filter" role="group" aria-label="时间范围">
      {QUICK_OPTIONS.map((opt) => (
        <StudioChip
          key={opt.key}
          size="sm"
          active={quick === opt.key}
          onClick={() => pickQuick(opt.key)}
        >
          {opt.label}
        </StudioChip>
      ))}
      <RangePicker
        className="studio-assets__range"
        locale={locale}
        value={value}
        placeholder={['开始日期', '结束日期']}
        allowClear
        onChange={(dates) => {
          if (!dates || !dates[0] || !dates[1]) {
            setQuick('all');
            onChange(null);
            return;
          }
          setQuick('custom');
          onChange([dates[0].startOf('day'), dates[1].endOf('day')]);
        }}
        onFocus={() => setQuick('custom')}
      />
      {quick === 'custom' && value ? (
        <span className="studio-assets__range-hint">自定义区间</span>
      ) : null}
    </div>
  );
}
