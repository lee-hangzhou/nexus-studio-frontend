import { describe, expect, it } from 'vitest';

import { buildImportErrorBanner } from './importErrors';
import { UNSUPPORTED_REPORT_TEMPLATE, type ImportRowError } from '../types';

describe('importErrors', () => {
  it('surfaces UNSUPPORTED_REPORT_TEMPLATE distinctly from validation errors', () => {
    const errors: ImportRowError[] = [
      {
        row_index: 0,
        code: UNSUPPORTED_REPORT_TEMPLATE,
        message: 'raw taobao report template mapping not enabled',
      },
      {
        row_index: 2,
        code: 'validation_error',
        message: 'paid_amount_fen required',
      },
    ];

    const banner = buildImportErrorBanner(errors);
    expect(banner?.variant).toBe('unsupported_template');
    expect(banner?.title).toContain('不支持');
    expect(banner?.messages[0]).toContain(UNSUPPORTED_REPORT_TEMPLATE);
  });

  it('classifies validation-only errors separately', () => {
    const banner = buildImportErrorBanner([
      { row_index: 1, code: 'validation_error', message: 'missing field' },
    ]);
    expect(banner?.variant).toBe('validation');
    expect(banner?.title).toBe('导入校验失败');
  });
});
