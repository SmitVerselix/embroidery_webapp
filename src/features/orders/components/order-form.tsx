'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  getProducts,
  getProduct,
  createOrder,
  getOrders,
  getOrder,
  getCustomers
} from '@/lib/api/services';
import { getError } from '@/lib/api/axios';
import type {
  Product,
  Customer,
  Order,
  OrderWithDetails,
  OrderTemplateData,
  TemplateWithDetails,
  OrderTemplatePayload,
  OrderExtraValuePayload,
  OrderBlockValuePayload,
  CreateOrderData,
  DiscountType,
  TemplateSummaryPayload
} from '@/lib/api/types';
import { ORDER_TYPES } from '@/lib/api/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Loader2,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Package,
  Users,
  Search,
  FileText,
  X,
  Link2
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { useDebounce } from '@/hooks/use-debounce';

// =============================================================================
// HELPERS
// =============================================================================

const getChildKey = (parentTmplId: string, idx: number) =>
  `${parentTmplId}__child__${idx}`;

// =============================================================================
// SCHEMA
// =============================================================================

const orderFormSchema = z
  .object({
    orderNo: z
      .string()
      .min(1, 'Order number is required')
      .max(50, 'Order number must be less than 50 characters'),
    referenceNo: z.string().optional(),
    productId: z.string().optional(),
    orderType: z.enum(['SAMPLE', 'PRODUCTION', 'CUSTOM'], {
      message: 'Please select an order type'
    }),
    description: z.string().optional(),
    customerId: z.string().optional()
  })
  .superRefine((data, ctx) => {
    if (
      (!data.referenceNo || data.referenceNo.trim() === '') &&
      (!data.productId || data.productId.trim() === '')
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Please select a product',
        path: ['productId']
      });
    if (
      data.orderType !== 'SAMPLE' &&
      (!data.customerId || data.customerId.trim() === '')
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Please select a customer',
        path: ['customerId']
      });
  });

type OrderFormData = z.infer<typeof orderFormSchema>;

// =============================================================================
// HELPER: Build array-based ExtraValuesMap from API extraValues array
// =============================================================================

function buildExtraValuesMap(
  extraValues: {
    templateExtraFieldId: string;
    value: string;
    id?: string;
    orderIndex?: number;
    meta?: unknown;
  }[]
): ExtraValuesMap {
  const map: ExtraValuesMap = {};
  (extraValues || []).forEach((ev) => {
    if (!map[ev.templateExtraFieldId]) map[ev.templateExtraFieldId] = [];
    map[ev.templateExtraFieldId].push({
      value: ev.value,
      orderExtraValueId: ev.id,
      orderIndex: ev.orderIndex ?? map[ev.templateExtraFieldId].length,
      meta: (ev.meta as Record<string, any>) ?? null
    });
  });
  Object.values(map).forEach((arr) =>
    arr.sort((a, b) => a.orderIndex - b.orderIndex)
  );
  return map;
}

// =============================================================================
// PROPS
// =============================================================================

interface OrderFormProps {
  companyId: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function OrderForm({ companyId }: OrderFormProps) {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [productError, setProductError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [ordersList, setOrdersList] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [ordersSearch, setOrdersSearch] = useState('');
  const [isOrdersPopoverOpen, setIsOrdersPopoverOpen] = useState(false);
  const debouncedOrdersSearch = useDebounce(ordersSearch, 300);
  const [referencedOrder, setReferencedOrder] =
    useState<OrderWithDetails | null>(null);
  const [referencedOrderId, setReferencedOrderId] = useState<string | null>(
    null
  );
  const [isLoadingReference, setIsLoadingReference] = useState(false);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [refChildrenMeta, setRefChildrenMeta] = useState<
    Record<string, { templateId: string }[]>
  >({});
  const isReferenceModeRef = useRef(false);
  const [templates, setTemplates] = useState<TemplateWithDetails[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);

  // ── Template values & helpers ─────────────────────────────────────
  const [templateValues, setTemplateValues] = useState<
    Record<string, TemplateValuesMap>
  >({});
  const [extraValues, setExtraValues] = useState<
    Record<string, ExtraValuesMap>
  >({});
  const [templateDiscounts, setTemplateDiscounts] = useState<
    Record<string, { discountType: DiscountType; discountValue: string }>
  >({});
  const [templateBlockValues, setTemplateBlockValues] = useState<
    Record<string, BlockValuesMap>
  >({});
  const [templateAdditionalCosts, setTemplateAdditionalCosts] = useState<
    Record<string, AdditionalCostItem[]>
  >({});

  // ── Child template state ──────────────────────────────────────────
  const [childTemplateValues, setChildTemplateValues] = useState<
    Record<string, TemplateValuesMap>
  >({});
  const [childExtraValues, setChildExtraValues] = useState<
    Record<string, ExtraValuesMap>
  >({});
  const [childDiscounts, setChildDiscounts] = useState<
    Record<string, { discountType: DiscountType; discountValue: string }>
  >({});
  const [childBlockValues, setChildBlockValues] = useState<
    Record<string, BlockValuesMap>
  >({});
  const [childAdditionalCosts, setChildAdditionalCosts] = useState<
    Record<string, AdditionalCostItem[]>
  >({});

  // ── Errors / submission ───────────────────────────────────────────
  const [cellErrors, setCellErrors] = useState<
    Record<string, Record<string, string>>
  >({});
  const [extraFieldErrors, setExtraFieldErrors] = useState<
    Record<string, Record<string, string>>
  >({});
  const [childCellErrors, setChildCellErrors] = useState<
    Record<string, Record<string, string>>
  >({});
  const [childExtraFieldErrors, setChildExtraFieldErrors] = useState<
    Record<string, Record<string, string>>
  >({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm<OrderFormData>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      orderNo: '',
      referenceNo: '',
      productId: '',
      orderType: undefined,
      description: '',
      customerId: ''
    }
  });

  const selectedProductId = watch('productId');
  const selectedOrderType = watch('orderType');
  const selectedCustomerId = watch('customerId');
  const referenceNoValue = watch('referenceNo');
  const isReferenceMode = !!referencedOrder;

  // ── Fetch customers ───────────────────────────────────────────────
  useEffect(() => {
    const f = async () => {
      setIsLoadingCustomers(true);
      setCustomerError(null);
      try {
        const res = await getCustomers(companyId, {
          page: 1,
          limit: 1000,
          sortBy: 'createdAt',
          sortOrder: 'DESC'
        });
        setCustomers(res.rows);
      } catch (err) {
        setCustomerError(getError(err));
      } finally {
        setIsLoadingCustomers(false);
      }
    };
    if (companyId) f();
  }, [companyId]);

  // ── Fetch products ────────────────────────────────────────────────
  useEffect(() => {
    const f = async () => {
      setIsLoadingProducts(true);
      setProductError(null);
      try {
        const res = await getProducts(companyId, {
          page: 1,
          limit: 100,
          sortBy: 'createdAt',
          sortOrder: 'ASC'
        });
        setProducts(res.rows);
      } catch (err) {
        setProductError(getError(err));
      } finally {
        setIsLoadingProducts(false);
      }
    };
    if (companyId) f();
  }, [companyId]);

  // ── Fetch orders for reference picker ────────────────────────────
  useEffect(() => {
    const f = async () => {
      setIsLoadingOrders(true);
      try {
        const res = await getOrders(companyId, {
          page: 1,
          limit: 20,
          search: debouncedOrdersSearch,
          sortBy: 'createdAt',
          sortOrder: 'DESC',
          orderType: 'SAMPLE'
        });
        setOrdersList(res.rows);
      } catch {
      } finally {
        setIsLoadingOrders(false);
      }
    };
    if (companyId) f();
  }, [companyId, debouncedOrdersSearch]);

  // ── Fetch templates when product changes (non-reference mode) ─────
  useEffect(() => {
    if (isReferenceModeRef.current) return;
    const fetchTemplatesForProduct = async () => {
      if (!selectedProductId) {
        setTemplates([]);
        setTemplateValues({});
        setExtraValues({});
        setTemplateDiscounts({});
        setTemplateBlockValues({});
        setTemplateAdditionalCosts({});
        setCellErrors({});
        setExtraFieldErrors({});
        clearChildState();
        return;
      }
      setIsLoadingTemplates(true);
      setTemplateError(null);
      setTemplates([]);
      setTemplateValues({});
      setExtraValues({});
      setTemplateDiscounts({});
      setTemplateBlockValues({});
      setTemplateAdditionalCosts({});
      setCellErrors({});
      setExtraFieldErrors({});
      clearChildState();
      try {
        const product = await getProduct(companyId, selectedProductId);
        const fullTemplates = (product.templates ||
          []) as TemplateWithDetails[];
        if (fullTemplates.length === 0) {
          setTemplates([]);
          setIsLoadingTemplates(false);
          return;
        }
        setTemplates(fullTemplates);
        const iv: Record<string, TemplateValuesMap> = {};
        const ie: Record<string, ExtraValuesMap> = {};
        const id: Record<
          string,
          { discountType: DiscountType; discountValue: string }
        > = {};
        const ib: Record<string, BlockValuesMap> = {};
        const iac: Record<string, AdditionalCostItem[]> = {};
        fullTemplates.forEach((t) => {
          iv[t.id] = {};
          ie[t.id] = {};
          id[t.id] = { discountType: 'PERCENT', discountValue: '0' };
          ib[t.id] = {};
          iac[t.id] = [];
        });
        setTemplateValues(iv);
        setExtraValues(ie);
        setTemplateDiscounts(id);
        setTemplateBlockValues(ib);
        setTemplateAdditionalCosts(iac);
      } catch (err) {
        setTemplateError(getError(err));
      } finally {
        setIsLoadingTemplates(false);
      }
    };
    fetchTemplatesForProduct();
  }, [companyId, selectedProductId]);

  useEffect(() => {
    if (selectedOrderType === 'SAMPLE') setValue('customerId', '');
  }, [selectedOrderType, setValue]);

  const clearChildState = useCallback(() => {
    setRefChildrenMeta({});
    setChildTemplateValues({});
    setChildExtraValues({});
    setChildDiscounts({});
    setChildBlockValues({});
    setChildAdditionalCosts({});
    setChildCellErrors({});
    setChildExtraFieldErrors({});
  }, []);

  // ── Select reference order ────────────────────────────────────────
  const handleSelectReferenceOrder = useCallback(
    async (order: Order) => {
      setIsOrdersPopoverOpen(false);
      setOrdersSearch('');
      setReferenceError(null);
      setValue('referenceNo', order.orderNo);
      setReferencedOrderId(order.id);
      setIsLoadingReference(true);
      try {
        const orderData = await getOrder(companyId, order.id);
        setReferencedOrder(orderData);
        isReferenceModeRef.current = true;
        setValue('productId', orderData.productId);
        const product = await getProduct(companyId, orderData.productId);
        const templateCache: Record<string, TemplateWithDetails> = {};
        const fullTemplates = (product.templates ||
          []) as TemplateWithDetails[];
        if (fullTemplates.length > 0) {
          fullTemplates.forEach((t) => {
            templateCache[t.id] = t;
          });
          setTemplates(fullTemplates);
        } else {
          setTemplates([]);
        }
        const loadedValues: Record<string, TemplateValuesMap> = {};
        const loadedExtraValues: Record<string, ExtraValuesMap> = {};
        const loadedDiscounts: Record<
          string,
          { discountType: DiscountType; discountValue: string }
        > = {};
        const loadedBlockValues: Record<string, BlockValuesMap> = {};
        const loadedAdditionalCosts: Record<string, AdditionalCostItem[]> = {};
        const loadedChildMeta: Record<string, { templateId: string }[]> = {};
        const loadedChildValues: Record<string, TemplateValuesMap> = {};
        const loadedChildExtras: Record<string, ExtraValuesMap> = {};
        const loadedChildDiscounts: Record<
          string,
          { discountType: DiscountType; discountValue: string }
        > = {};
        const loadedChildBlockValues: Record<string, BlockValuesMap> = {};
        const loadedChildAdditionalCosts: Record<string, AdditionalCostItem[]> =
          {};

        Object.values(templateCache).forEach((t) => {
          loadedValues[t.id] = {};
          loadedExtraValues[t.id] = {};
          loadedDiscounts[t.id] = {
            discountType: 'PERCENT',
            discountValue: '0'
          };
          loadedBlockValues[t.id] = {};
          loadedAdditionalCosts[t.id] = [];
        });

        (orderData.templates || []).forEach((tmplData: OrderTemplateData) => {
          const tid = tmplData.templateId;
          const valuesMap: TemplateValuesMap = {};
          (tmplData.values || []).forEach((v) => {
            if (!valuesMap[v.rowId]) valuesMap[v.rowId] = {};
            valuesMap[v.rowId][v.columnId] = v.calculatedValue ?? v.value ?? '';
          });
          loadedValues[tid] = valuesMap;
          loadedExtraValues[tid] = buildExtraValuesMap(
            tmplData.extraValues || []
          );
          const rawSummary = tmplData.summary;
          if (rawSummary) {
            loadedDiscounts[tid] = {
              discountType:
                (rawSummary.discountType as DiscountType) || 'PERCENT',
              discountValue: rawSummary.discount ?? '0'
            };
          }

          // Pre-fill additional costs from reference
          const apiAdditionalCosts =
            (tmplData as any).additionalTemplateCosts || [];
          loadedAdditionalCosts[tid] = (
            apiAdditionalCosts as {
              costName: string;
              cost: string;
              notes: string | null;
              indexNo: number;
            }[]
          )
            .sort((a, b) => a.indexNo - b.indexNo)
            .map((c, i) => ({
              // no `id` here — these will be new records on the new order
              costName: c.costName,
              cost: c.cost,
              notes: c.notes ?? '',
              indexNo: i
            }));

          if (tmplData.children && tmplData.children.length > 0) {
            loadedChildMeta[tid] = [];
            tmplData.children.forEach((child, idx) => {
              const childKey = getChildKey(tid, idx);
              loadedChildMeta[tid].push({ templateId: child.templateId });
              const childValMap: TemplateValuesMap = {};
              (child.values || []).forEach((v) => {
                if (!childValMap[v.rowId]) childValMap[v.rowId] = {};
                childValMap[v.rowId][v.columnId] =
                  v.calculatedValue ?? v.value ?? '';
              });
              loadedChildValues[childKey] = childValMap;
              loadedChildExtras[childKey] = buildExtraValuesMap(
                child.extraValues || []
              );
              const childSummary = child.summary;
              loadedChildDiscounts[childKey] = {
                discountType:
                  (childSummary?.discountType as DiscountType) || 'PERCENT',
                discountValue: childSummary?.discount ?? '0'
              };
              loadedChildBlockValues[childKey] = {};
              // Pre-fill child additional costs from reference
              const childApiCosts =
                (child as any).additionalTemplateCosts || [];
              loadedChildAdditionalCosts[childKey] = (
                childApiCosts as {
                  costName: string;
                  cost: string;
                  notes: string | null;
                  indexNo: number;
                }[]
              )
                .sort((a, b) => a.indexNo - b.indexNo)
                .map((c, i) => ({
                  costName: c.costName,
                  cost: c.cost,
                  notes: c.notes ?? '',
                  indexNo: i
                }));
            });
          }
        });

        setTemplateValues(loadedValues);
        setExtraValues(loadedExtraValues);
        setTemplateDiscounts(loadedDiscounts);
        setTemplateBlockValues(loadedBlockValues);
        setTemplateAdditionalCosts(loadedAdditionalCosts);
        setRefChildrenMeta(loadedChildMeta);
        setChildTemplateValues(loadedChildValues);
        setChildExtraValues(loadedChildExtras);
        setChildDiscounts(loadedChildDiscounts);
        setChildBlockValues(loadedChildBlockValues);
        setChildAdditionalCosts(loadedChildAdditionalCosts);
        setCellErrors({});
        setExtraFieldErrors({});
        setChildCellErrors({});
        setChildExtraFieldErrors({});
        setTemplateError(null);
      } catch (err) {
        setReferenceError(getError(err));
        setReferencedOrder(null);
        setReferencedOrderId(null);
        isReferenceModeRef.current = false;
      } finally {
        setIsLoadingReference(false);
      }
    },
    [companyId, setValue]
  );

  const handleClearReference = useCallback(() => {
    setValue('referenceNo', '');
    setValue('productId', '');
    setReferencedOrder(null);
    setReferencedOrderId(null);
    setReferenceError(null);
    isReferenceModeRef.current = false;
    setTemplates([]);
    setTemplateValues({});
    setExtraValues({});
    setTemplateDiscounts({});
    setTemplateBlockValues({});
    setTemplateAdditionalCosts({});
    setCellErrors({});
    setExtraFieldErrors({});
    clearChildState();
  }, [setValue, clearChildState]);

  // ── Change handlers ───────────────────────────────────────────────
  const handleTemplateValuesChange = useCallback(
    (templateId: string, values: TemplateValuesMap) => {
      setTemplateValues((p) => ({ ...p, [templateId]: values }));
      setCellErrors((p) => ({ ...p, [templateId]: {} }));
    },
    []
  );
  const handleExtraValuesChange = useCallback(
    (templateId: string, values: ExtraValuesMap) => {
      setExtraValues((p) => ({ ...p, [templateId]: values }));
      setExtraFieldErrors((p) => ({ ...p, [templateId]: {} }));
    },
    []
  );
  const handleDiscountChange = useCallback(
    (templateId: string, type: DiscountType, value: string) => {
      setTemplateDiscounts((p) => ({
        ...p,
        [templateId]: { discountType: type, discountValue: value }
      }));
    },
    []
  );
  const handleBlockValuesChange = useCallback(
    (templateId: string, values: BlockValuesMap) => {
      setTemplateBlockValues((p) => ({ ...p, [templateId]: values }));
    },
    []
  );
  const handleAdditionalCostsChange = useCallback(
    (templateId: string, costs: AdditionalCostItem[]) => {
      setTemplateAdditionalCosts((p) => ({ ...p, [templateId]: costs }));
    },
    []
  );

  // ── Child handlers ────────────────────────────────────────────────
  const handleChildValuesChange = useCallback(
    (childKey: string, values: TemplateValuesMap) => {
      setChildTemplateValues((p) => ({ ...p, [childKey]: values }));
      setChildCellErrors((p) => ({ ...p, [childKey]: {} }));
    },
    []
  );
  const handleChildExtraValuesChange = useCallback(
    (childKey: string, values: ExtraValuesMap) => {
      setChildExtraValues((p) => ({ ...p, [childKey]: values }));
      setChildExtraFieldErrors((p) => ({ ...p, [childKey]: {} }));
    },
    []
  );
  const handleChildDiscountChange = useCallback(
    (childKey: string, type: DiscountType, value: string) => {
      setChildDiscounts((p) => ({
        ...p,
        [childKey]: { discountType: type, discountValue: value }
      }));
    },
    []
  );
  const handleChildBlockValuesChange = useCallback(
    (childKey: string, values: BlockValuesMap) => {
      setChildBlockValues((p) => ({ ...p, [childKey]: values }));
    },
    []
  );
  const handleChildAdditionalCostsChange = useCallback(
    (childKey: string, costs: AdditionalCostItem[]) => {
      setChildAdditionalCosts((p) => ({ ...p, [childKey]: costs }));
    },
    []
  );

  // ── Validation ────────────────────────────────────────────────────
  const validateTemplateValues = useCallback((): boolean => {
    let isValid = true;
    const validateValues = (
      tmpl: TemplateWithDetails,
      vals: TemplateValuesMap,
      exVals: ExtraValuesMap
    ) => {
      const cErrors: Record<string, string> = {};
      const eErrors: Record<string, string> = {};
      (tmpl.rows || []).forEach((row) => {
        (tmpl.columns || []).forEach((col) => {
          if (col.dataType === 'FORMULA') return;
          const value = vals[row.id]?.[col.id] || '';
          const cellKey = `${row.id}-${col.id}`;
          if (col.isRequired && !value.trim()) {
            cErrors[cellKey] = 'Required';
            isValid = false;
            return;
          }
          if (col.dataType === 'NUMBER' && value.trim()) {
            if (isNaN(Number(value))) {
              cErrors[cellKey] = 'Must be a number';
              isValid = false;
            }
          }
        });
      });
      (tmpl.extra || []).forEach((extra) => {
        const items = exVals[extra.id] || [];
        if (extra.isRequired) {
          if (!items.some((i) => i.value.trim() !== '')) {
            eErrors[extra.id] = 'Required';
            isValid = false;
          }
        }
        if (extra.valueType === 'NUMBER') {
          items.forEach((item, idx) => {
            if (item.value.trim() && isNaN(Number(item.value))) {
              eErrors[`${extra.id}__${idx}`] = 'Must be a number';
              isValid = false;
            }
          });
        }
      });
      return { cErrors, eErrors };
    };

    const newCE: Record<string, Record<string, string>> = {};
    const newEE: Record<string, Record<string, string>> = {};
    templates.forEach((t) => {
      const { cErrors, eErrors } = validateValues(
        t,
        templateValues[t.id] || {},
        extraValues[t.id] || {}
      );
      newCE[t.id] = cErrors;
      newEE[t.id] = eErrors;
    });
    setCellErrors(newCE);
    setExtraFieldErrors(newEE);

    const newCCE: Record<string, Record<string, string>> = {};
    const newCEE: Record<string, Record<string, string>> = {};
    Object.entries(refChildrenMeta).forEach(([parentTmplId, children]) => {
      const parentTmpl = templates.find((t) => t.id === parentTmplId);
      if (!parentTmpl) return;
      children.forEach((_, idx) => {
        const childKey = getChildKey(parentTmplId, idx);
        const { cErrors, eErrors } = validateValues(
          parentTmpl,
          childTemplateValues[childKey] || {},
          childExtraValues[childKey] || {}
        );
        newCCE[childKey] = cErrors;
        newCEE[childKey] = eErrors;
      });
    });
    setChildCellErrors(newCCE);
    setChildExtraFieldErrors(newCEE);
    return isValid;
  }, [
    templates,
    templateValues,
    extraValues,
    refChildrenMeta,
    childTemplateValues,
    childExtraValues
  ]);

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

  const flattenExtraValues = useCallback(
    (tmplExtras: any[], exVals: ExtraValuesMap): OrderExtraValuePayload[] => {
      const result: OrderExtraValuePayload[] = [];
      tmplExtras.forEach((extra: any) => {
        const items = exVals[extra.id] || [];
        items.forEach((item) => {
          if (item.value.trim())
            result.push({
              templateExtraFieldId: extra.id,
              value: item.value.trim(),
              meta:
                item.meta && Object.keys(item.meta).length > 0
                  ? item.meta
                  : null,
              orderIndex: item.orderIndex
            });
        });
      });
      return result;
    },
    []
  );

  const buildAdditionalCostsPayload = useCallback(
    (costs: AdditionalCostItem[]) =>
      costs.map((c, i) => ({
        costName: c.costName,
        cost: parseFloat(c.cost) || 0,
        notes: c.notes || ''
      })),
    []
  );

  // ── Template layout items ─────────────────────────────────────────
  const templateLayoutItems: TemplateLayoutItem[] = useMemo(() => {
    return templates.map((tmpl) => {
      const childMeta = refChildrenMeta[tmpl.id];
      const hasChildren = childMeta && childMeta.length > 0;
      return {
        id: tmpl.id,
        label: tmpl.name || tmpl.id,
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
                      — {childMeta.length} child
                      {childMeta.length !== 1 ? 'ren' : ''} from reference
                    </span>
                  </Badge>
                )}
              </div>
              <OrderTemplateValues
                template={tmpl}
                values={templateValues[tmpl.id] || {}}
                onChange={(vals) => handleTemplateValuesChange(tmpl.id, vals)}
                errors={cellErrors[tmpl.id] || {}}
                disabled={isSubmitting}
                extraValues={extraValues[tmpl.id] || {}}
                onExtraValuesChange={(vals) =>
                  handleExtraValuesChange(tmpl.id, vals)
                }
                extraErrors={extraFieldErrors[tmpl.id] || {}}
                discountType={
                  templateDiscounts[tmpl.id]?.discountType || 'PERCENT'
                }
                discountValue={templateDiscounts[tmpl.id]?.discountValue || '0'}
                onDiscountChange={(type, value) =>
                  handleDiscountChange(tmpl.id, type, value)
                }
                apiBlocks={tmpl.blocks || []}
                blockValues={templateBlockValues[tmpl.id] || {}}
                onBlockValuesChange={(vals) =>
                  handleBlockValuesChange(tmpl.id, vals)
                }
                additionalCosts={templateAdditionalCosts[tmpl.id] || []}
                onAdditionalCostsChange={(costs) =>
                  handleAdditionalCostsChange(tmpl.id, costs)
                }
                companyId={companyId}
                productId={
                  selectedProductId || referencedOrder?.productId || ''
                }
                templateId={tmpl.id}
              />
            </div>
            {hasChildren &&
              childMeta.map((_, idx) => {
                const childKey = getChildKey(tmpl.id, idx);
                return (
                  <div key={childKey} className='min-w-0 flex-1 space-y-2'>
                    <Badge variant='secondary' className='text-xs'>
                      Child #{idx + 1}
                    </Badge>
                    <OrderTemplateValues
                      template={tmpl}
                      values={childTemplateValues[childKey] || {}}
                      onChange={(vals) =>
                        handleChildValuesChange(childKey, vals)
                      }
                      errors={childCellErrors[childKey] || {}}
                      disabled={isSubmitting}
                      extraValues={childExtraValues[childKey] || {}}
                      onExtraValuesChange={(vals) =>
                        handleChildExtraValuesChange(childKey, vals)
                      }
                      extraErrors={childExtraFieldErrors[childKey] || {}}
                      discountType={
                        childDiscounts[childKey]?.discountType || 'PERCENT'
                      }
                      discountValue={
                        childDiscounts[childKey]?.discountValue || '0'
                      }
                      onDiscountChange={(type, value) =>
                        handleChildDiscountChange(childKey, type, value)
                      }
                      apiBlocks={tmpl.blocks || []}
                      blockValues={childBlockValues[childKey] || {}}
                      onBlockValuesChange={(vals) =>
                        handleChildBlockValuesChange(childKey, vals)
                      }
                      additionalCosts={childAdditionalCosts[childKey] || []}
                      onAdditionalCostsChange={(costs) =>
                        handleChildAdditionalCostsChange(childKey, costs)
                      }
                      companyId={companyId}
                      productId={
                        selectedProductId || referencedOrder?.productId || ''
                      }
                      templateId={tmpl.id}
                    />
                  </div>
                );
              })}
          </div>
        )
      };
    });
  }, [
    templates,
    refChildrenMeta,
    templateValues,
    extraValues,
    cellErrors,
    extraFieldErrors,
    templateDiscounts,
    templateBlockValues,
    templateAdditionalCosts,
    childTemplateValues,
    childExtraValues,
    childCellErrors,
    childExtraFieldErrors,
    childDiscounts,
    childBlockValues,
    childAdditionalCosts,
    isSubmitting,
    handleTemplateValuesChange,
    handleExtraValuesChange,
    handleDiscountChange,
    handleBlockValuesChange,
    handleAdditionalCostsChange,
    handleChildValuesChange,
    handleChildExtraValuesChange,
    handleChildDiscountChange,
    handleChildBlockValuesChange,
    handleChildAdditionalCostsChange
  ]);

  // ── Submit ────────────────────────────────────────────────────────
  const onSubmit = async (data: OrderFormData) => {
    setSubmitError(null);
    if (!validateTemplateValues()) {
      setSubmitError(
        'Please fix the validation errors in the template values below.'
      );
      return;
    }
    setIsSubmitting(true);
    try {
      const templatesPayload: OrderTemplatePayload[] = templates.map((tmpl) => {
        const tmplValues = templateValues[tmpl.id] || {};
        const columns = tmpl.columns || [];
        const rows = tmpl.rows || [];
        const tmplExtras = tmpl.extra || [];
        const values: { value: string; rowId: string; columnId: string }[] = [];
        rows.forEach((row) => {
          columns.forEach((col) => {
            if (col.dataType === 'FORMULA') return;
            const value = tmplValues[row.id]?.[col.id] || '';
            if (value.trim())
              values.push({
                value: value.trim(),
                rowId: row.id,
                columnId: col.id
              });
          });
        });
        const extravalues = flattenExtraValues(
          tmplExtras,
          extraValues[tmpl.id] || {}
        );
        const discount = templateDiscounts[tmpl.id] || {
          discountType: 'PERCENT' as DiscountType,
          discountValue: '0'
        };
        const summary: TemplateSummaryPayload = {
          discountType: discount.discountType,
          discountValue: discount.discountValue || '0'
        };
        const blockvalues = buildBlockValuesPayload(
          templateBlockValues[tmpl.id] || {}
        );
        const additionalCosts = buildAdditionalCostsPayload(
          templateAdditionalCosts[tmpl.id] || []
        );

        const payload: OrderTemplatePayload = {
          templateId: tmpl.id,
          values,
          summary,
          ...(blockvalues.length > 0 ? { blockvalues } : {})
        };
        if (extravalues.length > 0) payload.extravalues = extravalues;
        if (additionalCosts.length > 0)
          (payload as any).additionalCosts = additionalCosts;

        const childMeta = refChildrenMeta[tmpl.id];
        if (childMeta && childMeta.length > 0) {
          payload.children = childMeta.map((meta, idx) => {
            const childKey = getChildKey(tmpl.id, idx);
            const childVals = childTemplateValues[childKey] || {};
            const childExVals = childExtraValues[childKey] || {};
            const childDisc = childDiscounts[childKey] || {
              discountType: 'PERCENT' as DiscountType,
              discountValue: '0'
            };
            const cValues: {
              value: string;
              rowId: string;
              columnId: string;
            }[] = [];
            rows.forEach((row) => {
              columns.forEach((col) => {
                if (col.dataType === 'FORMULA') return;
                const v = childVals[row.id]?.[col.id] || '';
                if (v.trim())
                  cValues.push({
                    value: v.trim(),
                    rowId: row.id,
                    columnId: col.id
                  });
              });
            });
            const cExtras = flattenExtraValues(tmplExtras, childExVals);
            const cSummary: TemplateSummaryPayload = {
              discountType: childDisc.discountType,
              discountValue: childDisc.discountValue || '0'
            };
            const cBlockvalues = buildBlockValuesPayload(
              childBlockValues[childKey] || {}
            );
            const cAdditionalCosts = buildAdditionalCostsPayload(
              childAdditionalCosts[childKey] || []
            );

            const childPayload: OrderTemplatePayload = {
              templateId: meta.templateId,
              values: cValues,
              summary: cSummary,
              ...(cBlockvalues.length > 0 ? { blockvalues: cBlockvalues } : {})
            };
            if (cExtras.length > 0) childPayload.extravalues = cExtras;
            if (cAdditionalCosts.length > 0)
              (childPayload as any).additionalCosts = cAdditionalCosts;
            return childPayload;
          });
        }
        return payload;
      });

      const productId = data.productId || referencedOrder?.productId || '';
      const createData: CreateOrderData = {
        orderNo: data.orderNo,
        productId,
        orderType: data.orderType,
        description: data.description || undefined,
        ...(data.referenceNo ? { referenceNo: data.referenceNo } : {}),
        ...(data.customerId ? { customerId: data.customerId } : {}),
        templates: templatesPayload
      };
      await createOrder(companyId, createData);
      router.push(`/dashboard/${companyId}/orders`);
      router.refresh();
    } catch (err) {
      setSubmitError(getError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const backUrl = `/dashboard/${companyId}/orders`;
  const totalCellErrors = useMemo(() => {
    let count = 0;
    Object.values(cellErrors).forEach((e) => {
      count += Object.keys(e).length;
    });
    Object.values(extraFieldErrors).forEach((e) => {
      count += Object.keys(e).length;
    });
    Object.values(childCellErrors).forEach((e) => {
      count += Object.keys(e).length;
    });
    Object.values(childExtraFieldErrors).forEach((e) => {
      count += Object.keys(e).length;
    });
    return count;
  }, [cellErrors, extraFieldErrors, childCellErrors, childExtraFieldErrors]);

  const hasTemplates = templates.length > 0;
  const showTemplateSection = isReferenceMode ? true : !!selectedProductId;

  return (
    <div className='space-y-6'>
      <Link
        href={backUrl}
        className='text-muted-foreground hover:text-foreground inline-flex items-center text-sm'
      >
        <ArrowLeft className='mr-2 h-4 w-4' />
        Back to Designs
      </Link>

      <form onSubmit={handleSubmit(onSubmit)} className='space-y-6'>
        <Card>
          <CardHeader>
            <CardTitle>Design Details</CardTitle>
            <CardDescription>
              Enter the basic information for your design
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            {(submitError || productError) && (
              <div className='bg-destructive/15 text-destructive flex items-start gap-2 rounded-md p-3 text-sm'>
                <AlertCircle className='mt-0.5 h-4 w-4 flex-shrink-0' />
                <span>{submitError || productError}</span>
              </div>
            )}

            <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
              <div className='space-y-2'>
                <Label htmlFor='orderNo'>
                  Design Number <span className='text-destructive'>*</span>
                </Label>
                <Input
                  id='orderNo'
                  placeholder='e.g., ORD-001'
                  disabled={isSubmitting}
                  {...register('orderNo')}
                  className={errors.orderNo ? 'border-destructive' : ''}
                />
                {errors.orderNo && (
                  <p className='text-destructive text-sm'>
                    {errors.orderNo.message}
                  </p>
                )}
              </div>
              <div className='space-y-2'>
                <Label>
                  Design Type <span className='text-destructive'>*</span>
                </Label>
                <Select
                  value={selectedOrderType}
                  onValueChange={(v) => setValue('orderType', v as any)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger
                    className={errors.orderType ? 'border-destructive' : ''}
                  >
                    <SelectValue placeholder='Select order type' />
                  </SelectTrigger>
                  <SelectContent>
                    {ORDER_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.orderType && (
                  <p className='text-destructive text-sm'>
                    {errors.orderType.message}
                  </p>
                )}
              </div>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='referenceNo'>Reference No</Label>
              {isReferenceMode ? (
                <div className='flex items-center gap-2'>
                  <div className='bg-muted flex flex-1 items-center gap-2 rounded-md border px-3 py-2'>
                    <Link2 className='text-primary h-4 w-4 flex-shrink-0' />
                    <span className='text-sm font-medium'>
                      #{referencedOrder.orderNo}
                    </span>
                    <Badge variant='secondary' className='ml-1 text-[10px]'>
                      {referencedOrder.orderType}
                    </Badge>
                    {referencedOrder.product?.name && (
                      <span className='text-muted-foreground ml-auto text-xs'>
                        {referencedOrder.product.name}
                      </span>
                    )}
                  </div>
                  <Button
                    type='button'
                    variant='outline'
                    size='icon'
                    className='h-9 w-9 flex-shrink-0'
                    onClick={handleClearReference}
                    disabled={isSubmitting}
                    title='Clear reference'
                  >
                    <X className='h-4 w-4' />
                  </Button>
                </div>
              ) : (
                <Popover
                  open={isOrdersPopoverOpen}
                  onOpenChange={setIsOrdersPopoverOpen}
                >
                  <PopoverTrigger asChild>
                    <div className='relative'>
                      <Input
                        id='referenceNo'
                        placeholder='Click to select from existing orders'
                        disabled={isSubmitting || isLoadingReference}
                        value={referenceNoValue || ''}
                        readOnly
                        onFocus={() => setIsOrdersPopoverOpen(true)}
                        className='cursor-pointer pr-10'
                      />
                      {isLoadingReference ? (
                        <Loader2 className='text-muted-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin' />
                      ) : (
                        <FileText className='text-muted-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2' />
                      )}
                    </div>
                  </PopoverTrigger>
                  <PopoverContent
                    className='w-[var(--radix-popover-trigger-width)] p-0'
                    align='start'
                    onOpenAutoFocus={(e) => e.preventDefault()}
                  >
                    <div className='border-b p-2'>
                      <div className='relative'>
                        <Search className='text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2' />
                        <Input
                          placeholder='Search orders...'
                          value={ordersSearch}
                          onChange={(e) => setOrdersSearch(e.target.value)}
                          className='h-8 pl-8 text-sm'
                        />
                      </div>
                    </div>
                    <div className='max-h-[220px] overflow-y-auto'>
                      {isLoadingOrders ? (
                        <div className='flex items-center justify-center py-4'>
                          <Loader2 className='text-muted-foreground h-4 w-4 animate-spin' />
                        </div>
                      ) : ordersList.length === 0 ? (
                        <div className='text-muted-foreground py-4 text-center text-sm'>
                          No designs found
                        </div>
                      ) : (
                        ordersList.map((o) => (
                          <button
                            key={o.id}
                            type='button'
                            className='hover:bg-accent flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors'
                            onClick={() => handleSelectReferenceOrder(o)}
                          >
                            <div className='flex items-center gap-2'>
                              <span className='font-medium'>#{o.orderNo}</span>
                              <Badge variant='outline' className='text-[10px]'>
                                {o.orderType}
                              </Badge>
                            </div>
                            <span className='text-muted-foreground text-xs'>
                              {o.status || 'DRAFT'}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              {referenceError && (
                <p className='text-destructive text-sm'>{referenceError}</p>
              )}
              <p className='text-muted-foreground text-xs'>
                {isReferenceMode
                  ? 'Order data loaded from reference. Clear to select a different product manually.'
                  : 'Select an existing order to copy its data. Product will be auto-selected.'}
              </p>
            </div>

            {!isReferenceMode && (
              <div className='space-y-2'>
                <Label>
                  Product <span className='text-destructive'>*</span>
                </Label>
                {isLoadingProducts ? (
                  <Skeleton className='h-10 w-full' />
                ) : (
                  <Select
                    value={selectedProductId || ''}
                    onValueChange={(v) => setValue('productId', v)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger
                      className={errors.productId ? 'border-destructive' : ''}
                    >
                      <SelectValue placeholder='Select a product' />
                    </SelectTrigger>
                    <SelectContent>
                      {products.length === 0 ? (
                        <div className='text-muted-foreground px-2 py-3 text-center text-sm'>
                          No products available.
                        </div>
                      ) : (
                        products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            <span className='flex items-center gap-2'>
                              <Package className='h-3 w-3' />
                              {p.name}
                            </span>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
                {errors.productId && (
                  <p className='text-destructive text-sm'>
                    {errors.productId.message}
                  </p>
                )}
              </div>
            )}

            {selectedOrderType !== 'SAMPLE' && (
              <div className='space-y-2'>
                <Label>
                  Customer <span className='text-destructive'>*</span>
                </Label>
                {isLoadingCustomers ? (
                  <Skeleton className='h-10 w-full' />
                ) : (
                  <Select
                    value={selectedCustomerId}
                    onValueChange={(v) => setValue('customerId', v)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger
                      className={errors.customerId ? 'border-destructive' : ''}
                    >
                      <SelectValue placeholder='Select a customer' />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.length === 0 ? (
                        <div className='text-muted-foreground px-2 py-3 text-center text-sm'>
                          No customers available.
                        </div>
                      ) : (
                        customers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            <span className='flex items-center gap-2'>
                              <Users className='h-3 w-3' />
                              {c.name}
                              <span className='text-muted-foreground text-xs'>
                                ({c.referenceCode})
                              </span>
                            </span>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
                {customerError && (
                  <p className='text-destructive text-sm'>{customerError}</p>
                )}
                {errors.customerId && (
                  <p className='text-destructive text-sm'>
                    {errors.customerId.message}
                  </p>
                )}
              </div>
            )}

            <div className='space-y-2'>
              <Label htmlFor='description'>Description</Label>
              <Textarea
                id='description'
                placeholder='Enter order description (optional)'
                disabled={isSubmitting}
                rows={3}
                {...register('description')}
              />
            </div>
          </CardContent>
        </Card>

        {isReferenceMode && referencedOrder && (
          <Card className='border-primary/20 bg-primary/5'>
            <CardHeader className='pb-3'>
              <CardTitle className='flex items-center gap-2 text-base'>
                <Link2 className='h-4 w-4' />
                Referenced Design — #{referencedOrder.orderNo}
              </CardTitle>
              <CardDescription>
                Data pre-filled from the referenced order. Edit the values below
                before creating.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-2 gap-4 text-sm md:grid-cols-4'>
                <div>
                  <span className='text-muted-foreground'>Product</span>
                  <p className='font-medium'>
                    {referencedOrder.product?.name ?? '—'}
                  </p>
                </div>
                <div>
                  <span className='text-muted-foreground'>Design Type</span>
                  <p className='font-medium'>{referencedOrder.orderType}</p>
                </div>
                <div>
                  <span className='text-muted-foreground'>Status</span>
                  <p className='font-medium'>
                    {referencedOrder.status || 'DRAFT'}
                  </p>
                </div>
                <div>
                  <span className='text-muted-foreground'>Customer</span>
                  <p className='font-medium'>
                    {referencedOrder.customer?.name ?? '—'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoadingReference && (
          <div className='flex items-center justify-center rounded-lg border py-8'>
            <div className='flex flex-col items-center gap-2'>
              <Loader2 className='text-primary h-6 w-6 animate-spin' />
              <p className='text-muted-foreground text-sm'>
                Loading referenced design data...
              </p>
            </div>
          </div>
        )}

        {showTemplateSection && !isLoadingReference && (
          <>
            <Separator />
            <div className='space-y-2'>
              <h2 className='text-lg font-semibold'>Template Values</h2>
              <p className='text-muted-foreground text-sm'>
                {isReferenceMode
                  ? 'Values pre-filled from the referenced design. Edit as needed.'
                  : 'Enter values for each template.'}{' '}
                Formula columns are auto-calculated. Fields marked with{' '}
                <span className='text-destructive font-bold'>*</span> are
                required.
              </p>
            </div>

            {isLoadingTemplates ? (
              <div className='space-y-4'>
                {[1, 2].map((i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className='h-5 w-40' />
                      <Skeleton className='h-4 w-64' />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className='h-48 w-full' />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : templateError ? (
              <div className='bg-destructive/15 text-destructive flex items-start gap-2 rounded-md p-4'>
                <AlertCircle className='mt-0.5 h-4 w-4 flex-shrink-0' />
                <span>{templateError}</span>
              </div>
            ) : !hasTemplates ? (
              <Card>
                <CardContent className='py-8'>
                  <div className='flex flex-col items-center justify-center text-center'>
                    <AlertCircle className='text-muted-foreground mb-2 h-8 w-8' />
                    <p className='text-muted-foreground text-sm'>
                      No templates found for this product.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <TemplateCanvasContainer
                items={templateLayoutItems}
                persistKey={`create-${selectedProductId || 'new'}`}
                title='Edit Template Values'
                subtitle='Update values for each template. Formula columns are auto-calculated.'
                beforeCanvas={
                  totalCellErrors > 0 ? (
                    <div className='bg-destructive/15 text-destructive flex items-start gap-2 rounded-md p-3 text-sm'>
                      <AlertCircle className='mt-0.5 h-4 w-4 flex-shrink-0' />
                      <span>
                        {totalCellErrors} validation error
                        {totalCellErrors !== 1 ? 's' : ''} found.
                      </span>
                    </div>
                  ) : undefined
                }
              />
            )}
          </>
        )}

        <div className='flex items-center gap-4 pt-2'>
          <Button
            type='submit'
            disabled={isSubmitting || isLoadingTemplates || isLoadingReference}
            size='lg'
          >
            {isSubmitting ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Creating Design...
              </>
            ) : (
              <>
                <CheckCircle2 className='mr-2 h-4 w-4' />
                Create Design
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
      </form>
    </div>
  );
}
