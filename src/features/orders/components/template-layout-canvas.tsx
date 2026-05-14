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

const GAP = 28;
const FALLBACK_W = 900;
const FALLBACK_H = 500;
const BOUNDS_PADDING = 60;

// =============================================================================
// VERTICAL LAYOUT
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

// =============================================================================
// COMPONENT
// =============================================================================

export default function TemplateLayoutCanvas({
  items,
  zoom
}: TemplateLayoutCanvasProps) {
  const [positions, setPositions] = useState<Record<string, TemplatePosition>>(
    {}
  );
  const [hasMeasured, setHasMeasured] = useState(false);

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

  // ── Recompute layout from current measurements ──────────────────────
  const relayout = useCallback(() => {
    const ids = items.map((i) => i.id);
    setPositions(verticalLayout(ids, mH.current));
  }, [items]);

  // ── First render: measure → position ────────────────────────────────
  useLayoutEffect(() => {
    if (items.length === 0) return;
    measure();
    relayout();
    setHasMeasured(true);
  }, [items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Post-paint re-measure ───────────────────────────────────────────
  useEffect(() => {
    if (!hasMeasured || items.length === 0) return;
    const timer = setTimeout(() => {
      const changed = measure();
      if (changed) relayout();
    }, 150);
    return () => clearTimeout(timer);
  }, [hasMeasured, items, measure, relayout]);

  // ══════════════════════════════════════════════════════════════════════
  // RESIZE OBSERVER — re-measure & re-layout when any card changes size
  //
  // This is the key fix: when content inside a card changes (e.g. rows
  // are toggled via the visibility dropdown), the card's height changes.
  // Without this observer, the layout positions stay stale and cards
  // overlap. The observer detects the size change, re-measures all cards,
  // and recomputes the vertical layout so everything shifts properly.
  // ══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!hasMeasured || items.length === 0) return;

    let rafId: number | null = null;

    const handleResize = () => {
      // Debounce via rAF to batch multiple simultaneous resizes
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const changed = measure();
        if (changed) relayout();
      });
    };

    const observer = new ResizeObserver(handleResize);

    // Observe all card elements
    items.forEach((item) => {
      const el = cardRefs.current[item.id];
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [hasMeasured, items, measure, relayout]);

  // ══════════════════════════════════════════════════════════════════════
  // COMPUTE CARD CONTAINER BOUNDS
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
  // RENDER
  // ══════════════════════════════════════════════════════════════════════
  return (
    <div
      className='relative'
      style={{
        minWidth: containerBounds.width,
        minHeight: containerBounds.height
      }}
    >
      {items.map((item) => {
        const pos = positions[item.id] || { x: 0, y: 0 };

        return (
          <div
            key={item.id}
            ref={(el) => {
              cardRefs.current[item.id] = el;
            }}
            className='absolute top-0 left-0 z-10 shadow-sm'
            style={{
              transform: `translate(${pos.x}px, ${pos.y}px)`,
              opacity: hasMeasured ? 1 : 0
            }}
          >
            {/* Header */}
            <div className='bg-muted/80 flex items-center gap-2 rounded-t-lg border border-b-0 px-3 py-1.5 select-none'>
              <span className='text-muted-foreground truncate text-xs font-medium'>
                {item.label}
              </span>
            </div>

            <div className='relative'>{item.children}</div>
          </div>
        );
      })}
    </div>
  );
}
