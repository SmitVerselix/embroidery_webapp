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

export interface TaskListPayload {
  boardId: string;
  companyId: string;
  sectionId: string;
}

// ── Stub payloads for events you'll provide later ──────────────────────
// These are best guesses based on the section pattern; adjust when your
// backend specs arrive.

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

    // ── Connection state ─────────────────────────────────────────────
    const handleConnect = () => {
      console.log('[KanbanSocket] Connected:', socket.id);
      setIsConnected(true);
      console.log('[KanbanSocket] Emitting kanban:join', {
        boardId,
        companyId
      });
      socket.emit(KANBAN_EVENTS.JOIN, { boardId, companyId });
    };

    const handleDisconnect = () => {
      console.log('[KanbanSocket] Disconnected');
      setIsConnected(false);
      setIsJoined(false);
    };

    // ── 🔵 kanban:join:response ─────────────────────────────────────
    const handleJoinResponse = (data: KanbanJoinResponse) => {
      console.log('[KanbanSocket] kanban:join:response', data);

      if (data.success && data.payload) {
        setIsJoined(true);
        setBoardData(data.payload);

        // If join response includes sections, populate them and fetch tasks
        if (data.payload.sections && Array.isArray(data.payload.sections)) {
          setSections(data.payload.sections);
          fetchTasksForSections(socket, data.payload.sections);
        }

        onBoardJoinedRef.current?.(data.payload);

        // Also explicitly fetch the sections list (server of truth)
        console.log('[KanbanSocket] Emitting section:list after join');
        socket.emit(KANBAN_EVENTS.SECTION_LIST, { boardId, companyId });
      } else {
        const msg = data.error || data.message || 'Failed to join board';
        console.error('[KanbanSocket] Join error:', msg);
        onErrorRef.current?.(msg);
      }
    };

    // ── 🟢 section:create:response ──────────────────────────────────
    const handleSectionCreateResponse = (data: SectionResponse) => {
      console.log('[KanbanSocket] section:create:response', data);

      if (data.success && data.payload) {
        const section = data.payload;
        setSections((prev) => {
          if (prev.some((s) => s.id === section.id)) return prev;
          return [...prev, section];
        });
        onSectionCreatedRef.current?.(section);
      } else {
        const msg = data.error || data.message || 'Failed to create section';
        console.error('[KanbanSocket] section:create:response error:', msg);
        onErrorRef.current?.(msg);
      }
    };

    // ── 🟣 section:list:response ────────────────────────────────────
    const handleSectionListResponse = (data: SectionListResponse) => {
      console.log('[KanbanSocket] section:list:response', data);

      if (data.success && data.payload) {
        setSections(data.payload);
        onSectionsListedRef.current?.(data.payload);

        // Auto-fetch tasks for every section
        fetchTasksForSections(socket, data.payload);
      } else {
        const msg = data.error || data.message || 'Failed to list sections';
        console.error('[KanbanSocket] section:list:response error:', msg);
        onErrorRef.current?.(msg);
      }
    };

    // ── 🟠 section:update:response ──────────────────────────────────
    const handleSectionUpdateResponse = (data: SectionResponse) => {
      console.log('[KanbanSocket] section:update:response', data);

      if (data.success && data.payload) {
        const updated = data.payload;
        setSections((prev) =>
          prev.map((s) => (s.id === updated.id ? updated : s))
        );
        onSectionUpdatedRef.current?.(updated);
      } else {
        const msg = data.error || data.message || 'Failed to update section';
        console.error('[KanbanSocket] section:update:response error:', msg);
        onErrorRef.current?.(msg);
      }
    };

    // ── 🔴 section:delete:response ──────────────────────────────────
    const handleSectionDeleteResponse = (data: SectionResponse) => {
      console.log('[KanbanSocket] section:delete:response', data);

      if (data.success && data.payload) {
        const deleted = data.payload;
        setSections((prev) => prev.filter((s) => s.id !== deleted.id));
        // Also drop any tasks that belonged to it
        setTasks((prev) => prev.filter((t) => t.sectionId !== deleted.id));
        onSectionDeletedRef.current?.(deleted);
      } else {
        const msg = data.error || data.message || 'Failed to delete section';
        console.error('[KanbanSocket] section:delete:response error:', msg);
        onErrorRef.current?.(msg);
      }
    };

    // ── 📋 task:list:response ───────────────────────────────────────
    const handleTaskListResponse = (data: TaskListResponse) => {
      console.log('[KanbanSocket] task:list:response', data);

      // Always shift off the queue so it stays in sync with emits.
      const queuedSectionId = pendingTaskListRef.current.shift();

      if (data.success && Array.isArray(data.payload)) {
        const tasksFromResp = data.payload;

        // Prefer sectionId from the payload; fall back to the queue
        // (needed when the response is an empty array).
        const sectionId =
          tasksFromResp[0]?.sectionId ?? queuedSectionId ?? null;

        if (!sectionId) {
          console.warn(
            '[KanbanSocket] task:list:response — unable to determine sectionId'
          );
          return;
        }

        // Replace all tasks for this section with the fresh list
        setTasks((prev) => [
          ...prev.filter((t) => t.sectionId !== sectionId),
          ...tasksFromResp
        ]);

        onTasksListedRef.current?.(tasksFromResp, sectionId);
      } else {
        const msg = data.error || data.message || 'Failed to list tasks';
        console.error('[KanbanSocket] task:list:response error:', msg);
        onErrorRef.current?.(msg);
      }
    };

    // ── ➕ task:create:response ────────────────────────────────────
    // TODO: confirm payload shape against backend spec
    const handleTaskCreateResponse = (data: TaskResponse) => {
      console.log('[KanbanSocket] task:create:response', data);

      if (data.success && data.payload) {
        const task = data.payload;
        setTasks((prev) => {
          if (prev.some((t) => t.id === task.id)) return prev;
          return [...prev, task];
        });
        onTaskCreatedRef.current?.(task);
      } else {
        const msg = data.error || data.message || 'Failed to create task';
        console.error('[KanbanSocket] task:create:response error:', msg);
        onErrorRef.current?.(msg);
      }
    };

    // ── 🔄 task:move:response ──────────────────────────────────────
    // TODO: confirm payload shape against backend spec
    const handleTaskMoveResponse = (data: TaskResponse) => {
      console.log('[KanbanSocket] task:move:response', data);

      if (data.success && data.payload) {
        const moved = data.payload;
        setTasks((prev) => prev.map((t) => (t.id === moved.id ? moved : t)));
        onTaskMovedRef.current?.(moved);
      } else {
        const msg = data.error || data.message || 'Failed to move task';
        console.error('[KanbanSocket] task:move:response error:', msg);
        onErrorRef.current?.(msg);
      }
    };

    // ── 👤 task:assign:response ────────────────────────────────────
    // TODO: confirm payload shape against backend spec
    const handleTaskAssignResponse = (data: TaskResponse) => {
      console.log('[KanbanSocket] task:assign:response', data);

      if (data.success && data.payload) {
        const updated = data.payload;
        setTasks((prev) =>
          prev.map((t) => (t.id === updated.id ? updated : t))
        );
        onTaskUpdatedRef.current?.(updated);
      } else {
        const msg = data.error || data.message || 'Failed to assign task';
        console.error('[KanbanSocket] task:assign:response error:', msg);
        onErrorRef.current?.(msg);
      }
    };

    // ── 🔍 task:get:response ───────────────────────────────────────
    // TODO: confirm payload shape against backend spec
    const handleTaskGetResponse = (data: TaskResponse) => {
      console.log('[KanbanSocket] task:get:response', data);

      if (data.success && data.payload) {
        const task = data.payload;
        setTasks((prev) => {
          const exists = prev.some((t) => t.id === task.id);
          if (exists) return prev.map((t) => (t.id === task.id ? task : t));
          return [...prev, task];
        });
      }
    };

    // ── 🟡 board-{boardId} (room-level channel) ────────────────────
    const handleBoardChannel = (data: unknown) => {
      console.log(`[KanbanSocket] ${boardChannel}`, data);
      onBoardEventRef.current?.(data);
    };

    // ── Register all listeners ───────────────────────────────────────
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on(KANBAN_EVENTS.JOIN_RESPONSE, handleJoinResponse);

    socket.on(
      KANBAN_EVENTS.SECTION_CREATE_RESPONSE,
      handleSectionCreateResponse
    );
    socket.on(KANBAN_EVENTS.SECTION_CREATED, handleSectionCreateResponse);
    socket.on(KANBAN_EVENTS.SECTION_LIST_RESPONSE, handleSectionListResponse);
    socket.on(
      KANBAN_EVENTS.SECTION_UPDATE_RESPONSE,
      handleSectionUpdateResponse
    );
    socket.on(KANBAN_EVENTS.SECTION_UPDATED, handleSectionUpdateResponse);
    socket.on(
      KANBAN_EVENTS.SECTION_DELETE_RESPONSE,
      handleSectionDeleteResponse
    );
    socket.on(KANBAN_EVENTS.SECTION_DELETED, handleSectionDeleteResponse);

    socket.on(KANBAN_EVENTS.TASK_LIST_RESPONSE, handleTaskListResponse);
    socket.on(KANBAN_EVENTS.TASK_CREATE_RESPONSE, handleTaskCreateResponse);
    socket.on(KANBAN_EVENTS.TASK_CREATED, handleTaskCreateResponse);
    socket.on(KANBAN_EVENTS.TASK_MOVE_RESPONSE, handleTaskMoveResponse);
    socket.on(KANBAN_EVENTS.TASK_MOVED, handleTaskMoveResponse);
    socket.on(KANBAN_EVENTS.TASK_ASSIGN_RESPONSE, handleTaskAssignResponse);
    socket.on(KANBAN_EVENTS.TASK_ASSIGND, handleTaskAssignResponse);
    socket.on(KANBAN_EVENTS.TASK_GET_RESPONSE, handleTaskGetResponse);

    socket.on(boardChannel, handleBoardChannel);

    // If already connected (reconnect scenario), emit join immediately
    if (socket.connected) {
      setIsConnected(true);
      console.log('[KanbanSocket] Already connected, emitting kanban:join');
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
      socket.off(KANBAN_EVENTS.JOIN_RESPONSE, handleJoinResponse);

      socket.off(
        KANBAN_EVENTS.SECTION_CREATE_RESPONSE,
        handleSectionCreateResponse
      );
      socket.off(KANBAN_EVENTS.SECTION_CREATED, handleSectionCreateResponse);
      socket.off(
        KANBAN_EVENTS.SECTION_LIST_RESPONSE,
        handleSectionListResponse
      );
      socket.off(
        KANBAN_EVENTS.SECTION_UPDATE_RESPONSE,
        handleSectionUpdateResponse
      );
      socket.off(KANBAN_EVENTS.SECTION_UPDATED, handleSectionUpdateResponse);
      socket.off(
        KANBAN_EVENTS.SECTION_DELETE_RESPONSE,
        handleSectionDeleteResponse
      );
      socket.off(KANBAN_EVENTS.SECTION_DELETED, handleSectionDeleteResponse);

      socket.off(KANBAN_EVENTS.TASK_LIST_RESPONSE, handleTaskListResponse);
      socket.off(KANBAN_EVENTS.TASK_CREATE_RESPONSE, handleTaskCreateResponse);
      socket.off(KANBAN_EVENTS.TASK_CREATED, handleTaskCreateResponse);
      socket.off(KANBAN_EVENTS.TASK_MOVE_RESPONSE, handleTaskMoveResponse);
      socket.off(KANBAN_EVENTS.TASK_MOVED, handleTaskMoveResponse);
      socket.off(KANBAN_EVENTS.TASK_ASSIGN_RESPONSE, handleTaskAssignResponse);
      socket.off(KANBAN_EVENTS.TASK_ASSIGND, handleTaskAssignResponse);
      socket.off(KANBAN_EVENTS.TASK_GET_RESPONSE, handleTaskGetResponse);

      socket.off(boardChannel, handleBoardChannel);

      destroySocket();

      socketRef.current = null;
      pendingTaskListRef.current = [];
      setIsConnected(false);
      setIsJoined(false);
    };
  }, [boardId, companyId]);

  // ───────────────────────────────────────────────────────────────────────
  // EMITTERS — SECTION
  // ───────────────────────────────────────────────────────────────────────

  const createSection = useCallback(
    (name: string) => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        onErrorRef.current?.('Socket not connected. Please try again.');
        return;
      }

      const position = sectionsRef.current.length + 1;
      const payload: SectionCreatePayload = {
        boardId,
        companyId,
        name,
        position
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

    const payload: SectionListPayload = { boardId, companyId };
    console.log('[KanbanSocket] Emitting section:list', payload);
    socket.emit(KANBAN_EVENTS.SECTION_LIST, payload);
  }, [boardId, companyId]);

  const updateSection = useCallback(
    (sectionId: string, updates: { name?: string; position?: number }) => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        onErrorRef.current?.('Socket not connected. Please try again.');
        return;
      }

      let position = updates.position;
      if (position === undefined) {
        const existing = sectionsRef.current.find((s) => s.id === sectionId);
        position = existing?.position ?? 1;
      }

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

  // ───────────────────────────────────────────────────────────────────────
  // EMITTERS — TASK
  // ───────────────────────────────────────────────────────────────────────

  /** List tasks for a specific section. */
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

  /** Re-fetch tasks for every section currently known. */
  const refreshAllTasks = useCallback(() => {
    const socket = socketRef.current;
    if (!socket?.connected) return;
    fetchTasksForSections(socket, sectionsRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, companyId]);

  /**
   * STUB — create a task. Backend payload/response shape not yet confirmed.
   * Adjust once the `task:create` event spec is provided.
   */
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

      const payload: TaskCreatePayload = {
        boardId,
        companyId,
        ...input
      };
      console.log('[KanbanSocket] Emitting task:create (STUB)', payload);
      socket.emit(KANBAN_EVENTS.TASK_CREATE, payload);
    },
    [boardId, companyId]
  );

  /**
   * STUB — move a task to another section. Also used for drag-and-drop
   * between columns.
   */
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
      console.log('[KanbanSocket] Emitting task:move (STUB)', payload);
      socket.emit(KANBAN_EVENTS.TASK_MOVE, payload);
    },
    [boardId, companyId]
  );

  /** STUB — assign a user to a task. */
  const assignTask = useCallback(
    (taskId: string, userId: string) => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        onErrorRef.current?.('Socket not connected. Please try again.');
        return;
      }

      const payload: TaskAssignPayload = {
        boardId,
        companyId,
        taskId,
        userId
      };
      console.log('[KanbanSocket] Emitting task:assign (STUB)', payload);
      socket.emit(KANBAN_EVENTS.TASK_ASSIGN, payload);
    },
    [boardId, companyId]
  );

  /** STUB — fetch a single task by id. */
  const getTask = useCallback(
    (taskId: string) => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        onErrorRef.current?.('Socket not connected. Please try again.');
        return;
      }

      const payload: TaskGetPayload = { boardId, companyId, taskId };
      console.log('[KanbanSocket] Emitting task:get (STUB)', payload);
      socket.emit(KANBAN_EVENTS.TASK_GET, payload);
    },
    [boardId, companyId]
  );

  /** STUB — fetch the activity log for a task. */
  const listTaskActivity = useCallback(
    (taskId: string) => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        onErrorRef.current?.('Socket not connected. Please try again.');
        return;
      }

      const payload: TaskActivityListPayload = {
        boardId,
        companyId,
        taskId
      };
      console.log('[KanbanSocket] Emitting task:activity:list (STUB)', payload);
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
