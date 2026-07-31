import { Navigate, useParams } from 'react-router-dom';

/** 兼容旧工坊路由：统一回到 /chat */
export function WorkshopPage() {
  return <Navigate to="/chat" replace />;
}

export function WorkshopProjectRedirect() {
  const { projectId = '' } = useParams();
  if (!projectId) return <Navigate to="/chat" replace />;
  return <Navigate to={`/chat?workshop=${encodeURIComponent(projectId)}`} replace />;
}
