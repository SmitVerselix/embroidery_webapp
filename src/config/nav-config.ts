import type { NavItem } from "@/lib/api/types";

// =============================================================================
// NAVIGATION CONFIGURATION
// =============================================================================
// Note: [companyId] in URLs will be replaced with actual company ID by useFilteredNavItems

export const navItems: NavItem[] = [
  {
    title: "Overview",
    url: "/dashboard/[companyId]/overview",
    icon: "dashboard",
    isActive: true,
  },
  {
    title: "Product",
    url: "/dashboard/[companyId]/product",
    icon: "product",
    items: [
      {
        title: "All Products",
        url: "/dashboard/[companyId]/product",
      },
      {
        title: "Add Product",
        url: "/dashboard/[companyId]/product/new",
      },
    ],
  },
  {
    title: "Customer",
    url: "/dashboard/[companyId]/customer",
    icon: "product",
    items: [
      {
        title: "All Customer",
        url: "/dashboard/[companyId]/customer",
      },
      {
        title: "Add Customer",
        url: "/dashboard/[companyId]/customer/new",
      },
    ],
  },
  {
    title: "Orders",
    url: "/dashboard/[companyId]/orders",
    icon: "orders",
    items: [
      {
        title: "All Orders",
        url: "/dashboard/[companyId]/orders",
      },
      {
        title: "Add Order",
        url: "/dashboard/[companyId]/orders/new",
      },
    ],
  },
  {
    title: "Kanban",
    url: "/dashboard/[companyId]/kanban",
    icon: "kanban",
    access: {
      requireOrg: true,
    },
  },
  {
    title: "Workspaces",
    url: "/dashboard/[companyId]/workspaces",
    icon: "folder",
    items: [
      {
        title: "All Workspaces",
        url: "/dashboard/[companyId]/workspaces",
      },
      {
        title: "Team",
        url: "/dashboard/[companyId]/workspaces/team",
        access: {
          requireOrg: true,
        },
      },
    ],
  },
  {
    title: "Billing",
    url: "/dashboard/[companyId]/billing",
    icon: "billing",
    access: {
      requireOrg: true,
    },
  },
  {
    title: "Profile",
    url: "/dashboard/[companyId]/profile",
    icon: "user",
  },
  {
    title: "Exclusive",
    url: "/dashboard/[companyId]/exclusive",
    icon: "star",
    access: {
      plan: "pro",
    },
  },
];

// =============================================================================
// ADMIN NAVIGATION (optional)
// =============================================================================

export const adminNavItems: NavItem[] = [
  {
    title: "Admin Dashboard",
    url: "/admin/dashboard",
    icon: "dashboard",
    access: {
      role: "admin",
    },
  },
  {
    title: "Users",
    url: "/admin/users",
    icon: "user",
    access: {
      role: "admin",
    },
  },
  {
    title: "Companies",
    url: "/admin/companies",
    icon: "folder",
    access: {
      role: "admin",
    },
  },
];