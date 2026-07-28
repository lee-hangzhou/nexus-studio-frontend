import { createContext, useContext, type ReactNode } from 'react';
import type { NodeGenerateBody } from '../api/canvasTypes';

export type NodeGenerateExtra = Partial<
  Pick<
    NodeGenerateBody,
    | 'reference_mode'
    | 'duration'
    | 'ratio'
    | 'resolution'
    | 'model_id'
    | 'ref_asset_ids'
    | 'prompt'
    | 'submit_content'
    | 'manual_refs'
    | 'preview_media_asset_ids'
  >
> & {
  /** PATCH 落库用展示文案（含 @文本1），与展开后的 generate prompt 分离 */
  input_prompt?: string;
};

const CanvasGenerateContext = createContext<{
  onNodeGenerate: (nodeId: string, extra?: NodeGenerateExtra) => Promise<void>;
} | null>(null);

export function CanvasGenerateProvider({
  onNodeGenerate,
  children,
}: {
  onNodeGenerate: (nodeId: string, extra?: NodeGenerateExtra) => Promise<void>;
  children: ReactNode;
}) {
  return (
    <CanvasGenerateContext.Provider value={{ onNodeGenerate }}>{children}</CanvasGenerateContext.Provider>
  );
}

export function useCanvasGenerate() {
  const ctx = useContext(CanvasGenerateContext);
  if (!ctx) throw new Error('useCanvasGenerate requires provider');
  return ctx;
}
