import { message } from 'antd';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  listGenerateModels,
  type GenerateModelItem,
} from '../../../api/generate';
import { hasResolvedModelId } from '../lib/generateModelId';

type Kind = 'image' | 'video' | 'audio';

type KindCatalog = {
  items: GenerateModelItem[];
  loading: boolean;
  failed: boolean;
};

type GenerateModelCatalogValue = {
  image: KindCatalog;
  video: KindCatalog;
  audio: KindCatalog;
  getItems: (kind: Kind) => GenerateModelItem[];
  getSpec: (kind: Kind, modelId: string | undefined) => GenerateModelItem | undefined;
  resolveModelId: (kind: Kind, stored: string | undefined) => string | undefined;
};

const emptyCatalog = (): KindCatalog => ({
  items: [],
  loading: true,
  failed: false,
});

const GenerateModelCatalogContext = createContext<GenerateModelCatalogValue | null>(null);

const KIND_LABEL: Record<Kind, string> = {
  image: '生图',
  video: '生视频',
  audio: '语音合成',
};

async function fetchKindCatalog(kind: Kind): Promise<KindCatalog> {
  try {
    const res = await listGenerateModels(kind);
    const items = res.items ?? [];
    if (items.length === 0) {
      message.warning(`暂无可用${KIND_LABEL[kind]}模型`);
    }
    return { items, loading: false, failed: false };
  } catch {
    message.error(`${KIND_LABEL[kind]}模型列表加载失败`);
    return { items: [], loading: false, failed: true };
  }
}

export function GenerateModelCatalogProvider({ children }: { children: ReactNode }) {
  const [image, setImage] = useState<KindCatalog>(emptyCatalog);
  const [video, setVideo] = useState<KindCatalog>(emptyCatalog);
  const [audio, setAudio] = useState<KindCatalog>(emptyCatalog);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [imageCat, videoCat, audioCat] = await Promise.all([
        fetchKindCatalog('image'),
        fetchKindCatalog('video'),
        fetchKindCatalog('audio'),
      ]);
      if (cancelled) return;
      setImage(imageCat);
      setVideo(videoCat);
      setAudio(audioCat);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const catalogs = useMemo(() => ({ image, video, audio }), [image, video, audio]);

  const getItems = useCallback((kind: Kind) => catalogs[kind].items, [catalogs]);

  const getSpec = useCallback(
    (kind: Kind, modelId: string | undefined) => {
      if (!hasResolvedModelId(modelId)) return undefined;
      return getItems(kind).find((m) => m.model_id === modelId);
    },
    [getItems],
  );

  const resolveModelId = useCallback(
    (kind: Kind, stored: string | undefined) => {
      const items = getItems(kind);
      if (hasResolvedModelId(stored) && items.some((m) => m.model_id === stored)) {
        return stored;
      }
      return items[0]?.model_id;
    },
    [getItems],
  );

  const value = useMemo(
    () => ({ image, video, audio, getItems, getSpec, resolveModelId }),
    [image, video, audio, getItems, getSpec, resolveModelId],
  );

  return (
    <GenerateModelCatalogContext.Provider value={value}>
      {children}
    </GenerateModelCatalogContext.Provider>
  );
}

export function useGenerateModelCatalog() {
  const ctx = useContext(GenerateModelCatalogContext);
  if (!ctx) {
    throw new Error('useGenerateModelCatalog must be used within GenerateModelCatalogProvider');
  }
  return ctx;
}
