import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { isAgentPickableNodeId } from '../lib/agentCanvasNodeRef';

type CanvasAgentPickContextValue = {
  isPickMode: boolean;
  pickedNodeIds: string[];
  enterPickMode: () => void;
  exitPickMode: () => void;
  togglePickMode: () => void;
  addPickedNode: (nodeId: string) => void;
  removePickedNode: (nodeId: string) => void;
  clearPickedNodes: () => void;
  replacePickedNodes: (nodeIds: string[]) => void;
};

const CanvasAgentPickContext = createContext<CanvasAgentPickContextValue | null>(null);

export function CanvasAgentPickProvider({ children }: { children: ReactNode }) {
  const [isPickMode, setIsPickMode] = useState(false);
  const [pickedNodeIds, setPickedNodeIds] = useState<string[]>([]);

  const enterPickMode = useCallback(() => {
    setIsPickMode(true);
  }, []);

  const exitPickMode = useCallback(() => {
    setIsPickMode(false);
  }, []);

  const togglePickMode = useCallback(() => {
    setIsPickMode((active) => !active);
  }, []);

  const addPickedNode = useCallback((nodeId: string) => {
    if (!isAgentPickableNodeId(nodeId)) {
      return;
    }
    setPickedNodeIds((prev) => {
      if (prev.includes(nodeId)) {
        return prev.filter((id) => id !== nodeId);
      }
      return [...prev, nodeId];
    });
  }, []);

  const removePickedNode = useCallback((nodeId: string) => {
    setPickedNodeIds((prev) => prev.filter((id) => id !== nodeId));
  }, []);

  const clearPickedNodes = useCallback(() => {
    setPickedNodeIds([]);
  }, []);

  const replacePickedNodes = useCallback((nodeIds: string[]) => {
    setPickedNodeIds(nodeIds.filter((id) => isAgentPickableNodeId(id)));
  }, []);

  const value = useMemo(
    () => ({
      isPickMode,
      pickedNodeIds,
      enterPickMode,
      exitPickMode,
      togglePickMode,
      addPickedNode,
      removePickedNode,
      clearPickedNodes,
      replacePickedNodes,
    }),
    [
      isPickMode,
      pickedNodeIds,
      enterPickMode,
      exitPickMode,
      togglePickMode,
      addPickedNode,
      removePickedNode,
      clearPickedNodes,
      replacePickedNodes,
    ],
  );

  return (
    <CanvasAgentPickContext.Provider value={value}>{children}</CanvasAgentPickContext.Provider>
  );
}

export function useCanvasAgentPick(): CanvasAgentPickContextValue {
  const value = useContext(CanvasAgentPickContext);
  if (!value) {
    throw new Error('useCanvasAgentPick must be used within CanvasAgentPickProvider');
  }
  return value;
}
