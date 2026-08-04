import { Checkbox, Modal, Space, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import type { WorkshopUpgradeInviteProposedView } from '../../../api/generated/workshop';

export type UpgradeInviteProposedPayload = WorkshopUpgradeInviteProposedView;

export function UpgradeInviteConfirmModal(props: {
  open: boolean;
  payload: UpgradeInviteProposedPayload | null;
  confirming: boolean;
  onConfirm: (selection: {
    expert_keys: string[];
    primary_expert_key: string;
  }) => void;
  onDecline: () => void;
}) {
  const { open, payload, confirming, onConfirm, onDecline } = props;
  const [selected, setSelected] = useState<string[]>([]);
  const [primary, setPrimary] = useState<string>('');

  useEffect(() => {
    if (!payload) return;
    setSelected([...(payload.expert_keys ?? [])]);
    setPrimary(payload.primary_expert_key ?? '');
  }, [payload]);

  const options = useMemo(() => payload?.experts ?? [], [payload]);
  const canConfirm =
    selected.length === 0 || (selected.length >= 1 && selected.includes(primary));

  return (
    <Modal
      open={open}
      title="升级为工坊项目"
      okText="确认升级"
      cancelText="拒绝"
      confirmLoading={confirming}
      okButtonProps={{ disabled: !canConfirm }}
      onOk={() => {
        if (!canConfirm) return;
        onConfirm({
          expert_keys: selected,
          primary_expert_key: selected.length > 0 ? primary : '',
        });
      }}
      onCancel={onDecline}
      destroyOnClose
      className="upgrade-invite-modal"
    >
      <Space direction="vertical" size="middle" className="upgrade-invite-modal__body">
        <Typography.Paragraph className="upgrade-invite-modal__rationale">
          {payload?.rationale ?? ''}
        </Typography.Paragraph>
        {options.length > 0 ? (
          <Checkbox.Group
            value={selected}
            onChange={(values) => {
              const next = values.map(String);
              setSelected(next);
              if (next.length === 0) {
                setPrimary('');
              } else if (!next.includes(primary)) {
                setPrimary(next[0]!);
              }
            }}
            className="upgrade-invite-modal__experts"
          >
            <Space direction="vertical">
              {options.map((expert) => (
                <Checkbox key={expert.key} value={expert.key}>
                  <Space>
                    <span>{expert.name}</span>
                    {primary === expert.key ? (
                      <Typography.Text type="secondary">（主答）</Typography.Text>
                    ) : (
                      <Typography.Link
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          if (selected.includes(expert.key)) {
                            setPrimary(expert.key);
                          }
                        }}
                      >
                        设为主答
                      </Typography.Link>
                    )}
                  </Space>
                </Checkbox>
              ))}
            </Space>
          </Checkbox.Group>
        ) : null}
      </Space>
    </Modal>
  );
}
