import { ArrowUpOutlined, StopOutlined } from '@ant-design/icons';

export type ComposerSendButtonProps = {
  busy?: boolean;
  disabled?: boolean;
  onSend: () => void;
  onStop?: () => void;
  /** 非 busy 时的 title；busy 时固定为「停止生成」 */
  title?: string;
};

/** 统一发送 / 停止钮；创作 / 对话 / 画布 Agent 必须用这一颗。 */
export function ComposerSendButton({
  busy = false,
  disabled = false,
  onSend,
  onStop,
  title,
}: ComposerSendButtonProps) {
  return (
    <button
      type="button"
      className={`studio-composer-box__send${busy ? ' studio-composer-box__send--stop' : ''}`}
      onClick={() => (busy ? onStop?.() : onSend())}
      disabled={busy ? !onStop : disabled}
      aria-label={busy ? '停止生成' : '发送'}
      title={busy ? '停止生成' : title ?? '发送'}
    >
      {busy ? <StopOutlined /> : <ArrowUpOutlined />}
    </button>
  );
}
