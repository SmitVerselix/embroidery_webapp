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
  type TemplateValuesMap
} from './order-template-values';
import type { ExtraValuesMap } from './order-extra-values';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';

// =============================================================================
// HELPERS
// =============================================================================

/** Unique key for a child template's editable state */
const getChildKey = (parentTmplId: string, idx: number) =>
  `${parentTmplId}__child__${idx}`;

// =============================================================================
// SCHEMA — productId is conditionally required (handled in superRefine)
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
    // productId required only in manual mode (no referenceNo)
    if (
      (!data.referenceNo || data.referenceNo.trim() === '') &&
      (!data.productId || data.productId.trim() === '')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Please select a product',
        path: ['productId']
      });
    }

    if (
      data.orderType !== 'SAMPLE' &&
      (!data.customerId || data.customerId.trim() === '')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Please select a customer',
        path: ['customerId']
      });
    }
  });

type OrderFormData = z.infer<typeof orderFormSchema>;

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

  // Products (for manual mode)
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [productError, setProductError] = useState<string | null>(null);

  // Customers
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [customerError, setCustomerError] = useState<string | null>(null);

  // Orders (for referenceNo picker)
  const [ordersList, setOrdersList] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [ordersSearch, setOrdersSearch] = useState('');
  const [isOrdersPopoverOpen, setIsOrdersPopoverOpen] = useState(false);
  const debouncedOrdersSearch = useDebounce(ordersSearch, 300);

  // ── Reference Order State ─────────────────────────────────────────
  const [referencedOrder, setReferencedOrder] =
    useState<OrderWithDetails | null>(null);
  const [referencedOrderId, setReferencedOrderId] = useState<string | null>(
    null
  );
  const [isLoadingReference, setIsLoadingReference] = useState(false);
  const [referenceError, setReferenceError] = useState<string | null>(null);

  /**
   * Metadata for children from the referenced order, keyed by parent
   * templateId. Used to know how many children exist and their templateIds.
   */
  const [refChildrenMeta, setRefChildrenMeta] = useState<
    Record<string, { templateId: string }[]>
  >({});

  // Prevents the product-change effect from wiping reference-loaded data
  const isReferenceModeRef = useRef(false);

  // ── Templates ─────────────────────────────────────────────────────
  const [templates, setTemplates] = useState<TemplateWithDetails[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);

  // ── Parent template editable state ────────────────────────────────
  const [templateValues, setTemplateValues] = useState<
    Record<string, TemplateValuesMap>
  >({});
  const [extraValues, setExtraValues] = useState<
    Record<string, ExtraValuesMap>
  >({});
  const [templateDiscounts, setTemplateDiscounts] = useState<
    Record<string, { discountType: DiscountType; discountValue: string }>
  >({});
  const [cellErrors, setCellErrors] = useState<
    Record<string, Record<string, string>>
  >({});
  const [extraFieldErrors, setExtraFieldErrors] = useState<
    Record<string, Record<string, string>>
  >({});

  // ── Child template editable state (keyed by getChildKey) ──────────
  const [childTemplateValues, setChildTemplateValues] = useState<
    Record<string, TemplateValuesMap>
  >({});
  const [childExtraValues, setChildExtraValues] = useState<
    Record<string, ExtraValuesMap>
  >({});
  const [childDiscounts, setChildDiscounts] = useState<
    Record<string, { discountType: DiscountType; discountValue: string }>
  >({});
  const [childCellErrors, setChildCellErrors] = useState<
    Record<string, Record<string, string>>
  >({});
  const [childExtraFieldErrors, setChildExtraFieldErrors] = useState<
    Record<string, Record<string, string>>
  >({});

  // Submit
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

  // ──────────────────────────────────────────────────────────────────────
  // FETCH CUSTOMERS
  // ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchCustomers = async () => {
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
    if (companyId) fetchCustomers();
  }, [companyId]);

  // ──────────────────────────────────────────────────────────────────────
  // FETCH PRODUCTS (manual mode only)
  // ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchProducts = async () => {
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
    if (companyId) fetchProducts();
  }, [companyId]);

  // ──────────────────────────────────────────────────────────────────────
  // FETCH ORDERS (for referenceNo picker list)
  // ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchOrders = async () => {
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
        // Silently fail
      } finally {
        setIsLoadingOrders(false);
      }
    };
    if (companyId) fetchOrders();
  }, [companyId, debouncedOrdersSearch]);

  // ──────────────────────────────────────────────────────────────────────
  // FETCH TEMPLATES WHEN PRODUCT IS MANUALLY SELECTED
  // Uses only getProduct — no separate getTemplate calls needed
  // ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isReferenceModeRef.current) return;

    const fetchTemplatesForProduct = async () => {
      if (!selectedProductId) {
        setTemplates([]);
        setTemplateValues({});
        setExtraValues({});
        setTemplateDiscounts({});
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
      setCellErrors({});
      setExtraFieldErrors({});
      clearChildState();

      try {
        const product = await getProduct(companyId, selectedProductId);

        // product.templates already includes full details (rows, columns, extra, etc.)
        const fullTemplates = (product.templates ||
          []) as TemplateWithDetails[];

        if (fullTemplates.length === 0) {
          setTemplates([]);
          setIsLoadingTemplates(false);
          return;
        }

        setTemplates(fullTemplates);

        const initialValues: Record<string, TemplateValuesMap> = {};
        const initialExtraValues: Record<string, ExtraValuesMap> = {};
        const initialDiscounts: Record<
          string,
          { discountType: DiscountType; discountValue: string }
        > = {};
        fullTemplates.forEach((tmpl) => {
          initialValues[tmpl.id] = {};
          initialExtraValues[tmpl.id] = {};
          initialDiscounts[tmpl.id] = {
            discountType: 'PERCENT',
            discountValue: '0'
          };
        });
        setTemplateValues(initialValues);
        setExtraValues(initialExtraValues);
        setTemplateDiscounts(initialDiscounts);
      } catch (err) {
        setTemplateError(getError(err));
      } finally {
        setIsLoadingTemplates(false);
      }
    };

    fetchTemplatesForProduct();
  }, [companyId, selectedProductId]);

  useEffect(() => {
    if (selectedOrderType === 'SAMPLE') {
      setValue('customerId', '');
    }
  }, [selectedOrderType, setValue]);

  // ──────────────────────────────────────────────────────────────────────
  // HELPER: clear all child editable state
  // ──────────────────────────────────────────────────────────────────────
  const clearChildState = useCallback(() => {
    setRefChildrenMeta({});
    setChildTemplateValues({});
    setChildExtraValues({});
    setChildDiscounts({});
    setChildCellErrors({});
    setChildExtraFieldErrors({});
  }, []);

  // ──────────────────────────────────────────────────────────────────────
  // SELECT REFERENCE ORDER → fetch full data, load templates, pre-fill
  // Uses only getProduct — no separate getTemplate calls needed
  // ──────────────────────────────────────────────────────────────────────
  const handleSelectReferenceOrder = useCallback(
    async (order: Order) => {
      setIsOrdersPopoverOpen(false);
      setOrdersSearch('');
      setReferenceError(null);

      setValue('referenceNo', order.orderNo);
      setReferencedOrderId(order.id);
      setIsLoadingReference(true);

      try {
        // 1) Fetch the full order
        const orderData = await getOrder(companyId, order.id);
        setReferencedOrder(orderData);

        // 2) Auto-set productId (flag prevents product effect from firing)
        isReferenceModeRef.current = true;
        setValue('productId', orderData.productId);

        // 3) Load full template definitions from the product
        //    getProduct already returns templates with rows, columns, extra, etc.
        const product = await getProduct(companyId, orderData.productId);
        const templateCache: Record<string, TemplateWithDetails> = {};
        const fullTemplates = (product.templates ||
          []) as TemplateWithDetails[];

        if (fullTemplates.length > 0) {
          fullTemplates.forEach((tmpl) => {
            templateCache[tmpl.id] = tmpl;
          });
          setTemplates(fullTemplates);
        } else {
          setTemplates([]);
        }

        // 4) Pre-fill parent + child editable state
        const loadedValues: Record<string, TemplateValuesMap> = {};
        const loadedExtraValues: Record<string, ExtraValuesMap> = {};
        const loadedDiscounts: Record<
          string,
          { discountType: DiscountType; discountValue: string }
        > = {};
        const loadedChildMeta: Record<string, { templateId: string }[]> = {};
        const loadedChildValues: Record<string, TemplateValuesMap> = {};
        const loadedChildExtras: Record<string, ExtraValuesMap> = {};
        const loadedChildDiscounts: Record<
          string,
          { discountType: DiscountType; discountValue: string }
        > = {};

        // Initialize every template with empties
        Object.values(templateCache).forEach((tmpl) => {
          loadedValues[tmpl.id] = {};
          loadedExtraValues[tmpl.id] = {};
          loadedDiscounts[tmpl.id] = {
            discountType: 'PERCENT',
            discountValue: '0'
          };
        });

        // Fill from the order's template data
        (orderData.templates || []).forEach((tmplData: OrderTemplateData) => {
          const tid = tmplData.templateId;

          // ── Parent values ──
          const valuesMap: TemplateValuesMap = {};
          (tmplData.values || []).forEach((v) => {
            if (!valuesMap[v.rowId]) valuesMap[v.rowId] = {};
            valuesMap[v.rowId][v.columnId] = v.value ?? v.calculatedValue ?? '';
          });
          loadedValues[tid] = valuesMap;

          // ── Parent extra values ──
          const extValMap: ExtraValuesMap = {};
          (tmplData.extraValues || []).forEach((ev) => {
            extValMap[ev.templateExtraFieldId] = {
              value: ev.value,
              orderIndex: ev.orderIndex
            };
          });
          loadedExtraValues[tid] = extValMap;

          // ── Parent discount ──
          const rawSummary = tmplData.summary;
          if (rawSummary) {
            loadedDiscounts[tid] = {
              discountType:
                (rawSummary.discountType as DiscountType) || 'PERCENT',
              discountValue: rawSummary.discount ?? '0'
            };
          }

          // ── Children → populate editable child state ──
          if (tmplData.children && tmplData.children.length > 0) {
            loadedChildMeta[tid] = [];

            tmplData.children.forEach((child, idx) => {
              const childKey = getChildKey(tid, idx);
              loadedChildMeta[tid].push({ templateId: child.templateId });

              // Child values
              const childValMap: TemplateValuesMap = {};
              (child.values || []).forEach((v) => {
                if (!childValMap[v.rowId]) childValMap[v.rowId] = {};
                childValMap[v.rowId][v.columnId] =
                  v.value ?? v.calculatedValue ?? '';
              });
              loadedChildValues[childKey] = childValMap;

              // Child extra values
              const childExtMap: ExtraValuesMap = {};
              (child.extraValues || []).forEach((ev) => {
                childExtMap[ev.templateExtraFieldId] = {
                  value: ev.value,
                  orderIndex: ev.orderIndex
                };
              });
              loadedChildExtras[childKey] = childExtMap;

              // Child discount
              const childSummary = child.summary;
              loadedChildDiscounts[childKey] = {
                discountType:
                  (childSummary?.discountType as DiscountType) || 'PERCENT',
                discountValue: childSummary?.discount ?? '0'
              };
            });
          }
        });

        setTemplateValues(loadedValues);
        setExtraValues(loadedExtraValues);
        setTemplateDiscounts(loadedDiscounts);
        setRefChildrenMeta(loadedChildMeta);
        setChildTemplateValues(loadedChildValues);
        setChildExtraValues(loadedChildExtras);
        setChildDiscounts(loadedChildDiscounts);
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

  // ──────────────────────────────────────────────────────────────────────
  // CLEAR REFERENCE — go back to manual mode
  // ──────────────────────────────────────────────────────────────────────
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
    setCellErrors({});
    setExtraFieldErrors({});
    clearChildState();
  }, [setValue, clearChildState]);

  // ──────────────────────────────────────────────────────────────────────
  // PARENT VALUE HANDLERS
  // ──────────────────────────────────────────────────────────────────────
  const handleTemplateValuesChange = useCallback(
    (templateId: string, values: TemplateValuesMap) => {
      setTemplateValues((prev) => ({ ...prev, [templateId]: values }));
      setCellErrors((prev) => ({ ...prev, [templateId]: {} }));
    },
    []
  );

  const handleExtraValuesChange = useCallback(
    (templateId: string, values: ExtraValuesMap) => {
      setExtraValues((prev) => ({ ...prev, [templateId]: values }));
      setExtraFieldErrors((prev) => ({ ...prev, [templateId]: {} }));
    },
    []
  );

  const handleDiscountChange = useCallback(
    (templateId: string, type: DiscountType, value: string) => {
      setTemplateDiscounts((prev) => ({
        ...prev,
        [templateId]: { discountType: type, discountValue: value }
      }));
    },
    []
  );

  // ──────────────────────────────────────────────────────────────────────
  // CHILD VALUE HANDLERS (keyed by childKey)
  // ──────────────────────────────────────────────────────────────────────
  const handleChildValuesChange = useCallback(
    (childKey: string, values: TemplateValuesMap) => {
      setChildTemplateValues((prev) => ({ ...prev, [childKey]: values }));
      setChildCellErrors((prev) => ({ ...prev, [childKey]: {} }));
    },
    []
  );

  const handleChildExtraValuesChange = useCallback(
    (childKey: string, values: ExtraValuesMap) => {
      setChildExtraValues((prev) => ({ ...prev, [childKey]: values }));
      setChildExtraFieldErrors((prev) => ({ ...prev, [childKey]: {} }));
    },
    []
  );

  const handleChildDiscountChange = useCallback(
    (childKey: string, type: DiscountType, value: string) => {
      setChildDiscounts((prev) => ({
        ...prev,
        [childKey]: { discountType: type, discountValue: value }
      }));
    },
    []
  );

  // ──────────────────────────────────────────────────────────────────────
  // VALIDATION — parents + children
  // ──────────────────────────────────────────────────────────────────────
  const validateTemplateValues = useCallback((): boolean => {
    let isValid = true;

    // Helper to validate a set of values against a template
    const validateValues = (
      tmpl: TemplateWithDetails,
      vals: TemplateValuesMap,
      exVals: ExtraValuesMap
    ) => {
      const cErrors: Record<string, string> = {};
      const eErrors: Record<string, string> = {};
      const columns = tmpl.columns || [];
      const rows = tmpl.rows || [];

      rows.forEach((row) => {
        columns.forEach((col) => {
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
        const val = exVals[extra.id]?.value || '';
        if (extra.isRequired && !val.trim()) {
          eErrors[extra.id] = 'Required';
          isValid = false;
          return;
        }
        if (extra.valueType === 'NUMBER' && val.trim()) {
          if (isNaN(Number(val))) {
            eErrors[extra.id] = 'Must be a number';
            isValid = false;
          }
        }
      });

      return { cErrors, eErrors };
    };

    // Validate parents
    const newCellErrors: Record<string, Record<string, string>> = {};
    const newExtraErrors: Record<string, Record<string, string>> = {};
    templates.forEach((tmpl) => {
      const { cErrors, eErrors } = validateValues(
        tmpl,
        templateValues[tmpl.id] || {},
        extraValues[tmpl.id] || {}
      );
      newCellErrors[tmpl.id] = cErrors;
      newExtraErrors[tmpl.id] = eErrors;
    });
    setCellErrors(newCellErrors);
    setExtraFieldErrors(newExtraErrors);

    // Validate children
    const newChildCellErrors: Record<string, Record<string, string>> = {};
    const newChildExtraErrors: Record<string, Record<string, string>> = {};
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
        newChildCellErrors[childKey] = cErrors;
        newChildExtraErrors[childKey] = eErrors;
      });
    });
    setChildCellErrors(newChildCellErrors);
    setChildExtraFieldErrors(newChildExtraErrors);

    return isValid;
  }, [
    templates,
    templateValues,
    extraValues,
    refChildrenMeta,
    childTemplateValues,
    childExtraValues
  ]);

  // ──────────────────────────────────────────────────────────────────────
  // SUBMIT — unified payload with editable children
  // ──────────────────────────────────────────────────────────────────────
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

        // Main values
        const values: { value: string; rowId: string; columnId: string }[] = [];
        rows.forEach((row) => {
          columns.forEach((col) => {
            if (col.dataType === 'FORMULA') return;
            const value = tmplValues[row.id]?.[col.id] || '';
            if (value.trim()) {
              values.push({
                value: value.trim(),
                rowId: row.id,
                columnId: col.id
              });
            }
          });
        });

        // Extra values
        const tmplExtras = tmpl.extra || [];
        const tmplExtraValues = extraValues[tmpl.id] || {};
        const extravalues: OrderExtraValuePayload[] = [];
        tmplExtras.forEach((extra) => {
          const val = tmplExtraValues[extra.id]?.value || '';
          if (val.trim()) {
            extravalues.push({
              templateExtraFieldId: extra.id,
              value: val.trim(),
              meta: null,
              orderIndex: tmplExtraValues[extra.id]?.orderIndex ?? 0
            });
          }
        });

        // Summary
        const discount = templateDiscounts[tmpl.id] || {
          discountType: 'PERCENT' as DiscountType,
          discountValue: '0'
        };
        const summary: TemplateSummaryPayload = {
          discountType: discount.discountType,
          discountValue: discount.discountValue || '0'
        };

        const payload: OrderTemplatePayload = {
          templateId: tmpl.id,
          values,
          summary
        };
        if (extravalues.length > 0) payload.extravalues = extravalues;

        // ── Build children from editable state ───────────────────────
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

            // Child main values
            const cValues: {
              value: string;
              rowId: string;
              columnId: string;
            }[] = [];
            rows.forEach((row) => {
              columns.forEach((col) => {
                if (col.dataType === 'FORMULA') return;
                const v = childVals[row.id]?.[col.id] || '';
                if (v.trim()) {
                  cValues.push({
                    value: v.trim(),
                    rowId: row.id,
                    columnId: col.id
                  });
                }
              });
            });

            // Child extra values
            const cExtras: OrderExtraValuePayload[] = [];
            tmplExtras.forEach((extra) => {
              const v = childExVals[extra.id]?.value || '';
              if (v.trim()) {
                cExtras.push({
                  templateExtraFieldId: extra.id,
                  value: v.trim(),
                  meta: null,
                  orderIndex: childExVals[extra.id]?.orderIndex ?? 0
                });
              }
            });

            // Child summary
            const cSummary: TemplateSummaryPayload = {
              discountType: childDisc.discountType,
              discountValue: childDisc.discountValue || '0'
            };

            const childPayload: OrderTemplatePayload = {
              templateId: meta.templateId,
              values: cValues,
              summary: cSummary
            };
            if (cExtras.length > 0) childPayload.extravalues = cExtras;

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
        Back to Orders
      </Link>

      <form onSubmit={handleSubmit(onSubmit)} className='space-y-6'>
        {/* ════════════════ ORDER DETAILS CARD ════════════════ */}
        <Card>
          <CardHeader>
            <CardTitle>Order Details</CardTitle>
            <CardDescription>
              Enter the basic information for your order
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
                  Order Number <span className='text-destructive'>*</span>
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
                  Order Type <span className='text-destructive'>*</span>
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

            {/* ══════════ Reference No — Order Picker ══════════ */}
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
                          No orders found
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

            {/* ══════════ Product Select — manual mode only ══════════ */}
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
                          No products available. Create a product first.
                        </div>
                      ) : (
                        products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            <span className='flex items-center gap-2'>
                              <Package className='h-3 w-3' />
                              {product.name}
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

            {/* Customer Select */}
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
                          No customers available. Create a customer first.
                        </div>
                      ) : (
                        customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            <span className='flex items-center gap-2'>
                              <Users className='h-3 w-3' />
                              {customer.name}
                              <span className='text-muted-foreground text-xs'>
                                ({customer.referenceCode})
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

        {/* ═══════════ REFERENCED ORDER INFO CARD ═══════════ */}
        {isReferenceMode && referencedOrder && (
          <Card className='border-primary/20 bg-primary/5'>
            <CardHeader className='pb-3'>
              <CardTitle className='flex items-center gap-2 text-base'>
                <Link2 className='h-4 w-4' />
                Referenced Order — #{referencedOrder.orderNo}
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
                  <span className='text-muted-foreground'>Order Type</span>
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

        {/* Loading reference */}
        {isLoadingReference && (
          <div className='flex items-center justify-center rounded-lg border py-8'>
            <div className='flex flex-col items-center gap-2'>
              <Loader2 className='text-primary h-6 w-6 animate-spin' />
              <p className='text-muted-foreground text-sm'>
                Loading referenced order data...
              </p>
            </div>
          </div>
        )}

        {/* ════════════════ TEMPLATE VALUES ════════════════ */}
        {showTemplateSection && !isLoadingReference && (
          <>
            <Separator />

            <div className='space-y-2'>
              <h2 className='text-lg font-semibold'>Template Values</h2>
              <p className='text-muted-foreground text-sm'>
                {isReferenceMode
                  ? 'Values pre-filled from the referenced order. Edit as needed.'
                  : 'Enter values for each template.'}{' '}
                Formula columns are auto-calculated. Fields marked with{' '}
                <span className='text-destructive font-bold'>*</span> are
                required.
              </p>
            </div>

            {totalCellErrors > 0 && (
              <div className='bg-destructive/15 text-destructive flex items-start gap-2 rounded-md p-3 text-sm'>
                <AlertCircle className='mt-0.5 h-4 w-4 flex-shrink-0' />
                <span>
                  {totalCellErrors} validation error
                  {totalCellErrors !== 1 ? 's' : ''} found. Please fix them
                  before submitting.
                </span>
              </div>
            )}

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
                      No templates found for this product. Please add templates
                      to the product first.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className='space-y-6'>
                {templates.map((tmpl) => {
                  const childMeta = refChildrenMeta[tmpl.id];
                  const hasChildren = childMeta && childMeta.length > 0;

                  return (
                    <div key={tmpl.id} className='space-y-4'>
                      {/* Parent badge when children exist */}
                      {hasChildren && (
                        <Badge variant='outline' className='text-xs'>
                          Parent Template
                          <span className='text-muted-foreground ml-1.5'>
                            — {childMeta.length} child
                            {childMeta.length !== 1 ? 'ren' : ''} from reference
                          </span>
                        </Badge>
                      )}

                      {/* Parent — editable */}
                      <OrderTemplateValues
                        template={tmpl}
                        values={templateValues[tmpl.id] || {}}
                        onChange={(vals) =>
                          handleTemplateValuesChange(tmpl.id, vals)
                        }
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
                        discountValue={
                          templateDiscounts[tmpl.id]?.discountValue || '0'
                        }
                        onDiscountChange={(type, value) =>
                          handleDiscountChange(tmpl.id, type, value)
                        }
                      />

                      {/* Children — editable */}
                      {hasChildren &&
                        childMeta.map((_, idx) => {
                          const childKey = getChildKey(tmpl.id, idx);
                          return (
                            <div key={childKey} className='space-y-2'>
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
                                extraErrors={
                                  childExtraFieldErrors[childKey] || {}
                                }
                                discountType={
                                  childDiscounts[childKey]?.discountType ||
                                  'PERCENT'
                                }
                                discountValue={
                                  childDiscounts[childKey]?.discountValue || '0'
                                }
                                onDiscountChange={(type, value) =>
                                  handleChildDiscountChange(
                                    childKey,
                                    type,
                                    value
                                  )
                                }
                              />
                            </div>
                          );
                        })}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ════════════════ SUBMIT ════════════════ */}
        <div className='flex items-center gap-4 pt-2'>
          <Button
            type='submit'
            disabled={isSubmitting || isLoadingTemplates || isLoadingReference}
            size='lg'
          >
            {isSubmitting ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Creating Order...
              </>
            ) : (
              <>
                <CheckCircle2 className='mr-2 h-4 w-4' />
                Create Order
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
