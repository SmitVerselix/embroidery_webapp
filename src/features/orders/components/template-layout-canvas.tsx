'use client';

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  useLayoutEffect,
  type ReactNode,
  type RefObject,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent
} from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  GripVertical,
  LayoutGrid,
  Columns as ColumnsIcon,
  LayoutList,
  Magnet,
  RotateCcw,
  ChevronDown,
  Lock,
  Unlock,
  Maximize2
} from 'lucide-react';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

export type TemplatePosition = { x: number; y: number };

export type LayoutPreset =
  | 'vertical'
  | 'horizontal'
  | 'grid-2'
  | 'grid-3'
  | 'free';

export type TemplateLayoutItem = {
  id: string;
  label: string;
  children: ReactNode;
};

export interface TemplateLayoutCanvasProps {
  items: TemplateLayoutItem[];
  persistKey?: string;
  zoom: number;
  onTemplateDragStart?: () => void;
  onTemplateDragEnd?: () => void;
  /**
   * Portal target: layout toolbar renders into this element
   * so it stays outside the zoomable/scrollable canvas.
   */
  toolbarPortalTarget?: RefObject<HTMLDivElement | null>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const GAP = 28;
const SNAP_GRID_SIZE = 20;
const STORAGE_PREFIX = 'tpl-layout-';
const FALLBACK_W = 900;
const FALLBACK_H = 500;
const BOUNDS_PADDING = 60;

// =============================================================================
// PRESET LAYOUT CALCULATORS
// =============================================================================

function verticalLayout(
  ids: string[],
  h: Record<string, number>
): Record<string, TemplatePosition> {
  const out: Record<string, TemplatePosition> = {};
  let y = 0;
  ids.forEach((id) => {
    out[id] = { x: 0, y };
    y += (h[id] ?? FALLBACK_H) + GAP;
  });
  return out;
}

function horizontalLayout(
  ids: string[],
  w: Record<string, number>
): Record<string, TemplatePosition> {
  const out: Record<string, TemplatePosition> = {};
  let x = 0;
  ids.forEach((id) => {
    out[id] = { x, y: 0 };
    x += (w[id] ?? FALLBACK_W) + GAP;
  });
  return out;
}

function gridLayout(
  ids: string[],
  cols: number,
  w: Record<string, number>,
  h: Record<string, number>
): Record<string, TemplatePosition> {
  const out: Record<string, TemplatePosition> = {};
  const colW: number[] = Array(cols).fill(0);
  ids.forEach((id, i) => {
    colW[i % cols] = Math.max(colW[i % cols], w[id] ?? FALLBACK_W);
  });
  const rowCount = Math.ceil(ids.length / cols);
  const rowH: number[] = Array(rowCount).fill(0);
  ids.forEach((id, i) => {
    rowH[Math.floor(i / cols)] = Math.max(
      rowH[Math.floor(i / cols)],
      h[id] ?? FALLBACK_H
    );
  });
  const xOff: number[] = [0];
  for (let c = 1; c < cols; c++) xOff[c] = xOff[c - 1] + colW[c - 1] + GAP;
  const yOff: number[] = [0];
  for (let r = 1; r < rowCount; r++) yOff[r] = yOff[r - 1] + rowH[r - 1] + GAP;
  ids.forEach((id, i) => {
    out[id] = { x: xOff[i % cols], y: yOff[Math.floor(i / cols)] };
  });
  return out;
}

function computePreset(
  items: TemplateLayoutItem[],
  preset: LayoutPreset,
  w: Record<string, number>,
  h: Record<string, number>
): Record<string, TemplatePosition> {
  const ids = items.map((i) => i.id);
  switch (preset) {
    case 'horizontal':
      return horizontalLayout(ids, w);
    case 'grid-2':
      return gridLayout(ids, 2, w, h);
    case 'grid-3':
      return gridLayout(ids, 3, w, h);
    default:
      return verticalLayout(ids, h);
  }
}

// =============================================================================
// PERSISTENCE
// =============================================================================

function loadPersisted(key: string): Record<string, TemplatePosition> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function savePersisted(key: string, pos: Record<string, TemplatePosition>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(pos));
  } catch {
    /* noop */
  }
}

function clearPersisted(key: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_PREFIX + key);
  } catch {
    /* noop */
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function TemplateLayoutCanvas({
  items,
  persistKey,
  zoom,
  onTemplateDragStart,
  onTemplateDragEnd,
  toolbarPortalTarget
}: TemplateLayoutCanvasProps) {
  const [positions, setPositions] = useState<Record<string, TemplatePosition>>(
    {}
  );
  const [activePreset, setActivePreset] = useState<LayoutPreset>('vertical');
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [hasMeasured, setHasMeasured] = useState(false);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragStartMouse = useRef({ x: 0, y: 0 });
  const dragStartPos = useRef({ x: 0, y: 0 });

  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const mH = useRef<Record<string, number>>({});
  const mW = useRef<Record<string, number>>({});

  // ── Measure cards ───────────────────────────────────────────────────
  const measure = useCallback(() => {
    let changed = false;
    items.forEach((item) => {
      const el = cardRefs.current[item.id];
      if (!el) return;
      const r = el.getBoundingClientRect();
      const h = r.height / zoom;
      const w = r.width / zoom;
      if (
        Math.abs((mH.current[item.id] ?? 0) - h) > 2 ||
        Math.abs((mW.current[item.id] ?? 0) - w) > 2
      ) {
        mH.current[item.id] = h;
        mW.current[item.id] = w;
        changed = true;
      }
    });
    return changed;
  }, [items, zoom]);

  // ── First render: measure → position ────────────────────────────────
  useLayoutEffect(() => {
    if (items.length === 0) return;
    measure();

    if (persistKey) {
      const p = loadPersisted(persistKey);
      if (p && items.every((i) => p[i.id] != null)) {
        setPositions(p);
        setActivePreset('free');
        setHasMeasured(true);
        return;
      }
    }

    setPositions(computePreset(items, 'vertical', mW.current, mH.current));
    setActivePreset('vertical');
    setHasMeasured(true);
  }, [items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Post-paint re-measure ───────────────────────────────────────────
  useEffect(() => {
    if (!hasMeasured || items.length === 0) return;
    const timer = setTimeout(() => {
      const changed = measure();
      if (changed && activePreset !== 'free') {
        setPositions(
          computePreset(items, activePreset, mW.current, mH.current)
        );
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [hasMeasured, items, activePreset, measure]);

  // ── Persist ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (persistKey && Object.keys(positions).length > 0 && hasMeasured)
      savePersisted(persistKey, positions);
  }, [positions, persistKey, hasMeasured]);

  // ── Snap ────────────────────────────────────────────────────────────
  const snap = useCallback(
    (x: number, y: number) =>
      snapEnabled
        ? {
            x: Math.round(x / SNAP_GRID_SIZE) * SNAP_GRID_SIZE,
            y: Math.round(y / SNAP_GRID_SIZE) * SNAP_GRID_SIZE
          }
        : { x, y },
    [snapEnabled]
  );

  // ── Presets ─────────────────────────────────────────────────────────
  const applyPreset = useCallback(
    (preset: LayoutPreset) => {
      if (preset === 'free') {
        setActivePreset('free');
        return;
      }
      measure();
      setPositions(computePreset(items, preset, mW.current, mH.current));
      setActivePreset(preset);
    },
    [items, measure]
  );

  const resetLayout = useCallback(() => {
    measure();
    setPositions(computePreset(items, 'vertical', mW.current, mH.current));
    setActivePreset('vertical');
    if (persistKey) clearPersisted(persistKey);
  }, [items, persistKey, measure]);

  const autoFit = useCallback(() => {
    if (items.length === 0) return;
    measure();
    const sorted = [...items].sort((a, b) => {
      const pA = positions[a.id] || { x: 0, y: 0 };
      const pB = positions[b.id] || { x: 0, y: 0 };
      return Math.abs(pA.y - pB.y) < 50 ? pA.x - pB.x : pA.y - pB.y;
    });
    const next: Record<string, TemplatePosition> = {};
    let y = 0;
    sorted.forEach((item) => {
      next[item.id] = { x: positions[item.id]?.x ?? 0, y };
      y += (mH.current[item.id] ?? FALLBACK_H) + GAP;
    });
    setPositions(next);
    setActivePreset('free');
  }, [items, positions, measure]);

  // ── Mouse drag ──────────────────────────────────────────────────────
  const onDragStart = useCallback(
    (e: ReactMouseEvent, id: string) => {
      if (isLocked) return;
      e.stopPropagation();
      e.preventDefault();
      setDraggingId(id);
      dragStartMouse.current = { x: e.clientX, y: e.clientY };
      dragStartPos.current = positions[id] || { x: 0, y: 0 };
      onTemplateDragStart?.();
    },
    [positions, isLocked, onTemplateDragStart]
  );

  // ── Touch drag ──────────────────────────────────────────────────────
  const onTouchDragStart = useCallback(
    (e: ReactTouchEvent, id: string) => {
      if (isLocked || e.touches.length !== 1) return;
      e.stopPropagation();
      setDraggingId(id);
      dragStartMouse.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
      dragStartPos.current = positions[id] || { x: 0, y: 0 };
      onTemplateDragStart?.();
    },
    [positions, isLocked, onTemplateDragStart]
  );

  const onTouchDragMove = useCallback(
    (e: ReactTouchEvent) => {
      if (!draggingId || e.touches.length !== 1) return;
      e.stopPropagation();
      const dx = (e.touches[0].clientX - dragStartMouse.current.x) / zoom;
      const dy = (e.touches[0].clientY - dragStartMouse.current.y) / zoom;
      const s = snap(dragStartPos.current.x + dx, dragStartPos.current.y + dy);
      setPositions((p) => ({ ...p, [draggingId]: s }));
    },
    [draggingId, zoom, snap]
  );

  const onTouchDragEnd = useCallback(() => {
    if (draggingId) {
      setDraggingId(null);
      setActivePreset('free');
      onTemplateDragEnd?.();
    }
  }, [draggingId, onTemplateDragEnd]);

  // ── Global mouse listeners ──────────────────────────────────────────
  useEffect(() => {
    if (!draggingId) return;
    const up = () => {
      setDraggingId(null);
      setActivePreset('free');
      onTemplateDragEnd?.();
    };
    const move = (e: MouseEvent) => {
      const dx = (e.clientX - dragStartMouse.current.x) / zoom;
      const dy = (e.clientY - dragStartMouse.current.y) / zoom;
      const s = snapEnabled
        ? {
            x:
              Math.round((dragStartPos.current.x + dx) / SNAP_GRID_SIZE) *
              SNAP_GRID_SIZE,
            y:
              Math.round((dragStartPos.current.y + dy) / SNAP_GRID_SIZE) *
              SNAP_GRID_SIZE
          }
        : { x: dragStartPos.current.x + dx, y: dragStartPos.current.y + dy };
      setPositions((p) => ({ ...p, [draggingId]: s }));
    };
    window.addEventListener('mouseup', up);
    window.addEventListener('mousemove', move);
    return () => {
      window.removeEventListener('mouseup', up);
      window.removeEventListener('mousemove', move);
    };
  }, [draggingId, zoom, snapEnabled, onTemplateDragEnd]);

  // ══════════════════════════════════════════════════════════════════════
  // COMPUTE CARD CONTAINER BOUNDS
  // Absolute-positioned cards don't contribute to parent height/width,
  // so we must set explicit dimensions on their container. This is what
  // makes the scroll area produce proper scrollbars.
  // ══════════════════════════════════════════════════════════════════════
  const containerBounds = useMemo(() => {
    let maxR = 0;
    let maxB = 0;
    items.forEach((item) => {
      const pos = positions[item.id] || { x: 0, y: 0 };
      const right = pos.x + (mW.current[item.id] ?? FALLBACK_W);
      const bottom = pos.y + (mH.current[item.id] ?? FALLBACK_H);
      if (right > maxR) maxR = right;
      if (bottom > maxB) maxB = bottom;
    });
    return {
      width: maxR + BOUNDS_PADDING,
      height: maxB + BOUNDS_PADDING
    };
  }, [items, positions]);

  // ══════════════════════════════════════════════════════════════════════
  // TOOLBAR JSX (rendered via portal or inline)
  // ══════════════════════════════════════════════════════════════════════
  const toolbarJsx = (
    <div className='flex flex-wrap items-center gap-2'>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant='outline' size='sm' className='gap-1.5 text-xs'>
            <LayoutGrid className='h-3.5 w-3.5' />
            Layout
            <ChevronDown className='h-3 w-3' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='start'>
          <DropdownMenuItem
            onClick={() => applyPreset('vertical')}
            className={cn(activePreset === 'vertical' && 'bg-accent')}
          >
            <LayoutList className='mr-2 h-4 w-4' />
            Stack Vertical
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => applyPreset('horizontal')}
            className={cn(activePreset === 'horizontal' && 'bg-accent')}
          >
            <ColumnsIcon className='mr-2 h-4 w-4' />
            Side by Side
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => applyPreset('grid-2')}
            className={cn(activePreset === 'grid-2' && 'bg-accent')}
          >
            <LayoutGrid className='mr-2 h-4 w-4' />
            Grid (2 Columns)
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => applyPreset('grid-3')}
            className={cn(activePreset === 'grid-3' && 'bg-accent')}
          >
            <LayoutGrid className='mr-2 h-4 w-4' />
            Grid (3 Columns)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={autoFit}>
            <Maximize2 className='mr-2 h-4 w-4' />
            Auto-fit (Tighten)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={snapEnabled ? 'default' : 'outline'}
              size='sm'
              className='gap-1.5 text-xs'
              onClick={() => setSnapEnabled((s) => !s)}
            >
              <Magnet className='h-3.5 w-3.5' />
              Snap
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {snapEnabled ? 'Snap to grid enabled' : 'Snap to grid disabled'}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isLocked ? 'destructive' : 'outline'}
              size='sm'
              className='gap-1.5 text-xs'
              onClick={() => setIsLocked((l) => !l)}
            >
              {isLocked ? (
                <Lock className='h-3.5 w-3.5' />
              ) : (
                <Unlock className='h-3.5 w-3.5' />
              )}
              {isLocked ? 'Locked' : 'Unlocked'}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isLocked
              ? 'Templates are locked. Click to unlock.'
              : 'Templates can be moved. Click to lock.'}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='ghost'
              size='sm'
              className='gap-1.5 text-xs'
              onClick={resetLayout}
            >
              <RotateCcw className='h-3.5 w-3.5' />
              Reset
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reset to default vertical layout</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Badge variant='secondary' className='ml-auto text-[10px]'>
        {items.length} template{items.length !== 1 ? 's' : ''} ·{' '}
        {activePreset === 'free'
          ? 'Custom'
          : activePreset === 'vertical'
            ? 'Vertical'
            : activePreset === 'horizontal'
              ? 'Horizontal'
              : activePreset === 'grid-2'
                ? '2-Col Grid'
                : '3-Col Grid'}
      </Badge>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════
  return (
    <>
      {/* Portal toolbar outside the canvas if target provided */}
      {toolbarPortalTarget?.current
        ? createPortal(toolbarJsx, toolbarPortalTarget.current)
        : toolbarJsx}

      {/* ── Card container ──────────────────────────────────────────
           Explicit min-width/min-height from computed bounds so that
           the parent scroll area knows how large the content is.
           (Absolute-positioned cards don't contribute to parent size.)
      ────────────────────────────────────────────────────────────── */}
      <div
        className='relative'
        style={{
          minWidth: containerBounds.width,
          minHeight: containerBounds.height
        }}
        onTouchMove={onTouchDragMove}
        onTouchEnd={onTouchDragEnd}
      >
        {items.map((item) => {
          const pos = positions[item.id] || { x: 0, y: 0 };
          const isDrag = draggingId === item.id;

          return (
            <div
              key={item.id}
              ref={(el) => {
                cardRefs.current[item.id] = el;
              }}
              className={cn(
                'absolute top-0 left-0',
                isDrag
                  ? 'ring-primary/40 z-50 shadow-2xl ring-2'
                  : 'z-10 shadow-sm',
                !draggingId && 'transition-[transform] duration-200 ease-out'
              )}
              style={{
                transform: `translate(${pos.x}px, ${pos.y}px)`,
                opacity: hasMeasured ? 1 : 0
              }}
            >
              {/* Drag handle */}
              <div
                data-drag-handle='true'
                className={cn(
                  'group flex items-center gap-2 rounded-t-lg border border-b-0 px-3 py-1.5',
                  'select-none',
                  isLocked
                    ? 'bg-muted/60 cursor-default'
                    : isDrag
                      ? 'bg-primary/10 cursor-grabbing'
                      : 'bg-muted/80 hover:bg-muted cursor-grab'
                )}
                onMouseDown={(e) => onDragStart(e, item.id)}
                onTouchStart={(e) => onTouchDragStart(e, item.id)}
              >
                {!isLocked && (
                  <GripVertical
                    className={cn(
                      'h-4 w-4 flex-shrink-0',
                      isDrag
                        ? 'text-primary'
                        : 'text-muted-foreground/50 group-hover:text-muted-foreground'
                    )}
                  />
                )}
                <span className='text-muted-foreground truncate text-xs font-medium'>
                  {item.label}
                </span>
                {!isLocked && (
                  <span className='text-muted-foreground/40 ml-auto text-[10px] opacity-0 transition-opacity group-hover:opacity-100'>
                    Drag to move
                  </span>
                )}
                {isLocked && (
                  <Lock className='text-muted-foreground/40 ml-auto h-3 w-3' />
                )}
              </div>

              <div className='relative'>{item.children}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}
