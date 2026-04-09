import { io, Socket } from 'socket.io-client';

// =============================================================================
// CONFIGURATION
// =============================================================================

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || 'https://embroidery-backend-zkey.onrender.com';
// 'https://unadventuring-dumpishly-song.ngrok-free.dev';
('https://embroidery-backend-zkey.onrender.com');

// =============================================================================
// SOCKET SINGLETON
// =============================================================================

let socket: Socket | null = null;

/**
 * Get or create the socket instance.
 * If a previous instance was destroyed, a fresh one is created.
 */
export const getSocket = (): Socket => {
  // Return existing live socket
  if (socket && !socket.disconnected) {
    return socket;
  }

  // If old socket was destroyed or disconnected, tear it down fully
  if (socket) {
    socket.removeAllListeners();
    socket = null;
  }

  const token =
    typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  socket = io(SOCKET_URL, {
    autoConnect: false,

    // ── IMPORTANT: polling FIRST so HTTP headers are sent during handshake,
    //    then auto-upgrades to websocket for performance ──────────────────
    transports: ['polling', 'websocket'],

    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,

    // ── Auth object — available via socket.handshake.auth on the server ──
    auth: {
      ...(token ? { token, Authorization: token } : {})
    },

    // ── HTTP headers — sent during polling handshake ─────────────────────
    extraHeaders: {
      ...(token ? { Authorization: token } : {}),
      'ngrok-skip-browser-warning': 'true'
    }
  });

  // ── Debug listeners ──────────────────────────────────────────────────
  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.error('[Socket] Connection error:', err.message);
  });

  socket.on('reconnect_attempt', (attempt) => {
    console.log('[Socket] Reconnect attempt:', attempt);
  });

  socket.on('reconnect', (attempt) => {
    console.log('[Socket] Reconnected after', attempt, 'attempts');
  });

  socket.on('reconnect_failed', () => {
    console.error('[Socket] Reconnection failed after all attempts');
  });

  return socket;
};

/**
 * Connect the socket (creates a fresh instance if needed).
 */
export const connectSocket = (): Socket => {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
};

/**
 * Fully destroy the socket instance.
 * Removes all listeners, disconnects, and nullifies the singleton
 * so the next connectSocket() call creates a brand-new connection.
 */
export const destroySocket = (): void => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    console.log('[Socket] Destroyed');
  }
};

/**
 * Check whether a socket is currently connected.
 */
export const isSocketConnected = (): boolean => {
  return socket?.connected ?? false;
};

export default getSocket;
