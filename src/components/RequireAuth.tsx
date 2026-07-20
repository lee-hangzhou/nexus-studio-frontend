import { Navigate, useLocation } from 'react-router-dom';
import { getAccessToken } from '../api/base';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const token = getAccessToken();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
