'use client';

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
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
  UpdateOrderValuesTemplatePayload,
  UpdateOrderValueItem,
  OrderExtraValuePayload,
  OrderBlockValuePayload,
  DiscountType,
  TemplateSummaryPayload
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
  Loader2,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Save,
  ZoomIn,
  ZoomOut,
  Maximize2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import OrderTemplateValues, {
  type TemplateValuesMap,
  type BlockValuesMap
} from './order-template-values';
import type { ExtraValuesMap } from './order-extra-values';
import TemplateLayoutCanvas, {
  type TemplateLayoutItem
} from './template-layout-canvas';

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
// INTERNAL TYPES
// =============================================================================

type OrderTemplateEntry = {
  orderTemplateId: string;
  templateId: string;
  parentOrderTemplateId: string | null;
  template: TemplateWithDetails;
  isNew?: boolean;
};

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

// =============================================================================
// PROPS
// =============================================================================

interface OrderEditFormProps {
  companyId: string;
  orderId: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function OrderEditForm({
  companyId,
  orderId
}: OrderEditFormProps) {
  const router = useRouter();

  // Data state
  const [order, setOrder] = useState<OrderWithDetails | null>(null);
  const [entries, setEntries] = useState<OrderTemplateEntry[]>([]);
  const [templateValues, setTemplateValues] = useState<
    Record<string, TemplateValuesMap>
  >({});
  const [extraValues, setExtraValues] = useState<
    Record<string, ExtraValuesMap>
  >({});

  const [originalValueIds, setOriginalValueIds] = useState<
    Record<string, Record<string, string>>
  >({});
  const [originalExtraValueIds, setOriginalExtraValueIds] = useState<
    Record<string, Record<string, string>>
  >({});

  // Discount per template
  const [templateDiscounts, setTemplateDiscounts] = useState<
    Record<string, { discountType: DiscountType; discountValue: string }>
  >({});

  // Block values per template (keyed by orderTemplateId)
  const [templateBlockValues, setTemplateBlockValues] = useState<
    Record<string, BlockValuesMap>
  >({});

  // Loading / error
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Validation errors
  const [cellErrors, setCellErrors] = useState<
    Record<string, Record<string, string>>
  >({});
  const [extraFieldErrors, setExtraFieldErrors] = useState<
    Record<string, Record<string, string>>
  >({});

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Zoom state
  const [zoom, setZoom] = useState(1);
  const [isCanvasFocused, setIsCanvasFocused] = useState(false);
  const [isTemplateDragging, setIsTemplateDragging] = useState(false);

  // Drag-to-scroll state
  const [isDragging, setIsDragging] = useState(false);
  const dragPending = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const scrollStart = useRef({ left: 0, top: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const lastPinchDist = useRef<number | null>(null);
  const toolbarPortalRef = useRef<HTMLDivElement>(null);

  // ──────────────────────────────────────────────────────────────────────
  // FETCH ORDER
  // ──────────────────────────────────────────────────────────────────────
  const fetchOrder = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const orderData = await getOrder(companyId, orderId);
      setOrder(orderData);

      const templateCache: Record<string, TemplateWithDetails> = {};
      const productTemplates = (orderData.product?.templates ||
        []) as TemplateWithDetails[];
      for (const tmpl of productTemplates) {
        templateCache[tmpl.id] = tmpl;
      }

      const loadedEntries: OrderTemplateEntry[] = [];
      const loadedValues: Record<string, TemplateValuesMap> = {};
      const loadedExtraValues: Record<string, ExtraValuesMap> = {};
      const valueIdMap: Record<string, Record<string, string>> = {};
      const extraValueIdMap: Record<string, Record<string, string>> = {};
      const discountMap: Record<
        string,
        { discountType: DiscountType; discountValue: string }
      > = {};
      const loadedBlockValues: Record<string, BlockValuesMap> = {};

      const processedTemplateIds = new Set<string>();

      const processTemplate = (
        tmplData: OrderTemplateData,
        parentOrderTemplateId: string | null
      ) => {
        const orderTemplateId = tmplData.id;
        const fullTemplate = templateCache[tmplData.templateId];
        if (!fullTemplate) return;

        processedTemplateIds.add(tmplData.templateId);

        loadedEntries.push({
          orderTemplateId,
          templateId: tmplData.templateId,
          parentOrderTemplateId,
          template: fullTemplate
        });

        const valuesMap: TemplateValuesMap = {};
        const vIdMap: Record<string, string> = {};
        const colTypeMap: Record<string, string> = {};
        (fullTemplate.columns || []).forEach((col) => {
          colTypeMap[col.id] = col.dataType;
        });
        (tmplData.values || []).forEach((v) => {
          if (!valuesMap[v.rowId]) {
            valuesMap[v.rowId] = {};
          }
          let raw = v.calculatedValue ?? v.value ?? '';
          if (colTypeMap[v.columnId] === 'NUMBER' && raw !== '') {
            const num = parseFloat(raw);
            if (!isNaN(num)) {
              raw = num === 0 ? '0' : num.toFixed(2);
            }
          }
          valuesMap[v.rowId][v.columnId] = raw;
          vIdMap[`${v.rowId}-${v.columnId}`] = v.id;
        });
        loadedValues[orderTemplateId] = valuesMap;
        valueIdMap[orderTemplateId] = vIdMap;

        const extValMap: ExtraValuesMap = {};
        const evIdMap: Record<string, string> = {};
        (tmplData.extraValues || []).forEach((ev) => {
          extValMap[ev.templateExtraFieldId] = {
            value: ev.value,
            orderExtraValueId: ev.id,
            orderIndex: ev.orderIndex
          };
          evIdMap[ev.templateExtraFieldId] = ev.id;
        });
        loadedExtraValues[orderTemplateId] = extValMap;
        extraValueIdMap[orderTemplateId] = evIdMap;

        const bvMap: BlockValuesMap = {};
        ((tmplData as any).blockValues || []).forEach((bv: any) => {
          const idx = parseInt(
            (bv.blockIndex as string).replace('block_', ''),
            10
          );
          if (!isNaN(idx)) {
            bvMap[idx] = bv.templateBlockId;
          }
        });
        loadedBlockValues[orderTemplateId] = bvMap;

        const rawSummary = tmplData.summary;
        if (rawSummary) {
          discountMap[orderTemplateId] = {
            discountType:
              (rawSummary.discountType as DiscountType) || 'PERCENT',
            discountValue: rawSummary.discount ?? '0'
          };
        } else {
          discountMap[orderTemplateId] = {
            discountType: 'PERCENT',
            discountValue: '0'
          };
        }

        if (tmplData.children && tmplData.children.length > 0) {
          tmplData.children.forEach((child) => {
            processTemplate(child, orderTemplateId);
          });
        }
      };

      (orderData.templates || []).forEach((tmplData: OrderTemplateData) => {
        processTemplate(tmplData, null);
      });

      for (const tmpl of productTemplates) {
        if (!processedTemplateIds.has(tmpl.id)) {
          const tempKey = `new_${tmpl.id}`;
          loadedEntries.push({
            orderTemplateId: tempKey,
            templateId: tmpl.id,
            parentOrderTemplateId: null,
            template: tmpl,
            isNew: true
          });
          loadedValues[tempKey] = {};
          loadedExtraValues[tempKey] = {};
          valueIdMap[tempKey] = {};
          extraValueIdMap[tempKey] = {};
          discountMap[tempKey] = {
            discountType: 'PERCENT',
            discountValue: '0'
          };
          loadedBlockValues[tempKey] = {};
        }
      }

      setEntries(loadedEntries);
      setTemplateValues(loadedValues);
      setExtraValues(loadedExtraValues);
      setOriginalValueIds(valueIdMap);
      setOriginalExtraValueIds(extraValueIdMap);
      setTemplateDiscounts(discountMap);
      setTemplateBlockValues(loadedBlockValues);
    } catch (err) {
      setError(getError(err));
    } finally {
      setIsLoading(false);
    }
  }, [companyId, orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // ──────────────────────────────────────────────────────────────────────
  // VALUE CHANGE HANDLERS
  // ──────────────────────────────────────────────────────────────────────
  const handleTemplateValuesChange = useCallback(
    (orderTemplateId: string, values: TemplateValuesMap) => {
      setTemplateValues((prev) => ({ ...prev, [orderTemplateId]: values }));
      setCellErrors((prev) => ({ ...prev, [orderTemplateId]: {} }));
      setSaveSuccess(false);
    },
    []
  );

  const handleExtraValuesChange = useCallback(
    (orderTemplateId: string, values: ExtraValuesMap) => {
      setExtraValues((prev) => ({ ...prev, [orderTemplateId]: values }));
      setExtraFieldErrors((prev) => ({ ...prev, [orderTemplateId]: {} }));
      setSaveSuccess(false);
    },
    []
  );

  const handleDiscountChange = useCallback(
    (orderTemplateId: string, type: DiscountType, value: string) => {
      setTemplateDiscounts((prev) => ({
        ...prev,
        [orderTemplateId]: { discountType: type, discountValue: value }
      }));
      setSaveSuccess(false);
    },
    []
  );

  const handleBlockValuesChange = useCallback(
    (orderTemplateId: string, values: BlockValuesMap) => {
      setTemplateBlockValues((prev) => ({
        ...prev,
        [orderTemplateId]: values
      }));
      setSaveSuccess(false);
    },
    []
  );

  // ──────────────────────────────────────────────────────────────────────
  // VALIDATION
  // ──────────────────────────────────────────────────────────────────────
  const validateAll = useCallback((): boolean => {
    let isValid = true;

    const newCellErrors: Record<string, Record<string, string>> = {};
    entries.forEach((entry) => {
      const tmpl = entry.template;
      const tmplErrors: Record<string, string> = {};
      const tmplValues = templateValues[entry.orderTemplateId] || {};
      const columns = tmpl.columns || [];
      const rows = tmpl.rows || [];

      rows.forEach((row) => {
        columns.forEach((col) => {
          if (col.dataType === 'FORMULA') return;
          const value = tmplValues[row.id]?.[col.id] || '';
          const cellKey = `${row.id}-${col.id}`;
          if (col.isRequired && !value.trim()) {
            tmplErrors[cellKey] = 'Required';
            isValid = false;
            return;
          }
          if (col.dataType === 'NUMBER' && value.trim()) {
            const num = Number(value);
            if (isNaN(num)) {
              tmplErrors[cellKey] = 'Must be a number';
              isValid = false;
            }
          }
        });
      });
      newCellErrors[entry.orderTemplateId] = tmplErrors;
    });
    setCellErrors(newCellErrors);

    const newExtraErrors: Record<string, Record<string, string>> = {};
    entries.forEach((entry) => {
      const tmpl = entry.template;
      const extErrors: Record<string, string> = {};
      const extras = tmpl.extra || [];
      const tmplExtraValues = extraValues[entry.orderTemplateId] || {};

      extras.forEach((extra) => {
        const val = tmplExtraValues[extra.id]?.value || '';
        if (extra.isRequired && !val.trim()) {
          extErrors[extra.id] = 'Required';
          isValid = false;
          return;
        }
        if (extra.valueType === 'NUMBER' && val.trim()) {
          const num = Number(val);
          if (isNaN(num)) {
            extErrors[extra.id] = 'Must be a number';
            isValid = false;
          }
        }
      });
      newExtraErrors[entry.orderTemplateId] = extErrors;
    });
    setExtraFieldErrors(newExtraErrors);

    return isValid;
  }, [entries, templateValues, extraValues]);

  // ──────────────────────────────────────────────────────────────────────
  // HELPER: Build blockvalues payload
  // ──────────────────────────────────────────────────────────────────────
  const buildBlockValuesPayload = useCallback(
    (bvMap: BlockValuesMap): OrderBlockValuePayload[] => {
      const result: OrderBlockValuePayload[] = [];
      Object.entries(bvMap).forEach(([blockIdx, templateBlockId]) => {
        if (templateBlockId) {
          result.push({
            templateBlockId,
            blockIndex: `block_${blockIdx}`
          });
        }
      });
      return result;
    },
    []
  );

  // ──────────────────────────────────────────────────────────────────────
  // SUBMIT
  // ──────────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitError(null);
    setSaveSuccess(false);

    if (!validateAll()) {
      setSubmitError('Please fix the validation errors before saving.');
      return;
    }

    setIsSubmitting(true);

    try {
      const topLevelEntries = entries.filter(
        (e) => e.parentOrderTemplateId === null
      );

      const buildTemplatePayload = (
        entry: OrderTemplateEntry
      ): UpdateOrderValuesTemplatePayload => {
        const tmpl = entry.template;
        const tmplValues = templateValues[entry.orderTemplateId] || {};
        const columns = tmpl.columns || [];
        const rows = tmpl.rows || [];
        const origIds = originalValueIds[entry.orderTemplateId] || {};
        const origExIds = originalExtraValueIds[entry.orderTemplateId] || {};
        const tmplExtras = tmpl.extra || [];
        const tmplExtraValues = extraValues[entry.orderTemplateId] || {};

        const values: UpdateOrderValueItem[] = [];
        const usedOriginalIds = new Set<string>();

        rows.forEach((row) => {
          columns.forEach((col) => {
            if (col.dataType === 'FORMULA') return;
            const value = tmplValues[row.id]?.[col.id] || '';
            const cellKey = `${row.id}-${col.id}`;
            const existingValueId = origIds[cellKey];

            if (value.trim() || existingValueId) {
              values.push({
                ...(existingValueId ? { orderValueId: existingValueId } : {}),
                value: value.trim(),
                rowId: row.id,
                columnId: col.id
              });
              if (existingValueId) {
                usedOriginalIds.add(existingValueId);
              }
            }
          });
        });

        const deleteOrderValueIds: string[] = [];
        if (!entry.isNew) {
          Object.entries(origIds).forEach(([, valueId]) => {
            if (!usedOriginalIds.has(valueId)) {
              deleteOrderValueIds.push(valueId);
            }
          });
        }

        const extravalues: OrderExtraValuePayload[] = [];
        const usedExtraIds = new Set<string>();

        tmplExtras.forEach((extra) => {
          const val = tmplExtraValues[extra.id]?.value || '';
          const existingId =
            tmplExtraValues[extra.id]?.orderExtraValueId || origExIds[extra.id];
          const orderIndex = tmplExtraValues[extra.id]?.orderIndex ?? 0;

          if (val.trim() || existingId) {
            extravalues.push({
              ...(existingId ? { orderExtraValueId: existingId } : {}),
              templateExtraFieldId: extra.id,
              value: val.trim(),
              meta: null,
              orderIndex
            });
            if (existingId) {
              usedExtraIds.add(existingId);
            }
          }
        });

        const deleteOrderExtraValueIds: string[] = [];
        if (!entry.isNew) {
          Object.entries(origExIds).forEach(([, exValueId]) => {
            if (!usedExtraIds.has(exValueId)) {
              deleteOrderExtraValueIds.push(exValueId);
            }
          });
        }

        const discount = templateDiscounts[entry.orderTemplateId] || {
          discountType: 'PERCENT' as DiscountType,
          discountValue: '0'
        };
        const summary: TemplateSummaryPayload = {
          discountType: discount.discountType,
          discountValue: discount.discountValue || '0'
        };

        const blockvalues = buildBlockValuesPayload(
          templateBlockValues[entry.orderTemplateId] || {}
        );

        const childEntries = entries.filter(
          (e) => e.parentOrderTemplateId === entry.orderTemplateId
        );
        const children: UpdateOrderValuesTemplatePayload[] =
          childEntries.map(buildTemplatePayload);

        const payload: UpdateOrderValuesTemplatePayload = {
          templateId: entry.templateId,
          ...(entry.isNew ? {} : { orderTemplateId: entry.orderTemplateId }),
          parentOrderTemplateId: entry.parentOrderTemplateId,
          values,
          summary,
          ...(blockvalues.length > 0 ? { blockvalues } : {})
        };

        if (deleteOrderValueIds.length > 0) {
          payload.deleteOrderValueIds = deleteOrderValueIds;
        }
        if (deleteOrderExtraValueIds.length > 0) {
          payload.deleteOrderExtraValueIds = deleteOrderExtraValueIds;
        }
        if (extravalues.length > 0) {
          payload.extravalues = extravalues;
        }
        if (children.length > 0) {
          payload.children = children;
        }

        return payload;
      };

      const valuesTemplates: UpdateOrderValuesTemplatePayload[] =
        topLevelEntries.map(buildTemplatePayload);

      const updatePayload: UpdateOrderValuesData = {
        templates: valuesTemplates
      };

      await updateOrderValues(companyId, orderId, updatePayload);

      setSaveSuccess(true);
      await fetchOrder();
    } catch (err) {
      setSubmitError(getError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

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
  // DRAG-TO-SCROLL (with movement threshold)
  // ──────────────────────────────────────────────────────────────────────
  const handleMouseDown = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (isTemplateDragging) return;
      if (e.button !== 0) return;
      if (isInteractiveTarget(e.target as HTMLElement)) return;
      e.preventDefault();
      dragPending.current = true;
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
      if (isTemplateDragging || !containerRef.current) return;
      if (!isDragging && !dragPending.current) return;

      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;

      if (!isDragging) {
        if (Math.abs(dx) >= DRAG_THRESHOLD || Math.abs(dy) >= DRAG_THRESHOLD) {
          setIsDragging(true);
        }
        return;
      }

      containerRef.current.scrollLeft = scrollStart.current.left - dx;
      containerRef.current.scrollTop = scrollStart.current.top - dy;
    },
    [isDragging, isTemplateDragging]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragPending.current = false;
  }, []);

  const getTouchDist = (t1: React.Touch, t2: React.Touch): number => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = useCallback(
    (e: ReactTouchEvent<HTMLDivElement>) => {
      if (isTemplateDragging) return;
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
    },
    [isTemplateDragging]
  );

  const handleTouchMove = useCallback(
    (e: ReactTouchEvent<HTMLDivElement>) => {
      if (isTemplateDragging) return;
      if (e.touches.length === 1 && containerRef.current) {
        if (!isDragging && !dragPending.current) return;

        const dx = e.touches[0].clientX - dragStart.current.x;
        const dy = e.touches[0].clientY - dragStart.current.y;

        if (!isDragging) {
          if (
            Math.abs(dx) >= DRAG_THRESHOLD ||
            Math.abs(dy) >= DRAG_THRESHOLD
          ) {
            setIsDragging(true);
          }
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
    [isDragging, isTemplateDragging, clampZoom]
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    dragPending.current = false;
    lastPinchDist.current = null;
  }, []);

  const handleDoubleClick = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (isInteractiveTarget(e.target as HTMLElement)) return;
      setZoom((z) => (z > 1.1 ? 1 : 2.5));
    },
    []
  );

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
  // TEMPLATE LAYOUT ITEMS
  // ──────────────────────────────────────────────────────────────────────
  const templateLayoutItems: TemplateLayoutItem[] = useMemo(() => {
    const topLevelEntries = entries.filter(
      (e) => e.parentOrderTemplateId === null
    );

    return topLevelEntries.map((parent) => {
      const childEntries = entries.filter(
        (e) => e.parentOrderTemplateId === parent.orderTemplateId
      );
      const hasChildren = childEntries.length > 0;

      return {
        id: parent.templateId,
        label: parent.template.name || parent.templateId,
        children: (
          <div className='space-y-4'>
            <div className='flex items-center gap-2'>
              {hasChildren && (
                <Badge variant='outline' className='text-xs'>
                  Parent Template
                  <span className='text-muted-foreground ml-1.5'>
                    — {childEntries.length} child
                    {childEntries.length !== 1 ? 'ren' : ''}
                  </span>
                </Badge>
              )}
              {parent.isNew && (
                <Badge variant='secondary' className='text-xs'>
                  New — no existing values
                </Badge>
              )}
            </div>

            {/* Parent */}
            <OrderTemplateValues
              template={parent.template}
              values={templateValues[parent.orderTemplateId] || {}}
              onChange={(vals) =>
                handleTemplateValuesChange(parent.orderTemplateId, vals)
              }
              errors={cellErrors[parent.orderTemplateId] || {}}
              disabled={isSubmitting}
              extraValues={extraValues[parent.orderTemplateId] || {}}
              onExtraValuesChange={(vals) =>
                handleExtraValuesChange(parent.orderTemplateId, vals)
              }
              extraErrors={extraFieldErrors[parent.orderTemplateId] || {}}
              discountType={
                templateDiscounts[parent.orderTemplateId]?.discountType ||
                'PERCENT'
              }
              discountValue={
                templateDiscounts[parent.orderTemplateId]?.discountValue || '0'
              }
              onDiscountChange={(type, value) =>
                handleDiscountChange(parent.orderTemplateId, type, value)
              }
              apiBlocks={parent.template.blocks || []}
              blockValues={templateBlockValues[parent.orderTemplateId] || {}}
              onBlockValuesChange={(vals) =>
                handleBlockValuesChange(parent.orderTemplateId, vals)
              }
            />

            {/* Children */}
            {childEntries.map((child, idx) => (
              <div key={child.orderTemplateId} className='space-y-2'>
                <Badge variant='secondary' className='text-xs'>
                  Child #{idx + 1}
                </Badge>
                <OrderTemplateValues
                  template={child.template}
                  values={templateValues[child.orderTemplateId] || {}}
                  onChange={(vals) =>
                    handleTemplateValuesChange(child.orderTemplateId, vals)
                  }
                  errors={cellErrors[child.orderTemplateId] || {}}
                  disabled={isSubmitting}
                  extraValues={extraValues[child.orderTemplateId] || {}}
                  onExtraValuesChange={(vals) =>
                    handleExtraValuesChange(child.orderTemplateId, vals)
                  }
                  extraErrors={extraFieldErrors[child.orderTemplateId] || {}}
                  discountType={
                    templateDiscounts[child.orderTemplateId]?.discountType ||
                    'PERCENT'
                  }
                  discountValue={
                    templateDiscounts[child.orderTemplateId]?.discountValue ||
                    '0'
                  }
                  onDiscountChange={(type, value) =>
                    handleDiscountChange(child.orderTemplateId, type, value)
                  }
                  apiBlocks={child.template.blocks || []}
                  blockValues={templateBlockValues[child.orderTemplateId] || {}}
                  onBlockValuesChange={(vals) =>
                    handleBlockValuesChange(child.orderTemplateId, vals)
                  }
                />
              </div>
            ))}
          </div>
        )
      };
    });
  }, [
    entries,
    templateValues,
    extraValues,
    cellErrors,
    extraFieldErrors,
    templateDiscounts,
    templateBlockValues,
    isSubmitting,
    handleTemplateValuesChange,
    handleExtraValuesChange,
    handleDiscountChange,
    handleBlockValuesChange
  ]);

  const backUrl = `/dashboard/${companyId}/orders/${orderId}`;
  const listUrl = `/dashboard/${companyId}/orders`;

  const totalCellErrors = useMemo(() => {
    let count = 0;
    Object.values(cellErrors).forEach((tmplErrs) => {
      count += Object.keys(tmplErrs).length;
    });
    Object.values(extraFieldErrors).forEach((tmplErrs) => {
      count += Object.keys(tmplErrs).length;
    });
    return count;
  }, [cellErrors, extraFieldErrors]);

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
        <Card>
          <CardHeader>
            <Skeleton className='h-5 w-32' />
          </CardHeader>
          <CardContent>
            <Skeleton className='h-64 w-full' />
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
          href={listUrl}
          className='text-muted-foreground hover:text-foreground inline-flex items-center text-sm'
        >
          <ArrowLeft className='mr-2 h-4 w-4' />
          Back to Designs
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
          <Button variant='outline' onClick={() => router.push(listUrl)}>
            Back to Designs
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
      <Link
        href={backUrl}
        className='text-muted-foreground hover:text-foreground inline-flex items-center text-sm'
      >
        <ArrowLeft className='mr-2 h-4 w-4' />
        Back to Design Details
      </Link>

      {/* Order Info Card */}
      <Card>
        <CardHeader>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
            <div className='space-y-1'>
              <CardTitle className='flex items-center gap-3 text-2xl'>
                Edit Design #{order.orderNo}
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
              <span className='text-muted-foreground'>Design No</span>
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

      {/* Template Values Section — Canvas */}
      {entries.length > 0 && (
        <>
          <Separator />

          {totalCellErrors > 0 && (
            <div className='bg-destructive/15 text-destructive flex items-start gap-2 rounded-md p-3 text-sm'>
              <AlertCircle className='mt-0.5 h-4 w-4 flex-shrink-0' />
              <span>
                {totalCellErrors} validation error
                {totalCellErrors !== 1 ? 's' : ''} found. Please fix them before
                saving.
              </span>
            </div>
          )}

          {submitError && (
            <div className='bg-destructive/15 text-destructive flex items-start gap-2 rounded-md p-3 text-sm'>
              <AlertCircle className='mt-0.5 h-4 w-4 flex-shrink-0' />
              <span>{submitError}</span>
            </div>
          )}

          {saveSuccess && (
            <div className='flex items-start gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/20 dark:text-green-400'>
              <CheckCircle2 className='mt-0.5 h-4 w-4 flex-shrink-0' />
              <span>Design values saved successfully!</span>
            </div>
          )}

          {/* Top toolbar */}
          <div className='bg-muted/60 flex items-center justify-between rounded-lg border px-4 py-2.5'>
            <div className='flex min-w-0 items-center gap-3'>
              <h2 className='truncate text-sm font-semibold'>
                Edit Template Values
              </h2>
              <span className='text-muted-foreground hidden text-xs sm:inline'>
                Update values for each template. Formula columns are
                auto-calculated.
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

          <div
            ref={toolbarPortalRef}
            className='bg-muted/40 rounded-lg border px-4 py-2.5'
          />

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
              <div
                className='origin-top-left p-6'
                style={{ zoom: zoom } as React.CSSProperties}
              >
                <TemplateLayoutCanvas
                  items={templateLayoutItems}
                  persistKey={`${orderId}-edit`}
                  zoom={zoom}
                  onTemplateDragStart={() => setIsTemplateDragging(true)}
                  onTemplateDragEnd={() => setIsTemplateDragging(false)}
                  toolbarPortalTarget={toolbarPortalRef}
                />
              </div>
            </div>
          </div>

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

      {entries.length === 0 && (
        <Card>
          <CardContent className='py-8'>
            <div className='flex flex-col items-center justify-center text-center'>
              <AlertCircle className='text-muted-foreground mb-2 h-8 w-8' />
              <p className='text-muted-foreground text-sm'>
                No templates found for this design.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className='flex items-center gap-4 pt-2'>
        <Button onClick={handleSubmit} disabled={isSubmitting} size='lg'>
          {isSubmitting ? (
            <>
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              Saving Changes...
            </>
          ) : (
            <>
              <Save className='mr-2 h-4 w-4' />
              Save Changes
            </>
          )}
        </Button>
        <Button
          type='button'
          variant='outline'
          onClick={() => router.push(backUrl)}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
