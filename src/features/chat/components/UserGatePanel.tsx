import { Button, Form, Input, Modal, Radio } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createBridgeToken,
  getBridgeStatus,
  refreshGateAsset,
  resolveChatAssetUrl,
} from '../../../api/chat';

export type GateFieldDef = {
  name?: string;
  key?: string;
  label?: string;
  secret?: boolean;
};

function gateFieldName(field: GateFieldDef): string {
  return String(field.name ?? field.key ?? '').trim();
}

export type GateChoiceDef = {
  id: string;
  label: string;
};

export type GateAssets = {
  qr_image_url?: string;
  captcha_image_url?: string;
  refresh_interval_sec?: number;
};

export type UserGateState = {
  turnId: string;
  gateId: string;
  gateType: string;
  prompt: string;
  fields: GateFieldDef[];
  choices?: GateChoiceDef[];
  phase?: string;
  assets?: GateAssets;
  conversationId?: number;
  domain?: string;
};

type UserGatePanelProps = {
  gate: UserGateState;
  open: boolean;
  submitting: boolean;
  onSubmit: (fields: Record<string, string>) => void;
  onCancel: () => void;
  cancelling?: boolean;
};

function resolveAssetUrl(url: string | undefined, conversationId?: number): string | undefined {
  if (!url) return undefined;
  return resolveChatAssetUrl(url, conversationId);
}

function GateImage({
  src,
  alt,
  refreshSec,
  onRefresh,
}: {
  src: string;
  alt: string;
  refreshSec: number;
  onRefresh?: () => void;
}) {
  const [tick, setTick] = useState(0);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    setLoadError(false);
  }, [src]);
  useEffect(() => {
    if (refreshSec <= 0) return undefined;
    const id = window.setInterval(() => {
      onRefresh?.();
      setTick((t) => t + 1);
    }, refreshSec * 1000);
    return () => window.clearInterval(id);
  }, [refreshSec, src, onRefresh]);
  const displaySrc = refreshSec > 0 ? `${src}${src.includes('?') ? '&' : '?'}_t=${tick}` : src;
  if (loadError) {
    return (
      <p className="mb-4 text-center text-sm text-amber-700">
        二维码加载失败，请取消后重试。
      </p>
    );
  }
  return (
    <div className="mb-4 flex justify-center">
      <img
        src={displaySrc}
        alt={alt}
        className="max-h-48 rounded border border-gray-200"
        onError={() => setLoadError(true)}
      />
    </div>
  );
}

function SessionBridgePanel({
  conversationId,
  gateId,
  domain,
}: {
  conversationId: number;
  gateId: string;
  domain?: string;
}) {
  const bridgeTokenRef = useRef<string | null>(null);
  const [status, setStatus] = useState<string>('pending');
  const [error, setError] = useState<string | null>(null);

  const ensureToken = useCallback(async () => {
    try {
      const created = await createBridgeToken(conversationId, gateId);
      bridgeTokenRef.current = created.bridge_token;
      setStatus(created.bridge_status);
      setError(null);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : '创建 bridge token 失败');
    }
  }, [conversationId, gateId]);

  useEffect(() => {
    void ensureToken();
    const id = window.setInterval(async () => {
      try {
        const resp = await getBridgeStatus(conversationId, gateId);
        const next = String(resp.status?.status ?? 'pending');
        setStatus(next);
      } catch {
        // ignore poll errors
      }
    }, 3000);
    return () => window.clearInterval(id);
  }, [conversationId, gateId, ensureToken]);

  return (
    <div className="space-y-3 text-sm text-gray-600">
      <p>
        请在已登录 <strong>{domain ?? '目标站点'}</strong> 的浏览器中完成授权导入。
      </p>
      <p>
        状态：<span className="font-medium">{status}</span>
      </p>
      {error && <p className="text-amber-700">{error}</p>}
      <Button size="small" onClick={() => void ensureToken()}>
        重新创建 token
      </Button>
    </div>
  );
}

export function UserGatePanel({
  gate,
  open,
  submitting,
  onSubmit,
  onCancel,
  cancelling = false,
}: UserGatePanelProps) {
  const [form] = Form.useForm<Record<string, string>>();
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedChoiceId(null);
  }, [gate.gateId, gate.gateType]);

  const handleOk = async () => {
    if (gate.gateType === 'login_method') {
      if (!selectedChoiceId) return;
      onSubmit({ choice_id: selectedChoiceId });
      return;
    }
    if (
      gate.gateType === 'qr_scan' ||
      gate.gateType === 'confirm' ||
      gate.gateType === 'session_bridge'
    ) {
      onSubmit({});
      return;
    }

    const values = await form.validateFields();
    onSubmit(values);
  };

  const defaultFields = useMemo((): GateFieldDef[] => {
    if (gate.gateType === 'phone_otp') {
      if (gate.phase === 'code') {
        return [{ name: 'code', label: '验证码', secret: false }];
      }
      return [{ name: 'phone', label: '手机号', secret: false }];
    }
    if (gate.gateType === 'credentials') {
      return [
        { name: 'username', label: '账号', secret: false },
        { name: 'password', label: '密码', secret: true },
      ];
    }
    if (gate.gateType === 'image_captcha') {
      return [{ name: 'captcha', label: '验证码', secret: false }];
    }
    return gate.fields;
  }, [gate.fields, gate.gateType, gate.phase]);

  const fieldDefs = useMemo((): GateFieldDef[] => {
    const defaultsByName = new Map(defaultFields.map((field) => [gateFieldName(field), field]));
    const source = gate.fields.length > 0 ? gate.fields : defaultFields;
    return source.map((field) => {
      const name = gateFieldName(field);
      const fallback = defaultsByName.get(name);
      return {
        ...field,
        name: field.name ?? fallback?.name ?? name,
        label: field.label || fallback?.label || name,
      };
    });
  }, [defaultFields, gate.fields]);
  const showFields =
    gate.gateType !== 'qr_scan' &&
    gate.gateType !== 'login_method' &&
    gate.gateType !== 'confirm' &&
    gate.gateType !== 'session_bridge' &&
    fieldDefs.length > 0;

  const captchaUrl = resolveAssetUrl(gate.assets?.captcha_image_url, gate.conversationId);
  const qrUrl = resolveAssetUrl(gate.assets?.qr_image_url, gate.conversationId);
  const qrRefresh = gate.assets?.refresh_interval_sec ?? 3;

  const handleQrRefresh = useCallback(() => {
    if (!gate.conversationId) return;
    void refreshGateAsset(gate.conversationId, gate.gateId);
  }, [gate.conversationId, gate.gateId]);

  const submitLabel =
    gate.gateType === 'qr_scan'
      ? '我扫好了'
      : gate.gateType === 'login_method'
        ? '确认'
        : gate.gateType === 'confirm' || gate.gateType === 'session_bridge'
          ? '继续'
          : '提交';
  const title =
    gate.gateType === 'confirm'
      ? '需要确认'
      : gate.gateType === 'login_method'
        ? '选择登录方式'
        : '需要您的操作';
  const prompt =
    gate.prompt ||
    (gate.gateType === 'login_method' ? '请选择一种登录方式' : '请完成验证后继续');
  const submitDisabled =
    submitting ||
    cancelling ||
    (gate.gateType === 'login_method' && !selectedChoiceId);

  return (
    <Modal
      open={open}
      title={title}
      onCancel={submitting || cancelling ? undefined : onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel} disabled={submitting} loading={cancelling}>
          取消
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={submitting}
          disabled={submitDisabled}
          onClick={() => void handleOk()}
        >
          {submitLabel}
        </Button>,
      ]}
      destroyOnHidden
      maskClosable={false}
    >
      <p className="mb-4 text-gray-600">{prompt}</p>
      {gate.gateType === 'login_method' && (gate.choices?.length ?? 0) > 0 && (
        <Radio.Group
          className="mb-4 flex w-full flex-col gap-2"
          value={selectedChoiceId ?? undefined}
          onChange={(event) => setSelectedChoiceId(String(event.target.value))}
        >
          {gate.choices?.map((choice) => (
            <Radio.Button key={choice.id} value={choice.id} className="text-left">
              {choice.label}
            </Radio.Button>
          ))}
        </Radio.Group>
      )}
      {gate.gateType === 'qr_scan' && qrUrl && (
        <GateImage src={qrUrl} alt="登录二维码" refreshSec={qrRefresh} onRefresh={handleQrRefresh} />
      )}
      {gate.gateType === 'qr_scan' && !qrUrl && (
        <p className="text-sm text-gray-500">请使用手机扫描页面上的二维码，完成后点击「我扫好了」。</p>
      )}
      {captchaUrl && <GateImage src={captchaUrl} alt="验证码" refreshSec={0} />}
      {gate.gateType === 'session_bridge' && gate.conversationId != null && (
        <SessionBridgePanel
          conversationId={gate.conversationId}
          gateId={gate.gateId}
          domain={gate.domain}
        />
      )}
      {showFields && (
        <Form form={form} layout="vertical">
          {fieldDefs.map((field) => {
            const fieldName = gateFieldName(field);
            return (
            <Form.Item
              key={fieldName}
              name={fieldName}
              label={field.label || fieldName}
              rules={[{ required: true, message: `请填写${field.label || fieldName}` }]}
            >
              {field.secret ? (
                <Input.Password autoComplete="off" />
              ) : (
                <Input autoComplete="off" />
              )}
            </Form.Item>
            );
          })}
        </Form>
      )}
    </Modal>
  );
}
