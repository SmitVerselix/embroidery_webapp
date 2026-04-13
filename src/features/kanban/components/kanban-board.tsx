'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
import { hasDraggableData } from '../utils';
import type { Column } from './board-column';
import { BoardColumn, BoardContainer } from './board-column';
import NewSectionDialog from './new-section-dialog';
import NewTaskDialog from './new-task-dialog';
import { TaskCard } from './task-card';
import type { KanbanSection, KanbanTask } from '@/hooks/use-kanban-socket';

// =============================================================================
// PROPS
// =============================================================================

interface KanbanBoardProps {
  boardId: string;
  companyId: string;
  sections: KanbanSection[];
  setSections: React.Dispatch<React.SetStateAction<KanbanSection[]>>;
  tasks: KanbanTask[];
  setTasks: React.Dispatch<React.SetStateAction<KanbanTask[]>>;
  createSection: (name: string) => void;
  updateSection: (
    sectionId: string,
    updates: { name?: string; position?: number }
  ) => void;
  deleteSection: (sectionId: string) => void;
  reorderSections: (sectionIds: string[]) => void;
  createTask: (input: {
    sectionId: string;
    title: string;
    description?: string;
    priority?: string;
    dueDate?: string;
  }) => void;
  moveTask: (taskId: string, toSectionId: string) => void;
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
  tasks,
  setTasks,
  createSection,
  updateSection,
  deleteSection,
  reorderSections,
  createTask,
  moveTask,
  isConnected
}: KanbanBoardProps) {
  const columns = useMemo(() => sectionsToColumns(sections), [sections]);
  const columnsId = useMemo(() => columns.map((col) => col.id), [columns]);

  const pickedUpTaskColumn = useRef<UniqueIdentifier | null>(null);

  const [activeColumn, setActiveColumn] = useState<Column | null>(null);
  const [activeTask, setActiveTask] = useState<KanbanTask | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  const sensors = useSensors(useSensor(MouseSensor), useSensor(TouchSensor));

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  // ── DnD helpers ────────────────────────────────────────────────────────
  function getDraggingTaskData(
    taskId: UniqueIdentifier,
    sectionId: UniqueIdentifier
  ) {
    const tasksInColumn = tasks.filter((task) => task.sectionId === sectionId);
    const taskPosition = tasksInColumn.findIndex((task) => task.id === taskId);
    const column = columns.find((col) => col.id === sectionId);
    return { tasksInColumn, taskPosition, column };
  }

  const announcements: Announcements = {
    onDragStart({ active }) {
      if (!hasDraggableData(active)) return;
      if (active.data.current?.type === 'Column') {
        const idx = columnsId.findIndex((id) => id === active.id);
        return `Picked up Column ${columns[idx]?.title} at position: ${idx + 1} of ${columnsId.length}`;
      } else if (active.data.current?.type === 'Task') {
        const draggedTask = active.data.current.task as KanbanTask;
        pickedUpTaskColumn.current = draggedTask.sectionId;
        const { tasksInColumn, taskPosition, column } = getDraggingTaskData(
          active.id,
          pickedUpTaskColumn.current
        );
        return `Picked up Task ${draggedTask.title} at position: ${taskPosition + 1} of ${tasksInColumn.length} in column ${column?.title}`;
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
        const overTask = over.data.current.task as KanbanTask;
        const activeTaskData = active.data.current.task as KanbanTask;
        const { tasksInColumn, taskPosition, column } = getDraggingTaskData(
          over.id,
          overTask.sectionId
        );
        if (overTask.sectionId !== pickedUpTaskColumn.current) {
          return `Task ${activeTaskData.title} was moved over column ${column?.title} in position ${taskPosition + 1} of ${tasksInColumn.length}`;
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
        const overTask = over.data.current.task as KanbanTask;
        const { tasksInColumn, taskPosition, column } = getDraggingTaskData(
          over.id,
          overTask.sectionId
        );
        if (overTask.sectionId !== pickedUpTaskColumn.current) {
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
      setActiveTask(data.task as KanbanTask);
    }
  }

  function onDragEnd(event: DragEndEvent) {
    const previousSectionId = pickedUpTaskColumn.current;
    setActiveColumn(null);
    setActiveTask(null);
    pickedUpTaskColumn.current = null;

    const { active, over } = event;
    if (!over) return;
    if (!hasDraggableData(active)) return;

    const activeData = active.data.current;

    // ── COLUMN reorder ──────────────────────────────────────────────────
    if (activeData?.type === 'Column') {
      if (active.id === over.id) return;

      const activeIdx = columns.findIndex((c) => c.id === active.id);
      const overIdx = columns.findIndex((c) => c.id === over.id);

      // Optimistic update — reorder locally immediately
      const reordered = arrayMove(sections, activeIdx, overIdx);
      setSections(reordered);

      // Emit the full ordered list of section IDs to the server
      reorderSections(reordered.map((s) => s.id));
      return;
    }

    // ── TASK move between sections ──────────────────────────────────────
    if (activeData?.type === 'Task') {
      const draggedTask = activeData.task as KanbanTask;

      // Find the section the task ended up in after onDragOver mutations
      const current = tasks.find((t) => t.id === draggedTask.id);
      const newSectionId = current?.sectionId;

      if (
        newSectionId &&
        previousSectionId &&
        newSectionId !== previousSectionId
      ) {
        moveTask(draggedTask.id, newSectionId);
      }
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

      if (activeIdx === -1 || overIdx === -1) return;

      const activeTaskItem = tasks[activeIdx];
      const overTaskItem = tasks[overIdx];

      if (activeTaskItem.sectionId !== overTaskItem.sectionId) {
        const next = [...tasks];
        next[activeIdx] = {
          ...activeTaskItem,
          sectionId: overTaskItem.sectionId
        };
        setTasks(arrayMove(next, activeIdx, overIdx - 1));
      } else {
        setTasks(arrayMove(tasks, activeIdx, overIdx));
      }
      return;
    }

    // Task over Column (empty column case)
    if (overData?.type === 'Column') {
      const activeIdx = tasks.findIndex((t) => t.id === active.id);
      if (activeIdx === -1) return;

      const activeTaskItem = tasks[activeIdx];
      if (activeTaskItem.sectionId === over.id) return;

      const next = [...tasks];
      next[activeIdx] = {
        ...activeTaskItem,
        sectionId: over.id as string
      };
      setTasks(next);
    }
  }

  // ── Section action handlers ────────────────────────────────────────────
  const handleRenameSection = (sectionId: string, newName: string) => {
    updateSection(sectionId, { name: newName });
  };

  const handleDeleteSection = (sectionId: string) => {
    deleteSection(sectionId);
  };

  // ── Task create handler (per column) ───────────────────────────────────
  const handleCreateTask = (
    sectionId: string,
    title: string,
    description?: string
  ) => {
    createTask({ sectionId, title, description });
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
                tasks={tasks.filter((task) => task.sectionId === col.id)}
                onRenameSection={handleRenameSection}
                onDeleteSection={handleDeleteSection}
                onCreateTask={(title, description) =>
                  handleCreateTask(col.id as string, title, description)
                }
                isConnected={isConnected}
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
                tasks={tasks.filter(
                  (task) => task.sectionId === activeColumn.id
                )}
              />
            )}
            {activeTask && <TaskCard task={activeTask} isOverlay />}
          </DragOverlay>,
          document.body
        )}
    </DndContext>
  );
}
