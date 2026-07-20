import { Button, ConfigProvider, Form, Input, message } from 'antd';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { register, sendRegisterCode } from '../api/auth';
import { setTokens } from '../api/base';
import { useUser } from '../contexts/UserContext';
import { authInputTheme, inputInnerStyle, inputWrapperStyle } from './authInputStyles';
import './RegisterPage.css';

const REG_INPUT_HEIGHT = 38;

const regInputStyle: React.CSSProperties = {
  ...inputWrapperStyle,
  height: REG_INPUT_HEIGHT,
};

const sendCodeBtnStyle: React.CSSProperties = {
  height: REG_INPUT_HEIGHT,
  minWidth: 108,
  border: '1px solid rgba(255,255,255,0.15)',
  borderLeft: 'none',
  borderRadius: '0 12px 12px 0',
  background: 'rgba(255,255,255,0.08)',
  color: '#fff',
  fontWeight: 500,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  padding: '0 16px',
  flexShrink: 0,
  fontSize: 14,
  transition: 'background 0.15s',
};

const emailInputStyle: React.CSSProperties = {
  ...regInputStyle,
  borderRight: 'none',
  borderRadius: '12px 0 0 12px',
  flex: 1,
  minWidth: 0,
};

export function RegisterPage() {
  const navigate = useNavigate();
  const { refresh } = useUser();
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm();
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const email = searchParams.get('email');
    if (email) form.setFieldValue('email', email);
  }, [form, searchParams]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setTimeout(() => setCountdown((v) => v - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  const handleSendCode = async () => {
    try {
      const { email } = await form.validateFields(['email']);
      setSending(true);
      const result = await sendRegisterCode(email);
      message.success(result.message);
      setCountdown(60);
    } catch (error) {
      if (error instanceof Error) message.error(error.message);
    } finally {
      setSending(false);
    }
  };

  const onFinish = async (values: {
    username: string;
    email: string;
    password: string;
    code: string;
  }) => {
    try {
      const tokens = await register(values);
      setTokens(tokens.access_token, tokens.refresh_token);
      await refresh();
      message.success('注册成功');
      navigate('/', { replace: true });
    } catch (error) {
      message.error(error instanceof Error ? error.message : '注册失败');
    }
  };

  return (
    <ConfigProvider theme={authInputTheme}>
      <AuthLayout
        title="注册账号"
        subtitle="验证邮箱后即可使用 Nexus Studio"
        links={<Link to="/login">已有账号？去登录</Link>}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          size="large"
          requiredMark={false}
          className="register-page-form"
        >
          <Form.Item
            label="邮箱"
            name="email"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '邮箱格式不正确' },
            ]}
          >
            <div style={{ display: 'flex' }}>
              <Input
                placeholder="your@email.com"
                autoComplete="email"
                style={emailInputStyle}
                styles={{ input: inputInnerStyle }}
              />
              <button
                type="button"
                style={sendCodeBtnStyle}
                onClick={() => void handleSendCode()}
                disabled={sending || countdown > 0}
              >
                {sending ? '发送中…' : countdown > 0 ? `${countdown}s 后重发` : '发送验证码'}
              </button>
            </div>
          </Form.Item>

          <Form.Item
            label="验证码"
            name="code"
            rules={[{ required: true, message: '请输入验证码' }]}
          >
            <Input
              placeholder="6 位验证码"
              maxLength={6}
              style={regInputStyle}
              styles={{ input: inputInnerStyle }}
            />
          </Form.Item>

          <Form.Item
            label="用户名"
            name="username"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, message: '至少 3 个字符' },
            ]}
          >
            <Input
              placeholder="用户名"
              style={regInputStyle}
              styles={{ input: inputInnerStyle }}
            />
          </Form.Item>

          <Form.Item
            label="密码"
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '至少 6 位' },
            ]}
          >
            <Input.Password
              placeholder="密码"
              style={regInputStyle}
              styles={{ input: inputInnerStyle }}
            />
          </Form.Item>

          <Form.Item
            label="确认密码"
            name="confirmPassword"
            dependencies={['password']}
            rules={[
              { required: true, message: '请确认密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) return Promise.resolve();
                  return Promise.reject(new Error('两次密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password
              placeholder="再次输入密码"
              style={regInputStyle}
              styles={{ input: inputInnerStyle }}
            />
          </Form.Item>

          <Form.Item className="auth-form-submit">
            <Button type="primary" htmlType="submit" block className="auth-submit-btn">
              注册
            </Button>
          </Form.Item>
        </Form>
      </AuthLayout>
    </ConfigProvider>
  );
}
