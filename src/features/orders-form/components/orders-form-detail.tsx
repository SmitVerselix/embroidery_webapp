'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getOrder, recalculateOrder } from '@/lib/api/services';
import { getError } from '@/lib/api/axios';
import type {
  OrderWithDetails,
  TemplateWithDetails,
  OrderTemplateData
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
  Loader2,
  RotateCw,
  History,
  Link2
} from 'lucide-react';
import Link from 'next/link';
import OrderFormFieldsDisplay, {
  resolveOrderFormFields,
  type ResolvedOrderFormField
} from '@/features/orders-form/components/order-form-fields-display';
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
// PROPS
// =============================================================================

interface OrdersFormDetailProps {
  companyId: string;
  orderId: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function OrdersFormDetail({
  companyId,
  orderId
}: OrdersFormDetailProps) {
  const router = useRouter();

  const [order, setOrder] = useState<OrderWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [resolvedFields, setResolvedFields] = useState<
    ResolvedOrderFormField[]
  >([]);
  const [templateSummariesMap, setTemplateSummariesMap] = useState<
    Record<string, { finalPayableAmount: string | null }>
  >({});

  // ==========================================================================
  // PROCESS ORDER DATA
  // ==========================================================================

  const processOrderData = useCallback((orderData: OrderWithDetails) => {
    const productTemplates = (orderData.product?.templates ||
      []) as TemplateWithDetails[];

    const tCache: Record<string, TemplateWithDetails> = {};
    productTemplates.forEach((t) => (tCache[t.id] = t));

    // Build summaries keyed by templateId
    const summaries: Record<string, { finalPayableAmount: string | null }> = {};
    (orderData.templates || []).forEach((td: OrderTemplateData) => {
      const rawSummary = (td as any).summary;
      summaries[td.templateId] = {
        finalPayableAmount: rawSummary?.finalPayableAmount ?? null
      };
    });
    setTemplateSummariesMap(summaries);

    // Resolve order form fields (read-only)
    const forms = (orderData.product?.orderForms || []) as any[];
    const existingFormValues = (orderData as any).orderFormValues || [];
    const formValueMap: Record<string, string> = {};
    existingFormValues.forEach((fv: any) => {
      formValueMap[fv.orderFormsMasterId] =
        fv.jsonValue && Array.isArray(fv.jsonValue) && fv.jsonValue.length > 0
          ? fv.jsonValue.join(', ')
          : (fv.value ?? '');
    });

    const resolved = resolveOrderFormFields(
      forms,
      orderData.templates || [],
      tCache
    );
    resolved.forEach((field: any) => {
      if (formValueMap[field.id] !== undefined) {
        field.value = formValueMap[field.id];
      }
    });
    setResolvedFields(resolved);
  }, []);

  // ==========================================================================
  // FETCH
  // ==========================================================================

  const fetchOrder = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const orderData = await getOrder(companyId, orderId);
      setOrder(orderData);
      processOrderData(orderData);
    } catch (err) {
      setError(getError(err));
    } finally {
      setIsLoading(false);
    }
  }, [companyId, orderId, processOrderData]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // ==========================================================================
  // RECALCULATE
  // ==========================================================================

  const handleRecalculate = useCallback(async () => {
    setIsRecalculating(true);
    try {
      await recalculateOrder(companyId, orderId);
      toast.success('Order recalculated successfully');
      const orderData = await getOrder(companyId, orderId);
      setOrder(orderData);
      processOrderData(orderData);
    } catch (err) {
      toast.error(getError(err) || 'Failed to recalculate order');
    } finally {
      setIsRecalculating(false);
    }
  }, [companyId, orderId, processOrderData]);

  const backUrl = `/dashboard/${companyId}/orders-form`;
  const editUrl = `/dashboard/${companyId}/orders-form/${orderId}/edit`;

  // ==========================================================================
  // LOADING
  // ==========================================================================

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

  // ==========================================================================
  // ERROR
  // ==========================================================================

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

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className='space-y-6'>
      <Link
        href={backUrl}
        className='text-muted-foreground hover:text-foreground inline-flex items-center text-sm'
      >
        <ArrowLeft className='mr-2 h-4 w-4' />
        Back to Orders
      </Link>

      <Card>
        <CardHeader>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
            <div className='space-y-1'>
              <CardTitle className='flex items-center gap-3 text-2xl'>
                Order Form #{order.orderNo}
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
            <div className='flex flex-wrap items-center gap-2'>
              <Button
                variant='outline'
                size='sm'
                onClick={handleRecalculate}
                disabled={isRecalculating}
                className='gap-1.5'
              >
                {isRecalculating ? (
                  <Loader2 className='h-4 w-4 animate-spin' />
                ) : (
                  <RotateCw className='h-4 w-4' />
                )}{' '}
                Recalculate
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={() => router.push(editUrl)}
                className='gap-1.5'
              >
                <Pencil className='h-4 w-4' />
                Edit Order
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={() =>
                  router.push(
                    `/dashboard/${companyId}/orders-form/${orderId}/history`
                  )
                }
                className='gap-1.5'
              >
                <History className='h-4 w-4' />
                History
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className='space-y-4'>
          {/* Order metadata grid */}
          <div className='grid grid-cols-2 gap-4 text-sm md:grid-cols-4'>
            <div>
              <span className='text-muted-foreground'>Product</span>
              <p className='font-medium'>{order.product?.name ?? '—'}</p>
            </div>
            <div>
              <span className='text-muted-foreground'>Customer</span>
              <p className='font-medium'>{order.customer?.name ?? '—'}</p>
            </div>
            <div>
              <span className='text-muted-foreground'>Order No</span>
              <p className='font-medium'>{order.orderNo}</p>
            </div>
            <div>
              <span className='text-muted-foreground'>Status</span>
              <p className='font-medium'>{order.status || 'DRAFT'}</p>
            </div>
            <div>
              <span className='text-muted-foreground'>Type</span>
              <p className='font-medium'>{order.orderType}</p>
            </div>
            <div>
              <span className='text-muted-foreground'>Created</span>
              <p className='font-medium'>
                {new Date(order.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Customer */}
          {order.customer && (
            <div className='space-y-1'>
              <p className='text-muted-foreground text-sm'>Customer</p>
              <div className='bg-muted flex items-center gap-2 rounded-md border px-3 py-2'>
                <span className='text-sm font-medium'>
                  {order.customer.name}
                </span>
                {(order.customer as any).referenceCode && (
                  <span className='text-muted-foreground text-xs'>
                    ({(order.customer as any).referenceCode})
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Design Number */}
          {order.referenceNo && (
            <div className='space-y-1'>
              <p className='text-muted-foreground text-sm'>Design Number</p>
              <div className='bg-muted flex items-center gap-2 rounded-md border px-3 py-2'>
                <Link2 className='text-primary h-4 w-4 flex-shrink-0' />
                <span className='text-sm font-medium'>
                  #{order.referenceNo}
                </span>
                <Badge variant='secondary' className='ml-1 text-[10px]'>
                  {(order as any).parentOrder?.orderType ?? 'SAMPLE'}
                </Badge>
              </div>
            </div>
          )}

          {/* Order form fields (read-only) */}
          {resolvedFields.length > 0 && (
            <>
              <Separator />
              <OrderFormFieldsDisplay
                fields={resolvedFields}
                onFieldValueChange={() => {}}
                templateSummaries={templateSummariesMap}
                disabled={true}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
