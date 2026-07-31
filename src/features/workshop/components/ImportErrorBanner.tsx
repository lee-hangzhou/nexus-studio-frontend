import { Alert } from 'antd';
import { buildImportErrorBanner } from '../utils/importErrors';
import type { ImportRowError } from '../types';

export function ImportErrorBanner(props: { errors: ImportRowError[] }) {
  const model = buildImportErrorBanner(props.errors);
  if (!model) return null;

  const alertType =
    model.variant === 'unsupported_template'
      ? 'error'
      : model.variant === 'validation'
        ? 'warning'
        : 'info';

  return (
    <Alert
      type={alertType}
      showIcon
      message={model.title}
      description={
        <ul>
          {model.messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      }
    />
  );
}
