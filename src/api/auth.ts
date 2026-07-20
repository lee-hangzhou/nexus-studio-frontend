import { clearTokens, request, setTokens } from './base';

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface UserInfo {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export interface MessageResponse {
  message: string;
}

export function sendRegisterCode(email: string) {
  return request<MessageResponse>('/auth/send-register-code', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function register(payload: {
  username: string;
  email: string;
  password: string;
  code: string;
}) {
  return request<TokenResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function login(email: string, password: string) {
  const tokens = await request<TokenResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setTokens(tokens.access_token, tokens.refresh_token);
  return tokens;
}

export function fetchMe() {
  return request<UserInfo>('/auth/me', {
    method: 'POST',
    body: '{}',
  });
}

export async function logout() {
  const refreshToken = localStorage.getItem('nexus_studio_refresh_token');
  try {
    await request<MessageResponse>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  } finally {
    clearTokens();
  }
}

export function forgotPassword(email: string) {
  return request<MessageResponse>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(token: string, newPassword: string) {
  return request<MessageResponse>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, new_password: newPassword }),
  });
}
