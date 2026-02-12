"use client";

import { useMemo } from "react";
import { useAuth } from "@/providers/auth-provider";

// =============================================================================
// TYPES
// =============================================================================

interface NavAccess {
  requireOrg?: boolean;
  permission?: string;
  role?: string;
  plan?: string;
  feature?: string;
}

interface NavItem {
  title: string;
  url: string;
  icon?: string;
  isActive?: boolean;
  shortcut?: string[];
  items?: NavItem[];
  access?: NavAccess;
}

// =============================================================================
// ACCESS CHECK
// =============================================================================

function checkAccess(
  access: NavAccess | undefined,
  context: {
    hasCompany: boolean;
    role: string | undefined;
    userRole: string | undefined;
    isAdmin: boolean;
  }
): boolean {
  if (!access) return true;

  if (access.requireOrg && !context.hasCompany) {
    return false;
  }

  if (access.role) {
    if (context.isAdmin) return true;
    if (!context.hasCompany) return false;
    if (context.userRole !== access.role && context.role !== access.role) {
      return false;
    }
  }

  if (access.permission) {
    if (context.isAdmin) return true;
    if (!context.hasCompany) return false;
    return false;
  }

  if (access.plan || access.feature) {
    if (context.isAdmin) return true;
  }

  return true;
}

// =============================================================================
// HOOKS
// =============================================================================

export function useFilteredNavItems(items: NavItem[]): NavItem[] {
  const { user, currentCompany, isAdmin, userRole } = useAuth();

  const accessContext = useMemo(() => {
    const role = currentCompany?.role?.name;

    return {
      user: user ?? undefined,
      role,
      userRole: userRole ?? undefined,
      hasCompany: !!currentCompany,
      isAdmin: isAdmin(),
    };
  }, [user?.id, currentCompany?.role?.name, isAdmin, userRole]);

  const filteredItems = useMemo(() => {
    return items
      .filter((item) => checkAccess(item.access, accessContext))
      .map((item) => {
        if (item.items && item.items.length > 0) {
          const filteredChildren = item.items.filter((childItem) =>
            checkAccess(childItem.access, accessContext)
          );

          return {
            ...item,
            items: filteredChildren,
          };
        }

        return item;
      });
  }, [items, accessContext]);

  return filteredItems;
}

export function useHasPermission(permission: string): boolean {
  const { currentCompany, isAdmin } = useAuth();

  return useMemo(() => {
    if (isAdmin()) return true;
    if (!currentCompany) return false;
    return false;
  }, [currentCompany, isAdmin]);
}

export function useHasRole(role: string): boolean {
  const { currentCompany, userRole } = useAuth();

  return useMemo(() => {
    if (!currentCompany && !userRole) return false;
    if (userRole === role) return true;
    return currentCompany?.role?.name === role;
  }, [currentCompany, userRole, role]);
}

export function useIsOwner(): boolean {
  return useHasRole("owner");
}

export function useIsAdmin(): boolean {
  const { isAdmin } = useAuth();
  return isAdmin();
}