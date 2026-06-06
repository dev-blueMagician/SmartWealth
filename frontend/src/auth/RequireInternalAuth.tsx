/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function RequireInternalAuth({ children }: { children: React.ReactNode }) {
  const { auth, bootstrapping } = useAuth();
  const location = useLocation();

  if (bootstrapping) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600 text-sm">
        Loading session…
      </div>
    );
  }

  if (!auth) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
