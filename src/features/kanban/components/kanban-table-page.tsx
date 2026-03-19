'use client';

import { useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import KanbanListing from './kanban-listing';
import KanbanCreateDialog from './kanban-create-dialog';
import PageContainer from '@/components/layout/page-container';

// =============================================================================
// COMPONENT
// =============================================================================

export default function KanbanTablePage() {
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
      pageTitle='Kanban Boards'
      pageDescription='Manage your Kanban boards and tasks.'
      pageHeaderAction={<KanbanCreateDialog onSuccess={handleCreateSuccess} />}
    >
      {/* Board List */}
      <KanbanListing onRefresh={(fn) => (refreshRef.current = fn)} />
    </PageContainer>
  );
}
