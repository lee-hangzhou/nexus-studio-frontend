import { Alert, Checkbox, Modal, Space, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import {
  hostScopeLabel,
  requiresOperationHashConfirmation,
  selectedScopesToCapabilities,
  toggleHostScope,
} from '../utils/authScopes';
import { HOST_AUTH_SCOPES, type HostAuthScope } from '../types';

export interface AuthModalConfirmPayload {
  scopes: HostAuthScope[];
  capabilities: ReturnType<typeof selectedScopesToCapabilities>;
  operationHash?: string;
}

export function AuthModal(props: {
  open: boolean;
  operationHash?: string;
  diffSummary?: string;
  onCancel: () => void;
  onConfirm: (payload: AuthModalConfirmPayload) => void;
}) {
  const { open, operationHash = '', diffSummary, onCancel, onConfirm } = props;
  const [selected, setSelected] = useState<Set<HostAuthScope>>(new Set());
  const [operationReviewed, setOperationReviewed] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelected(new Set());
      setOperationReviewed(false);
    }
  }, [open]);

  const needsHash = useMemo(() => requiresOperationHashConfirmation(selected), [selected]);

  const handleToggle = (scope: HostAuthScope, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(scope);
      else next.delete(scope);
      return next;
    });
  };

  const handleConfirm = () => {
    if (needsHash && !operationReviewed) return;
    onConfirm({
      scopes: HOST_AUTH_SCOPES.filter((scope) => selected.has(scope)),
      capabilities: selectedScopesToCapabilities(selected),
      operationHash: needsHash ? operationHash : undefined,
    });
  };

  const confirmDisabled = selected.size === 0 || (needsHash && !operationReviewed);

  return (
    <Modal
      title="允许本次操作"
      open={open}
      onCancel={onCancel}
      onOk={handleConfirm}
      okText="允许"
      okButtonProps={{ disabled: confirmDisabled }}
      destroyOnClose
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Typography.Paragraph type="secondary">
          只勾选本次需要的操作
        </Typography.Paragraph>

        {HOST_AUTH_SCOPES.map((scope) => (
          <Checkbox
            key={scope}
            checked={selected.has(scope)}
            onChange={(event) => handleToggle(scope, event.target.checked)}
          >
            {hostScopeLabel(scope)}
          </Checkbox>
        ))}

        {needsHash ? (
          <Space direction="vertical" size="small">
            {diffSummary ? <Alert type="warning" showIcon message={diffSummary} /> : null}
            <Checkbox
              checked={operationReviewed}
              onChange={(event) => setOperationReviewed(event.target.checked)}
            >
              我已查看并确认待执行的具体变更
            </Checkbox>
          </Space>
        ) : null}
      </Space>
    </Modal>
  );
}

export { toggleHostScope };
