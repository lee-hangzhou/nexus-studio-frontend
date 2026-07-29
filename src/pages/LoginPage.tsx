import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { Button, Checkbox, ConfigProvider, Form, Input, message } from 'antd';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { login } from '../api/auth';
import { useUser } from '../contexts/UserContext';
import { authInputTheme, inputInnerStyle, inputWrapperStyle } from './authInputStyles';
import './LoginPage.css';

export function LoginPage() {
  const navigate = useNavigate();
  const { refresh } = useUser();
  const [searchParams] = useSearchParams();
  const from = searchParams.get('from') ?? '/';

  const onFinish = async (values: { email: string; password: string }) => {
    try {
      await login(values.email, values.password);
      await refresh();
      message.success('登录成功');
      navigate(from, { replace: true });
    } catch (error) {
      message.error(error instanceof Error ? error.message : '登录失败');
    }
  };

  return (
    <ConfigProvider theme={authInputTheme}>
      <AuthLayout
        title="登录"
        links={
          <>
            还没有账号？<Link to="/register">注册</Link>
          </>
        }
      >
        <Form
          className="login-page-form"
          layout="vertical"
          onFinish={onFinish}
          size="large"
          requiredMark={false}
        >
          <Form.Item
            label="邮箱"
            name="email"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '邮箱格式不正确' },
            ]}
          >
            <Input
              prefix={<MailOutlined />}
              placeholder="请输入注册邮箱"
              autoComplete="email"
              style={inputWrapperStyle}
              styles={{ input: inputInnerStyle }}
            />
          </Form.Item>
          <Form.Item
            label="密码"
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请输入密码"
              autoComplete="current-password"
              style={inputWrapperStyle}
              styles={{ input: inputInnerStyle }}
            />
          </Form.Item>
          <div className="auth-form-options">
            <Form.Item name="remember" valuePropName="checked" noStyle>
              <Checkbox>记住我</Checkbox>
            </Form.Item>
            <Link to="/forgot-password">忘记密码？</Link>
          </div>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block className="auth-submit-btn">
              登录
            </Button>
          </Form.Item>
        </Form>
      </AuthLayout>
    </ConfigProvider>
  );
}
