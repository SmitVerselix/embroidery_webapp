'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { Socket } from 'socket.io-client';
import { connectSocket, destroySocket } from '@/lib/socket';

// =============================================================================
// TYPES
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
// SOCKET EVENT NAMES
// =============================================================================

export const KANBAN_EVENTS = {
  // ── Board ──────────────────────────────────────────────────────────────
  JOIN: 'kanban:join',
  JOIN_RESPONSE: 'kanban:join:response',

  // ── Section CRUD ───────────────────────────────────────────────────────
  SECTION_CREATE: 'section:create',
  SECTION_CREATE_RESPONSE: 'section:create:response',

  SECTION_LIST: 'section:list',
  SECTION_LIST_RESPONSE: 'section:list:response',

  SECTION_GET: 'section:get',
  SECTION_GET_RESPONSE: 'section:get:response',

  SECTION_UPDATE: 'section:update',
  SECTION_UPDATE_RESPONSE: 'section:update:response',

  SECTION_DELETE: 'section:delete',
  SECTION_DELETE_RESPONSE: 'section:delete:response'
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
  onBoardEvent,
  onError
}: UseKanbanSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [boardData, setBoardData] = useState<KanbanBoardData | null>(null);
  const [sections, setSections] = useState<KanbanSection[]>([]);
  const sectionsRef = useRef<KanbanSection[]>([]);

  // Keep sectionsRef in sync with state
  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);

  // Stable callback refs
  const onBoardJoinedRef = useRef(onBoardJoined);
  const onSectionCreatedRef = useRef(onSectionCreated);
  const onSectionUpdatedRef = useRef(onSectionUpdated);
  const onSectionDeletedRef = useRef(onSectionDeleted);
  const onSectionsListedRef = useRef(onSectionsListed);
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
    onBoardEventRef.current = onBoardEvent;
  }, [onBoardEvent]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  // ── Connect, join board, and subscribe to all events ───────────────────
  useEffect(() => {
    if (!boardId || !companyId) return;

    const boardChannel = `board-${boardId}`;

    // 1️⃣  Connect socket
    const socket = connectSocket();
    socketRef.current = socket;

    // ── Connection state ─────────────────────────────────────────────
    const handleConnect = () => {
      console.log('[KanbanSocket] Connected:', socket.id);
      setIsConnected(true);

      // Emit kanban:join as soon as connected
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

        // If the join response includes sections, populate them
        if (data.payload.sections && Array.isArray(data.payload.sections)) {
          setSections(data.payload.sections);
        }

        onBoardJoinedRef.current?.(data.payload);

        // Also fetch sections explicitly after joining
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
        onSectionDeletedRef.current?.(deleted);
      } else {
        const msg = data.error || data.message || 'Failed to delete section';
        console.error('[KanbanSocket] section:delete:response error:', msg);
        onErrorRef.current?.(msg);
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
    socket.on(KANBAN_EVENTS.SECTION_LIST_RESPONSE, handleSectionListResponse);
    socket.on(
      KANBAN_EVENTS.SECTION_UPDATE_RESPONSE,
      handleSectionUpdateResponse
    );
    socket.on(
      KANBAN_EVENTS.SECTION_DELETE_RESPONSE,
      handleSectionDeleteResponse
    );
    socket.on(boardChannel, handleBoardChannel);

    // If already connected (reconnect scenario), emit join immediately
    if (socket.connected) {
      setIsConnected(true);
      console.log('[KanbanSocket] Already connected, emitting kanban:join');
      socket.emit(KANBAN_EVENTS.JOIN, { boardId, companyId });
    }

    // 2️⃣  Handle page refresh — clean disconnect before unload
    const handleBeforeUnload = () => {
      destroySocket();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // 3️⃣  Cleanup — navigate away or boardId/companyId changes
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);

      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
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
      socket.off(boardChannel, handleBoardChannel);

      destroySocket();

      socketRef.current = null;
      setIsConnected(false);
      setIsJoined(false);
    };
  }, [boardId, companyId]);

  // ── Emit: create section ───────────────────────────────────────────────
  const createSection = useCallback(
    (name: string) => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        console.warn('[KanbanSocket] Cannot emit — not connected');
        onErrorRef.current?.('Socket not connected. Please try again.');
        return;
      }

      // Position = current count + 1
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

  // ── Emit: list sections ────────────────────────────────────────────────
  const listSections = useCallback(() => {
    const socket = socketRef.current;
    if (!socket?.connected) {
      console.warn('[KanbanSocket] Cannot emit — not connected');
      onErrorRef.current?.('Socket not connected. Please try again.');
      return;
    }

    const payload: SectionListPayload = { boardId, companyId };
    console.log('[KanbanSocket] Emitting section:list', payload);
    socket.emit(KANBAN_EVENTS.SECTION_LIST, payload);
  }, [boardId, companyId]);

  // ── Emit: update section ───────────────────────────────────────────────
  const updateSection = useCallback(
    (sectionId: string, updates: { name?: string; position?: number }) => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        console.warn('[KanbanSocket] Cannot emit — not connected');
        onErrorRef.current?.('Socket not connected. Please try again.');
        return;
      }

      // If position is not explicitly provided, look up the section's current position
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

  // ── Emit: delete section ───────────────────────────────────────────────
  const deleteSection = useCallback(
    (sectionId: string) => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        console.warn('[KanbanSocket] Cannot emit — not connected');
        onErrorRef.current?.('Socket not connected. Please try again.');
        return;
      }

      const payload: SectionDeletePayload = { sectionId, boardId, companyId };
      console.log('[KanbanSocket] Emitting section:delete', payload);
      socket.emit(KANBAN_EVENTS.SECTION_DELETE, payload);
    },
    [boardId, companyId]
  );

  // ── Emit: get section by id ────────────────────────────────────────────
  const getSection = useCallback(
    (sectionId: string) => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        console.warn('[KanbanSocket] Cannot emit — not connected');
        onErrorRef.current?.('Socket not connected. Please try again.');
        return;
      }

      const payload: SectionGetPayload = { sectionId, boardId, companyId };
      console.log('[KanbanSocket] Emitting section:get', payload);
      socket.emit(KANBAN_EVENTS.SECTION_GET, payload);
    },
    [boardId, companyId]
  );

  // ── Reset ──────────────────────────────────────────────────────────────
  const resetSections = useCallback(() => {
    setSections([]);
  }, []);

  return {
    isConnected,
    isJoined,
    boardData,
    sections,
    setSections,
    createSection,
    listSections,
    updateSection,
    deleteSection,
    getSection,
    resetSections,
    socket: socketRef.current
  };
}
