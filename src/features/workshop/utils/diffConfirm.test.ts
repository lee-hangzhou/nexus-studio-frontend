import { describe, expect, it } from 'vitest';

import { canConfirmPublishDiff } from './diffConfirm';
import type { PublishDiff } from '../types';

const sampleDiff: Pick<PublishDiff, 'payload_hash' | 'changes'> = {
  payload_hash: 'sha256-demo-hash',
  changes: [{ path: 'title', before: '旧', after: '新' }],
};

describe('diffConfirm', () => {
  it('requires matching payload_hash to confirm', () => {
    expect(canConfirmPublishDiff(sampleDiff, '')).toBe(false);
    expect(canConfirmPublishDiff(sampleDiff, 'wrong')).toBe(false);
    expect(canConfirmPublishDiff(sampleDiff, 'sha256-demo-hash')).toBe(true);
    expect(canConfirmPublishDiff(sampleDiff, '  sha256-demo-hash  ')).toBe(true);
  });
});
