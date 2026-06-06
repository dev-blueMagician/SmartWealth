/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import type { PortalCapabilities } from './portalPermissions';

type CapKey = keyof PortalCapabilities;

export function RequireCapability({
  capability,
  redirectTo = '/internal',
  children,
}: {
  capability: CapKey;
  redirectTo?: string;
  children: ReactNode;
}) {
  const { portalCaps } = useAuth();
  if (!portalCaps[capability]) {
    return <Navigate to={redirectTo} replace />;
  }
  return <>{children}</>;
}
