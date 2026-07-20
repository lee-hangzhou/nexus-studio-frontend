import {
  FileExcelFilled,
  FileFilled,
  FileImageFilled,
  FileMarkdownFilled,
  FilePdfFilled,
  FilePptFilled,
  FileTextFilled,
  FileWordFilled,
  FileZipFilled,
} from '@ant-design/icons';
import type { CSSProperties } from 'react';

interface FileTypeMeta {
  Icon: typeof FileFilled;
  color: string;
  label: string;
}

function extOf(filename?: string): string {
  if (!filename) return '';
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot + 1).toLowerCase() : '';
}

// 依据 mime / 扩展名解析文件类型展示元信息，复用 Ant Design 的分格式图标。
export function fileTypeMeta(mime: string, filename?: string): FileTypeMeta {
  const m = mime.toLowerCase();
  const ext = extOf(filename);

  if (m.includes('pdf') || ext === 'pdf') {
    return { Icon: FilePdfFilled, color: '#e8453c', label: 'PDF' };
  }
  if (m.includes('word') || m.includes('msword') || ext === 'doc' || ext === 'docx') {
    return { Icon: FileWordFilled, color: '#2b7cd3', label: ext === 'doc' ? 'DOC' : 'DOCX' };
  }
  if (
    m.includes('excel') ||
    m.includes('spreadsheet') ||
    m.includes('csv') ||
    ext === 'xls' ||
    ext === 'xlsx' ||
    ext === 'csv'
  ) {
    return { Icon: FileExcelFilled, color: '#21a366', label: ext ? ext.toUpperCase() : 'XLSX' };
  }
  if (m.includes('presentation') || m.includes('powerpoint') || ext === 'ppt' || ext === 'pptx') {
    return { Icon: FilePptFilled, color: '#d24726', label: ext === 'ppt' ? 'PPT' : 'PPTX' };
  }
  if (m.includes('zip') || m.includes('compressed') || ['zip', 'rar', '7z', 'gz', 'tar'].includes(ext)) {
    return { Icon: FileZipFilled, color: '#f59e0b', label: ext ? ext.toUpperCase() : 'ZIP' };
  }
  if (m.includes('markdown') || ext === 'md' || ext === 'markdown') {
    return { Icon: FileMarkdownFilled, color: '#6b7280', label: 'MD' };
  }
  if (m.startsWith('image/')) {
    return { Icon: FileImageFilled, color: '#f59e0b', label: ext ? ext.toUpperCase() : 'IMG' };
  }
  if (m.startsWith('text/') || ['txt', 'json', 'log', 'xml', 'yaml', 'yml'].includes(ext)) {
    return { Icon: FileTextFilled, color: '#6b7280', label: ext ? ext.toUpperCase() : 'TXT' };
  }
  return { Icon: FileFilled, color: 'var(--studio-primary)', label: ext ? ext.toUpperCase() : 'FILE' };
}

export function fileTypeLabel(mime: string, filename?: string): string {
  return fileTypeMeta(mime, filename).label;
}

interface FileTypeIconProps {
  mime: string;
  filename?: string;
  size?: number;
  style?: CSSProperties;
}

export function FileTypeIcon({ mime, filename, size = 16, style }: FileTypeIconProps) {
  const { Icon, color } = fileTypeMeta(mime, filename);
  return <Icon style={{ color, fontSize: size, ...style }} />;
}
