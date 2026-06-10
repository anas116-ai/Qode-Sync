import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";

/**
 * Context shape injected into route guards (`beforeLoad`).
 *
 * We deliberately keep `auth` optional / nullable so that `beforeLoad`
 * doesn't crash with "cannot read user of undefined" before the React
 * `<AuthProvider>` has mounted. The runtime redirect-to-login is then
 * driven by the React component (`_layout.tsx` -> `Navigate`).
 */
export interface RouterContext {
  auth?: {
    user: { id: string; email?: string | null } | null;
    profile?: unknown;
    loading?: boolean;
  };
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => <Outlet />,
});
