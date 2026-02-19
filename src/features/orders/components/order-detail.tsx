'use client';

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import OrderTemplateValues, {
  type TemplateValuesMap
} from './order-template-values';
import type { ExtraValuesMap } from './order-extra-values';
import TemplateLayoutCanvas, {
  type TemplateLayoutItem
} from './template-layout-canvas';
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
// ZOOM CONSTANTS
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
  const [duplicatingIds, setDuplicatingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // ── Duplicate confirmation dialog ───────────────────────────────────
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [pendingDuplicateEntry, setPendingDuplicateEntry] =
    useState<OrderTemplateEntry | null>(null);

  // ── Zoom state ──────────────────────────────────────────────────────
  const [zoom, setZoom] = useState(1);
  const [isCanvasFocused, setIsCanvasFocused] = useState(false);
  const [isTemplateDragging, setIsTemplateDragging] = useState(false);

  // ── Drag-to-scroll state ────────────────────────────────────────────
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const scrollStart = useRef({ left: 0, top: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const lastPinchDist = useRef<number | null>(null);

  /** Layout toolbar portals into this div (sits outside the canvas). */
  const toolbarPortalRef = useRef<HTMLDivElement>(null);

  // ──────────────────────────────────────────────────────────────────────
  // PROCESS TEMPLATE DATA
  // ──────────────────────────────────────────────────────────────────────
  const processOrderTemplates = useCallback((orderData: OrderWithDetails) => {
    const productTemplates = (orderData.product?.templates ||
      []) as TemplateWithDetails[];

    if (productTemplates.length === 0) {
      setEntries([]);
      setTemplateValues({});
      setExtraValues({});
      return;
    }

    const templateCache: Record<string, TemplateWithDetails> = {};
    for (const tmpl of productTemplates) templateCache[tmpl.id] = tmpl;

    const loadedEntries: OrderTemplateEntry[] = [];
    const loadedValues: Record<string, TemplateValuesMap> = {};
    const loadedExtraValues: Record<string, ExtraValuesMap> = {};
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
        tmplData.children.forEach((child) =>
          processTemplate(child, orderTemplateId, true)
        );
      }
    };

    (orderData.templates || []).forEach((tmplData: OrderTemplateData) =>
      processTemplate(tmplData, null, false)
    );

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

  // ── FETCH ORDER ─────────────────────────────────────────────────────
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
  // DUPLICATE: confirm → execute
  // ──────────────────────────────────────────────────────────────────────
  const requestDuplicate = useCallback(
    (entry: OrderTemplateEntry) => {
      const count = entries.filter(
        (e) => e.templateId === entry.templateId
      ).length;
      if (count >= 2) {
        toast.error('Maximum 2 templates allowed. Cannot duplicate further.');
        return;
      }
      setPendingDuplicateEntry(entry);
      setDuplicateDialogOpen(true);
    },
    [entries]
  );

  const executeDuplicate = useCallback(async () => {
    const entry = pendingDuplicateEntry;
    if (!entry || !order) return;
    setDuplicateDialogOpen(false);
    setPendingDuplicateEntry(null);
    setDuplicatingIds((prev) => new Set(prev).add(entry.templateId));

    try {
      const sourceValues = templateValues[entry.orderTemplateId] || {};
      const template = entry.template;
      const nonFormulaCols = (template.columns || []).filter(
        (c) => c.dataType !== 'FORMULA'
      );

      const buildValues = (src: TemplateValuesMap): OrderValue[] => {
        const vals: OrderValue[] = [];
        for (const row of template.rows || [])
          for (const col of nonFormulaCols) {
            const v = src[row.id]?.[col.id];
            if (v !== undefined && v !== '')
              vals.push({ value: v, rowId: row.id, columnId: col.id });
          }
        return vals;
      };

      const buildExtra = (src: ExtraValuesMap) =>
        Object.entries(src).map(([fid, ev]) => ({
          templateExtraFieldId: fid,
          value: ev.value,
          orderExtraValueId: ev.orderExtraValueId,
          orderIndex: ev.orderIndex ?? 0
        }));

      const values = buildValues(sourceValues);
      const extValues = buildExtra(extraValues[entry.orderTemplateId] || {});

      let payload: UpdateOrderValuesData;

      if (entry.isNew) {
        payload = {
          templates: [
            {
              templateId: entry.templateId,
              values,
              ...(extValues.length > 0 ? { extravalues: extValues } : {}),
              children: [
                {
                  templateId: entry.templateId,
                  values,
                  ...(extValues.length > 0 ? { extravalues: extValues } : {})
                }
              ]
            }
          ]
        };
      } else {
        const parentEntry = entries.find(
          (e) => e.templateId === entry.templateId && !e.isChild
        );
        if (!parentEntry) return;
        payload = {
          templates: [
            {
              templateId: entry.templateId,
              parentOrderTemplateId: parentEntry.orderTemplateId,
              values,
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
  }, [
    pendingDuplicateEntry,
    order,
    entries,
    templateValues,
    extraValues,
    companyId,
    orderId,
    processOrderTemplates
  ]);

  const cancelDuplicate = useCallback(() => {
    setDuplicateDialogOpen(false);
    setPendingDuplicateEntry(null);
  }, []);

  // ──────────────────────────────────────────────────────────────────────
  // ZOOM HELPERS
  // ──────────────────────────────────────────────────────────────────────
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

  // ── CTRL + SCROLL WHEEL ZOOM (only inside the canvas) ──────────────
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

  // Prevent browser's own zoom when Ctrl+scrolling inside the canvas
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
  // DRAG-TO-SCROLL (grab canvas and scroll)
  // ──────────────────────────────────────────────────────────────────────
  const handleMouseDown = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (isTemplateDragging) return;
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (
        target.closest('button') ||
        target.closest('a') ||
        target.closest('input') ||
        target.closest('select') ||
        target.closest('textarea') ||
        target.closest('[data-drag-handle]')
      )
        return;
      e.preventDefault();
      setIsDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY };
      scrollStart.current = {
        left: containerRef.current?.scrollLeft ?? 0,
        top: containerRef.current?.scrollTop ?? 0
      };
    },
    [isTemplateDragging]
  );

  const handleMouseMove = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (!isDragging || isTemplateDragging || !containerRef.current) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      containerRef.current.scrollLeft = scrollStart.current.left - dx;
      containerRef.current.scrollTop = scrollStart.current.top - dy;
    },
    [isDragging, isTemplateDragging]
  );

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  // ── TOUCH PAN + PINCH-TO-ZOOM ──────────────────────────────────────
  const getTouchDist = (t1: React.Touch, t2: React.Touch): number => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback(
    (e: ReactTouchEvent<HTMLDivElement>) => {
      if (isTemplateDragging) return;
      if (e.touches.length === 1) {
        const target = e.target as HTMLElement;
        if (
          target.closest('button') ||
          target.closest('a') ||
          target.closest('input') ||
          target.closest('select') ||
          target.closest('textarea') ||
          target.closest('[data-drag-handle]')
        )
          return;
        setIsDragging(true);
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
    },
    [isTemplateDragging]
  );

  const handleTouchMove = useCallback(
    (e: ReactTouchEvent<HTMLDivElement>) => {
      if (isTemplateDragging) return;
      if (e.touches.length === 1 && isDragging && containerRef.current) {
        const dx = e.touches[0].clientX - dragStart.current.x;
        const dy = e.touches[0].clientY - dragStart.current.y;
        containerRef.current.scrollLeft = scrollStart.current.left - dx;
        containerRef.current.scrollTop = scrollStart.current.top - dy;
      } else if (e.touches.length === 2 && lastPinchDist.current !== null) {
        const newDist = getTouchDist(e.touches[0], e.touches[1]);
        const scale = newDist / lastPinchDist.current;
        lastPinchDist.current = newDist;
        setZoom((z) => clampZoom(z * scale));
      }
    },
    [isDragging, isTemplateDragging, clampZoom]
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    lastPinchDist.current = null;
  }, []);

  // ── DOUBLE-CLICK ZOOM TOGGLE ────────────────────────────────────────
  const handleDoubleClick = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (
        target.closest('button') ||
        target.closest('a') ||
        target.closest('input') ||
        target.closest('select') ||
        target.closest('textarea') ||
        target.closest('[data-drag-handle]')
      )
        return;
      setZoom((z) => (z > 1.1 ? 1 : 2.5));
    },
    []
  );

  // ── KEYBOARD SHORTCUTS ──────────────────────────────────────────────
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

  // ──────────────────────────────────────────────────────────────────────
  // HELPERS
  // ──────────────────────────────────────────────────────────────────────
  const canDuplicate = useCallback(
    (templateId: string) =>
      entries.filter((e) => e.templateId === templateId).length < 2,
    [entries]
  );

  const groupedByTemplate = useMemo(() => {
    const grouped: Record<string, OrderTemplateEntry[]> = {};
    entries.forEach((entry) => {
      if (!grouped[entry.templateId]) grouped[entry.templateId] = [];
      grouped[entry.templateId].push(entry);
    });
    return grouped;
  }, [entries]);

  const layoutItems: TemplateLayoutItem[] = useMemo(
    () =>
      Object.entries(groupedByTemplate).map(([templateId, templateEntries]) => {
        const parentEntry = templateEntries.find((e) => !e.isChild);
        const childEntries = templateEntries.filter((e) => e.isChild);
        const duplicateAllowed = canDuplicate(templateId);
        const templateName =
          parentEntry?.template?.name ||
          childEntries[0]?.template?.name ||
          templateId;

        return {
          id: templateId,
          label: templateName,
          children: (
            <div className='space-y-4'>
              {parentEntry && (
                <div className='relative'>
                  <div className='mb-2 flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                      <Badge variant='outline' className='text-xs font-normal'>
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
                            onClick={() => requestDuplicate(parentEntry)}
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
                    values={templateValues[parentEntry.orderTemplateId] || {}}
                    onChange={() => {}}
                    readOnly
                    extraValues={extraValues[parentEntry.orderTemplateId] || {}}
                    onExtraValuesChange={() => {}}
                    summary={parentEntry.summary ?? {}}
                  />
                </div>
              )}

              {childEntries.map((childEntry, idx) => (
                <div key={childEntry.orderTemplateId}>
                  <div className='mb-2 flex items-center gap-2'>
                    <Badge variant='secondary' className='text-xs font-normal'>
                      Duplicate #{idx + 1}
                    </Badge>
                  </div>
                  <OrderTemplateValues
                    template={childEntry.template}
                    values={templateValues[childEntry.orderTemplateId] || {}}
                    onChange={() => {}}
                    readOnly
                    extraValues={extraValues[childEntry.orderTemplateId] || {}}
                    onExtraValuesChange={() => {}}
                    summary={childEntry.summary ?? {}}
                  />
                </div>
              ))}
            </div>
          )
        };
      }),
    [
      groupedByTemplate,
      canDuplicate,
      duplicatingIds,
      templateValues,
      extraValues,
      requestDuplicate
    ]
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

  // ──────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────
  return (
    <div className='space-y-6'>
      {/* ── Duplicate Confirmation Dialog ─────────────────────────── */}
      <AlertDialog
        open={duplicateDialogOpen}
        onOpenChange={setDuplicateDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicate Template?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to duplicate the template
              {pendingDuplicateEntry?.template?.name
                ? ` "${pendingDuplicateEntry.template.name}"`
                : ''}
              ? This will create a copy with the same values.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDuplicate}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={executeDuplicate}>
              <Copy className='mr-2 h-4 w-4' />
              Yes, Duplicate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
          TEMPLATE VALUES SECTION
      ──────────────────────────────────────────────────────────────── */}
      {entries.length > 0 && (
        <>
          <Separator />

          {/* ── Top toolbar: zoom controls ─────────────────────────── */}
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
                onClick={handleResetView}
                title='Reset view (0)'
              >
                <Maximize2 className='h-3.5 w-3.5' />
              </CanvasToolbarButton>
            </div>

            <div className='w-20' />
          </div>

          {/* ── Layout toolbar portal (OUTSIDE the canvas) ─────────── */}
          <div
            ref={toolbarPortalRef}
            className='bg-muted/40 rounded-lg border px-4 py-2.5'
          />

          {/* ──────────────────────────────────────────────────────────
              CANVAS: 3-layer containment
              ─────────────────────────────────────────────────────────
              1. BOUNDARY — overflow:hidden, fixed size, isolation.
                 Its size comes from its own CSS, never from children.
                 Nothing can push the page wider or taller.

              2. SCROLL AREA — absolute inset:0, overflow:auto.
                 Fills the boundary exactly. Native scrollbars appear
                 when zoomed content exceeds the viewport.

              3. ZOOMER — CSS "zoom" property (not transform:scale).
                 Unlike transform, CSS zoom AFFECTS LAYOUT: content
                 physically takes up zoom × natural size. Scroll area
                 sees the real zoomed dimensions and scrolls correctly.
                 No sizer div needed. No bounds callbacks.
          ────────────────────────────────────────────────────────── */}
          <div
            className='bg-muted/30 relative isolate overflow-hidden rounded-xl border'
            style={{ height: '70vh', minHeight: '400px', maxHeight: '80vh' }}
          >
            <div
              ref={containerRef}
              tabIndex={0}
              className={cn(
                'absolute inset-0 overflow-auto outline-none',
                isTemplateDragging
                  ? 'cursor-default'
                  : isDragging
                    ? 'cursor-grabbing'
                    : 'cursor-grab'
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
              {/* Zoomer: CSS zoom property scales content AND layout.
                  Content physically occupies zoom × natural size.
                  The scroll area sees the real dimensions. */}
              <div
                className='origin-top-left p-6'
                style={{ zoom: zoom } as React.CSSProperties}
              >
                <TemplateLayoutCanvas
                  items={layoutItems}
                  persistKey={orderId}
                  zoom={zoom}
                  onTemplateDragStart={() => setIsTemplateDragging(true)}
                  onTemplateDragEnd={() => setIsTemplateDragging(false)}
                  toolbarPortalTarget={toolbarPortalRef}
                />
              </div>
            </div>
          </div>

          {/* ── Bottom hint bar ───────────────────────────────────── */}
          <div className='bg-muted/40 flex items-center justify-center rounded-lg border px-4 py-2'>
            <p className='text-muted-foreground text-[11px] select-none'>
              Scroll or drag to pan · Drag handle to reposition templates ·
              Double-click to toggle zoom · Pinch to zoom on touch ·{' '}
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
