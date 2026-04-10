'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { getKanbanSections } from '@/lib/api/services';
import { getError } from '@/lib/api/axios';
import type { KanbanSection } from '@/lib/api/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageContainer from '@/components/layout/page-container';
import KanbanPermissionUsersTab from './kanban-permission-users-tab';
import KanbanPermissionRolesTab from './kanban-permission-roles-tab';

// =============================================================================
// COMPONENT
// =============================================================================

export default function KanbanPermissionsPage() {
  const params = useParams();
  const { currentCompany } = useAuth();

  const companyId =
    (params?.companyId as string) || currentCompany?.company?.id;
  const kanbanId = params?.kanbanId as string;

  // ── Sections (shared between both tabs) ────────────────────────────────
  const [sections, setSections] = useState<KanbanSection[]>([]);

  const fetchSections = useCallback(async () => {
    if (!companyId || !kanbanId) return;
    try {
      const data = await getKanbanSections(companyId, kanbanId);
      setSections(data);
    } catch (err) {
      console.error('Failed to fetch sections:', getError(err));
    }
  }, [companyId, kanbanId]);

  useEffect(() => {
    fetchSections();
  }, [fetchSections]);

  if (!companyId || !kanbanId) {
    return (
      <div className='flex items-center justify-center py-10'>
        <p className='text-muted-foreground'>No board selected</p>
      </div>
    );
  }

  return (
    <PageContainer
      pageTitle='Permissions'
      pageDescription='Manage user and role access to this board.'
    >
      <Tabs defaultValue='users' className='w-full'>
        <TabsList className='grid w-full max-w-md grid-cols-2'>
          <TabsTrigger value='users'>User Permission</TabsTrigger>
          <TabsTrigger value='roles'>Role Permission</TabsTrigger>
        </TabsList>

        <TabsContent value='users' className='mt-6'>
          <KanbanPermissionUsersTab sections={sections} />
        </TabsContent>

        <TabsContent value='roles' className='mt-6'>
          <KanbanPermissionRolesTab sections={sections} />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
