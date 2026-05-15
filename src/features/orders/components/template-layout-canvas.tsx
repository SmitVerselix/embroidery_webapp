'use client';

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  useLayoutEffect,
  type ReactNode,
  type RefObject
} from 'react';
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
  toolbarPortalTarget?: RefObject<HTMLDivElement | null>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const GAP = 32;
const FALLBACK_W = 900;
const FALLBACK_H = 500;
const BOUNDS_PADDING = 80;
const MIN_W = 300;

// =============================================================================
// LAYOUT HELPER
// =============================================================================

function verticalLayout(
  ids: string[],
  heights: Record<string, number>
): Record<string, TemplatePosition> {
  const out: Record<string, TemplatePosition> = {};
  let y = 0;
  ids.forEach((id) => {
    out[id] = { x: 0, y };
    y += (heights[id] ?? FALLBACK_H) + GAP;
  });
  return out;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function TemplateLayoutCanvas({
  items,
  zoom
}: TemplateLayoutCanvasProps) {
  // ── Positions ────────────────────────────────────────────────────────
  const [positions, setPositions] = useState<Record<string, TemplatePosition>>(
    {}
  );
  const [hasMeasured, setHasMeasured] = useState(false);

  // Natural (content-driven) width per card — the minimum floor for resizing
  const naturalW = useRef<Record<string, number>>({});

  // User width overrides: null = use natural content width, number = forced px width
  const [userWidths, setUserWidths] = useState<Record<string, number | null>>(
    {}
  );
  const userWidthsRef = useRef<Record<string, number | null>>({});
  useEffect(() => {
    userWidthsRef.current = userWidths;
  }, [userWidths]);

  // Outer card div refs — always read actual rendered height from DOM for layout
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // ── Active drag ───────────────────────────────────────────────────────
  const dragRef = useRef<{
    id: string;
    startX: number;
    startW: number; // card width at drag start
    natW: number; // natural content width (floor)
  } | null>(null);

  const [activeResizeId, setActiveResizeId] = useState<string | null>(null);

  // ── Zoom ref — window listeners always see current value ──────────────
  const zoomRef = useRef(zoom);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  // ─────────────────────────────────────────────────────────────────────
  // LAYOUT — always read actual rendered card heights from the DOM.
  // This is the single source of truth: content-driven or not, it's
  // always correct and never goes stale.
  // ─────────────────────────────────────────────────────────────────────

  const readCardHeights = useCallback((): Record<string, number> => {
    const out: Record<string, number> = {};
    items.forEach((item) => {
      const el = cardRefs.current[item.id];
      out[item.id] = el
        ? el.getBoundingClientRect().height / zoomRef.current
        : FALLBACK_H;
    });
    return out;
  }, [items]);

  const relayout = useCallback(() => {
    setPositions(
      verticalLayout(
        items.map((i) => i.id),
        readCardHeights()
      )
    );
  }, [items, readCardHeights]);

  // ── Measure natural card width (only when no override is active) ──────
  const measureNaturalWidth = useCallback(() => {
    items.forEach((item) => {
      const el = cardRefs.current[item.id];
      if (!el) return;
      if (userWidthsRef.current[item.id] != null) return; // don't clobber override
      const w = el.getBoundingClientRect().width / zoomRef.current;
      if (w > 10) naturalW.current[item.id] = w;
    });
  }, [items]);

  // ── Initial layout ────────────────────────────────────────────────────
  useLayoutEffect(() => {
    if (items.length === 0) return;
    const raf = requestAnimationFrame(() => {
      measureNaturalWidth();
      relayout();
      setHasMeasured(true);
    });
    return () => cancelAnimationFrame(raf);
  }, [items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Post-paint settle ─────────────────────────────────────────────────
  useEffect(() => {
    if (!hasMeasured || items.length === 0) return;
    const t = setTimeout(() => {
      measureNaturalWidth();
      relayout();
    }, 180);
    return () => clearTimeout(t);
  }, [hasMeasured, items, measureNaturalWidth, relayout]);

  // ── ResizeObserver — recompute layout when any card changes height ────
  // Observing cardRefs covers all cases: content growth/shrink, row toggles,
  // extra fields expanding, etc. — all shift cards below automatically.
  useEffect(() => {
    if (!hasMeasured || items.length === 0) return;
    let rafId: number | null = null;

    const ro = new ResizeObserver(() => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        relayout();
      });
    });

    items.forEach((item) => {
      const el = cardRefs.current[item.id];
      if (el) ro.observe(el);
    });

    return () => {
      ro.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [hasMeasured, items, relayout]);

  // ── Re-apply width overrides after React re-renders ───────────────────
  // React reconciliation can clear inline styles; this restores them.
  useEffect(() => {
    items.forEach((item) => {
      const el = cardRefs.current[item.id];
      if (!el) return;
      const w = userWidths[item.id];
      el.style.width = w != null ? `${w}px` : '';
    });
  }, [userWidths, items]);

  // ─────────────────────────────────────────────────────────────────────
  // WIDTH RESIZE DRAG
  // ─────────────────────────────────────────────────────────────────────

  const handleDragStart = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();

    const el = cardRefs.current[id];
    if (!el) return;

    const currentW = el.getBoundingClientRect().width / zoomRef.current;

    dragRef.current = {
      id,
      startX: e.clientX,
      startW: currentW,
      natW: naturalW.current[id] ?? currentW
    };

    setActiveResizeId(id);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;

      const z = zoomRef.current;
      const dx = (e.clientX - d.startX) / z;
      const rawW = d.startW + dx;
      const newW = Math.max(MIN_W, d.natW, rawW);

      // Apply directly to DOM — zero React render overhead during drag
      const el = cardRefs.current[d.id];
      if (el) el.style.width = `${newW}px`;

      // Keep ref in sync
      userWidthsRef.current = {
        ...userWidthsRef.current,
        [d.id]: newW > d.natW ? newW : null
      };

      // No need to relayout — width changes don't affect vertical positions
    };

    const onUp = () => {
      if (!dragRef.current) return;
      // Commit final value to React state (drives reset-button visibility)
      setUserWidths({ ...userWidthsRef.current });
      dragRef.current = null;
      setActiveResizeId(null);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []); // no deps — reads everything from refs

  // ── Reset a card to natural width ─────────────────────────────────────
  const resetWidth = useCallback((id: string) => {
    const el = cardRefs.current[id];
    if (el) el.style.width = '';
    userWidthsRef.current = { ...userWidthsRef.current, [id]: null };
    setUserWidths((prev) => ({ ...prev, [id]: null }));
  }, []);

  // ── Container bounds ──────────────────────────────────────────────────
  const containerBounds = useMemo(() => {
    let maxR = 0;
    let maxB = 0;
    items.forEach((item) => {
      const pos = positions[item.id] ?? { x: 0, y: 0 };
      const el = cardRefs.current[item.id];
      const w = el
        ? el.getBoundingClientRect().width / zoomRef.current
        : FALLBACK_W;
      const h = el
        ? el.getBoundingClientRect().height / zoomRef.current
        : FALLBACK_H;
      maxR = Math.max(maxR, pos.x + w);
      maxB = Math.max(maxB, pos.y + h);
    });
    return { width: maxR + BOUNDS_PADDING, height: maxB + BOUNDS_PADDING };
    // userWidths in deps so bounds update after drag commits
  }, [items, positions, userWidths]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────
  return (
    <div
      className='relative'
      style={{
        minWidth: containerBounds.width,
        minHeight: containerBounds.height
      }}
    >
      {items.map((item) => {
        const pos = positions[item.id] ?? { x: 0, y: 0 };
        const hasUser = (userWidths[item.id] ?? null) != null;
        const isActive = activeResizeId === item.id;

        return (
          <div
            key={item.id}
            ref={(el) => {
              cardRefs.current[item.id] = el;
            }}
            className={cn(
              'group absolute top-0 left-0 z-10 rounded-lg shadow-sm',
              isActive && 'ring-primary/20 shadow-md ring-1'
            )}
            style={{
              transform: `translate(${pos.x}px, ${pos.y}px)`,
              opacity: hasMeasured ? 1 : 0,
              transition: isActive
                ? 'opacity 200ms, box-shadow 150ms'
                : 'opacity 200ms, box-shadow 150ms, transform 180ms ease-out'
            }}
          >
            {/* ── Header ── */}
            <div className='bg-muted/80 flex items-center gap-2 rounded-t-lg border border-b-0 px-3 py-1.5 select-none'>
              <span className='text-muted-foreground truncate text-xs font-medium'>
                {item.label}
              </span>
              {hasUser && (
                <button
                  type='button'
                  data-resize-handle
                  onClick={() => resetWidth(item.id)}
                  className={cn(
                    'ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium',
                    'text-muted-foreground/70 hover:text-foreground',
                    'transition-colors hover:bg-black/5 dark:hover:bg-white/10'
                  )}
                  title='Reset to original width'
                >
                  Reset width
                </button>
              )}
            </div>

            {/* ── Content ── */}
            <div data-resize-content className='relative'>
              {item.children}
            </div>

            {/* ── Right-edge resize handle ── */}
            <div
              data-resize-handle
              onMouseDown={(e) => handleDragStart(e, item.id)}
              title='Drag to resize width'
              className={cn(
                'absolute top-0 right-0 z-20 h-full w-3',
                'flex cursor-ew-resize items-center justify-center',
                'opacity-0 transition-opacity duration-150',
                'group-hover:opacity-100',
                isActive && 'opacity-100'
              )}
            >
              {/* Grip line */}
              <div
                className={cn(
                  'bg-border h-10 w-0.5 rounded-full transition-colors duration-100',
                  'group-hover:bg-primary/40',
                  isActive && 'bg-primary/60'
                )}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
