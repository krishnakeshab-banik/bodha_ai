import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../../hooks/useAuth';

export function RequireOnboarding({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();

  if (user && !user.onboarded) {
    return <Navigate to="/onboarding" replace state={{ from: location.pathname }} />;
  }

  return children;
}
