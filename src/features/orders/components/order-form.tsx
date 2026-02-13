'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  getProducts,
  getProduct,
  getTemplate,
  createOrder,
  getOrder,
  updateOrderExtraValues,
  getCustomers
} from '@/lib/api/services';
import { getError } from '@/lib/api/axios';
import type {
  Product,
  Customer,
  TemplateWithDetails,
  OrderTemplatePayload,
  CreateOrderData,
  UpdateOrderExtraValuesData,
  UpdateOrderExtraValuesTemplatePayload,
  UpdateOrderExtraValueItem
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
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Loader2,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Package,
  Users
} from 'lucide-react';
import Link from 'next/link';
import OrderTemplateValues, {
  type TemplateValuesMap
} from './order-template-values';
import type { ExtraValuesMap } from './order-extra-values';

// =============================================================================
// SCHEMA
// =============================================================================

const orderFormSchema = z
  .object({
    orderNo: z
      .string()
      .min(1, 'Order number is required')
      .max(50, 'Order number must be less than 50 characters'),
    productId: z.string().min(1, 'Please select a product'),
    orderType: z.enum(['SAMPLE', 'PRODUCTION', 'CUSTOM'], {
      message: 'Please select an order type'
    }),
    description: z.string().optional(),
    customerId: z.string().optional()
  })
  .superRefine((data, ctx) => {
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

  // Products
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [productError, setProductError] = useState<string | null>(null);

  // Customers
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [customerError, setCustomerError] = useState<string | null>(null);

  // Templates (loaded when product is selected)
  const [templates, setTemplates] = useState<TemplateWithDetails[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);

  // Template values: { [templateId]: { [rowId]: { [columnId]: value } } }
  const [templateValues, setTemplateValues] = useState<
    Record<string, TemplateValuesMap>
  >({});

  // Extra values: { [templateId]: { [extraFieldId]: { value, ... } } }
  const [extraValues, setExtraValues] = useState<
    Record<string, ExtraValuesMap>
  >({});

  // Validation errors for template cells
  const [cellErrors, setCellErrors] = useState<
    Record<string, Record<string, string>>
  >({});

  // Validation errors for extra fields
  const [extraFieldErrors, setExtraFieldErrors] = useState<
    Record<string, Record<string, string>>
  >({});

  // Submit state
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
      productId: '',
      orderType: undefined,
      description: '',
      customerId: ''
    }
  });

  const selectedProductId = watch('productId');
  const selectedOrderType = watch('orderType');
  const selectedCustomerId = watch('customerId');

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
  // FETCH PRODUCTS
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
  // FETCH TEMPLATES WHEN PRODUCT IS SELECTED
  // ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchTemplatesForProduct = async () => {
      if (!selectedProductId) {
        setTemplates([]);
        setTemplateValues({});
        setExtraValues({});
        setCellErrors({});
        setExtraFieldErrors({});
        return;
      }

      setIsLoadingTemplates(true);
      setTemplateError(null);
      setTemplates([]);
      setTemplateValues({});
      setExtraValues({});
      setCellErrors({});
      setExtraFieldErrors({});

      try {
        const product = await getProduct(companyId, selectedProductId);

        if (!product.templates || product.templates.length === 0) {
          setTemplates([]);
          setIsLoadingTemplates(false);
          return;
        }

        const templatePromises = (product.templates as { id: string }[]).map(
          (t) => getTemplate(companyId, selectedProductId, t.id)
        );
        const fullTemplates = await Promise.all(templatePromises);

        setTemplates(fullTemplates);

        const initialValues: Record<string, TemplateValuesMap> = {};
        const initialExtraValues: Record<string, ExtraValuesMap> = {};
        fullTemplates.forEach((tmpl) => {
          initialValues[tmpl.id] = {};
          initialExtraValues[tmpl.id] = {};
        });
        setTemplateValues(initialValues);
        setExtraValues(initialExtraValues);
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
  // VALUE HANDLERS
  // ──────────────────────────────────────────────────────────────────────
  const handleTemplateValuesChange = useCallback(
    (templateId: string, values: TemplateValuesMap) => {
      setTemplateValues((prev) => ({
        ...prev,
        [templateId]: values
      }));
      setCellErrors((prev) => ({
        ...prev,
        [templateId]: {}
      }));
    },
    []
  );

  const handleExtraValuesChange = useCallback(
    (templateId: string, values: ExtraValuesMap) => {
      setExtraValues((prev) => ({
        ...prev,
        [templateId]: values
      }));
      setExtraFieldErrors((prev) => ({
        ...prev,
        [templateId]: {}
      }));
    },
    []
  );

  // ──────────────────────────────────────────────────────────────────────
  // VALIDATION
  // ──────────────────────────────────────────────────────────────────────
  const validateTemplateValues = useCallback((): boolean => {
    let isValid = true;

    const newCellErrors: Record<string, Record<string, string>> = {};
    templates.forEach((tmpl) => {
      const tmplErrors: Record<string, string> = {};
      const tmplValues = templateValues[tmpl.id] || {};
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

      newCellErrors[tmpl.id] = tmplErrors;
    });
    setCellErrors(newCellErrors);

    // Validate extra values (including IMAGE/FILE required check)
    const newExtraErrors: Record<string, Record<string, string>> = {};
    templates.forEach((tmpl) => {
      const extErrors: Record<string, string> = {};
      const extras = tmpl.extra || [];
      const tmplExtraValues = extraValues[tmpl.id] || {};

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

      newExtraErrors[tmpl.id] = extErrors;
    });
    setExtraFieldErrors(newExtraErrors);

    return isValid;
  }, [templates, templateValues, extraValues]);

  // ──────────────────────────────────────────────────────────────────────
  // Check if any extra values need saving
  // ──────────────────────────────────────────────────────────────────────
  const hasExtraValuesToSave = useMemo(() => {
    return templates.some((tmpl) => {
      const tmplExtras = tmpl.extra || [];
      const tmplExtraValues = extraValues[tmpl.id] || {};
      return tmplExtras.some((extra) => {
        const val = tmplExtraValues[extra.id]?.value || '';
        return val.trim() !== '';
      });
    });
  }, [templates, extraValues]);

  // ──────────────────────────────────────────────────────────────────────
  // SUBMIT
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
      // ── Step 1: Build create order payload (main values only) ──────
      const templatesPayload: OrderTemplatePayload[] = templates.map((tmpl) => {
        const tmplValues = templateValues[tmpl.id] || {};
        const columns = tmpl.columns || [];
        const rows = tmpl.rows || [];

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

        return {
          templateId: tmpl.id,
          values
        };
      });

      const createData: CreateOrderData = {
        orderNo: data.orderNo,
        productId: data.productId,
        orderType: data.orderType,
        description: data.description || undefined,
        ...(data.customerId ? { customerId: data.customerId } : {}),
        templates: templatesPayload
      };

      const createdOrder = await createOrder(companyId, createData);

      // ── Step 2: Save extra values (image URLs, text, etc.) ─────────
      // The create API doesn't support extra values, so we fetch the
      // created order to get orderTemplateIds, then call update-extra-values.
      if (hasExtraValuesToSave) {
        try {
          const orderDetails = await getOrder(companyId, createdOrder.id);

          if (orderDetails.templates && orderDetails.templates.length > 0) {
            const extraTemplates: UpdateOrderExtraValuesTemplatePayload[] = [];

            orderDetails.templates.forEach((orderTmpl) => {
              // orderTmpl.id = orderTemplateId, orderTmpl.templateId = templateId
              const tmpl = templates.find((t) => t.id === orderTmpl.templateId);
              if (!tmpl) return;

              const tmplExtras = tmpl.extra || [];
              const tmplExtraValues = extraValues[tmpl.id] || {};

              if (tmplExtras.length === 0) return;

              const values: UpdateOrderExtraValueItem[] = [];

              tmplExtras.forEach((extra) => {
                const val = tmplExtraValues[extra.id]?.value || '';
                if (val.trim()) {
                  values.push({
                    value: val.trim(),
                    templateExtraFieldId: extra.id,
                    orderIndex: 0
                  });
                }
              });

              if (values.length > 0) {
                extraTemplates.push({
                  templateId: orderTmpl.templateId,
                  orderTemplateId: orderTmpl.id, // API `id` = orderTemplateId
                  parentOrderTemplateId: null,
                  values
                });
              }
            });

            if (extraTemplates.length > 0) {
              const updateExtraPayload: UpdateOrderExtraValuesData = {
                templates: extraTemplates
              };
              await updateOrderExtraValues(
                companyId,
                createdOrder.id,
                updateExtraPayload
              );
            }
          }
        } catch (extraErr) {
          console.error(
            'Order created but failed to save extra values:',
            extraErr
          );
        }
      }

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
    Object.values(cellErrors).forEach((tmplErrs) => {
      count += Object.keys(tmplErrs).length;
    });
    Object.values(extraFieldErrors).forEach((tmplErrs) => {
      count += Object.keys(tmplErrs).length;
    });
    return count;
  }, [cellErrors, extraFieldErrors]);

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

            <div className='space-y-2'>
              <Label>
                Product <span className='text-destructive'>*</span>
              </Label>
              {isLoadingProducts ? (
                <Skeleton className='h-10 w-full' />
              ) : (
                <Select
                  value={selectedProductId}
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

        {/* ════════════════ TEMPLATE VALUES ════════════════ */}
        {selectedProductId && (
          <>
            <Separator />

            <div className='space-y-2'>
              <h2 className='text-lg font-semibold'>Template Values</h2>
              <p className='text-muted-foreground text-sm'>
                Enter values for each template. Formula columns are
                auto-calculated. Fields marked with{' '}
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
            ) : templates.length === 0 ? (
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
                {templates.map((tmpl) => (
                  <OrderTemplateValues
                    key={tmpl.id}
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
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ════════════════ SUBMIT ════════════════ */}
        <div className='flex items-center gap-4 pt-2'>
          <Button
            type='submit'
            disabled={isSubmitting || isLoadingTemplates}
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
