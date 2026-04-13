'use client';

import { useParams } from 'next/navigation';
import { useCallback } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { toast } from 'sonner';
import PageContainer from '@/components/layout/page-container';
import { KanbanBoard } from './kanban-board';
import {
  useKanbanSocket,
  type KanbanBoardData,
  type KanbanSection,
  type KanbanTask
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
    tasks,
    setTasks,
    createSection,
    updateSection,
    deleteSection,
    reorderSections,
    createTask,
    moveTask
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
      // Sections + tasks are fetched by the hook automatically.
    }, []),
    onSectionsReordered: useCallback(
      (_sections: KanbanSection[], message: string) => {
        toast.success(message);
      },
      []
    ),
    onTasksListed: useCallback((_tasks: KanbanTask[], _sectionId: string) => {
      // Tasks are merged into state by the hook.
    }, []),
    onTaskCreated: useCallback((task: KanbanTask) => {
      toast.success(`Task "${task.title}" created`);
    }, []),
    onTaskMoved: useCallback((task: KanbanTask) => {
      toast.success(`Task "${task.title}" moved`);
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
      pageDescription={
        boardData?.description || 'Manage tasks by drag and drop'
      }
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
        </div>
      }
    >
      <KanbanBoard
        boardId={boardId}
        companyId={companyId}
        sections={sections}
        setSections={setSections}
        tasks={tasks}
        setTasks={setTasks}
        createSection={createSection}
        updateSection={updateSection}
        deleteSection={deleteSection}
        reorderSections={reorderSections}
        createTask={createTask}
        moveTask={moveTask}
        isConnected={isConnected}
      />
    </PageContainer>
  );
}
