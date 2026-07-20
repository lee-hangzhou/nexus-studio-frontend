import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

export function formatConversationTime(iso: string): string {
  const time = dayjs(iso);
  if (!time.isValid()) {
    return '';
  }
  const now = dayjs();
  const diffMinutes = now.diff(time, 'minute');
  if (diffMinutes < 1) {
    return '刚刚';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} 分钟前`;
  }
  if (time.isSame(now, 'day')) {
    return time.format('HH:mm');
  }
  if (time.isSame(now.subtract(1, 'day'), 'day')) {
    return `昨天 ${time.format('HH:mm')}`;
  }
  if (time.isSame(now, 'year')) {
    return time.format('M月D日');
  }
  return time.format('YYYY/M/D');
}
