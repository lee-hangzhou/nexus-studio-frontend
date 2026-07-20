import { Button, Form, Input, message } from 'antd';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { resetPassword } from '../api/auth';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const onFinish = async (values: { password: string }) => {
    if (!token) {
      message.error('重置链接无效，请重新申请');
      return;
    }
    try {
      const result = await resetPassword(token, values.password);
      message.success(result.message);
      navigate('/login', { replace: true });
    } catch (error) {
      message.error(error instanceof Error ? error.message : '重置失败');
    }
  };

  return (
    <AuthLayout
      title="重置密码"
      subtitle="请设置新的登录密码"
      links={<Link to="/login">返回登录</Link>}
    >
      {!token ? (
        <p style={{ color: '#c00', margin: 0 }}>链接缺少 token，请从邮件中重新打开。</p>
      ) : (
        <Form layout="vertical" onFinish={onFinish} size="large">
          <Form.Item
            label="新密码"
            name="password"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '至少 6 位' },
            ]}
          >
            <Input.Password placeholder="新密码" />
          </Form.Item>
          <Form.Item
            label="确认新密码"
            name="confirmPassword"
            dependencies={['password']}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="再次输入新密码" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block>
              重置密码
            </Button>
          </Form.Item>
        </Form>
      )}
    </AuthLayout>
  );
}
