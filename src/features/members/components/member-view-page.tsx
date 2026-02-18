'use client';

import { useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import MemberListing from './member-listing';
import MemberInviteDialog from './member-invite-dialog';
import { Separator } from '@/components/ui/separator';
import PageContainer from '@/components/layout/page-container';

// =============================================================================
// COMPONENT
// =============================================================================

export default function MemberViewPage() {
  const params = useParams();
  const { currentCompany } = useAuth();

  const companyId =
    (params?.companyId as string) || currentCompany?.company?.id;

  // Ref to trigger listing refresh from parent
  const refreshRef = useRef<(() => void) | null>(null);

  const handleInviteSuccess = useCallback(() => {
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
      pageTitle='Members'
      pageDescription='Manage your team members and invitations.'
      pageHeaderAction={<MemberInviteDialog onSuccess={handleInviteSuccess} />}
    >
      {/* Member List */}
      <MemberListing onRefresh={(fn) => (refreshRef.current = fn)} />
    </PageContainer>
  );
}
