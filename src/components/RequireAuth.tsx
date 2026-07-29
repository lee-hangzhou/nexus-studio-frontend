import { Navigate, useLocation } from 'react-router-dom';
import { getAccessToken } from '../api/base';
import { loginUrl } from '../shared/utils/authGate';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const token = getAccessToken();

  if (!token) {
    return <Navigate to={loginUrl(`${location.pathname}${location.search}`)} replace />;
  }

  return <>{children}</>;
}
