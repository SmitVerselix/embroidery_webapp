'use client';

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
  type WheelEvent as ReactWheelEvent,
  type TouchEvent as ReactTouchEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  X,
  Maximize2,
  Minimize2,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// =============================================================================
// CONSTANTS
// =============================================================================

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.25;
const SCROLL_ZOOM_FACTOR = 0.001;

// =============================================================================
// TYPES
// =============================================================================

export interface ImageViewerProps {
  /** Image source URL */
  src: string;
  /** Alt text for accessibility */
  alt?: string;
  /** ClassName applied to the outer wrapper (controls thumbnail size) */
  className?: string;
  /** ClassName applied directly to the <img> thumbnail */
  thumbnailClassName?: string;
  /** Replace the default thumbnail with a custom trigger element */
  children?: ReactNode;
  /** Disable opening the viewer on click */
  disabled?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function ImageViewer({
  src,
  alt = 'Image',
  className,
  thumbnailClassName,
  children,
  disabled = false,
}: ImageViewerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isFitted, setIsFitted] = useState(true);

  // Refs
  const dragStart = useRef({ x: 0, y: 0 });
  const positionStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const lastPinchDist = useRef<number | null>(null);

  // ──────────────────────────────────────────────────────────────────────
  // OPEN / CLOSE
  // ──────────────────────────────────────────────────────────────────────
  const openViewer = useCallback(() => {
    if (disabled) return;
    setIsOpen(true);
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    setIsFitted(true);
    document.body.style.overflow = 'hidden';
  }, [disabled]);

  const closeViewer = useCallback(() => {
    setIsOpen(false);
    setIsDragging(false);
    lastPinchDist.current = null;
    document.body.style.overflow = '';
  }, []);

  // ──────────────────────────────────────────────────────────────────────
  // ZOOM HELPERS
  // ──────────────────────────────────────────────────────────────────────
  const clampZoom = useCallback((z: number) => {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoom((z) => clampZoom(z + ZOOM_STEP));
    setIsFitted(false);
  }, [clampZoom]);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => clampZoom(z - ZOOM_STEP));
    setIsFitted(false);
  }, [clampZoom]);

  const handleResetZoom = useCallback(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    setIsFitted(true);
  }, []);

  const handleToggleFit = useCallback(() => {
    if (isFitted) {
      // Go to actual size
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      setIsFitted(false);
    } else {
      // Fit to screen
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      setIsFitted(true);
    }
  }, [isFitted]);

  // ──────────────────────────────────────────────────────────────────────
  // SCROLL WHEEL ZOOM
  // ──────────────────────────────────────────────────────────────────────
  const handleWheel = useCallback(
    (e: ReactWheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = -e.deltaY * SCROLL_ZOOM_FACTOR;
      setZoom((z) => clampZoom(z + delta * z));
      setIsFitted(false);
    },
    [clampZoom]
  );

  // ──────────────────────────────────────────────────────────────────────
  // MOUSE DRAG / PAN
  // ──────────────────────────────────────────────────────────────────────
  const handleMouseDown = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      // Only left-click
      if (e.button !== 0) return;
      e.preventDefault();
      setIsDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY };
      positionStart.current = { ...position };
    },
    [position]
  );

  const handleMouseMove = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setPosition({
        x: positionStart.current.x + dx,
        y: positionStart.current.y + dy,
      });
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // ──────────────────────────────────────────────────────────────────────
  // TOUCH DRAG + PINCH-TO-ZOOM
  // ──────────────────────────────────────────────────────────────────────
  const getTouchDist = (t1: React.Touch, t2: React.Touch): number => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback(
    (e: ReactTouchEvent<HTMLDivElement>) => {
      if (e.touches.length === 1) {
        setIsDragging(true);
        dragStart.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
        positionStart.current = { ...position };
      } else if (e.touches.length === 2) {
        lastPinchDist.current = getTouchDist(e.touches[0], e.touches[1]);
      }
    },
    [position]
  );

  const handleTouchMove = useCallback(
    (e: ReactTouchEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (e.touches.length === 1 && isDragging) {
        const dx = e.touches[0].clientX - dragStart.current.x;
        const dy = e.touches[0].clientY - dragStart.current.y;
        setPosition({
          x: positionStart.current.x + dx,
          y: positionStart.current.y + dy,
        });
      } else if (e.touches.length === 2 && lastPinchDist.current !== null) {
        const newDist = getTouchDist(e.touches[0], e.touches[1]);
        const scale = newDist / lastPinchDist.current;
        lastPinchDist.current = newDist;
        setZoom((z) => clampZoom(z * scale));
        setIsFitted(false);
      }
    },
    [isDragging, clampZoom]
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    lastPinchDist.current = null;
  }, []);

  // ──────────────────────────────────────────────────────────────────────
  // DOUBLE-CLICK TO TOGGLE ZOOM
  // ──────────────────────────────────────────────────────────────────────
  const handleDoubleClick = useCallback(() => {
    if (zoom > 1.1) {
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      setIsFitted(true);
    } else {
      setZoom(2.5);
      setIsFitted(false);
    }
  }, [zoom]);

  // ──────────────────────────────────────────────────────────────────────
  // DOWNLOAD
  // ──────────────────────────────────────────────────────────────────────
  const handleDownload = useCallback(async () => {
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const fileName = src.split('/').pop()?.split('?')[0] || 'image';
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      // Fallback: open in new tab
      window.open(src, '_blank');
    }
  }, [src]);

  // ──────────────────────────────────────────────────────────────────────
  // KEYBOARD SHORTCUTS
  // ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          closeViewer();
          break;
        case '+':
        case '=':
          e.preventDefault();
          handleZoomIn();
          break;
        case '-':
        case '_':
          e.preventDefault();
          handleZoomOut();
          break;
        case '0':
          e.preventDefault();
          handleResetZoom();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeViewer, handleZoomIn, handleZoomOut, handleResetZoom]);

  // Prevent native wheel scroll on the container when modal open
  useEffect(() => {
    if (!isOpen) return;
    const container = containerRef.current;
    if (!container) return;

    const preventScroll = (e: Event) => e.preventDefault();
    container.addEventListener('wheel', preventScroll, { passive: false });
    return () => container.removeEventListener('wheel', preventScroll);
  }, [isOpen]);

  // ──────────────────────────────────────────────────────────────────────
  // PREVENT CLICK ON BACKDROP FROM CLOSING WHEN DRAGGING
  // ──────────────────────────────────────────────────────────────────────
  const handleBackdropClick = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      // Only close if click target is the backdrop itself (not the image)
      if (e.target === e.currentTarget) {
        closeViewer();
      }
    },
    [closeViewer]
  );

  // ──────────────────────────────────────────────────────────────────────
  // ZOOM PERCENTAGE DISPLAY
  // ──────────────────────────────────────────────────────────────────────
  const zoomPercent = Math.round(zoom * 100);

  // ──────────────────────────────────────────────────────────────────────
  // RENDER: THUMBNAIL
  // ──────────────────────────────────────────────────────────────────────
  const thumbnail = children ? (
    <div
      onClick={openViewer}
      className={cn('cursor-zoom-in', disabled && 'cursor-default', className)}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openViewer();
        }
      }}
      aria-label={`View ${alt}`}
    >
      {children}
    </div>
  ) : (
    <img
      src={src}
      alt={alt}
      onClick={openViewer}
      className={cn(
        'cursor-zoom-in transition-opacity hover:opacity-90',
        disabled && 'cursor-default',
        className,
        thumbnailClassName
      )}
      role="button"
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openViewer();
        }
      }}
      aria-label={`View ${alt}`}
    />
  );

  // ──────────────────────────────────────────────────────────────────────
  // RENDER: MODAL
  // ──────────────────────────────────────────────────────────────────────
  const modal = isOpen
    ? createPortal(
        <div
          ref={containerRef}
          className="fixed inset-0 z-[9999] flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-label={`Image viewer: ${alt}`}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" />

          {/* ── Top toolbar ──────────────────────────────────────── */}
          <div className="relative z-10 flex items-center justify-between px-4 py-3 bg-black/40 border-b border-white/10">
            {/* Left: image alt text */}
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-sm font-medium text-white/80 truncate max-w-[240px]">
                {alt}
              </span>
            </div>

            {/* Center: zoom controls */}
            <div className="flex items-center gap-1 bg-white/10 rounded-lg px-1 py-0.5">
              <ToolbarButton
                onClick={handleZoomOut}
                disabled={zoom <= MIN_ZOOM}
                title="Zoom out (−)"
              >
                <ZoomOut className="h-4 w-4" />
              </ToolbarButton>

              <span className="text-xs font-mono text-white/70 w-12 text-center tabular-nums select-none">
                {zoomPercent}%
              </span>

              <ToolbarButton
                onClick={handleZoomIn}
                disabled={zoom >= MAX_ZOOM}
                title="Zoom in (+)"
              >
                <ZoomIn className="h-4 w-4" />
              </ToolbarButton>

              <div className="w-px h-4 bg-white/20 mx-0.5" />

              <ToolbarButton onClick={handleResetZoom} title="Reset zoom (0)">
                <RotateCcw className="h-3.5 w-3.5" />
              </ToolbarButton>

              <ToolbarButton
                onClick={handleToggleFit}
                title={isFitted ? 'Actual size' : 'Fit to screen'}
              >
                {isFitted ? (
                  <Maximize2 className="h-3.5 w-3.5" />
                ) : (
                  <Minimize2 className="h-3.5 w-3.5" />
                )}
              </ToolbarButton>
            </div>

            {/* Right: download + close */}
            <div className="flex items-center gap-1">
              <ToolbarButton onClick={handleDownload} title="Download image">
                <Download className="h-4 w-4" />
              </ToolbarButton>

              <ToolbarButton onClick={closeViewer} title="Close (Esc)">
                <X className="h-4 w-4" />
              </ToolbarButton>
            </div>
          </div>

          {/* ── Image area ───────────────────────────────────────── */}
          <div
            className={cn(
              'relative z-10 flex-1 overflow-hidden select-none',
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            )}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onDoubleClick={handleDoubleClick}
            onClick={handleBackdropClick}
          >
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ pointerEvents: 'none' }}
            >
              <img
                ref={imageRef}
                src={src}
                alt={alt}
                draggable={false}
                className={cn(
                  'pointer-events-auto max-w-none select-none',
                  isFitted && zoom === 1 && 'max-h-full max-w-full object-contain',
                  !isDragging && 'transition-transform duration-150 ease-out'
                )}
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                  transformOrigin: 'center center',
                }}
              />
            </div>
          </div>

          {/* ── Bottom hint bar ──────────────────────────────────── */}
          <div className="relative z-10 flex items-center justify-center px-4 py-2 bg-black/40 border-t border-white/10">
            <p className="text-[11px] text-white/40 select-none">
              Scroll to zoom · Drag to pan · Double-click to toggle zoom · Press
              Esc to close
            </p>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      {thumbnail}
      {modal}
    </>
  );
}

// =============================================================================
// TOOLBAR BUTTON (internal sub-component)
// =============================================================================

function ToolbarButton({
  onClick,
  disabled = false,
  title,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      title={title}
      className={cn(
        'inline-flex items-center justify-center h-8 w-8 rounded-md',
        'text-white/70 hover:text-white hover:bg-white/15',
        'transition-colors duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
        'disabled:opacity-30 disabled:pointer-events-none'
      )}
    >
      {children}
    </button>
  );
}