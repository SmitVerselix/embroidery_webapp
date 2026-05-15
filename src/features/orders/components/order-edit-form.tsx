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
  Save
} from 'lucide-react';
import Link from 'next/link';
import OrderTemplateValues, {
  type TemplateValuesMap,
  type BlockValuesMap,
  type AdditionalCostItem
} from './order-template-values';
import type { ExtraValuesMap } from './order-extra-values';
import type { TemplateLayoutItem } from './template-layout-canvas';
import TemplateCanvasContainer from './template-canvas-container';

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

type OrderTemplateEntry = {
  orderTemplateId: string;
  templateId: string;
  parentOrderTemplateId: string | null;
  template: TemplateWithDetails;
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
  const [originalExtraValueIdSets, setOriginalExtraValueIdSets] = useState<
    Record<string, Set<string>>
  >({});
  const [templateDiscounts, setTemplateDiscounts] = useState<
    Record<string, { discountType: DiscountType; discountValue: string }>
  >({});
  const [templateBlockValues, setTemplateBlockValues] = useState<
    Record<string, BlockValuesMap>
  >({});
  // ── Additional costs per orderTemplateId ──────────────────────────
  const [templateAdditionalCosts, setTemplateAdditionalCosts] = useState<
    Record<string, AdditionalCostItem[]>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cellErrors, setCellErrors] = useState<
    Record<string, Record<string, string>>
  >({});
  const [extraFieldErrors, setExtraFieldErrors] = useState<
    Record<string, Record<string, string>>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ── FETCH ORDER ─────────────────────────────────────────────────────
  const fetchOrder = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const orderData = await getOrder(companyId, orderId);
      setOrder(orderData);

      const templateCache: Record<string, TemplateWithDetails> = {};
      const productTemplates = (orderData.product?.templates ||
        []) as TemplateWithDetails[];
      for (const tmpl of productTemplates) templateCache[tmpl.id] = tmpl;

      const loadedEntries: OrderTemplateEntry[] = [];
      const loadedValues: Record<string, TemplateValuesMap> = {};
      const loadedExtraValues: Record<string, ExtraValuesMap> = {};
      const valueIdMap: Record<string, Record<string, string>> = {};
      const extraIdSets: Record<string, Set<string>> = {};
      const discountMap: Record<
        string,
        { discountType: DiscountType; discountValue: string }
      > = {};
      const loadedBlockValues: Record<string, BlockValuesMap> = {};
      const loadedAdditionalCosts: Record<string, AdditionalCostItem[]> = {};
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
          if (!valuesMap[v.rowId]) valuesMap[v.rowId] = {};
          let raw = v.calculatedValue ?? v.value ?? '';
          if (colTypeMap[v.columnId] === 'NUMBER' && raw !== '') {
            const num = parseFloat(raw);
            if (!isNaN(num)) raw = num === 0 ? '0' : num.toFixed(2);
          }
          valuesMap[v.rowId][v.columnId] = raw;
          vIdMap[`${v.rowId}-${v.columnId}`] = v.id;
        });
        loadedValues[orderTemplateId] = valuesMap;
        valueIdMap[orderTemplateId] = vIdMap;

        const extValMap: ExtraValuesMap = {};
        const evIdSet = new Set<string>();
        (tmplData.extraValues || []).forEach((ev) => {
          if (!extValMap[ev.templateExtraFieldId])
            extValMap[ev.templateExtraFieldId] = [];
          extValMap[ev.templateExtraFieldId].push({
            value: ev.value,
            orderExtraValueId: ev.id,
            orderIndex:
              ev.orderIndex ?? extValMap[ev.templateExtraFieldId].length,
            meta: (ev as any).meta ?? null
          });
          evIdSet.add(ev.id);
        });
        Object.values(extValMap).forEach((arr) =>
          arr.sort((a, b) => a.orderIndex - b.orderIndex)
        );
        loadedExtraValues[orderTemplateId] = extValMap;
        extraIdSets[orderTemplateId] = evIdSet;

        const bvMap: BlockValuesMap = {};
        ((tmplData as any).blockValues || []).forEach((bv: any) => {
          const idx = parseInt(
            (bv.blockIndex as string).replace('block_', ''),
            10
          );
          if (!isNaN(idx)) bvMap[idx] = bv.templateBlockId;
        });
        loadedBlockValues[orderTemplateId] = bvMap;

        // ── Load additionalTemplateCosts from API response ──
        const apiAdditionalCosts =
          (tmplData as any).additionalTemplateCosts || [];
        loadedAdditionalCosts[orderTemplateId] = (
          apiAdditionalCosts as {
            id: string;
            costName: string;
            cost: string;
            notes: string | null;
            indexNo: number;
          }[]
        )
          .sort((a, b) => a.indexNo - b.indexNo)
          .map((c, i) => ({
            id: c.id,
            costName: c.costName,
            cost: c.cost,
            notes: c.notes ?? '',
            indexNo: i
          }));

        const rawSummary = tmplData.summary;
        discountMap[orderTemplateId] = rawSummary
          ? {
              discountType:
                (rawSummary.discountType as DiscountType) || 'PERCENT',
              discountValue: rawSummary.discount ?? '0'
            }
          : { discountType: 'PERCENT', discountValue: '0' };

        if (tmplData.children && tmplData.children.length > 0)
          tmplData.children.forEach((child) =>
            processTemplate(child, orderTemplateId)
          );
      };

      (orderData.templates || []).forEach((tmplData: OrderTemplateData) =>
        processTemplate(tmplData, null)
      );

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
          extraIdSets[tempKey] = new Set();
          discountMap[tempKey] = {
            discountType: 'PERCENT',
            discountValue: '0'
          };
          loadedBlockValues[tempKey] = {};
          loadedAdditionalCosts[tempKey] = [];
        }
      }

      setEntries(loadedEntries);
      setTemplateValues(loadedValues);
      setExtraValues(loadedExtraValues);
      setOriginalValueIds(valueIdMap);
      setOriginalExtraValueIdSets(extraIdSets);
      setTemplateDiscounts(discountMap);
      setTemplateBlockValues(loadedBlockValues);
      setTemplateAdditionalCosts(loadedAdditionalCosts);
    } catch (err) {
      setError(getError(err));
    } finally {
      setIsLoading(false);
    }
  }, [companyId, orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // ── VALUE CHANGE HANDLERS ───────────────────────────────────────────
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
  const handleAdditionalCostsChange = useCallback(
    (orderTemplateId: string, costs: AdditionalCostItem[]) => {
      setTemplateAdditionalCosts((prev) => ({
        ...prev,
        [orderTemplateId]: costs
      }));
      setSaveSuccess(false);
    },
    []
  );

  // ── VALIDATION ──────────────────────────────────────────────────────
  const validateAll = useCallback((): boolean => {
    let isValid = true;
    const newCellErrors: Record<string, Record<string, string>> = {};
    entries.forEach((entry) => {
      const tmpl = entry.template;
      const tmplErrors: Record<string, string> = {};
      const tmplValues = templateValues[entry.orderTemplateId] || {};
      (tmpl.rows || []).forEach((row) => {
        (tmpl.columns || []).forEach((col) => {
          if (col.dataType === 'FORMULA') return;
          const value = tmplValues[row.id]?.[col.id] || '';
          const cellKey = `${row.id}-${col.id}`;
          if (col.isRequired && !value.trim()) {
            tmplErrors[cellKey] = 'Required';
            isValid = false;
            return;
          }
          if (col.dataType === 'NUMBER' && value.trim()) {
            if (isNaN(Number(value))) {
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
      const extErrors: Record<string, string> = {};
      const tmplExtraValues = extraValues[entry.orderTemplateId] || {};
      (entry.template.extra || []).forEach((extra) => {
        const items = tmplExtraValues[extra.id] || [];
        if (extra.isRequired) {
          const hasValue = items.some((i) => i.value.trim() !== '');
          if (!hasValue) {
            extErrors[extra.id] = 'Required';
            isValid = false;
          }
        }
        if (extra.valueType === 'NUMBER') {
          items.forEach((item, idx) => {
            if (item.value.trim() && isNaN(Number(item.value))) {
              extErrors[`${extra.id}__${idx}`] = 'Must be a number';
              isValid = false;
            }
          });
        }
      });
      newExtraErrors[entry.orderTemplateId] = extErrors;
    });
    setExtraFieldErrors(newExtraErrors);
    return isValid;
  }, [entries, templateValues, extraValues]);

  const buildBlockValuesPayload = useCallback(
    (bvMap: BlockValuesMap): OrderBlockValuePayload[] => {
      const result: OrderBlockValuePayload[] = [];
      Object.entries(bvMap).forEach(([blockIdx, templateBlockId]) => {
        if (templateBlockId)
          result.push({ templateBlockId, blockIndex: `block_${blockIdx}` });
      });
      return result;
    },
    []
  );

  // ── SUBMIT ──────────────────────────────────────────────────────────
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
        const origIds = originalValueIds[entry.orderTemplateId] || {};
        const tmplExtraValues = extraValues[entry.orderTemplateId] || {};
        const originalExIdSet =
          originalExtraValueIdSets[entry.orderTemplateId] || new Set();

        const values: UpdateOrderValueItem[] = [];
        const usedOriginalIds = new Set<string>();
        (tmpl.rows || []).forEach((row) => {
          (tmpl.columns || []).forEach((col) => {
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
              if (existingValueId) usedOriginalIds.add(existingValueId);
            }
          });
        });

        const deleteOrderValueIds: string[] = [];
        if (!entry.isNew)
          Object.entries(origIds).forEach(([, valueId]) => {
            if (!usedOriginalIds.has(valueId))
              deleteOrderValueIds.push(valueId);
          });

        const extravalues: OrderExtraValuePayload[] = [];
        const usedExtraIds = new Set<string>();
        (tmpl.extra || []).forEach((extra) => {
          const items = tmplExtraValues[extra.id] || [];
          items.forEach((item) => {
            if (item.value.trim() || item.orderExtraValueId) {
              extravalues.push({
                ...(item.orderExtraValueId
                  ? { orderExtraValueId: item.orderExtraValueId }
                  : {}),
                templateExtraFieldId: extra.id,
                value: item.value.trim(),
                meta:
                  item.meta && Object.keys(item.meta).length > 0
                    ? item.meta
                    : null,
                orderIndex: item.orderIndex
              });
              if (item.orderExtraValueId)
                usedExtraIds.add(item.orderExtraValueId);
            }
          });
        });

        const deleteOrderExtraValueIds: string[] = [];
        if (!entry.isNew)
          originalExIdSet.forEach((exId) => {
            if (!usedExtraIds.has(exId)) deleteOrderExtraValueIds.push(exId);
          });

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

        // ── Build additionalCosts payload ──
        const additionalCosts = (
          templateAdditionalCosts[entry.orderTemplateId] || []
        ).map((c, i) => ({
          costName: c.costName,
          cost: parseFloat(c.cost) || 0,
          notes: c.notes || ''
        }));

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
        if (deleteOrderValueIds.length > 0)
          payload.deleteOrderValueIds = deleteOrderValueIds;
        if (deleteOrderExtraValueIds.length > 0)
          payload.deleteOrderExtraValueIds = deleteOrderExtraValueIds;
        if (extravalues.length > 0) payload.extravalues = extravalues;
        if (additionalCosts.length > 0)
          (payload as any).additionalCosts = additionalCosts;
        if (children.length > 0) payload.children = children;
        return payload;
      };

      const updatePayload: UpdateOrderValuesData = {
        templates: topLevelEntries.map(buildTemplatePayload)
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

  // ── TEMPLATE LAYOUT ITEMS ───────────────────────────────────────────
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
          <div className={hasChildren ? 'flex items-start gap-4' : 'space-y-4'}>
            <div
              className={hasChildren ? 'min-w-0 flex-1 space-y-2' : 'space-y-2'}
            >
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
                  templateDiscounts[parent.orderTemplateId]?.discountValue ||
                  '0'
                }
                onDiscountChange={(type, value) =>
                  handleDiscountChange(parent.orderTemplateId, type, value)
                }
                apiBlocks={parent.template.blocks || []}
                blockValues={templateBlockValues[parent.orderTemplateId] || {}}
                onBlockValuesChange={(vals) =>
                  handleBlockValuesChange(parent.orderTemplateId, vals)
                }
                additionalCosts={
                  templateAdditionalCosts[parent.orderTemplateId] || []
                }
                onAdditionalCostsChange={(costs) =>
                  handleAdditionalCostsChange(parent.orderTemplateId, costs)
                }
                companyId={companyId}
                productId={order?.product?.id || ''}
                templateId={parent.template.id}
              />
            </div>
            {childEntries.map((child, idx) => (
              <div
                key={child.orderTemplateId}
                className={
                  hasChildren ? 'min-w-0 flex-1 space-y-2' : 'space-y-2'
                }
              >
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
                  additionalCosts={
                    templateAdditionalCosts[child.orderTemplateId] || []
                  }
                  onAdditionalCostsChange={(costs) =>
                    handleAdditionalCostsChange(child.orderTemplateId, costs)
                  }
                  companyId={companyId}
                  productId={order?.product?.id || ''}
                  templateId={child.template.id}
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
    templateAdditionalCosts,
    isSubmitting,
    handleTemplateValuesChange,
    handleExtraValuesChange,
    handleDiscountChange,
    handleBlockValuesChange,
    handleAdditionalCostsChange
  ]);

  const backUrl = `/dashboard/${companyId}/orders/${orderId}`;
  const listUrl = `/dashboard/${companyId}/orders`;

  const totalCellErrors = useMemo(() => {
    let count = 0;
    Object.values(cellErrors).forEach((e) => {
      count += Object.keys(e).length;
    });
    Object.values(extraFieldErrors).forEach((e) => {
      count += Object.keys(e).length;
    });
    return count;
  }, [cellErrors, extraFieldErrors]);

  // ── LOADING ─────────────────────────────────────────────────────────
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

  // ── ERROR ───────────────────────────────────────────────────────────
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

  // ── RENDER ──────────────────────────────────────────────────────────
  const statusMessages = (
    <div className='space-y-3'>
      {totalCellErrors > 0 && (
        <div className='bg-destructive/15 text-destructive flex items-start gap-2 rounded-md p-3 text-sm'>
          <AlertCircle className='mt-0.5 h-4 w-4 flex-shrink-0' />
          <span>
            {totalCellErrors} validation error{totalCellErrors !== 1 ? 's' : ''}{' '}
            found. Please fix them before saving.
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
    </div>
  );

  return (
    <div className='space-y-6'>
      <Link
        href={backUrl}
        className='text-muted-foreground hover:text-foreground inline-flex items-center text-sm'
      >
        <ArrowLeft className='mr-2 h-4 w-4' />
        Back to Design Details
      </Link>

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

      {entries.length > 0 ? (
        <>
          <Separator />
          <TemplateCanvasContainer
            items={templateLayoutItems}
            persistKey={`${orderId}-edit`}
            title='Edit Template Values'
            subtitle='Update values for each template. Formula columns are auto-calculated.'
            beforeCanvas={statusMessages}
          />
        </>
      ) : (
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
