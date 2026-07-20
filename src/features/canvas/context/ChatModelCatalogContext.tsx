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
import { listChatModels, type ChatModelItem } from '../../../api/chat';
import { hasResolvedChatModelKey } from '../lib/chatModelKey';

type ChatModelCatalogValue = {
  items: ChatModelItem[];
  loading: boolean;
  failed: boolean;
  getSpec: (modelKey: string | undefined) => ChatModelItem | undefined;
  resolveModelKey: (stored: string | undefined) => string | undefined;
};

const ChatModelCatalogContext = createContext<ChatModelCatalogValue | null>(null);

export function ChatModelCatalogProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ChatModelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    void listChatModels()
      .then((list) => {
        if (cancelled) return;
        const models = Array.isArray(list) ? list : [];
        setItems(models);
        if (models.length === 0) {
          message.warning('暂无可用对话模型');
        }
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
        setFailed(true);
        message.error('对话模型列表加载失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const getSpec = useCallback(
    (modelKey: string | undefined) => {
      if (!hasResolvedChatModelKey(modelKey)) return undefined;
      return items.find((m) => m.key === modelKey);
    },
    [items],
  );

  const resolveModelKey = useCallback(
    (stored: string | undefined) => {
      if (hasResolvedChatModelKey(stored) && items.some((m) => m.key === stored)) {
        return stored;
      }
      return items[0]?.key;
    },
    [items],
  );

  const value = useMemo(
    () => ({ items, loading, failed, getSpec, resolveModelKey }),
    [items, loading, failed, getSpec, resolveModelKey],
  );

  return (
    <ChatModelCatalogContext.Provider value={value}>{children}</ChatModelCatalogContext.Provider>
  );
}

export function useChatModelCatalog() {
  const ctx = useContext(ChatModelCatalogContext);
  if (!ctx) {
    throw new Error('useChatModelCatalog must be used within ChatModelCatalogProvider');
  }
  return ctx;
}
