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
  Link2,
  ZoomIn,
  ZoomOut,
  Maximize2
} from 'lucide-react';
import Link from 'next/link';
import OrderTemplateValues, {
  type TemplateValuesMap,
  type BlockValuesMap
} from './order-template-values';
import type { ExtraValuesMap } from './order-extra-values';
import TemplateLayoutCanvas, {
  type TemplateLayoutItem
} from './template-layout-canvas';
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
// ZOOM CONSTANTS
// =============================================================================

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.25;
const SCROLL_ZOOM_FACTOR = 0.001;
const DRAG_THRESHOLD = 3;

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
// HELPER: Build array-based ExtraValuesMap from API extraValues array
// =============================================================================

function buildExtraValuesMap(
  extraValues: {
    templateExtraFieldId: string;
    value: string;
    id?: string;
    orderIndex?: number;
  }[]
): ExtraValuesMap {
  const map: ExtraValuesMap = {};
  (extraValues || []).forEach((ev) => {
    if (!map[ev.templateExtraFieldId]) {
      map[ev.templateExtraFieldId] = [];
    }
    map[ev.templateExtraFieldId].push({
      value: ev.value,
      orderExtraValueId: ev.id,
      orderIndex: ev.orderIndex ?? map[ev.templateExtraFieldId].length
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

  // Products
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

  // Reference Order State
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

  // Templates
  const [templates, setTemplates] = useState<TemplateWithDetails[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);

  // Parent template editable state
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
  const [cellErrors, setCellErrors] = useState<
    Record<string, Record<string, string>>
  >({});
  const [extraFieldErrors, setExtraFieldErrors] = useState<
    Record<string, Record<string, string>>
  >({});

  // Child template editable state
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
  const [childCellErrors, setChildCellErrors] = useState<
    Record<string, Record<string, string>>
  >({});
  const [childExtraFieldErrors, setChildExtraFieldErrors] = useState<
    Record<string, Record<string, string>>
  >({});

  // Submit
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  // ── FETCH CUSTOMERS ─────────────────────────────────────────────────
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

  // ── FETCH PRODUCTS ──────────────────────────────────────────────────
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

  // ── FETCH ORDERS (for referenceNo picker) ───────────────────────────
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
        /* Silently fail */
      } finally {
        setIsLoadingOrders(false);
      }
    };
    if (companyId) fetchOrders();
  }, [companyId, debouncedOrdersSearch]);

  // ── FETCH TEMPLATES WHEN PRODUCT IS MANUALLY SELECTED ───────────────
  useEffect(() => {
    if (isReferenceModeRef.current) return;
    const fetchTemplatesForProduct = async () => {
      if (!selectedProductId) {
        setTemplates([]);
        setTemplateValues({});
        setExtraValues({});
        setTemplateDiscounts({});
        setTemplateBlockValues({});
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
        fullTemplates.forEach((t) => {
          iv[t.id] = {};
          ie[t.id] = {};
          id[t.id] = { discountType: 'PERCENT', discountValue: '0' };
          ib[t.id] = {};
        });
        setTemplateValues(iv);
        setExtraValues(ie);
        setTemplateDiscounts(id);
        setTemplateBlockValues(ib);
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

  // ── CLEAR CHILD STATE ───────────────────────────────────────────────
  const clearChildState = useCallback(() => {
    setRefChildrenMeta({});
    setChildTemplateValues({});
    setChildExtraValues({});
    setChildDiscounts({});
    setChildBlockValues({});
    setChildCellErrors({});
    setChildExtraFieldErrors({});
  }, []);

  // ── SELECT REFERENCE ORDER ──────────────────────────────────────────
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
        const loadedChildMeta: Record<string, { templateId: string }[]> = {};
        const loadedChildValues: Record<string, TemplateValuesMap> = {};
        const loadedChildExtras: Record<string, ExtraValuesMap> = {};
        const loadedChildDiscounts: Record<
          string,
          { discountType: DiscountType; discountValue: string }
        > = {};
        const loadedChildBlockValues: Record<string, BlockValuesMap> = {};

        Object.values(templateCache).forEach((t) => {
          loadedValues[t.id] = {};
          loadedExtraValues[t.id] = {};
          loadedDiscounts[t.id] = {
            discountType: 'PERCENT',
            discountValue: '0'
          };
          loadedBlockValues[t.id] = {};
        });

        (orderData.templates || []).forEach((tmplData: OrderTemplateData) => {
          const tid = tmplData.templateId;

          const valuesMap: TemplateValuesMap = {};
          (tmplData.values || []).forEach((v) => {
            if (!valuesMap[v.rowId]) valuesMap[v.rowId] = {};
            valuesMap[v.rowId][v.columnId] = v.calculatedValue ?? v.value ?? '';
          });
          loadedValues[tid] = valuesMap;

          // ── Array-based extra values ────────────────────────────
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

              // ── Array-based child extra values ──────────────────
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
            });
          }
        });

        setTemplateValues(loadedValues);
        setExtraValues(loadedExtraValues);
        setTemplateDiscounts(loadedDiscounts);
        setTemplateBlockValues(loadedBlockValues);
        setRefChildrenMeta(loadedChildMeta);
        setChildTemplateValues(loadedChildValues);
        setChildExtraValues(loadedChildExtras);
        setChildDiscounts(loadedChildDiscounts);
        setChildBlockValues(loadedChildBlockValues);
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

  // ── CLEAR REFERENCE ─────────────────────────────────────────────────
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
    setCellErrors({});
    setExtraFieldErrors({});
    clearChildState();
  }, [setValue, clearChildState]);

  // ── PARENT VALUE HANDLERS ───────────────────────────────────────────
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

  // ── CHILD VALUE HANDLERS ────────────────────────────────────────────
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

  // ── VALIDATION ──────────────────────────────────────────────────────
  const validateTemplateValues = useCallback((): boolean => {
    let isValid = true;

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
        const items = exVals[extra.id] || [];
        // Required: at least one non-empty value
        if (extra.isRequired) {
          const hasValue = items.some((i) => i.value.trim() !== '');
          if (!hasValue) {
            eErrors[extra.id] = 'Required';
            isValid = false;
          }
        }
        // Type validation per item
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

  // ── Build blockvalues ───────────────────────────────────────────────
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

  // ── ZOOM HELPERS ────────────────────────────────────────────────────
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
  }, [templates.length]);

  // ── DRAG-TO-SCROLL ──────────────────────────────────────────────────
  const handleMouseDown = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (isTemplateDragging || e.button !== 0) return;
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
        if (Math.abs(dx) >= DRAG_THRESHOLD || Math.abs(dy) >= DRAG_THRESHOLD)
          setIsDragging(true);
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
          if (Math.abs(dx) >= DRAG_THRESHOLD || Math.abs(dy) >= DRAG_THRESHOLD)
            setIsDragging(true);
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

  // ── HELPER: Flatten ExtraValuesMap to payload array ─────────────────
  const flattenExtraValues = useCallback(
    (tmplExtras: any[], exVals: ExtraValuesMap): OrderExtraValuePayload[] => {
      const result: OrderExtraValuePayload[] = [];
      tmplExtras.forEach((extra: any) => {
        const items = exVals[extra.id] || [];
        items.forEach((item) => {
          if (item.value.trim()) {
            result.push({
              templateExtraFieldId: extra.id,
              value: item.value.trim(),
              meta: null,
              orderIndex: item.orderIndex
            });
          }
        });
      });
      return result;
    },
    []
  );

  // ── TEMPLATE LAYOUT ITEMS ───────────────────────────────────────────
  const templateLayoutItems: TemplateLayoutItem[] = useMemo(() => {
    return templates.map((tmpl) => {
      const childMeta = refChildrenMeta[tmpl.id];
      const hasChildren = childMeta && childMeta.length > 0;
      return {
        id: tmpl.id,
        label: tmpl.name || tmpl.id,
        children: (
          <div className='space-y-4'>
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
            />
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
    childTemplateValues,
    childExtraValues,
    childCellErrors,
    childExtraFieldErrors,
    childDiscounts,
    childBlockValues,
    isSubmitting,
    handleTemplateValuesChange,
    handleExtraValuesChange,
    handleDiscountChange,
    handleBlockValuesChange,
    handleChildValuesChange,
    handleChildExtraValuesChange,
    handleChildDiscountChange,
    handleChildBlockValuesChange
  ]);

  const zoomPercent = Math.round(zoom * 100);

  // ── SUBMIT ──────────────────────────────────────────────────────────
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

        const payload: OrderTemplatePayload = {
          templateId: tmpl.id,
          values,
          summary,
          ...(blockvalues.length > 0 ? { blockvalues } : {})
        };
        if (extravalues.length > 0) payload.extravalues = extravalues;

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

            const childPayload: OrderTemplatePayload = {
              templateId: meta.templateId,
              values: cValues,
              summary: cSummary,
              ...(cBlockvalues.length > 0 ? { blockvalues: cBlockvalues } : {})
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

  // ── RENDER ──────────────────────────────────────────────────────────
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

            {/* Reference No */}
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

            {/* Product Select */}
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

        {/* Referenced Order Info */}
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

        {/* TEMPLATE VALUES */}
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

            {totalCellErrors > 0 && (
              <div className='bg-destructive/15 text-destructive flex items-start gap-2 rounded-md p-3 text-sm'>
                <AlertCircle className='mt-0.5 h-4 w-4 flex-shrink-0' />
                <span>
                  {totalCellErrors} validation error
                  {totalCellErrors !== 1 ? 's' : ''} found.
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
                      No templates found for this product.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
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
                  style={{
                    height: '70vh',
                    minHeight: '400px',
                    maxHeight: '80vh'
                  }}
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
                        persistKey={`create-${selectedProductId || 'new'}`}
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
                    Scroll or drag to pan · Drag handle to reposition templates
                    · Double-click to toggle zoom · Pinch to zoom on touch ·{' '}
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
