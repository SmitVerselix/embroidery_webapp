"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
  requiredPermission?: string;
  fallbackUrl?: string;
}

/**
 * Client-side route protection component
 * 
 * Use this to wrap pages or components that require authentication
 * or specific permissions.
 * 
 * @example
 * ```tsx
 * // Basic protection (just requires auth)
 * <ProtectedRoute>
 *   <DashboardPage />
 * </ProtectedRoute>
 * 
 * // With role requirement
 * <ProtectedRoute requiredRole="admin">
 *   <AdminPage />
 * </ProtectedRoute>
 * 
 * // With permission requirement
 * <ProtectedRoute requiredPermission="manage:users">
 *   <UsersPage />
 * </ProtectedRoute>
 * ```
 */
export function ProtectedRoute({
  children,
  requiredRole,
  requiredPermission,
  fallbackUrl = "/dashboard/overview",
}: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, hasRole, hasPermission } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    // Not authenticated - redirect to sign in
    if (!isAuthenticated) {
      const signInUrl = `/auth/sign-in?callbackUrl=${encodeURIComponent(pathname)}`;
      router.replace(signInUrl);
      return;
    }

    // Check role requirement
    if (requiredRole && !hasRole(requiredRole)) {
      router.replace(fallbackUrl);
      return;
    }

    // Check permission requirement
    if (requiredPermission && !hasPermission(requiredPermission)) {
      router.replace(fallbackUrl);
      return;
    }
  }, [
    isAuthenticated,
    isLoading,
    requiredRole,
    requiredPermission,
    hasRole,
    hasPermission,
    router,
    pathname,
    fallbackUrl,
  ]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return null;
  }

  // Role check failed
  if (requiredRole && !hasRole(requiredRole)) {
    return null;
  }

  // Permission check failed
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return null;
  }

  return <>{children}</>;
}

/**
 * Higher-order component for protecting pages
 * 
 * @example
 * ```tsx
 * function AdminPage() {
 *   return <div>Admin Content</div>;
 * }
 * 
 * export default withProtection(AdminPage, { requiredRole: 'admin' });
 * ```
 */
export function withProtection<P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    requiredRole?: string;
    requiredPermission?: string;
    fallbackUrl?: string;
  }
) {
  return function ProtectedComponent(props: P) {
    return (
      <ProtectedRoute
        requiredRole={options?.requiredRole}
        requiredPermission={options?.requiredPermission}
        fallbackUrl={options?.fallbackUrl}
      >
        <Component {...props} />
      </ProtectedRoute>
    );
  };
}

export default ProtectedRoute;