'use client';

import { useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import RoleListing from './role-listing';
import RoleFormDialog from './role-form-dialog';
import PageContainer from '@/components/layout/page-container';

// =============================================================================
// COMPONENT
// =============================================================================

export default function RoleViewPage() {
  const params = useParams();
  const { currentCompany } = useAuth();

  const companyId =
    (params?.companyId as string) || currentCompany?.company?.id;

  // Ref to trigger listing refresh from parent
  const refreshRef = useRef<(() => void) | null>(null);

  const handleCreateSuccess = useCallback(() => {
    refreshRef.current?.();
  }, []);

  if (!companyId) {
    return (
      <div className='flex items-center justify-center py-10'>
        <p className='text-muted-foreground'>No company selected</p>
      </div>
    );
  }

  return (
    <PageContainer
      pageTitle='Roles'
      pageDescription='Manage company roles and permissions.'
      pageHeaderAction={<RoleFormDialog onSuccess={handleCreateSuccess} />}
    >
      {/* Role List */}
      <RoleListing onRefresh={(fn) => (refreshRef.current = fn)} />
    </PageContainer>
  );
}
