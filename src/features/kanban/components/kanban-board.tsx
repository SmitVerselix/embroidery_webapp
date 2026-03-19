'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Task, useTaskStore } from '../utils/store';
import { hasDraggableData } from '../utils';
import {
  Announcements,
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  UniqueIdentifier,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent
} from '@dnd-kit/core';
import { SortableContext, arrayMove } from '@dnd-kit/sortable';
import type { Column } from './board-column';
import { BoardColumn, BoardContainer } from './board-column';
import NewSectionDialog from './new-section-dialog';
import { TaskCard } from './task-card';
import type { KanbanSection } from '@/hooks/use-kanban-socket';

// =============================================================================
// PROPS
// =============================================================================

interface KanbanBoardProps {
  boardId: string;
  companyId: string;
  sections: KanbanSection[];
  setSections: React.Dispatch<React.SetStateAction<KanbanSection[]>>;
  createSection: (name: string) => void;
  updateSection: (
    sectionId: string,
    updates: { name?: string; position?: number }
  ) => void;
  deleteSection: (sectionId: string) => void;
  isConnected: boolean;
}

// =============================================================================
// HELPERS
// =============================================================================

function sectionsToColumns(sections: KanbanSection[]): Column[] {
  return sections.map((section) => ({
    id: section.id,
    title: section.name
  }));
}

// =============================================================================
// COMPONENT
// =============================================================================

export function KanbanBoard({
  boardId,
  companyId,
  sections,
  setSections,
  createSection,
  updateSection,
  deleteSection,
  isConnected
}: KanbanBoardProps) {
  const columns = useMemo(() => sectionsToColumns(sections), [sections]);
  const columnsId = useMemo(() => columns.map((col) => col.id), [columns]);

  const pickedUpTaskColumn = useRef<UniqueIdentifier | null>(null);

  // Tasks from store (will move to socket later)
  const tasks = useTaskStore((state) => state.tasks);
  const setTasks = useTaskStore((state) => state.setTasks);

  const [activeColumn, setActiveColumn] = useState<Column | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  const sensors = useSensors(useSensor(MouseSensor), useSensor(TouchSensor));

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    useTaskStore.persist.rehydrate();
  }, []);

  if (!isMounted) return null;

  // ── DnD helpers ────────────────────────────────────────────────────────

  function getDraggingTaskData(
    taskId: UniqueIdentifier,
    columnId: UniqueIdentifier
  ) {
    const tasksInColumn = tasks.filter((task) => task.status === columnId);
    const taskPosition = tasksInColumn.findIndex((task) => task.id === taskId);
    const column = columns.find((col) => col.id === columnId);
    return { tasksInColumn, taskPosition, column };
  }

  const announcements: Announcements = {
    onDragStart({ active }) {
      if (!hasDraggableData(active)) return;
      if (active.data.current?.type === 'Column') {
        const idx = columnsId.findIndex((id) => id === active.id);
        return `Picked up Column ${columns[idx]?.title} at position: ${idx + 1} of ${columnsId.length}`;
      } else if (active.data.current?.type === 'Task') {
        pickedUpTaskColumn.current = active.data.current.task.status;
        const { tasksInColumn, taskPosition, column } = getDraggingTaskData(
          active.id,
          pickedUpTaskColumn.current
        );
        return `Picked up Task ${active.data.current.task.title} at position: ${taskPosition + 1} of ${tasksInColumn.length} in column ${column?.title}`;
      }
    },
    onDragOver({ active, over }) {
      if (!hasDraggableData(active) || !hasDraggableData(over)) return;
      if (
        active.data.current?.type === 'Column' &&
        over.data.current?.type === 'Column'
      ) {
        const overIdx = columnsId.findIndex((id) => id === over.id);
        return `Column ${active.data.current.column.title} was moved over ${over.data.current.column.title} at position ${overIdx + 1} of ${columnsId.length}`;
      } else if (
        active.data.current?.type === 'Task' &&
        over.data.current?.type === 'Task'
      ) {
        const { tasksInColumn, taskPosition, column } = getDraggingTaskData(
          over.id,
          over.data.current.task.status
        );
        if (over.data.current.task.status !== pickedUpTaskColumn.current) {
          return `Task ${active.data.current.task.title} was moved over column ${column?.title} in position ${taskPosition + 1} of ${tasksInColumn.length}`;
        }
        return `Task was moved over position ${taskPosition + 1} of ${tasksInColumn.length} in column ${column?.title}`;
      }
    },
    onDragEnd({ active, over }) {
      if (!hasDraggableData(active) || !hasDraggableData(over)) {
        pickedUpTaskColumn.current = null;
        return;
      }
      if (
        active.data.current?.type === 'Column' &&
        over.data.current?.type === 'Column'
      ) {
        const overPos = columnsId.findIndex((id) => id === over.id);
        return `Column ${active.data.current.column.title} was dropped into position ${overPos + 1} of ${columnsId.length}`;
      } else if (
        active.data.current?.type === 'Task' &&
        over.data.current?.type === 'Task'
      ) {
        const { tasksInColumn, taskPosition, column } = getDraggingTaskData(
          over.id,
          over.data.current.task.status
        );
        if (over.data.current.task.status !== pickedUpTaskColumn.current) {
          return `Task was dropped into column ${column?.title} in position ${taskPosition + 1} of ${tasksInColumn.length}`;
        }
        return `Task was dropped into position ${taskPosition + 1} of ${tasksInColumn.length} in column ${column?.title}`;
      }
      pickedUpTaskColumn.current = null;
    },
    onDragCancel({ active }) {
      pickedUpTaskColumn.current = null;
      if (!hasDraggableData(active)) return;
      return `Dragging ${active.data.current?.type} cancelled.`;
    }
  };

  // ── DnD event handlers ─────────────────────────────────────────────────

  function onDragStart(event: DragStartEvent) {
    if (!hasDraggableData(event.active)) return;
    const data = event.active.data.current;
    if (data?.type === 'Column') {
      setActiveColumn(data.column);
    } else if (data?.type === 'Task') {
      setActiveTask(data.task);
    }
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveColumn(null);
    setActiveTask(null);

    const { active, over } = event;
    if (!over) return;
    if (active.id === over.id) return;
    if (!hasDraggableData(active)) return;

    const activeData = active.data.current;
    if (activeData?.type !== 'Column') return;

    const activeIdx = columns.findIndex((c) => c.id === active.id);
    const overIdx = columns.findIndex((c) => c.id === over.id);

    // Optimistically reorder locally
    const reordered = arrayMove(sections, activeIdx, overIdx);
    setSections(reordered);

    // Emit position update to the server
    const movedSection = reordered[overIdx];
    if (movedSection) {
      updateSection(movedSection.id, { position: overIdx + 1 });
    }
  }

  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    if (!hasDraggableData(active) || !hasDraggableData(over)) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    if (activeData?.type !== 'Task') return;

    // Task over Task
    if (overData?.type === 'Task') {
      const activeIdx = tasks.findIndex((t) => t.id === active.id);
      const overIdx = tasks.findIndex((t) => t.id === over.id);
      const activeTaskItem = tasks[activeIdx];
      const overTaskItem = tasks[overIdx];
      if (
        activeTaskItem &&
        overTaskItem &&
        activeTaskItem.status !== overTaskItem.status
      ) {
        activeTaskItem.status = overTaskItem.status;
        setTasks(arrayMove(tasks, activeIdx, overIdx - 1));
      }
      setTasks(arrayMove(tasks, activeIdx, overIdx));
    }

    // Task over Column
    if (overData?.type === 'Column') {
      const activeIdx = tasks.findIndex((t) => t.id === active.id);
      const activeTaskItem = tasks[activeIdx];
      if (activeTaskItem) {
        activeTaskItem.status = over.id as Task['status'];
        setTasks(arrayMove(tasks, activeIdx, activeIdx));
      }
    }
  }

  // ── Section action handlers ────────────────────────────────────────────

  const handleRenameSection = (sectionId: string, newName: string) => {
    updateSection(sectionId, { name: newName });
  };

  const handleDeleteSection = (sectionId: string) => {
    deleteSection(sectionId);
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <DndContext
      accessibility={{ announcements }}
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
    >
      <BoardContainer>
        <SortableContext items={columnsId}>
          {columns.map((col, index) => (
            <Fragment key={col.id}>
              <BoardColumn
                column={col}
                tasks={tasks.filter((task) => task.status === col.id)}
                onRenameSection={handleRenameSection}
                onDeleteSection={handleDeleteSection}
              />
              {index === columns.length - 1 && (
                <div className='w-[300px]'>
                  <NewSectionDialog
                    onCreateSection={createSection}
                    isConnected={isConnected}
                  />
                </div>
              )}
            </Fragment>
          ))}
          {!columns.length && (
            <NewSectionDialog
              onCreateSection={createSection}
              isConnected={isConnected}
            />
          )}
        </SortableContext>
      </BoardContainer>

      {'document' in window &&
        createPortal(
          <DragOverlay>
            {activeColumn && (
              <BoardColumn
                isOverlay
                column={activeColumn}
                tasks={tasks.filter((task) => task.status === activeColumn.id)}
              />
            )}
            {activeTask && <TaskCard task={activeTask} isOverlay />}
          </DragOverlay>,
          document.body
        )}
    </DndContext>
  );
}
