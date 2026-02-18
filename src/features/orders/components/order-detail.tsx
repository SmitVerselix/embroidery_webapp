'use client';

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type WheelEvent as ReactWheelEvent,
  type TouchEvent as ReactTouchEvent
} from 'react';
import { useRouter } from 'next/navigation';
import { getOrder, updateOrderValues } from '@/lib/api/services';
import { getError } from '@/lib/api/axios';
import type {
  OrderWithDetails,
  TemplateWithDetails,
  OrderTemplateData,
  UpdateOrderValuesData,
  OrderValue
} from '@/lib/api/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  AlertCircle,
  Pencil,
  Copy,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Loader2
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import OrderTemplateValues, {
  type TemplateValuesMap
} from './order-template-values';
import type { ExtraValuesMap } from './order-extra-values';
import { toast } from 'sonner';

// =============================================================================
// HELPERS
// =============================================================================

const getStatusBadgeVariant = (status: string | null) => {
  switch (status) {
    case 'APPROVED':
    case 'COMPLETED':
      return 'default' as const;
    case 'PENDING':
      return 'secondary' as const;
    case 'REJECTED':
    case 'CANCELLED':
      return 'destructive' as const;
    default:
      return 'outline' as const;
  }
};

const getOrderTypeBadgeVariant = (type: string) => {
  switch (type) {
    case 'PRODUCTION':
      return 'default' as const;
    case 'SAMPLE':
      return 'secondary' as const;
    default:
      return 'outline' as const;
  }
};

// =============================================================================
// ZOOM / PAN CONSTANTS
// =============================================================================

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.25;
const SCROLL_ZOOM_FACTOR = 0.001;

// =============================================================================
// INTERNAL TYPES
// =============================================================================

type OrderTemplateSummary = {
  id: string;
  total: string;
  discount: string | null;
  discountAmount: string;
  discountType: string | null;
  finalPayableAmount: string;
};

type OrderTemplateEntry = {
  orderTemplateId: string;
  templateId: string;
  template: TemplateWithDetails;
  parentOrderTemplateId: string | null;
  isChild: boolean;
  summary: OrderTemplateSummary | null;
  /** true when the product template has no corresponding order-template yet */
  isNew?: boolean;
};

// =============================================================================
// PROPS
// =============================================================================

interface OrderDetailProps {
  companyId: string;
  orderId: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function OrderDetail({ companyId, orderId }: OrderDetailProps) {
  const router = useRouter();

  const [order, setOrder] = useState<OrderWithDetails | null>(null);
  const [entries, setEntries] = useState<OrderTemplateEntry[]>([]);
  const [templateValues, setTemplateValues] = useState<
    Record<string, TemplateValuesMap>
  >({});
  const [extraValues, setExtraValues] = useState<
    Record<string, ExtraValuesMap>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  /** Track which templateIds are currently being duplicated */
  const [duplicatingIds, setDuplicatingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // ── Zoom & Pan state ──────────────────────────────────────────────────
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isFitted, setIsFitted] = useState(true);
  const [isCanvasFocused, setIsCanvasFocused] = useState(false);

  const dragStart = useRef({ x: 0, y: 0 });
  const positionStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const lastPinchDist = useRef<number | null>(null);

  // ──────────────────────────────────────────────────────────────────────
  // PROCESS TEMPLATE DATA (handles parent + children + missing templates)
  // ──────────────────────────────────────────────────────────────────────
  const processOrderTemplates = useCallback((orderData: OrderWithDetails) => {
    const productTemplates = (orderData.product?.templates ||
      []) as TemplateWithDetails[];

    // Nothing to show if the product itself has no templates
    if (productTemplates.length === 0) {
      setEntries([]);
      setTemplateValues({});
      setExtraValues({});
      return;
    }

    const templateCache: Record<string, TemplateWithDetails> = {};
    for (const tmpl of productTemplates) {
      templateCache[tmpl.id] = tmpl;
    }

    const loadedEntries: OrderTemplateEntry[] = [];
    const loadedValues: Record<string, TemplateValuesMap> = {};
    const loadedExtraValues: Record<string, ExtraValuesMap> = {};

    /** Track which product templateIds already have order data */
    const processedTemplateIds = new Set<string>();

    const processTemplate = (
      tmplData: OrderTemplateData,
      parentOrderTemplateId: string | null,
      isChild: boolean
    ) => {
      const orderTemplateId = tmplData.id;
      const fullTemplate = templateCache[tmplData.templateId];
      if (!fullTemplate) return;

      processedTemplateIds.add(tmplData.templateId);

      // Extract summary
      const rawSummary = (tmplData as any).summary;
      const summary: OrderTemplateSummary | null = rawSummary
        ? {
            id: rawSummary.id,
            total: rawSummary.total ?? '0.0000',
            discount: rawSummary.discount ?? null,
            discountAmount: rawSummary.discountAmount ?? '0.0000',
            discountType: rawSummary.discountType ?? null,
            finalPayableAmount: rawSummary.finalPayableAmount ?? '0.0000'
          }
        : null;

      loadedEntries.push({
        orderTemplateId,
        templateId: tmplData.templateId,
        template: fullTemplate,
        parentOrderTemplateId,
        isChild,
        summary
      });

      const valuesMap: TemplateValuesMap = {};
      (tmplData.values || []).forEach((v) => {
        if (!valuesMap[v.rowId]) valuesMap[v.rowId] = {};
        valuesMap[v.rowId][v.columnId] = v.value ?? v.calculatedValue ?? '';
      });
      loadedValues[orderTemplateId] = valuesMap;

      const extValMap: ExtraValuesMap = {};
      (tmplData.extraValues || []).forEach((ev) => {
        extValMap[ev.templateExtraFieldId] = {
          value: ev.value,
          orderExtraValueId: ev.id,
          orderIndex: ev.orderIndex
        };
      });
      loadedExtraValues[orderTemplateId] = extValMap;

      if (tmplData.children && tmplData.children.length > 0) {
        tmplData.children.forEach((child) => {
          processTemplate(child, orderTemplateId, true);
        });
      }
    };

    // Process existing order templates
    (orderData.templates || []).forEach((tmplData: OrderTemplateData) => {
      processTemplate(tmplData, null, false);
    });

    // Add entries for product templates that don't have order data yet
    for (const tmpl of productTemplates) {
      if (!processedTemplateIds.has(tmpl.id)) {
        const tempKey = `new_${tmpl.id}`;
        loadedEntries.push({
          orderTemplateId: tempKey,
          templateId: tmpl.id,
          template: tmpl,
          parentOrderTemplateId: null,
          isChild: false,
          summary: null,
          isNew: true
        });
        loadedValues[tempKey] = {};
        loadedExtraValues[tempKey] = {};
      }
    }

    setEntries(loadedEntries);
    setTemplateValues(loadedValues);
    setExtraValues(loadedExtraValues);
  }, []);

  // ──────────────────────────────────────────────────────────────────────
  // FETCH ORDER
  // ──────────────────────────────────────────────────────────────────────
  const fetchOrder = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const orderData = await getOrder(companyId, orderId);
      setOrder(orderData);
      processOrderTemplates(orderData);
    } catch (err) {
      setError(getError(err));
    } finally {
      setIsLoading(false);
    }
  }, [companyId, orderId, processOrderTemplates]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // ──────────────────────────────────────────────────────────────────────
  // DUPLICATE TEMPLATE
  // ──────────────────────────────────────────────────────────────────────
  const handleDuplicate = useCallback(
    async (entry: OrderTemplateEntry) => {
      if (!order) return;

      const totalInstances = entries.filter(
        (e) => e.templateId === entry.templateId
      ).length;

      if (totalInstances >= 2) {
        toast.error('Maximum 2 templates allowed. Cannot duplicate further.');
        return;
      }

      setDuplicatingIds((prev) => new Set(prev).add(entry.templateId));

      try {
        const sourceValues = templateValues[entry.orderTemplateId] || {};
        const template = entry.template;

        const nonFormulaColumns = (template.columns || []).filter(
          (col) => col.dataType !== 'FORMULA'
        );

        // Build values array from current template data
        const buildValues = (src: TemplateValuesMap): OrderValue[] => {
          const vals: OrderValue[] = [];
          for (const row of template.rows || []) {
            for (const col of nonFormulaColumns) {
              const val = src[row.id]?.[col.id];
              if (val !== undefined && val !== '') {
                vals.push({ value: val, rowId: row.id, columnId: col.id });
              }
            }
          }
          return vals;
        };

        // Build extra values array
        const buildExtraValues = (src: ExtraValuesMap) => {
          return Object.entries(src).map(([templateExtraFieldId, ev]) => ({
            templateExtraFieldId,
            value: ev.value,
            orderExtraValueId: ev.orderExtraValueId,
            orderIndex: ev.orderIndex ?? 0
          }));
        };

        const values = buildValues(sourceValues);
        const extValues = buildExtraValues(
          extraValues[entry.orderTemplateId] || {}
        );

        let payload: UpdateOrderValuesData;

        if (entry.isNew) {
          // For templates without existing order data:
          // Send parent + child together using the children array
          payload = {
            templates: [
              {
                templateId: entry.templateId,
                values: values,
                ...(extValues.length > 0 ? { extravalues: extValues } : {}),
                children: [
                  {
                    templateId: entry.templateId,
                    values: values,
                    ...(extValues.length > 0 ? { extravalues: extValues } : {})
                  }
                ]
              }
            ]
          };
        } else {
          // For templates with existing order data:
          // Attach the duplicate as a child of the existing parent
          const parentEntry = entries.find(
            (e) => e.templateId === entry.templateId && !e.isChild
          );
          if (!parentEntry) return;

          payload = {
            templates: [
              {
                templateId: entry.templateId,
                parentOrderTemplateId: parentEntry.orderTemplateId,
                values: values,
                ...(extValues.length > 0 ? { extravalues: extValues } : {})
              }
            ]
          };
        }

        await updateOrderValues(companyId, orderId, payload);
        toast.success('Template duplicated successfully');

        const orderData = await getOrder(companyId, orderId);
        setOrder(orderData);
        processOrderTemplates(orderData);
      } catch (err) {
        toast.error(getError(err) || 'Failed to duplicate template');
      } finally {
        setDuplicatingIds((prev) => {
          const next = new Set(prev);
          next.delete(entry.templateId);
          return next;
        });
      }
    },
    [
      order,
      entries,
      templateValues,
      extraValues,
      companyId,
      orderId,
      processOrderTemplates
    ]
  );

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

  const handleToggleFit = useCallback(() => {
    if (isFitted) {
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      setIsFitted(false);
    } else {
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      setIsFitted(true);
    }
  }, [isFitted]);

  // ──────────────────────────────────────────────────────────────────────
  // CTRL + SCROLL WHEEL ZOOM
  // ──────────────────────────────────────────────────────────────────────
  const handleWheel = useCallback(
    (e: ReactWheelEvent<HTMLDivElement>) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      e.stopPropagation();
      const delta = -e.deltaY * SCROLL_ZOOM_FACTOR;
      setZoom((z) => clampZoom(z + delta * z));
      setIsFitted(false);
    },
    [clampZoom]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const preventNativeZoom = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };
    container.addEventListener('wheel', preventNativeZoom, { passive: false });
    return () => container.removeEventListener('wheel', preventNativeZoom);
  }, [entries.length]);

  // ──────────────────────────────────────────────────────────────────────
  // MOUSE DRAG / PAN
  // ──────────────────────────────────────────────────────────────────────
  const handleMouseDown = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (
        target.closest('button') ||
        target.closest('a') ||
        target.closest('input') ||
        target.closest('select') ||
        target.closest('textarea')
      )
        return;
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
        y: positionStart.current.y + dy
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
        const target = e.target as HTMLElement;
        if (
          target.closest('button') ||
          target.closest('a') ||
          target.closest('input') ||
          target.closest('select') ||
          target.closest('textarea')
        )
          return;
        setIsDragging(true);
        dragStart.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY
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
      if (e.touches.length === 1 && isDragging) {
        const dx = e.touches[0].clientX - dragStart.current.x;
        const dy = e.touches[0].clientY - dragStart.current.y;
        setPosition({
          x: positionStart.current.x + dx,
          y: positionStart.current.y + dy
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
  const handleDoubleClick = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (
        target.closest('button') ||
        target.closest('a') ||
        target.closest('input') ||
        target.closest('select') ||
        target.closest('textarea')
      )
        return;
      if (zoom > 1.1) {
        setZoom(1);
        setPosition({ x: 0, y: 0 });
        setIsFitted(true);
      } else {
        setZoom(2.5);
        setIsFitted(false);
      }
    },
    [zoom]
  );

  // ──────────────────────────────────────────────────────────────────────
  // KEYBOARD SHORTCUTS (+/= zoom in, -/_ zoom out, 0 toggle fit)
  // ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isCanvasFocused) return;
    const handleKeyDown = (e: KeyboardEvent) => {
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
          handleToggleFit();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCanvasFocused, handleZoomIn, handleZoomOut, handleToggleFit]);

  // ──────────────────────────────────────────────────────────────────────
  // HELPERS
  // ──────────────────────────────────────────────────────────────────────
  const canDuplicate = useCallback(
    (templateId: string) => {
      const count = entries.filter((e) => e.templateId === templateId).length;
      return count < 2;
    },
    [entries]
  );

  const backUrl = `/dashboard/${companyId}/orders`;
  const editUrl = `/dashboard/${companyId}/orders/${orderId}/edit`;
  const zoomPercent = Math.round(zoom * 100);

  // ──────────────────────────────────────────────────────────────────────
  // LOADING
  // ──────────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className='space-y-6'>
        <Skeleton className='h-5 w-32' />
        <Card>
          <CardHeader>
            <Skeleton className='h-6 w-40' />
            <Skeleton className='h-4 w-64' />
          </CardHeader>
          <CardContent className='space-y-3'>
            <Skeleton className='h-5 w-full' />
            <Skeleton className='h-5 w-3/4' />
            <Skeleton className='h-48 w-full' />
          </CardContent>
        </Card>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────
  // ERROR
  // ──────────────────────────────────────────────────────────────────────
  if (error || !order) {
    return (
      <div className='space-y-6'>
        <Link
          href={backUrl}
          className='text-muted-foreground hover:text-foreground inline-flex items-center text-sm'
        >
          <ArrowLeft className='mr-2 h-4 w-4' />
          Back to Orders
        </Link>
        <div className='flex flex-col items-center justify-center space-y-4 py-10'>
          <div className='bg-destructive/15 rounded-full p-3'>
            <AlertCircle className='text-destructive h-6 w-6' />
          </div>
          <div className='space-y-2 text-center'>
            <h3 className='font-semibold'>Failed to load order</h3>
            <p className='text-muted-foreground text-sm'>
              {error || 'Order not found'}
            </p>
          </div>
          <Button variant='outline' onClick={() => router.push(backUrl)}>
            Back to Orders
          </Button>
        </div>
      </div>
    );
  }

  // Group entries by templateId
  const groupedByTemplate: Record<string, OrderTemplateEntry[]> = {};
  entries.forEach((entry) => {
    if (!groupedByTemplate[entry.templateId]) {
      groupedByTemplate[entry.templateId] = [];
    }
    groupedByTemplate[entry.templateId].push(entry);
  });

  // ──────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────
  return (
    <div className='space-y-6'>
      {/* Back */}
      <Link
        href={backUrl}
        className='text-muted-foreground hover:text-foreground inline-flex items-center text-sm'
      >
        <ArrowLeft className='mr-2 h-4 w-4' />
        Back to Orders
      </Link>

      {/* Order Info Card */}
      <Card>
        <CardHeader>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
            <div className='space-y-1'>
              <CardTitle className='flex items-center gap-3 text-2xl'>
                Order #{order.orderNo}
                <Badge variant={getOrderTypeBadgeVariant(order.orderType)}>
                  {order.orderType}
                </Badge>
                <Badge variant={getStatusBadgeVariant(order.status)}>
                  {order.status || 'DRAFT'}
                </Badge>
              </CardTitle>
              {order.description && (
                <CardDescription>{order.description}</CardDescription>
              )}
            </div>
            <Button variant='outline' onClick={() => router.push(editUrl)}>
              <Pencil className='mr-2 h-4 w-4' />
              Edit Order
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-2 gap-4 text-sm md:grid-cols-4'>
            <div>
              <span className='text-muted-foreground'>Product Name</span>
              <p className='font-medium'>{order.product?.name ?? '-'}</p>
            </div>
            <div>
              <span className='text-muted-foreground'>Customer Name</span>
              <p className='font-medium'>{order.customer?.name ?? '-'}</p>
            </div>
            <div>
              <span className='text-muted-foreground'>Order No</span>
              <p className='font-medium'>{order.orderNo}</p>
            </div>
            <div>
              <span className='text-muted-foreground'>Type</span>
              <p className='font-medium'>{order.orderType}</p>
            </div>
            <div>
              <span className='text-muted-foreground'>Status</span>
              <p className='font-medium'>{order.status || 'DRAFT'}</p>
            </div>
            <div>
              <span className='text-muted-foreground'>Created</span>
              <p className='font-medium'>
                {new Date(order.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          {order.referenceNo && (
            <div className='mt-3 text-sm'>
              <span className='text-muted-foreground'>Reference No</span>
              <p className='font-medium'>{order.referenceNo}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ────────────────────────────────────────────────────────────────
          TEMPLATE VALUES — Zoomable / Pannable Canvas
      ──────────────────────────────────────────────────────────────── */}
      {entries.length > 0 && (
        <>
          <Separator />

          {/* ── Top toolbar ───────────────────────────────────────── */}
          <div className='bg-muted/60 flex items-center justify-between rounded-lg border px-4 py-2.5'>
            <div className='flex min-w-0 items-center gap-3'>
              <h2 className='truncate text-sm font-semibold'>
                Template Values
              </h2>
              <span className='text-muted-foreground hidden text-xs sm:inline'>
                Values entered for this order&apos;s templates
              </span>
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

              <CanvasToolbarButton
                onClick={handleToggleFit}
                title={isFitted ? 'Actual size' : 'Fit to screen (0)'}
              >
                {isFitted ? (
                  <Maximize2 className='h-3.5 w-3.5' />
                ) : (
                  <Minimize2 className='h-3.5 w-3.5' />
                )}
              </CanvasToolbarButton>
            </div>

            <div className='w-20' />
          </div>

          {/* ── Canvas container ──────────────────────────────────── */}
          <div
            ref={containerRef}
            tabIndex={0}
            className={cn(
              'bg-muted/30 relative overflow-auto rounded-xl border outline-none',
              'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2',
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            )}
            style={{ minHeight: '500px' }}
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
              className={cn(
                'origin-top-left p-6',
                !isDragging && 'transition-transform duration-150 ease-out'
              )}
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                transformOrigin: 'top left'
              }}
            >
              <div className='space-y-6'>
                {Object.entries(groupedByTemplate).map(
                  ([templateId, templateEntries]) => {
                    const parentEntry = templateEntries.find((e) => !e.isChild);
                    const childEntries = templateEntries.filter(
                      (e) => e.isChild
                    );
                    const duplicateAllowed = canDuplicate(templateId);

                    return (
                      <div key={templateId} className='space-y-4'>
                        {/* Parent Template */}
                        {parentEntry && (
                          <div className='relative'>
                            <div className='mb-2 flex items-center justify-between'>
                              <div className='flex items-center gap-2'>
                                <Badge
                                  variant='outline'
                                  className='text-xs font-normal'
                                >
                                  Parent Template
                                </Badge>
                                {parentEntry.isNew && (
                                  <Badge
                                    variant='secondary'
                                    className='text-xs font-normal'
                                  >
                                    No values yet
                                  </Badge>
                                )}
                              </div>
                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant='outline'
                                      size='sm'
                                      disabled={
                                        !duplicateAllowed ||
                                        duplicatingIds.has(templateId)
                                      }
                                      onClick={() =>
                                        handleDuplicate(parentEntry)
                                      }
                                      className='gap-1.5'
                                    >
                                      {duplicatingIds.has(templateId) ? (
                                        <Loader2 className='h-3.5 w-3.5 animate-spin' />
                                      ) : (
                                        <Copy className='h-3.5 w-3.5' />
                                      )}
                                      Duplicate
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side='left'>
                                    {duplicateAllowed
                                      ? 'Duplicate this template with copied values'
                                      : 'Maximum 2 templates reached'}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <OrderTemplateValues
                              template={parentEntry.template}
                              values={
                                templateValues[parentEntry.orderTemplateId] ||
                                {}
                              }
                              onChange={() => {}}
                              readOnly
                              extraValues={
                                extraValues[parentEntry.orderTemplateId] || {}
                              }
                              onExtraValuesChange={() => {}}
                              summary={parentEntry.summary ?? {}}
                            />
                          </div>
                        )}

                        {/* Child Templates (duplicates) */}
                        {childEntries.map((childEntry, idx) => (
                          <div key={childEntry.orderTemplateId}>
                            <div className='mb-2 flex items-center gap-2'>
                              <Badge
                                variant='secondary'
                                className='text-xs font-normal'
                              >
                                Duplicate #{idx + 1}
                              </Badge>
                            </div>
                            <OrderTemplateValues
                              template={childEntry.template}
                              values={
                                templateValues[childEntry.orderTemplateId] || {}
                              }
                              onChange={() => {}}
                              readOnly
                              extraValues={
                                extraValues[childEntry.orderTemplateId] || {}
                              }
                              onExtraValuesChange={() => {}}
                              summary={childEntry.summary ?? {}}
                            />
                          </div>
                        ))}
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          </div>

          {/* ── Bottom hint bar ───────────────────────────────────── */}
          <div className='bg-muted/40 flex items-center justify-center rounded-lg border px-4 py-2'>
            <p className='text-muted-foreground text-[11px] select-none'>
              Drag to pan · Double-click to toggle zoom · Pinch to zoom on touch
              ·{' '}
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
      )}
    </div>
  );
}

// =============================================================================
// CANVAS TOOLBAR BUTTON
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
  children: React.ReactNode;
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
