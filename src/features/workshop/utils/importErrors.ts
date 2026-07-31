import { UNSUPPORTED_REPORT_TEMPLATE, type ImportRowError } from '../types';

export interface ImportErrorBannerModel {
  variant: 'unsupported_template' | 'validation' | 'duplicate' | 'generic';
  title: string;
  messages: string[];
}

export function buildImportErrorBanner(errors: ImportRowError[]): ImportErrorBannerModel | null {
  if (errors.length === 0) return null;

  const unsupported = errors.filter((error) => error.code === UNSUPPORTED_REPORT_TEMPLATE);
  if (unsupported.length > 0) {
    return {
      variant: 'unsupported_template',
      title: '暂不支持该淘天报表模板',
      messages: unsupported.map(
        (error) =>
          `${error.message}（行 ${error.row_index + 1}，代码 ${error.code}）`,
      ),
    };
  }

  const validation = errors.filter((error) => error.code === 'validation_error');
  if (validation.length > 0) {
    return {
      variant: 'validation',
      title: '导入校验失败',
      messages: validation.map(
        (error) => `第 ${error.row_index + 1} 行：${error.message}`,
      ),
    };
  }

  const duplicate = errors.filter((error) => error.code === 'duplicate_natural_key');
  if (duplicate.length > 0) {
    return {
      variant: 'duplicate',
      title: '导入存在重复键',
      messages: duplicate.map(
        (error) => `第 ${error.row_index + 1} 行：${error.message}`,
      ),
    };
  }

  return {
    variant: 'generic',
    title: '导入失败',
    messages: errors.map(
      (error) => `第 ${error.row_index + 1} 行 [${error.code}]：${error.message}`,
    ),
  };
}
