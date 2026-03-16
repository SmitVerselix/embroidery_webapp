'use client';

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
  type WheelEvent as ReactWheelEvent,
  type TouchEvent as ReactTouchEvent
} from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import TemplateLayoutCanvas, {
  type TemplateLayoutItem
} from './template-layout-canvas';

// =============================================================================
// CONSTANTS
// =============================================================================

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.25;
const SCROLL_ZOOM_FACTOR = 0.001;
const DRAG_THRESHOLD = 3;

// =============================================================================
// Interactive-element check shared by mouse & touch handlers
// =============================================================================

function isInteractiveTarget(target: HTMLElement): boolean {
  return !!(
    target.closest('button') ||
    target.closest('a') ||
    target.closest('input') ||
    target.closest('select') ||
    target.closest('textarea') ||
    target.closest('[data-drag-handle]') ||
    target.closest('[role="combobox"]') ||
    target.closest('[role="listbox"]') ||
    target.closest('[role="option"]') ||
    target.closest('[role="dialog"]') ||
    target.closest('[data-radix-select-trigger]') ||
    target.closest('[data-radix-collection-item]')
  );
}

// =============================================================================
// TOOLBAR BUTTON
// =============================================================================

function CanvasToolbarButton({
  onClick,
  disabled = false,
  title,
  children
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type='button'
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      title={title}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-md',
        'text-muted-foreground hover:text-foreground hover:bg-accent',
        'transition-colors duration-150',
        'focus-visible:ring-ring focus:outline-none focus-visible:ring-2',
        'disabled:pointer-events-none disabled:opacity-30'
      )}
    >
      {children}
    </button>
  );
}

// =============================================================================
// PROPS
// =============================================================================

export interface TemplateCanvasContainerProps {
  /** Layout items to render inside the canvas */
  items: TemplateLayoutItem[];
  /** Key for persisting layout positions */
  persistKey: string;
  /** Title shown in the toolbar bar */
  title: string;
  /** Subtitle shown next to the title (hidden on small screens) */
  subtitle?: string;
  /** Optional extra content rendered between the toolbar and canvas */
  beforeCanvas?: ReactNode;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function TemplateCanvasContainer({
  items,
  persistKey,
  title,
  subtitle,
  beforeCanvas
}: TemplateCanvasContainerProps) {
  // ── Zoom state ──────────────────────────────────────────────────────
  const [zoom, setZoom] = useState(1);
  const [isCanvasFocused, setIsCanvasFocused] = useState(false);

  // ── Drag-to-scroll state ────────────────────────────────────────────
  const [isDragging, setIsDragging] = useState(false);
  const dragPending = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const scrollStart = useRef({ left: 0, top: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const lastPinchDist = useRef<number | null>(null);

  // ── Zoom helpers ────────────────────────────────────────────────────
  const clampZoom = useCallback(
    (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z)),
    []
  );

  const handleZoomIn = useCallback(() => {
    setZoom((z) => clampZoom(z + ZOOM_STEP));
  }, [clampZoom]);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => clampZoom(z - ZOOM_STEP));
  }, [clampZoom]);

  const handleResetView = useCallback(() => {
    setZoom(1);
    if (containerRef.current) {
      containerRef.current.scrollLeft = 0;
      containerRef.current.scrollTop = 0;
    }
  }, []);

  const handleWheel = useCallback(
    (e: ReactWheelEvent<HTMLDivElement>) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      e.stopPropagation();
      const delta = -e.deltaY * SCROLL_ZOOM_FACTOR;
      setZoom((z) => clampZoom(z + delta * z));
    },
    [clampZoom]
  );

  // ── Prevent native browser zoom on Ctrl+Scroll ─────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const preventNativeZoom = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };
    container.addEventListener('wheel', preventNativeZoom, { passive: false });
    return () => container.removeEventListener('wheel', preventNativeZoom);
  }, [items.length]);

  // ── Drag-to-scroll: mouse ──────────────────────────────────────────
  const handleMouseDown = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (isInteractiveTarget(e.target as HTMLElement)) return;
    e.preventDefault();
    dragPending.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    scrollStart.current = {
      left: containerRef.current?.scrollLeft ?? 0,
      top: containerRef.current?.scrollTop ?? 0
    };
  }, []);

  const handleMouseMove = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (!containerRef.current) return;
      if (!isDragging && !dragPending.current) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      if (!isDragging) {
        if (Math.abs(dx) >= DRAG_THRESHOLD || Math.abs(dy) >= DRAG_THRESHOLD)
          setIsDragging(true);
        return;
      }
      containerRef.current.scrollLeft = scrollStart.current.left - dx;
      containerRef.current.scrollTop = scrollStart.current.top - dy;
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragPending.current = false;
  }, []);

  // ── Drag-to-scroll: touch ──────────────────────────────────────────
  const getTouchDist = (t1: React.Touch, t2: React.Touch): number => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback((e: ReactTouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      if (isInteractiveTarget(e.target as HTMLElement)) return;
      dragPending.current = true;
      dragStart.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
      scrollStart.current = {
        left: containerRef.current?.scrollLeft ?? 0,
        top: containerRef.current?.scrollTop ?? 0
      };
    } else if (e.touches.length === 2) {
      lastPinchDist.current = getTouchDist(e.touches[0], e.touches[1]);
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: ReactTouchEvent<HTMLDivElement>) => {
      if (e.touches.length === 1 && containerRef.current) {
        if (!isDragging && !dragPending.current) return;
        const dx = e.touches[0].clientX - dragStart.current.x;
        const dy = e.touches[0].clientY - dragStart.current.y;
        if (!isDragging) {
          if (Math.abs(dx) >= DRAG_THRESHOLD || Math.abs(dy) >= DRAG_THRESHOLD)
            setIsDragging(true);
          return;
        }
        containerRef.current.scrollLeft = scrollStart.current.left - dx;
        containerRef.current.scrollTop = scrollStart.current.top - dy;
      } else if (e.touches.length === 2 && lastPinchDist.current !== null) {
        const newDist = getTouchDist(e.touches[0], e.touches[1]);
        const scale = newDist / lastPinchDist.current;
        lastPinchDist.current = newDist;
        setZoom((z) => clampZoom(z * scale));
      }
    },
    [isDragging, clampZoom]
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    dragPending.current = false;
    lastPinchDist.current = null;
  }, []);

  // ── Double-click to toggle zoom ────────────────────────────────────
  const handleDoubleClick = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (isInteractiveTarget(e.target as HTMLElement)) return;
      setZoom((z) => (z > 1.1 ? 1 : 2.5));
    },
    []
  );

  // ── Keyboard shortcuts (+, -, 0) ───────────────────────────────────
  useEffect(() => {
    if (!isCanvasFocused) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      switch (e.key) {
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
          handleResetView();
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isCanvasFocused, handleZoomIn, handleZoomOut, handleResetView]);

  const zoomPercent = Math.round(zoom * 100);

  // ── RENDER ──────────────────────────────────────────────────────────
  return (
    <>
      {/* Toolbar */}
      <div className='bg-muted/60 flex items-center justify-between rounded-lg border px-4 py-2.5'>
        <div className='flex min-w-0 items-center gap-3'>
          <h2 className='truncate text-sm font-semibold'>{title}</h2>
          {subtitle && (
            <span className='text-muted-foreground hidden text-xs sm:inline'>
              {subtitle}
            </span>
          )}
        </div>
        <div className='bg-background flex items-center gap-1 rounded-lg border px-1 py-0.5 shadow-sm'>
          <CanvasToolbarButton
            onClick={handleZoomOut}
            disabled={zoom <= MIN_ZOOM}
            title='Zoom out (−)'
          >
            <ZoomOut className='h-4 w-4' />
          </CanvasToolbarButton>
          <span className='text-muted-foreground w-12 text-center font-mono text-xs tabular-nums select-none'>
            {zoomPercent}%
          </span>
          <CanvasToolbarButton
            onClick={handleZoomIn}
            disabled={zoom >= MAX_ZOOM}
            title='Zoom in (+)'
          >
            <ZoomIn className='h-4 w-4' />
          </CanvasToolbarButton>
          <div className='bg-border mx-0.5 h-4 w-px' />
          <CanvasToolbarButton onClick={handleResetView} title='Reset view (0)'>
            <Maximize2 className='h-3.5 w-3.5' />
          </CanvasToolbarButton>
        </div>
        <div className='w-20' />
      </div>

      {/* Optional content between toolbar and canvas */}
      {beforeCanvas}

      {/* Canvas */}
      <div
        className='bg-muted/30 relative isolate overflow-hidden rounded-xl border'
        style={{ height: '70vh', minHeight: '400px', maxHeight: '80vh' }}
      >
        <div
          ref={containerRef}
          tabIndex={0}
          className={cn(
            'absolute inset-0 overflow-auto outline-none',
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          )}
          onFocus={() => setIsCanvasFocused(true)}
          onBlur={() => setIsCanvasFocused(false)}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onDoubleClick={handleDoubleClick}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div
            className='origin-top-left p-6'
            style={{ zoom: zoom } as React.CSSProperties}
          >
            <TemplateLayoutCanvas
              items={items}
              persistKey={persistKey}
              zoom={zoom}
            />
          </div>
        </div>
      </div>

      {/* Hints */}
      <div className='bg-muted/40 flex items-center justify-center rounded-lg border px-4 py-2'>
        <p className='text-muted-foreground text-[11px] select-none'>
          Scroll or drag to pan · Double-click to toggle zoom · Pinch to zoom on
          touch ·{' '}
          <kbd className='bg-muted rounded border px-1 py-0.5 font-mono text-[10px]'>
            Ctrl
          </kbd>
          {' + Scroll to zoom · '}
          <kbd className='bg-muted rounded border px-1 py-0.5 font-mono text-[10px]'>
            +
          </kbd>{' '}
          <kbd className='bg-muted rounded border px-1 py-0.5 font-mono text-[10px]'>
            −
          </kbd>{' '}
          <kbd className='bg-muted rounded border px-1 py-0.5 font-mono text-[10px]'>
            0
          </kbd>{' '}
          for zoom controls
        </p>
      </div>
    </>
  );
}
