"use client";

import { useMemo } from "react";
import { useAuth } from "@/providers/auth-provider";
import type { NavItem } from "@/lib/api/types";

/**
 * Hook to filter navigation items based on RBAC (fully client-side)
 *
 * @param items - Array of navigation items to filter
 * @returns Filtered items with company ID replaced in URLs
 */
export function useFilteredNavItems(items: NavItem[]) {
  const { user, currentCompany, isAdmin, userRole } = useAuth();

  // Get company ID for URL replacement
  const companyId = currentCompany?.company?.id;

  // Memoize context
  const accessContext = useMemo(() => {
    const role = currentCompany?.role?.name;

    return {
      company: currentCompany ?? undefined,
      user: user ?? undefined,
      role: role ?? undefined,
      userRole: userRole ?? undefined,
      hasCompany: !!currentCompany,
      isAdmin: isAdmin(),
      companyId,
    };
  }, [currentCompany?.company?.id, user?.id, currentCompany?.role?.name, isAdmin, userRole, companyId]);

  // Filter items and replace [companyId] in URLs
  const filteredItems = useMemo(() => {
    const replaceCompanyId = (url: string): string => {
      if (!accessContext.companyId) return url;
      return url.replace("[companyId]", accessContext.companyId);
    };

    return items
      .filter((item) => {
        // No access restrictions
        if (!item.access) {
          return true;
        }

        // Check requireOrg (company)
        if (item.access.requireOrg && !accessContext.hasCompany) {
          return false;
        }

        // Check permission - admin always has access
        if (item.access.permission) {
          if (accessContext.isAdmin) {
            return true;
          }
          if (!accessContext.hasCompany) {
            return false;
          }
          return false;
        }

        // Check role - admin always has access
        if (item.access.role) {
          if (accessContext.isAdmin) {
            return true;
          }
          if (!accessContext.hasCompany) {
            return false;
          }
          if (
            accessContext.userRole !== item.access.role &&
            accessContext.role !== item.access.role
          ) {
            return false;
          }
        }

        return true;
      })
      .map((item) => {
        // Replace [companyId] in URL
        const newItem = {
          ...item,
          url: replaceCompanyId(item.url),
        };

        // Recursively filter and update child items
        if (item.items && item.items.length > 0) {
          const filteredChildren = item.items
            .filter((childItem) => {
              if (!childItem.access) {
                return true;
              }

              if (childItem.access.requireOrg && !accessContext.hasCompany) {
                return false;
              }

              if (childItem.access.permission) {
                if (accessContext.isAdmin) {
                  return true;
                }
                if (!accessContext.hasCompany) {
                  return false;
                }
                return false;
              }

              if (childItem.access.role) {
                if (accessContext.isAdmin) {
                  return true;
                }
                if (!accessContext.hasCompany) {
                  return false;
                }
                if (
                  accessContext.userRole !== childItem.access.role &&
                  accessContext.role !== childItem.access.role
                ) {
                  return false;
                }
              }

              return true;
            })
            .map((childItem) => ({
              ...childItem,
              url: replaceCompanyId(childItem.url),
            }));

          return {
            ...newItem,
            items: filteredChildren,
          };
        }

        return newItem;
      });
  }, [items, accessContext]);

  return filteredItems;
}

/**
 * Hook to check if user has a specific permission
 */
export function useHasPermission(permission: string): boolean {
  const { currentCompany, isAdmin } = useAuth();

  return useMemo(() => {
    if (isAdmin()) return true;
    if (!currentCompany) return false;
    return false;
  }, [currentCompany, isAdmin]);
}

/**
 * Hook to check if user has a specific role
 */
export function useHasRole(role: string): boolean {
  const { currentCompany, userRole } = useAuth();

  return useMemo(() => {
    if (!currentCompany && !userRole) return false;
    if (userRole === role) return true;
    return currentCompany?.role?.name === role;
  }, [currentCompany, userRole, role]);
}

/**
 * Hook to check if user is owner of current company
 */
export function useIsOwner(): boolean {
  return useHasRole("owner");
}

/**
 * Hook to check if user is admin
 */
export function useIsAdmin(): boolean {
  const { isAdmin } = useAuth();
  return isAdmin();
}

/**
 * Hook to get current company ID for URL building
 */
export function useCompanyId(): string | null {
  const { currentCompany } = useAuth();
  return currentCompany?.company?.id ?? null;
}