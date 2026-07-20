import { Button, ConfigProvider, Form, Input, message } from 'antd';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { forgotPassword } from '../api/auth';
import { authInputTheme, inputInnerStyle, inputWrapperStyle } from './authInputStyles';

export function ForgotPasswordPage() {
  const onFinish = async (values: { email: string }) => {
    try {
      const result = await forgotPassword(values.email);
      message.success(result.message);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '提交失败');
    }
  };

  return (
    <ConfigProvider theme={authInputTheme}>
      <AuthLayout
        title="忘记密码"
        subtitle="我们将向您的邮箱发送重置链接"
        links={<Link to="/login">返回登录</Link>}
      >
        <Form layout="vertical" onFinish={onFinish} size="large" requiredMark={false}>
          <Form.Item
            label="邮箱"
            name="email"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '邮箱格式不正确' },
            ]}
          >
            <Input
              placeholder="请输入注册邮箱"
              autoComplete="email"
              style={inputWrapperStyle}
              styles={{ input: inputInnerStyle }}
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block className="auth-submit-btn">
              发送重置邮件
            </Button>
          </Form.Item>
        </Form>
      </AuthLayout>
    </ConfigProvider>
  );
}
