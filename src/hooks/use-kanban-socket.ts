'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { Socket } from 'socket.io-client';
import { connectSocket, destroySocket } from '@/lib/socket';

// =============================================================================
// TYPES — SECTION
// =============================================================================

export interface KanbanSection {
  id: string;
  name: string;
  boardId: string;
  companyId: string;
  position: number;
  isActive?: boolean;
  isFinalStage?: boolean;
  isArchived?: boolean;
  color?: string | null;
  wipLimit?: number | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  deletedBy?: string | null;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface KanbanBoardData {
  id: string;
  isActive: boolean;
  createdBy: string;
  updatedBy: string | null;
  deletedBy: string | null;
  deletedAt: string | null;
  companyId: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  sections?: KanbanSection[];
  [key: string]: unknown;
}

export interface KanbanJoinResponse {
  success: boolean;
  message?: string;
  payload?: KanbanBoardData;
  error?: string;
}

// ── Response types (single object payload) ────────────────────────────────────

export interface SectionResponse {
  success: boolean;
  message?: string;
  payload?: KanbanSection;
  error?: string;
}

export interface SectionListResponse {
  success: boolean;
  message?: string;
  payload?: KanbanSection[];
  error?: string;
}

// ── Broadcast types (array payload) ───────────────────────────────────────────
// Broadcast events (section:created, section:updated, section:deleted,
// section:reordered) always carry an array in `payload`, even when only
// one record is affected.

export interface SectionBroadcast {
  success: boolean;
  message?: string;
  payload?: KanbanSection[];
  error?: string;
}

export interface SectionCreatePayload {
  boardId: string;
  companyId: string;
  name: string;
  position?: number;
}

export interface SectionUpdatePayload {
  sectionId: string;
  boardId: string;
  companyId: string;
  name?: string;
  position?: number;
}

export interface SectionDeletePayload {
  sectionId: string;
  boardId: string;
  companyId: string;
}

export interface SectionGetPayload {
  sectionId: string;
  boardId: string;
  companyId: string;
}

export interface SectionListPayload {
  boardId: string;
  companyId: string;
}

export interface SectionReorderPayload {
  sectionIds: string[];
  boardId: string;
  companyId: string;
}

// =============================================================================
// TYPES — TASK
// =============================================================================

export interface TaskAssignee {
  id: string;
  isActive: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  deletedBy: string | null;
  deletedAt: string | null;
  taskId: string;
  userId: string;
  assignee: string;
  assignedAt: string | null;
  unassignedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assigne?: {
    id: string;
    name: string;
    email: string;
    profileImage?: string | null;
  } | null;
}

export interface KanbanTask {
  id: string;
  isActive: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  deletedBy: string | null;
  deletedAt: string | null;
  companyId: string;
  boardId: string;
  sectionId: string;
  title: string;
  description: string | null;
  metadata: unknown | null;
  priority: string | null;
  status: string;
  position: number | null;
  taskNo: number;
  dueDate: string | null;
  creatorId: string;
  currentAssignedTo: string | null;
  createdAt: string;
  updatedAt: string;
  userId: string | null;
  assignees?: TaskAssignee[];
  [key: string]: unknown;
}

export interface TaskListResponse {
  success: boolean;
  message?: string;
  payload?: KanbanTask[];
  error?: string;
}

export interface TaskResponse {
  success: boolean;
  message?: string;
  payload?: KanbanTask;
  error?: string;
}

// ── Task broadcast type (array payload) ──────────────────────────────────────

export interface TaskBroadcast {
  success: boolean;
  message?: string;
  payload?: KanbanTask[];
  error?: string;
}

export interface TaskListPayload {
  boardId: string;
  companyId: string;
  sectionId: string;
}

export interface TaskCreatePayload {
  boardId: string;
  companyId: string;
  sectionId: string;
  title: string;
  description?: string;
  priority?: string;
  dueDate?: string;
}

export interface TaskGetPayload {
  boardId: string;
  companyId: string;
  taskId: string;
}

export interface TaskAssignPayload {
  boardId: string;
  companyId: string;
  taskId: string;
  userId: string;
}

export interface TaskMovePayload {
  boardId: string;
  companyId: string;
  taskId: string;
  toSectionId: string;
}

export interface TaskActivityListPayload {
  boardId: string;
  companyId: string;
  taskId: string;
}

// =============================================================================
// SOCKET EVENT NAMES
// =============================================================================

export const KANBAN_EVENTS = {
  // ── Board ──────────────────────────────────────────────────────────────
  JOIN: 'kanban:join',
  JOIN_RESPONSE: 'kanban:join:response',

  // ── Section CRUD ───────────────────────────────────────────────────────
  SECTION_CREATE: 'section:create',
  SECTION_CREATE_RESPONSE: 'section:create:response',
  SECTION_CREATED: 'section:created',

  SECTION_LIST: 'section:list',
  SECTION_LIST_RESPONSE: 'section:list:response',

  SECTION_GET: 'section:get',
  SECTION_GET_RESPONSE: 'section:get:response',

  SECTION_UPDATE: 'section:update',
  SECTION_UPDATE_RESPONSE: 'section:update:response',
  SECTION_UPDATED: 'section:updated',

  SECTION_DELETE: 'section:delete',
  SECTION_DELETE_RESPONSE: 'section:delete:response',
  SECTION_DELETED: 'section:deleted',

  SECTION_REORDER: 'section:reorder',
  SECTION_REORDER_RESPONSE: 'section:reorder:response',
  SECTION_REORDERED: 'section:reordered',

  // ── Task CRUD ──────────────────────────────────────────────────────────
  TASK_LIST: 'task:list',
  TASK_LIST_RESPONSE: 'task:list:response',

  TASK_GET: 'task:get',
  TASK_GET_RESPONSE: 'task:get:response',

  TASK_CREATE: 'task:create',
  TASK_CREATE_RESPONSE: 'task:create:response',
  TASK_CREATED: 'task:created',

  TASK_ASSIGN: 'task:assign',
  TASK_ASSIGN_RESPONSE: 'task:assign:response',
  TASK_ASSIGND: 'task:assignd',

  TASK_MOVE: 'task:move',
  TASK_MOVE_RESPONSE: 'task:move:response',
  TASK_MOVED: 'task:moved',

  TASK_ACTIVITY_LIST: 'task:activity:list',
  TASK_ACTIVITY_LIST_RESPONSE: 'task:activity:list:response'
} as const;

// =============================================================================
// HOOK OPTIONS
// =============================================================================

interface UseKanbanSocketOptions {
  boardId: string;
  companyId: string;
  onBoardJoined?: (board: KanbanBoardData) => void;
  onSectionCreated?: (section: KanbanSection) => void;
  onSectionUpdated?: (section: KanbanSection) => void;
  onSectionDeleted?: (section: KanbanSection) => void;
  onSectionsListed?: (sections: KanbanSection[]) => void;
  onSectionsReordered?: (sections: KanbanSection[], message: string) => void;
  onTasksListed?: (tasks: KanbanTask[], sectionId: string) => void;
  onTaskCreated?: (task: KanbanTask) => void;
  onTaskUpdated?: (task: KanbanTask) => void;
  onTaskMoved?: (task: KanbanTask) => void;
  onBoardEvent?: (data: unknown) => void;
  onError?: (error: string) => void;
}

// =============================================================================
// HOOK
// =============================================================================

export function useKanbanSocket({
  boardId,
  companyId,
  onBoardJoined,
  onSectionCreated,
  onSectionUpdated,
  onSectionDeleted,
  onSectionsListed,
  onSectionsReordered,
  onTasksListed,
  onTaskCreated,
  onTaskUpdated,
  onTaskMoved,
  onBoardEvent,
  onError
}: UseKanbanSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [boardData, setBoardData] = useState<KanbanBoardData | null>(null);
  const [sections, setSections] = useState<KanbanSection[]>([]);
  const [tasks, setTasks] = useState<KanbanTask[]>([]);

  const sectionsRef = useRef<KanbanSection[]>([]);
  const tasksRef = useRef<KanbanTask[]>([]);

  // Queue of pending task:list requests so we can associate empty
  // responses back with the section they were requested for.
  const pendingTaskListRef = useRef<string[]>([]);

  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // Stable callback refs
  const onBoardJoinedRef = useRef(onBoardJoined);
  const onSectionCreatedRef = useRef(onSectionCreated);
  const onSectionUpdatedRef = useRef(onSectionUpdated);
  const onSectionDeletedRef = useRef(onSectionDeleted);
  const onSectionsListedRef = useRef(onSectionsListed);
  const onSectionsReorderedRef = useRef(onSectionsReordered);
  const onTasksListedRef = useRef(onTasksListed);
  const onTaskCreatedRef = useRef(onTaskCreated);
  const onTaskUpdatedRef = useRef(onTaskUpdated);
  const onTaskMovedRef = useRef(onTaskMoved);
  const onBoardEventRef = useRef(onBoardEvent);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onBoardJoinedRef.current = onBoardJoined;
  }, [onBoardJoined]);
  useEffect(() => {
    onSectionCreatedRef.current = onSectionCreated;
  }, [onSectionCreated]);
  useEffect(() => {
    onSectionUpdatedRef.current = onSectionUpdated;
  }, [onSectionUpdated]);
  useEffect(() => {
    onSectionDeletedRef.current = onSectionDeleted;
  }, [onSectionDeleted]);
  useEffect(() => {
    onSectionsListedRef.current = onSectionsListed;
  }, [onSectionsListed]);
  useEffect(() => {
    onSectionsReorderedRef.current = onSectionsReordered;
  }, [onSectionsReordered]);
  useEffect(() => {
    onTasksListedRef.current = onTasksListed;
  }, [onTasksListed]);
  useEffect(() => {
    onTaskCreatedRef.current = onTaskCreated;
  }, [onTaskCreated]);
  useEffect(() => {
    onTaskUpdatedRef.current = onTaskUpdated;
  }, [onTaskUpdated]);
  useEffect(() => {
    onTaskMovedRef.current = onTaskMoved;
  }, [onTaskMoved]);
  useEffect(() => {
    onBoardEventRef.current = onBoardEvent;
  }, [onBoardEvent]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  // ── Helper: fetch tasks for a list of sections ─────────────────────────
  const fetchTasksForSections = (
    socket: Socket,
    sectionsToFetch: KanbanSection[]
  ) => {
    sectionsToFetch.forEach((section) => {
      const payload: TaskListPayload = {
        boardId,
        companyId,
        sectionId: section.id
      };
      pendingTaskListRef.current.push(section.id);
      console.log('[KanbanSocket] Emitting task:list for', section.id);
      socket.emit(KANBAN_EVENTS.TASK_LIST, payload);
    });
  };

  // ── Connect, join board, subscribe to all events ───────────────────────
  useEffect(() => {
    if (!boardId || !companyId) return;

    const boardChannel = `board-${boardId}`;
    const socket = connectSocket();
    socketRef.current = socket;

    // ── Connection state ─────────────────────────────────────────────────
    const handleConnect = () => {
      console.log('[KanbanSocket] Connected:', socket.id);
      setIsConnected(true);
      socket.emit(KANBAN_EVENTS.JOIN, { boardId, companyId });
    };

    const handleDisconnect = () => {
      console.log('[KanbanSocket] Disconnected');
      setIsConnected(false);
      setIsJoined(false);
    };

    // =========================================================================
    // RESPONSE HANDLERS  (caller-only, single-object payload)
    // These fire only for the socket that made the request.
    // =========================================================================

    // ── kanban:join:response ─────────────────────────────────────────────
    const handleJoinResponse = (data: KanbanJoinResponse) => {
      console.log('[KanbanSocket] kanban:join:response', data);
      if (data.success && data.payload) {
        setIsJoined(true);
        setBoardData(data.payload);
        if (data.payload.sections && Array.isArray(data.payload.sections)) {
          setSections(data.payload.sections);
          fetchTasksForSections(socket, data.payload.sections);
        }
        onBoardJoinedRef.current?.(data.payload);
        socket.emit(KANBAN_EVENTS.SECTION_LIST, { boardId, companyId });
      } else {
        const msg = data.error || data.message || 'Failed to join board';
        console.error('[KanbanSocket] Join error:', msg);
        onErrorRef.current?.(msg);
      }
    };

    // ── section:create:response ──────────────────────────────────────────
    const handleSectionCreateResponse = (data: SectionResponse) => {
      console.log('[KanbanSocket] section:create:response', data);
      if (data.success && data.payload) {
        const section = data.payload;
        setSections((prev) =>
          prev.some((s) => s.id === section.id) ? prev : [...prev, section]
        );
        onSectionCreatedRef.current?.(section);
      } else if (!data.success) {
        const msg = data.error || data.message || 'Failed to create section';
        console.error('[KanbanSocket] section:create:response error:', msg);
        onErrorRef.current?.(msg);
      }
    };

    // ── section:list:response ────────────────────────────────────────────
    const handleSectionListResponse = (data: SectionListResponse) => {
      console.log('[KanbanSocket] section:list:response', data);
      if (data.success && data.payload) {
        setSections(data.payload);
        onSectionsListedRef.current?.(data.payload);
        fetchTasksForSections(socket, data.payload);
      } else if (!data.success) {
        const msg = data.error || data.message || 'Failed to list sections';
        console.error('[KanbanSocket] section:list:response error:', msg);
        onErrorRef.current?.(msg);
      }
    };

    // ── section:update:response ──────────────────────────────────────────
    const handleSectionUpdateResponse = (data: SectionResponse) => {
      console.log('[KanbanSocket] section:update:response', data);
      if (data.success && data.payload) {
        const updated = data.payload;
        setSections((prev) =>
          prev.map((s) => (s.id === updated.id ? updated : s))
        );
        onSectionUpdatedRef.current?.(updated);
      } else if (!data.success) {
        const msg = data.error || data.message || 'Failed to update section';
        console.error('[KanbanSocket] section:update:response error:', msg);
        onErrorRef.current?.(msg);
      }
    };

    // ── section:delete:response ──────────────────────────────────────────
    const handleSectionDeleteResponse = (data: SectionResponse) => {
      console.log('[KanbanSocket] section:delete:response', data);
      if (data.success) {
        if (data.payload) {
          const deleted = data.payload;
          setSections((prev) => prev.filter((s) => s.id !== deleted.id));
          setTasks((prev) => prev.filter((t) => t.sectionId !== deleted.id));
          onSectionDeletedRef.current?.(deleted);
        }
        // No payload on response is fine — broadcast will carry the array.
      } else {
        const msg = data.error || data.message || 'Failed to delete section';
        console.error('[KanbanSocket] section:delete:response error:', msg);
        onErrorRef.current?.(msg);
      }
    };

    // ── section:reorder:response ─────────────────────────────────────────
    const handleSectionReorderResponse = (data: SectionListResponse) => {
      console.log('[KanbanSocket] section:reorder:response', data);
      if (data.success) {
        const msg = data.message || 'Sections reordered successfully';
        onSectionsReorderedRef.current?.(
          Array.isArray(data.payload) ? data.payload : sectionsRef.current,
          msg
        );
        // Re-fetch authoritative order from server.
        socket.emit(KANBAN_EVENTS.SECTION_LIST, { boardId, companyId });
      } else {
        const msg = data.error || data.message || 'Failed to reorder sections';
        console.error('[KanbanSocket] section:reorder:response error:', msg);
        onErrorRef.current?.(msg);
        socket.emit(KANBAN_EVENTS.SECTION_LIST, { boardId, companyId });
      }
    };

    // ── task:list:response ───────────────────────────────────────────────
    const handleTaskListResponse = (data: TaskListResponse) => {
      console.log('[KanbanSocket] task:list:response', data);
      const queuedSectionId = pendingTaskListRef.current.shift();
      if (data.success && Array.isArray(data.payload)) {
        const tasksFromResp = data.payload;
        const sectionId =
          tasksFromResp[0]?.sectionId ?? queuedSectionId ?? null;
        if (!sectionId) {
          console.warn(
            '[KanbanSocket] task:list:response — unable to determine sectionId'
          );
          return;
        }
        setTasks((prev) => [
          ...prev.filter((t) => t.sectionId !== sectionId),
          ...tasksFromResp
        ]);
        onTasksListedRef.current?.(tasksFromResp, sectionId);
      } else if (!data.success) {
        const msg = data.error || data.message || 'Failed to list tasks';
        console.error('[KanbanSocket] task:list:response error:', msg);
        onErrorRef.current?.(msg);
      }
    };

    // ── task:create:response ─────────────────────────────────────────────
    const handleTaskCreateResponse = (data: TaskResponse) => {
      console.log('[KanbanSocket] task:create:response', data);
      if (data.success && data.payload) {
        const task = data.payload;
        setTasks((prev) =>
          prev.some((t) => t.id === task.id) ? prev : [...prev, task]
        );
        onTaskCreatedRef.current?.(task);
      } else if (!data.success) {
        const msg = data.error || data.message || 'Failed to create task';
        console.error('[KanbanSocket] task:create:response error:', msg);
        onErrorRef.current?.(msg);
      }
    };

    // ── task:move:response ───────────────────────────────────────────────
    const handleTaskMoveResponse = (data: TaskResponse) => {
      console.log('[KanbanSocket] task:move:response', data);
      if (data.success && data.payload) {
        const moved = data.payload;
        setTasks((prev) => prev.map((t) => (t.id === moved.id ? moved : t)));
        onTaskMovedRef.current?.(moved);
      } else if (!data.success) {
        const msg = data.error || data.message || 'Failed to move task';
        console.error('[KanbanSocket] task:move:response error:', msg);
        onErrorRef.current?.(msg);
      }
    };

    // ── task:assign:response ─────────────────────────────────────────────
    const handleTaskAssignResponse = (data: TaskResponse) => {
      console.log('[KanbanSocket] task:assign:response', data);
      if (data.success && data.payload) {
        const updated = data.payload;
        setTasks((prev) =>
          prev.map((t) => (t.id === updated.id ? updated : t))
        );
        onTaskUpdatedRef.current?.(updated);
      } else if (!data.success) {
        const msg = data.error || data.message || 'Failed to assign task';
        console.error('[KanbanSocket] task:assign:response error:', msg);
        onErrorRef.current?.(msg);
      }
    };

    // ── task:get:response ────────────────────────────────────────────────
    const handleTaskGetResponse = (data: TaskResponse) => {
      console.log('[KanbanSocket] task:get:response', data);
      if (data.success && data.payload) {
        const task = data.payload;
        setTasks((prev) => {
          const exists = prev.some((t) => t.id === task.id);
          return exists
            ? prev.map((t) => (t.id === task.id ? task : t))
            : [...prev, task];
        });
      }
    };

    // =========================================================================
    // BROADCAST HANDLERS  (room-wide, array payload)
    // These fire for ALL connected clients, including the sender.
    // Payload is always KanbanSection[] / KanbanTask[].
    // =========================================================================

    // ── section:created (broadcast) ─────────────────────────────────────
    const handleSectionCreatedBroadcast = (data: SectionBroadcast) => {
      console.log('[KanbanSocket] section:created (broadcast)', data);
      if (!data.success || !Array.isArray(data.payload)) return;

      data.payload.forEach((section) => {
        setSections((prev) =>
          prev.some((s) => s.id === section.id) ? prev : [...prev, section]
        );
        onSectionCreatedRef.current?.(section);
      });
    };

    // ── section:updated (broadcast) ─────────────────────────────────────
    const handleSectionUpdatedBroadcast = (data: SectionBroadcast) => {
      console.log('[KanbanSocket] section:updated (broadcast)', data);
      if (!data.success || !Array.isArray(data.payload)) return;

      data.payload.forEach((updated) => {
        setSections((prev) =>
          prev.map((s) => (s.id === updated.id ? updated : s))
        );
        onSectionUpdatedRef.current?.(updated);
      });
    };

    // ── section:deleted (broadcast) ─────────────────────────────────────
    const handleSectionDeletedBroadcast = (data: SectionBroadcast) => {
      console.log('[KanbanSocket] section:deleted (broadcast)', data);
      if (!data.success || !Array.isArray(data.payload)) return;

      const deletedIds = new Set(data.payload.map((s) => s.id));

      setSections((prev) => prev.filter((s) => !deletedIds.has(s.id)));
      setTasks((prev) => prev.filter((t) => !deletedIds.has(t.sectionId)));

      data.payload.forEach((section) => {
        onSectionDeletedRef.current?.(section);
      });
    };

    // ── section:reordered (broadcast) ───────────────────────────────────
    const handleSectionReorderedBroadcast = (data: SectionBroadcast) => {
      console.log('[KanbanSocket] section:reordered (broadcast)', data);
      if (!data.success) return;

      if (Array.isArray(data.payload) && data.payload.length > 0) {
        // Apply the authoritative order from the broadcast directly.
        setSections(data.payload);
        const msg = data.message || 'Sections reordered';
        onSectionsReorderedRef.current?.(data.payload, msg);
      } else {
        // Fallback: re-fetch if the broadcast carries no payload.
        socket.emit(KANBAN_EVENTS.SECTION_LIST, { boardId, companyId });
      }
    };

    // ── task:created (broadcast) ─────────────────────────────────────────
    const handleTaskCreatedBroadcast = (data: TaskBroadcast) => {
      console.log('[KanbanSocket] task:created (broadcast)', data);
      if (!data.success || !Array.isArray(data.payload)) return;

      data.payload.forEach((task) => {
        setTasks((prev) =>
          prev.some((t) => t.id === task.id) ? prev : [...prev, task]
        );
        onTaskCreatedRef.current?.(task);
      });
    };

    // ── task:moved (broadcast) ───────────────────────────────────────────
    const handleTaskMovedBroadcast = (data: TaskBroadcast) => {
      console.log('[KanbanSocket] task:moved (broadcast)', data);
      if (!data.success || !Array.isArray(data.payload)) return;

      data.payload.forEach((moved) => {
        setTasks((prev) => prev.map((t) => (t.id === moved.id ? moved : t)));
        onTaskMovedRef.current?.(moved);
      });
    };

    // ── task:assignd (broadcast) ─────────────────────────────────────────
    const handleTaskAssignedBroadcast = (data: TaskBroadcast) => {
      console.log('[KanbanSocket] task:assignd (broadcast)', data);
      if (!data.success || !Array.isArray(data.payload)) return;

      data.payload.forEach((updated) => {
        setTasks((prev) =>
          prev.map((t) => (t.id === updated.id ? updated : t))
        );
        onTaskUpdatedRef.current?.(updated);
      });
    };

    // ── board-{boardId} (room-level channel) ────────────────────────────
    const handleBoardChannel = (data: unknown) => {
      console.log(`[KanbanSocket] board-${boardId}`, data);
      onBoardEventRef.current?.(data);
    };

    // =========================================================================
    // REGISTER LISTENERS
    // =========================================================================

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    // Response events (caller-only)
    socket.on(KANBAN_EVENTS.JOIN_RESPONSE, handleJoinResponse);
    socket.on(
      KANBAN_EVENTS.SECTION_CREATE_RESPONSE,
      handleSectionCreateResponse
    );
    socket.on(KANBAN_EVENTS.SECTION_LIST_RESPONSE, handleSectionListResponse);
    socket.on(
      KANBAN_EVENTS.SECTION_UPDATE_RESPONSE,
      handleSectionUpdateResponse
    );
    socket.on(
      KANBAN_EVENTS.SECTION_DELETE_RESPONSE,
      handleSectionDeleteResponse
    );
    socket.on(
      KANBAN_EVENTS.SECTION_REORDER_RESPONSE,
      handleSectionReorderResponse
    );
    socket.on(KANBAN_EVENTS.TASK_LIST_RESPONSE, handleTaskListResponse);
    socket.on(KANBAN_EVENTS.TASK_CREATE_RESPONSE, handleTaskCreateResponse);
    socket.on(KANBAN_EVENTS.TASK_MOVE_RESPONSE, handleTaskMoveResponse);
    socket.on(KANBAN_EVENTS.TASK_ASSIGN_RESPONSE, handleTaskAssignResponse);
    socket.on(KANBAN_EVENTS.TASK_GET_RESPONSE, handleTaskGetResponse);

    // Broadcast events (all clients in room — array payload)
    socket.on(KANBAN_EVENTS.SECTION_CREATED, handleSectionCreatedBroadcast);
    socket.on(KANBAN_EVENTS.SECTION_UPDATED, handleSectionUpdatedBroadcast);
    socket.on(KANBAN_EVENTS.SECTION_DELETED, handleSectionDeletedBroadcast);
    socket.on(KANBAN_EVENTS.SECTION_REORDERED, handleSectionReorderedBroadcast);
    socket.on(KANBAN_EVENTS.TASK_CREATED, handleTaskCreatedBroadcast);
    socket.on(KANBAN_EVENTS.TASK_MOVED, handleTaskMovedBroadcast);
    socket.on(KANBAN_EVENTS.TASK_ASSIGND, handleTaskAssignedBroadcast);

    socket.on(boardChannel, handleBoardChannel);

    // If already connected (reconnect scenario), emit join immediately
    if (socket.connected) {
      setIsConnected(true);
      socket.emit(KANBAN_EVENTS.JOIN, { boardId, companyId });
    }

    const handleBeforeUnload = () => {
      destroySocket();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);

      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);

      // Response events
      socket.off(KANBAN_EVENTS.JOIN_RESPONSE, handleJoinResponse);
      socket.off(
        KANBAN_EVENTS.SECTION_CREATE_RESPONSE,
        handleSectionCreateResponse
      );
      socket.off(
        KANBAN_EVENTS.SECTION_LIST_RESPONSE,
        handleSectionListResponse
      );
      socket.off(
        KANBAN_EVENTS.SECTION_UPDATE_RESPONSE,
        handleSectionUpdateResponse
      );
      socket.off(
        KANBAN_EVENTS.SECTION_DELETE_RESPONSE,
        handleSectionDeleteResponse
      );
      socket.off(
        KANBAN_EVENTS.SECTION_REORDER_RESPONSE,
        handleSectionReorderResponse
      );
      socket.off(KANBAN_EVENTS.TASK_LIST_RESPONSE, handleTaskListResponse);
      socket.off(KANBAN_EVENTS.TASK_CREATE_RESPONSE, handleTaskCreateResponse);
      socket.off(KANBAN_EVENTS.TASK_MOVE_RESPONSE, handleTaskMoveResponse);
      socket.off(KANBAN_EVENTS.TASK_ASSIGN_RESPONSE, handleTaskAssignResponse);
      socket.off(KANBAN_EVENTS.TASK_GET_RESPONSE, handleTaskGetResponse);

      // Broadcast events
      socket.off(KANBAN_EVENTS.SECTION_CREATED, handleSectionCreatedBroadcast);
      socket.off(KANBAN_EVENTS.SECTION_UPDATED, handleSectionUpdatedBroadcast);
      socket.off(KANBAN_EVENTS.SECTION_DELETED, handleSectionDeletedBroadcast);
      socket.off(
        KANBAN_EVENTS.SECTION_REORDERED,
        handleSectionReorderedBroadcast
      );
      socket.off(KANBAN_EVENTS.TASK_CREATED, handleTaskCreatedBroadcast);
      socket.off(KANBAN_EVENTS.TASK_MOVED, handleTaskMovedBroadcast);
      socket.off(KANBAN_EVENTS.TASK_ASSIGND, handleTaskAssignedBroadcast);

      socket.off(boardChannel, handleBoardChannel);

      destroySocket();
      socketRef.current = null;
      pendingTaskListRef.current = [];
      setIsConnected(false);
      setIsJoined(false);
    };
  }, [boardId, companyId]);

  // ───────────────────────────────────────────────────────────────────────────
  // EMITTERS — SECTION
  // ───────────────────────────────────────────────────────────────────────────

  const createSection = useCallback(
    (name: string) => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        onErrorRef.current?.('Socket not connected. Please try again.');
        return;
      }
      const payload: SectionCreatePayload = {
        boardId,
        companyId,
        name,
        position: sectionsRef.current.length + 1
      };
      console.log('[KanbanSocket] Emitting section:create', payload);
      socket.emit(KANBAN_EVENTS.SECTION_CREATE, payload);
    },
    [boardId, companyId]
  );

  const listSections = useCallback(() => {
    const socket = socketRef.current;
    if (!socket?.connected) {
      onErrorRef.current?.('Socket not connected. Please try again.');
      return;
    }
    socket.emit(KANBAN_EVENTS.SECTION_LIST, { boardId, companyId });
  }, [boardId, companyId]);

  const updateSection = useCallback(
    (sectionId: string, updates: { name?: string; position?: number }) => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        onErrorRef.current?.('Socket not connected. Please try again.');
        return;
      }
      const position =
        updates.position ??
        sectionsRef.current.find((s) => s.id === sectionId)?.position ??
        1;
      const payload: SectionUpdatePayload = {
        sectionId,
        boardId,
        companyId,
        ...updates,
        position
      };
      console.log('[KanbanSocket] Emitting section:update', payload);
      socket.emit(KANBAN_EVENTS.SECTION_UPDATE, payload);
    },
    [boardId, companyId]
  );

  const deleteSection = useCallback(
    (sectionId: string) => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        onErrorRef.current?.('Socket not connected. Please try again.');
        return;
      }
      const payload: SectionDeletePayload = { sectionId, boardId, companyId };
      console.log('[KanbanSocket] Emitting section:delete', payload);
      socket.emit(KANBAN_EVENTS.SECTION_DELETE, payload);
    },
    [boardId, companyId]
  );

  const getSection = useCallback(
    (sectionId: string) => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        onErrorRef.current?.('Socket not connected. Please try again.');
        return;
      }
      const payload: SectionGetPayload = { sectionId, boardId, companyId };
      console.log('[KanbanSocket] Emitting section:get', payload);
      socket.emit(KANBAN_EVENTS.SECTION_GET, payload);
    },
    [boardId, companyId]
  );

  const reorderSections = useCallback(
    (sectionIds: string[]) => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        onErrorRef.current?.('Socket not connected. Please try again.');
        return;
      }
      const payload: SectionReorderPayload = { sectionIds, boardId, companyId };
      console.log('[KanbanSocket] Emitting section:reorder', payload);
      socket.emit(KANBAN_EVENTS.SECTION_REORDER, payload);
    },
    [boardId, companyId]
  );

  // ───────────────────────────────────────────────────────────────────────────
  // EMITTERS — TASK
  // ───────────────────────────────────────────────────────────────────────────

  const listTasks = useCallback(
    (sectionId: string) => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        onErrorRef.current?.('Socket not connected. Please try again.');
        return;
      }
      const payload: TaskListPayload = { boardId, companyId, sectionId };
      pendingTaskListRef.current.push(sectionId);
      console.log('[KanbanSocket] Emitting task:list', payload);
      socket.emit(KANBAN_EVENTS.TASK_LIST, payload);
    },
    [boardId, companyId]
  );

  const refreshAllTasks = useCallback(() => {
    const socket = socketRef.current;
    if (!socket?.connected) return;
    fetchTasksForSections(socket, sectionsRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, companyId]);

  const createTask = useCallback(
    (input: {
      sectionId: string;
      title: string;
      description?: string;
      priority?: string;
      dueDate?: string;
    }) => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        onErrorRef.current?.('Socket not connected. Please try again.');
        return;
      }
      const payload: TaskCreatePayload = { boardId, companyId, ...input };
      console.log('[KanbanSocket] Emitting task:create', payload);
      socket.emit(KANBAN_EVENTS.TASK_CREATE, payload);
    },
    [boardId, companyId]
  );

  const moveTask = useCallback(
    (taskId: string, toSectionId: string) => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        onErrorRef.current?.('Socket not connected. Please try again.');
        return;
      }
      const payload: TaskMovePayload = {
        boardId,
        companyId,
        taskId,
        toSectionId
      };
      console.log('[KanbanSocket] Emitting task:move', payload);
      socket.emit(KANBAN_EVENTS.TASK_MOVE, payload);
    },
    [boardId, companyId]
  );

  const assignTask = useCallback(
    (taskId: string, userId: string) => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        onErrorRef.current?.('Socket not connected. Please try again.');
        return;
      }
      const payload: TaskAssignPayload = { boardId, companyId, taskId, userId };
      console.log('[KanbanSocket] Emitting task:assign', payload);
      socket.emit(KANBAN_EVENTS.TASK_ASSIGN, payload);
    },
    [boardId, companyId]
  );

  const getTask = useCallback(
    (taskId: string) => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        onErrorRef.current?.('Socket not connected. Please try again.');
        return;
      }
      const payload: TaskGetPayload = { boardId, companyId, taskId };
      console.log('[KanbanSocket] Emitting task:get', payload);
      socket.emit(KANBAN_EVENTS.TASK_GET, payload);
    },
    [boardId, companyId]
  );

  const listTaskActivity = useCallback(
    (taskId: string) => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        onErrorRef.current?.('Socket not connected. Please try again.');
        return;
      }
      const payload: TaskActivityListPayload = { boardId, companyId, taskId };
      console.log('[KanbanSocket] Emitting task:activity:list', payload);
      socket.emit(KANBAN_EVENTS.TASK_ACTIVITY_LIST, payload);
    },
    [boardId, companyId]
  );

  const resetSections = useCallback(() => {
    setSections([]);
    setTasks([]);
  }, []);

  return {
    // state
    isConnected,
    isJoined,
    boardData,
    sections,
    setSections,
    tasks,
    setTasks,

    // section emitters
    createSection,
    listSections,
    updateSection,
    deleteSection,
    getSection,
    reorderSections,

    // task emitters
    listTasks,
    refreshAllTasks,
    createTask,
    moveTask,
    assignTask,
    getTask,
    listTaskActivity,

    // misc
    resetSections,
    socket: socketRef.current
  };
}
