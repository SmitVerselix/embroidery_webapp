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
import {
  getOrder,
  updateOrderValues,
  recalculateOrder
} from '@/lib/api/services';
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  ArrowLeft,
  AlertCircle,
  Pencil,
  Copy,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Loader2,
  RotateCw,
  Check,
  X
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
import OrderTemplatePDF, { type FinalCalcData } from './order-template-pdf';
import TemplateLayoutCanvas, {
  type TemplateLayoutItem
} from './template-layout-canvas';
import { toast } from 'sonner';
import api from '@/lib/api/axios';

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

/** Format a numeric string to 2 decimal places for display */
const formatAmount = (value: string | null | undefined): string => {
  if (!value) return '0.00';
  const num = parseFloat(value);
  if (isNaN(num)) return '0.00';
  return num.toFixed(2);
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
  notes: string | null;
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

type DiscountType = 'AMOUNT' | 'PERCENT';

// =============================================================================
// UPDATE FINAL CALCULATION API
// =============================================================================

type UpdateFinalCalculationPayload = {
  notes: { orderTemplateId: string; notes: string }[];
  discount: number;
  discountType: DiscountType;
  marginDiscount: number;
  marginType: DiscountType;
};

const updateFinalCalculation = async (
  companyId: string,
  orderId: string,
  data: UpdateFinalCalculationPayload
): Promise<void> => {
  await api.put(
    `/api/v1/web/user/${companyId}/order/update-final-calculation/${orderId}`,
    data
  );
};

// =============================================================================
// PROPS
// =============================================================================

interface OrderDetailProps {
  companyId: string;
  orderId: string;
}

// =============================================================================
// FINAL CALCULATION TABLE — TYPES
// =============================================================================

type FinalCalcTemplateRow = {
  label: string;
  orderTemplateId: string;
  total: string;
  childTotal: string | null;
  notes: string | null;
};

// =============================================================================
// FINAL CALCULATION TABLE COMPONENT
// =============================================================================

interface FinalCalculationTableProps {
  templateRows: FinalCalcTemplateRow[];
  total: string;
  discount: string;
  discountType: string | null;
  marginDiscount: string;
  marginType: string | null;
  marginTotal: string;
  finalPayableAmount: string;
  hasAnyChildren: boolean;
  companyId: string;
  orderId: string;
  onSaved: () => Promise<void>;
}

function FinalCalculationTable({
  templateRows,
  total,
  discount,
  discountType: orderDiscountType,
  marginDiscount,
  marginType: orderMarginType,
  marginTotal,
  finalPayableAmount,
  hasAnyChildren,
  companyId,
  orderId,
  onSaved
}: FinalCalculationTableProps) {
  // ── Edit mode state ────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form values
  const [formDiscount, setFormDiscount] = useState(discount);
  const [formDiscountType, setFormDiscountType] = useState<DiscountType>(
    (orderDiscountType as DiscountType) || 'AMOUNT'
  );
  const [formMarginDiscount, setFormMarginDiscount] = useState(marginDiscount);
  const [formMarginType, setFormMarginType] = useState<DiscountType>(
    (orderMarginType as DiscountType) || 'AMOUNT'
  );
  const [formNotes, setFormNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      templateRows.map((r) => [r.orderTemplateId, r.notes ?? ''])
    )
  );

  // Sync form values when external data changes (e.g. after save)
  useEffect(() => {
    if (!isEditing) {
      setFormDiscount(discount);
      setFormMarginDiscount(marginDiscount);
    }
  }, [discount, marginDiscount, isEditing]);

  const handleEdit = () => {
    setFormDiscount(discount);
    setFormDiscountType((orderDiscountType as DiscountType) || 'AMOUNT');
    setFormMarginDiscount(marginDiscount);
    setFormMarginType((orderMarginType as DiscountType) || 'AMOUNT');
    setFormNotes(
      Object.fromEntries(
        templateRows.map((r) => [r.orderTemplateId, r.notes ?? ''])
      )
    );
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      const notes = templateRows
        .map((r) => ({
          orderTemplateId: r.orderTemplateId,
          notes: formNotes[r.orderTemplateId] ?? ''
        }))
        .filter((n) => n.notes.trim() !== '');

      await updateFinalCalculation(companyId, orderId, {
        notes,
        discount: parseFloat(formDiscount) || 0,
        discountType: formDiscountType,
        marginDiscount: parseFloat(formMarginDiscount) || 0,
        marginType: formMarginType
      });

      toast.success('Final calculation updated successfully');
      setIsEditing(false);
      await onSaved();
    } catch (err) {
      toast.error(getError(err) || 'Failed to update final calculation');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Handle Enter key on inputs ─────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className='w-full min-w-[520px]'>
      {/* Header row */}
      <div className='my-2 flex items-center justify-between px-4'>
        <h3 className='text-sm font-semibold'>Final Calculation</h3>
        {!isEditing ? (
          <Button
            variant='outline'
            size='sm'
            className='gap-1.5'
            onClick={handleEdit}
          >
            <Pencil className='h-3.5 w-3.5' />
            Edit
          </Button>
        ) : (
          <div className='flex items-center gap-2'>
            <Button
              variant='outline'
              size='sm'
              className='gap-1.5'
              onClick={handleCancel}
              disabled={isSaving}
            >
              <X className='h-3.5 w-3.5' />
              Cancel
            </Button>
            <Button
              size='sm'
              className='gap-1.5'
              onClick={handleSubmit}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className='h-3.5 w-3.5 animate-spin' />
              ) : (
                <Check className='h-3.5 w-3.5' />
              )}
              Submit
            </Button>
          </div>
        )}
      </div>

      <div className='overflow-hidden rounded-md border'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='bg-muted/50 border-b'>
              <th className='px-4 py-2.5 text-left font-medium' />
              <th className='px-4 py-2.5 text-left font-medium'>Total</th>
              {hasAnyChildren && (
                <th className='px-4 py-2.5 text-left font-medium'>
                  Child Total
                </th>
              )}
              {/* Notes column — always visible */}
              <th className='px-4 py-2.5 text-left font-medium'>Notes</th>
            </tr>
          </thead>
          <tbody>
            {/* ── Template rows ──────────────────────────────────────── */}
            {templateRows.map((row) => (
              <tr key={row.orderTemplateId} className='border-b'>
                <td className='px-4 py-2 font-medium'>{row.label}</td>
                <td className='px-4 py-2 font-mono tabular-nums'>
                  {row.total}
                </td>
                {hasAnyChildren && (
                  <td className='text-muted-foreground px-4 py-2 font-mono tabular-nums'>
                    {row.childTotal ?? '—'}
                  </td>
                )}
                {/* Notes cell */}
                <td className='px-4 py-2'>
                  {isEditing ? (
                    <Input
                      className='h-7 min-w-[160px] text-xs'
                      placeholder='Add notes…'
                      value={formNotes[row.orderTemplateId] ?? ''}
                      onChange={(e) =>
                        setFormNotes((prev) => ({
                          ...prev,
                          [row.orderTemplateId]: e.target.value
                        }))
                      }
                      onKeyDown={handleKeyDown}
                    />
                  ) : row.notes ? (
                    <span className='text-foreground text-xs'>{row.notes}</span>
                  ) : (
                    <span className='text-muted-foreground text-xs'>—</span>
                  )}
                </td>
              </tr>
            ))}

            {/* ── Total ──────────────────────────────────────────── */}
            <tr className='border-t-2 border-b font-semibold'>
              <td className='px-4 py-2'>Total</td>
              <td
                className='px-4 py-2 font-mono tabular-nums'
                colSpan={hasAnyChildren ? 2 : 1}
              >
                {total}
              </td>
              {/* Empty notes cell */}
              <td className='px-4 py-2' />
            </tr>

            {/* ── Discount ───────────────────────────────────────────── */}
            <tr className='border-b'>
              <td className='px-4 py-2 font-medium'>Discount</td>
              <td className='px-4 py-2' colSpan={hasAnyChildren ? 2 : 1}>
                {isEditing ? (
                  <div className='flex items-center gap-2'>
                    <Input
                      className='h-7 w-28 font-mono text-xs tabular-nums'
                      type='number'
                      min='0'
                      step='0.01'
                      value={formDiscount}
                      onChange={(e) => setFormDiscount(e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                    <Select
                      value={formDiscountType}
                      onValueChange={(v) =>
                        setFormDiscountType(v as DiscountType)
                      }
                    >
                      <SelectTrigger className='h-7 w-28 text-xs'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='AMOUNT'>Amount (₹)</SelectItem>
                        <SelectItem value='PERCENT'>Percent (%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <span className='font-mono tabular-nums'>
                    {discount} {orderDiscountType === 'PERCENT' ? '%' : '₹'}
                  </span>
                )}
              </td>
              {/* Empty notes cell */}
              <td className='px-4 py-2' />
            </tr>

            {/* ── Margin Discount ────────────────────────────────────── */}
            <tr className='border-b'>
              <td className='px-4 py-2 font-medium'>Margin Discount</td>
              <td className='px-4 py-2' colSpan={hasAnyChildren ? 2 : 1}>
                {isEditing ? (
                  <div className='flex items-center gap-2'>
                    <Input
                      className='h-7 w-28 font-mono text-xs tabular-nums'
                      type='number'
                      min='0'
                      step='0.01'
                      value={formMarginDiscount}
                      onChange={(e) => setFormMarginDiscount(e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                    <Select
                      value={formMarginType}
                      onValueChange={(v) =>
                        setFormMarginType(v as DiscountType)
                      }
                    >
                      <SelectTrigger className='h-7 w-28 text-xs'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='AMOUNT'>Amount (₹)</SelectItem>
                        <SelectItem value='PERCENT'>Percent (%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <span className='font-mono tabular-nums'>
                    {marginDiscount} {orderMarginType === 'PERCENT' ? '%' : '₹'}
                  </span>
                )}
              </td>
              {/* Empty notes cell */}
              <td className='px-4 py-2' />
            </tr>

            {/* ── Margin Total ───────────────────────────────────── */}
            <tr className='border-b'>
              <td className='px-4 py-2 font-medium'>Margin Total</td>
              <td
                className='px-4 py-2 font-mono tabular-nums'
                colSpan={hasAnyChildren ? 2 : 1}
              >
                {marginTotal}
              </td>
              {/* Empty notes cell */}
              <td className='px-4 py-2' />
            </tr>

            {/* ── Final Payable Amount ───────────────────────────────── */}
            <tr className='border-t-2 font-semibold'>
              <td className='px-4 py-2'>Final Payable Amount</td>
              <td
                className='px-4 py-2 font-mono tabular-nums'
                colSpan={hasAnyChildren ? 2 : 1}
              >
                {finalPayableAmount}
              </td>
              {/* Empty notes cell */}
              <td className='px-4 py-2' />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
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

  // ── Recalculate state ───────────────────────────────────────────────
  const [isRecalculating, setIsRecalculating] = useState(false);

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
            finalPayableAmount: rawSummary.finalPayableAmount ?? '0.0000',
            notes: rawSummary.notes ?? null
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

  // ── Refresh order (used after saving final calculation) ─────────────
  const refreshOrder = useCallback(async () => {
    try {
      const orderData = await getOrder(companyId, orderId);
      setOrder(orderData);
      processOrderTemplates(orderData);
    } catch (err) {
      toast.error(getError(err) || 'Failed to refresh order');
    }
  }, [companyId, orderId, processOrderTemplates]);

  // ──────────────────────────────────────────────────────────────────────
  // RECALCULATE ORDER
  // ──────────────────────────────────────────────────────────────────────
  const handleRecalculate = useCallback(async () => {
    setIsRecalculating(true);
    try {
      await recalculateOrder(companyId, orderId);
      toast.success('Order recalculated successfully');
      const orderData = await getOrder(companyId, orderId);
      setOrder(orderData);
      processOrderTemplates(orderData);
    } catch (err) {
      toast.error(getError(err) || 'Failed to recalculate order');
    } finally {
      setIsRecalculating(false);
    }
  }, [companyId, orderId, processOrderTemplates]);

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

  // ── CTRL + SCROLL WHEEL ZOOM ────────────────────────────────────────
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
  // DRAG-TO-SCROLL
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

  // ──────────────────────────────────────────────────────────────────────
  // FINAL CALC DATA — passed to PDF component
  // ──────────────────────────────────────────────────────────────────────
  const finalCalcData: FinalCalcData | undefined = useMemo(() => {
    if (!order || entries.length === 0) return undefined;

    const hasAnyChildren = Object.values(groupedByTemplate).some(
      (templateEntries) => templateEntries.some((e) => e.isChild)
    );

    const templateRows = Object.entries(groupedByTemplate).map(
      ([templateId, templateEntries]) => {
        const parentEntry = templateEntries.find((e) => !e.isChild);
        const childEntries = templateEntries.filter((e) => e.isChild);
        const templateName =
          parentEntry?.template?.name ||
          childEntries[0]?.template?.name ||
          templateId;

        const parentTotal =
          parentEntry?.summary?.finalPayableAmount ?? '0.0000';

        let childTotal: string | null = null;
        if (childEntries.length > 0) {
          const sum = childEntries.reduce(
            (acc, child) =>
              acc + parseFloat(child.summary?.finalPayableAmount || '0'),
            0
          );
          childTotal = formatAmount(String(sum));
        }

        return {
          label: templateName,
          orderTemplateId:
            parentEntry && !parentEntry.isNew
              ? parentEntry.orderTemplateId
              : (childEntries[0]?.orderTemplateId ?? templateId),
          total: formatAmount(parentTotal),
          childTotal,
          notes: parentEntry?.summary?.notes ?? null
        };
      }
    );

    return {
      templateRows,
      total: formatAmount((order as any).total),
      discount: formatAmount(order.discount),
      discountType: (order as any).discountType ?? null,
      marginDiscount: formatAmount(order.marginDiscount),
      marginType: (order as any).marginType ?? null,
      marginTotal: formatAmount((order as any).marginTotal),
      finalPayableAmount: formatAmount(order.finalPayableAmount),
      hasAnyChildren
    };
  }, [order, entries, groupedByTemplate]);

  // ──────────────────────────────────────────────────────────────────────
  // TEMPLATE LAYOUT ITEMS
  // ──────────────────────────────────────────────────────────────────────
  const templateLayoutItems: TemplateLayoutItem[] = useMemo(
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

  // ──────────────────────────────────────────────────────────────────────
  // FINAL CALCULATION LAYOUT ITEM
  // ──────────────────────────────────────────────────────────────────────
  const finalCalcLayoutItem: TemplateLayoutItem | null = useMemo(() => {
    if (!order || entries.length === 0) return null;

    const hasAnyChildren = Object.values(groupedByTemplate).some(
      (templateEntries) => templateEntries.some((e) => e.isChild)
    );

    // Build per-template rows — now include orderTemplateId for notes
    const templateRows: FinalCalcTemplateRow[] = Object.entries(
      groupedByTemplate
    ).map(([templateId, templateEntries]) => {
      const parentEntry = templateEntries.find((e) => !e.isChild);
      const childEntries = templateEntries.filter((e) => e.isChild);
      const templateName =
        parentEntry?.template?.name ||
        childEntries[0]?.template?.name ||
        templateId;

      const parentTotal = parentEntry?.summary?.finalPayableAmount ?? '0.0000';

      let childTotal: string | null = null;
      if (childEntries.length > 0) {
        const sum = childEntries.reduce((acc, child) => {
          return acc + parseFloat(child.summary?.finalPayableAmount || '0');
        }, 0);
        childTotal = formatAmount(String(sum));
      }

      return {
        label: templateName,
        // Use parent's orderTemplateId; fall back to child's if parent is "new"
        orderTemplateId:
          parentEntry && !parentEntry.isNew
            ? parentEntry.orderTemplateId
            : (childEntries[0]?.orderTemplateId ?? templateId),
        total: formatAmount(parentTotal),
        childTotal,
        notes: parentEntry?.summary?.notes ?? null
      };
    });

    return {
      id: '__final_calculation__',
      label: 'Final Calculation',
      children: (
        <FinalCalculationTable
          templateRows={templateRows}
          total={formatAmount(order.total)}
          discount={formatAmount(order.discount)}
          discountType={(order as any).discountType ?? null}
          marginDiscount={formatAmount(order.marginDiscount)}
          marginType={(order as any).marginType ?? null}
          marginTotal={formatAmount((order as any).marginTotal)}
          finalPayableAmount={formatAmount(order.finalPayableAmount)}
          hasAnyChildren={hasAnyChildren}
          companyId={companyId}
          orderId={orderId}
          onSaved={refreshOrder}
        />
      )
    };
  }, [order, entries, groupedByTemplate, companyId, orderId, refreshOrder]);

  // ──────────────────────────────────────────────────────────────────────
  // COMBINED LAYOUT ITEMS
  // ──────────────────────────────────────────────────────────────────────
  const layoutItems: TemplateLayoutItem[] = useMemo(() => {
    const items = [...templateLayoutItems];
    if (finalCalcLayoutItem) items.push(finalCalcLayoutItem);
    return items;
  }, [templateLayoutItems, finalCalcLayoutItem]);

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
            <div className='flex items-center gap-2'>
              <Button
                variant='outline'
                onClick={handleRecalculate}
                disabled={isRecalculating}
              >
                {isRecalculating ? (
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                ) : (
                  <RotateCw className='mr-2 h-4 w-4' />
                )}
                Recalculate
              </Button>
              <OrderTemplatePDF
                order={order}
                entries={entries}
                templateValues={templateValues}
                extraValues={extraValues}
                finalCalc={finalCalcData}
              />
              <Button variant='outline' onClick={() => router.push(editUrl)}>
                <Pencil className='mr-2 h-4 w-4' />
                Edit Order
              </Button>
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
