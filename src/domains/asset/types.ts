export type AssetKind = 'image' | 'video' | 'text';

export type AssetSource = 'generate' | 'chat' | 'canvas' | 'import';

export interface AssetBase {
  id: string;
  kind: AssetKind;
  title: string;
  filename?: string;
  mimeType?: string;
  metadata?: Record<string, unknown>;
  status?: string;
  createdAt: string;
  source: AssetSource;
  previewUrl?: string;
  favorite?: boolean;
}
