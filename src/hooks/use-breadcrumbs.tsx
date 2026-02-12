'use client';

import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { useAuth } from '@/providers/auth-provider';

type BreadcrumbItem = {
  title: string;
  link: string;
};

// Check if a string looks like a UUID
const isUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

// Format segment title (capitalize, replace hyphens with spaces)
const formatSegmentTitle = (segment: string): string => {
  return segment
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export function useBreadcrumbs() {
  const pathname = usePathname();
  const { currentCompany } = useAuth();

  const breadcrumbs = useMemo(() => {
    const segments = pathname.split('/').filter(Boolean);

    return segments.map((segment, index) => {
      const path = `/${segments.slice(0, index + 1).join('/')}`;

      // Check if this segment is a company ID (UUID)
      if (isUUID(segment)) {
        // If we have the current company and the ID matches, show company name
        if (currentCompany && currentCompany.company.id === segment) {
          return {
            title: currentCompany.company.name,
            link: path,
          };
        }
        // If no match, still try to show something better than UUID
        return {
          title: currentCompany?.company?.name || 'Workspace',
          link: path,
        };
      }

      // Special case mappings for better titles
      const titleMappings: Record<string, string> = {
        'dashboard': 'Dashboard',
        'overview': 'Overview',
        'billing': 'Billing',
        'profile': 'Profile',
        'workspaces': 'Workspaces',
        'team': 'Team',
        'kanban': 'Kanban',
        'product': 'Product',
        'exclusive': 'Exclusive',
        'settings': 'Settings',
        'select-company': 'Select Company',
      };

      return {
        title: titleMappings[segment.toLowerCase()] || formatSegmentTitle(segment),
        link: path,
      };
    });
  }, [pathname, currentCompany]);

  return breadcrumbs;
}