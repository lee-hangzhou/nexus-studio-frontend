import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadApiUrls(origin: string) {
  vi.stubEnv('VITE_API_ORIGIN', origin);
  vi.resetModules();
  return import('./base');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('API URL helpers', () => {
  it('uses same-origin API paths by default', async () => {
    const { apiOriginUrl, apiUrl } = await loadApiUrls('');

    expect(apiUrl('/chat/message/stream')).toBe('/api/v1/chat/message/stream');
    expect(apiOriginUrl('/api/v1/chat/gate/asset')).toBe('/api/v1/chat/gate/asset');
  });

  it('normalizes a configured API origin', async () => {
    const { API_ORIGIN, apiOriginUrl, apiUrl } = await loadApiUrls(' https://api.example.com/// ');

    expect(API_ORIGIN).toBe('https://api.example.com');
    expect(apiUrl('assets/upload-url')).toBe('https://api.example.com/api/v1/assets/upload-url');
    expect(apiOriginUrl('/api/v1/chat/gate/asset')).toBe(
      'https://api.example.com/api/v1/chat/gate/asset',
    );
  });

  it('does not rewrite absolute resource URLs', async () => {
    const { apiOriginUrl } = await loadApiUrls('https://api.example.com');

    expect(apiOriginUrl('https://storage.example.com/object.png')).toBe(
      'https://storage.example.com/object.png',
    );
    expect(apiOriginUrl('//storage.example.com/object.png')).toBe('//storage.example.com/object.png');
    expect(apiOriginUrl('javascript:alert(1)')).toBe(
      'https://api.example.com/javascript:alert(1)',
    );
  });
});
