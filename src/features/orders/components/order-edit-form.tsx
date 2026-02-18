'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Loader2,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Save,
  MessageSquare
} from 'lucide-react';
import Link from 'next/link';
import OrderTemplateValues, {
  type TemplateValuesMap
} from './order-template-values';
import type { ExtraValuesMap } from './order-extra-values';

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
// INTERNAL TYPES
// =============================================================================

/** A unique order-template instance with its full template definition */
type OrderTemplateEntry = {
  orderTemplateId: string;
  templateId: string;
  parentOrderTemplateId: string | null;
  template: TemplateWithDetails;
  /** true when the product template has no corresponding order-template yet */
  isNew?: boolean;
};

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
  /** Each entry is a unique order-template instance */
  const [entries, setEntries] = useState<OrderTemplateEntry[]>([]);
  /** Keyed by orderTemplateId */
  const [templateValues, setTemplateValues] = useState<
    Record<string, TemplateValuesMap>
  >({});
  /** Keyed by orderTemplateId */
  const [extraValues, setExtraValues] = useState<
    Record<string, ExtraValuesMap>
  >({});

  /** Original value IDs: orderTemplateId → "rowId-columnId" → orderValueId */
  const [originalValueIds, setOriginalValueIds] = useState<
    Record<string, Record<string, string>>
  >({});
  /** Original extra value IDs: orderTemplateId → extraFieldId → orderExtraValueId */
  const [originalExtraValueIds, setOriginalExtraValueIds] = useState<
    Record<string, Record<string, string>>
  >({});

  // Comment field
  const [comment, setComment] = useState('');

  // Discount per template: orderTemplateId → { discountType, discountValue }
  const [templateDiscounts, setTemplateDiscounts] = useState<
    Record<string, { discountType: DiscountType; discountValue: string }>
  >({});

  // Loading / error
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Validation errors — keyed by orderTemplateId
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

  // ──────────────────────────────────────────────────────────────────────
  // FETCH ORDER (single API call — no separate getTemplate calls)
  // ──────────────────────────────────────────────────────────────────────
  const fetchOrder = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const orderData = await getOrder(companyId, orderId);
      setOrder(orderData);

      // ── Build template cache from product.templates ────────────────
      const templateCache: Record<string, TemplateWithDetails> = {};
      const productTemplates = (orderData.product?.templates ||
        []) as TemplateWithDetails[];
      for (const tmpl of productTemplates) {
        templateCache[tmpl.id] = tmpl;
      }

      // ── State accumulators ─────────────────────────────────────────
      const loadedEntries: OrderTemplateEntry[] = [];
      const loadedValues: Record<string, TemplateValuesMap> = {};
      const loadedExtraValues: Record<string, ExtraValuesMap> = {};
      const valueIdMap: Record<string, Record<string, string>> = {};
      const extraValueIdMap: Record<string, Record<string, string>> = {};
      const discountMap: Record<
        string,
        { discountType: DiscountType; discountValue: string }
      > = {};

      /** Track which product templateIds already have order data */
      const processedTemplateIds = new Set<string>();

      // ── Recursive processor for order-template entries ─────────────
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

        // Map main values
        const valuesMap: TemplateValuesMap = {};
        const vIdMap: Record<string, string> = {};
        (tmplData.values || []).forEach((v) => {
          if (!valuesMap[v.rowId]) {
            valuesMap[v.rowId] = {};
          }
          valuesMap[v.rowId][v.columnId] = v.value ?? v.calculatedValue ?? '';
          vIdMap[`${v.rowId}-${v.columnId}`] = v.id;
        });
        loadedValues[orderTemplateId] = valuesMap;
        valueIdMap[orderTemplateId] = vIdMap;

        // Map extra values
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

        // Extract discount from summary
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

        // Process children recursively
        if (tmplData.children && tmplData.children.length > 0) {
          tmplData.children.forEach((child) => {
            processTemplate(child, orderTemplateId);
          });
        }
      };

      // ── Process existing order templates ───────────────────────────
      (orderData.templates || []).forEach((tmplData: OrderTemplateData) => {
        processTemplate(tmplData, null);
      });

      // ── Add entries for product templates without order data yet ───
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
        }
      }

      setEntries(loadedEntries);
      setTemplateValues(loadedValues);
      setExtraValues(loadedExtraValues);
      setOriginalValueIds(valueIdMap);
      setOriginalExtraValueIds(extraValueIdMap);
      setTemplateDiscounts(discountMap);
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
  // VALUE CHANGE HANDLERS (keyed by orderTemplateId)
  // ──────────────────────────────────────────────────────────────────────
  const handleTemplateValuesChange = useCallback(
    (orderTemplateId: string, values: TemplateValuesMap) => {
      setTemplateValues((prev) => ({
        ...prev,
        [orderTemplateId]: values
      }));
      setCellErrors((prev) => ({
        ...prev,
        [orderTemplateId]: {}
      }));
      setSaveSuccess(false);
    },
    []
  );

  const handleExtraValuesChange = useCallback(
    (orderTemplateId: string, values: ExtraValuesMap) => {
      setExtraValues((prev) => ({
        ...prev,
        [orderTemplateId]: values
      }));
      setExtraFieldErrors((prev) => ({
        ...prev,
        [orderTemplateId]: {}
      }));
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

  // ──────────────────────────────────────────────────────────────────────
  // VALIDATION
  // ──────────────────────────────────────────────────────────────────────
  const validateAll = useCallback((): boolean => {
    let isValid = true;

    // Validate main template values
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

    // Validate extra values
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
  // SUBMIT — unified payload: values + extravalues + summary + comment
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
      // Group entries: top-level (parentOrderTemplateId === null) and children
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

        // ── Build main values ────────────────────────────────────────
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

        // Find deleted values (only for existing entries)
        const deleteOrderValueIds: string[] = [];
        if (!entry.isNew) {
          Object.entries(origIds).forEach(([, valueId]) => {
            if (!usedOriginalIds.has(valueId)) {
              deleteOrderValueIds.push(valueId);
            }
          });
        }

        // ── Build extra values ───────────────────────────────────────
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

        // Find deleted extra values (only for existing entries)
        const deleteOrderExtraValueIds: string[] = [];
        if (!entry.isNew) {
          Object.entries(origExIds).forEach(([, exValueId]) => {
            if (!usedExtraIds.has(exValueId)) {
              deleteOrderExtraValueIds.push(exValueId);
            }
          });
        }

        // ── Build summary ────────────────────────────────────────────
        const discount = templateDiscounts[entry.orderTemplateId] || {
          discountType: 'PERCENT' as DiscountType,
          discountValue: '0'
        };
        const summary: TemplateSummaryPayload = {
          discountType: discount.discountType,
          discountValue: discount.discountValue || '0'
        };

        // ── Find children for this entry ─────────────────────────────
        const childEntries = entries.filter(
          (e) => e.parentOrderTemplateId === entry.orderTemplateId
        );
        const children: UpdateOrderValuesTemplatePayload[] =
          childEntries.map(buildTemplatePayload);

        const payload: UpdateOrderValuesTemplatePayload = {
          templateId: entry.templateId,
          // Only include orderTemplateId for existing entries
          ...(entry.isNew ? {} : { orderTemplateId: entry.orderTemplateId }),
          parentOrderTemplateId: entry.parentOrderTemplateId,
          values,
          summary
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

      // Include comment if provided
      if (comment.trim()) {
        updatePayload.comment = comment.trim();
      }

      // ── Single API call for everything ─────────────────────────────
      await updateOrderValues(companyId, orderId, updatePayload);

      setSaveSuccess(true);

      // Refresh data to get updated IDs
      await fetchOrder();
    } catch (err) {
      setSubmitError(getError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const backUrl = `/dashboard/${companyId}/orders/${orderId}`;
  const listUrl = `/dashboard/${companyId}/orders`;

  // Count total validation errors
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
          <Button variant='outline' onClick={() => router.push(listUrl)}>
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
      {/* Back */}
      <Link
        href={backUrl}
        className='text-muted-foreground hover:text-foreground inline-flex items-center text-sm'
      >
        <ArrowLeft className='mr-2 h-4 w-4' />
        Back to Order Details
      </Link>

      {/* Order Info Card (read-only summary) */}
      <Card>
        <CardHeader>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
            <div className='space-y-1'>
              <CardTitle className='flex items-center gap-3 text-2xl'>
                Edit Order #{order.orderNo}
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

      {/* Template Values Section */}
      {entries.length > 0 && (
        <>
          <Separator />

          <div className='space-y-2'>
            <h2 className='text-lg font-semibold'>Edit Template Values</h2>
            <p className='text-muted-foreground text-sm'>
              Update values for each template. Formula columns are
              auto-calculated. Fields marked with{' '}
              <span className='text-destructive font-bold'>*</span> are
              required.
            </p>
          </div>

          {/* Validation summary */}
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

          {/* Submit error */}
          {submitError && (
            <div className='bg-destructive/15 text-destructive flex items-start gap-2 rounded-md p-3 text-sm'>
              <AlertCircle className='mt-0.5 h-4 w-4 flex-shrink-0' />
              <span>{submitError}</span>
            </div>
          )}

          {/* Success message */}
          {saveSuccess && (
            <div className='flex items-start gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950/20 dark:text-green-400'>
              <CheckCircle2 className='mt-0.5 h-4 w-4 flex-shrink-0' />
              <span>Order values saved successfully!</span>
            </div>
          )}

          {/* Template cards — grouped: parent + children underneath */}
          <div className='space-y-6'>
            {entries
              .filter((e) => e.parentOrderTemplateId === null)
              .map((parent) => {
                const childEntries = entries.filter(
                  (e) => e.parentOrderTemplateId === parent.orderTemplateId
                );
                const hasChildren = childEntries.length > 0;

                return (
                  <div key={parent.orderTemplateId} className='space-y-4'>
                    {/* Parent badge when children exist */}
                    {hasChildren && (
                      <Badge variant='outline' className='text-xs'>
                        Parent Template
                        <span className='text-muted-foreground ml-1.5'>
                          — {childEntries.length} child
                          {childEntries.length !== 1 ? 'ren' : ''}
                        </span>
                      </Badge>
                    )}

                    {/* New template indicator */}
                    {parent.isNew && (
                      <Badge variant='secondary' className='text-xs'>
                        New — no existing values
                      </Badge>
                    )}

                    {/* Parent — editable */}
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
                      extraErrors={
                        extraFieldErrors[parent.orderTemplateId] || {}
                      }
                      discountType={
                        templateDiscounts[parent.orderTemplateId]
                          ?.discountType || 'PERCENT'
                      }
                      discountValue={
                        templateDiscounts[parent.orderTemplateId]
                          ?.discountValue || '0'
                      }
                      onDiscountChange={(type, value) =>
                        handleDiscountChange(
                          parent.orderTemplateId,
                          type,
                          value
                        )
                      }
                    />

                    {/* Children — editable */}
                    {childEntries.map((child, idx) => (
                      <div key={child.orderTemplateId} className='space-y-2'>
                        <Badge variant='secondary' className='text-xs'>
                          Child #{idx + 1}
                        </Badge>
                        <OrderTemplateValues
                          template={child.template}
                          values={templateValues[child.orderTemplateId] || {}}
                          onChange={(vals) =>
                            handleTemplateValuesChange(
                              child.orderTemplateId,
                              vals
                            )
                          }
                          errors={cellErrors[child.orderTemplateId] || {}}
                          disabled={isSubmitting}
                          extraValues={extraValues[child.orderTemplateId] || {}}
                          onExtraValuesChange={(vals) =>
                            handleExtraValuesChange(child.orderTemplateId, vals)
                          }
                          extraErrors={
                            extraFieldErrors[child.orderTemplateId] || {}
                          }
                          discountType={
                            templateDiscounts[child.orderTemplateId]
                              ?.discountType || 'PERCENT'
                          }
                          discountValue={
                            templateDiscounts[child.orderTemplateId]
                              ?.discountValue || '0'
                          }
                          onDiscountChange={(type, value) =>
                            handleDiscountChange(
                              child.orderTemplateId,
                              type,
                              value
                            )
                          }
                        />
                      </div>
                    ))}
                  </div>
                );
              })}
          </div>
        </>
      )}

      {/* No templates */}
      {entries.length === 0 && (
        <Card>
          <CardContent className='py-8'>
            <div className='flex flex-col items-center justify-center text-center'>
              <AlertCircle className='text-muted-foreground mb-2 h-8 w-8' />
              <p className='text-muted-foreground text-sm'>
                No templates found for this order.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Comment Section */}
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <MessageSquare className='h-4 w-4' />
            Comment
          </CardTitle>
          <CardDescription>
            Add a comment for this update (optional). This will be sent with
            your changes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
              setSaveSuccess(false);
            }}
            placeholder='Enter your comment here...'
            disabled={isSubmitting}
            rows={3}
            className='resize-none'
          />
        </CardContent>
      </Card>

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
