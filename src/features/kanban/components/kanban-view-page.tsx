'use client';

import { useParams } from 'next/navigation';
import { useCallback } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { toast } from 'sonner';
import PageContainer from '@/components/layout/page-container';
import { KanbanBoard } from './kanban-board';
import NewTaskDialog from './new-task-dialog';
import {
  useKanbanSocket,
  type KanbanBoardData,
  type KanbanSection
} from '@/hooks/use-kanban-socket';
import { Loader2 } from 'lucide-react';

// =============================================================================
// COMPONENT
// =============================================================================

export default function KanbanViewPage() {
  const params = useParams();
  const { currentCompany } = useAuth();

  const companyId =
    (params?.companyId as string) || currentCompany?.company?.id || '';
  const boardId = (params?.kanbanId as string) || '';

  // ── Socket connection ──────────────────────────────────────────────────
  const {
    isConnected,
    isJoined,
    boardData,
    sections,
    setSections,
    createSection,
    updateSection,
    deleteSection
  } = useKanbanSocket({
    boardId,
    companyId,

    onBoardJoined: useCallback((board: KanbanBoardData) => {
      toast.success(`Joined board "${board.name}"`);
    }, []),

    onSectionCreated: useCallback((section: KanbanSection) => {
      toast.success(`Section "${section.name}" created`);
    }, []),

    onSectionUpdated: useCallback((section: KanbanSection) => {
      toast.success(`Section "${section.name}" updated`);
    }, []),

    onSectionDeleted: useCallback((section: KanbanSection) => {
      toast.success(`Section "${section.name}" deleted`);
    }, []),

    onSectionsListed: useCallback((_sections: KanbanSection[]) => {
      // Sections are set in the hook; no extra action needed here
    }, []),

    onBoardEvent: useCallback((data: unknown) => {
      console.log('[KanbanViewPage] Board channel event:', data);
    }, []),

    onError: useCallback((error: string) => {
      toast.error(error);
    }, [])
  });

  // ── Guards ─────────────────────────────────────────────────────────────
  if (!boardId || !companyId) {
    return (
      <div className='flex items-center justify-center py-10'>
        <p className='text-muted-foreground'>No board selected</p>
      </div>
    );
  }

  // Show loader while connecting + joining
  if (!isConnected || !isJoined) {
    return (
      <div className='flex flex-col items-center justify-center gap-3 py-20'>
        <Loader2 className='text-muted-foreground h-8 w-8 animate-spin' />
        <p className='text-muted-foreground text-sm'>
          {!isConnected ? 'Connecting to server...' : 'Joining board...'}
        </p>
      </div>
    );
  }

  return (
    <PageContainer
      pageTitle={boardData?.name || 'Kanban'}
      pageDescription={boardData?.description || 'Manage tasks by dnd'}
      pageHeaderAction={
        <div className='flex items-center gap-2'>
          {/* Connection indicator */}
          <div className='text-muted-foreground flex items-center gap-1.5 text-xs'>
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            {isConnected ? 'Live' : 'Reconnecting...'}
          </div>
          <NewTaskDialog />
        </div>
      }
    >
      <KanbanBoard
        boardId={boardId}
        companyId={companyId}
        sections={sections}
        setSections={setSections}
        createSection={createSection}
        updateSection={updateSection}
        deleteSection={deleteSection}
        isConnected={isConnected}
      />
    </PageContainer>
  );
}
