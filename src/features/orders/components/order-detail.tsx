/**
 * Component: OrderDetail
 * Description: View order details with template values and extra values in read-only mode.
 *              Includes an Edit button to navigate to the edit page.
 *
 * KEY FIX: The order/get API returns `id` as the orderTemplateId on each
 *          template entry. The same templateId can appear multiple times
 *          (repeatable templates), so we use orderTemplateId as the unique key
 *          for values/extraValues maps instead of templateId.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getOrder, getTemplate } from '@/lib/api/services';
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
import { ArrowLeft, AlertCircle, Pencil } from 'lucide-react';
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

/** Represents a single order-template instance (unique by orderTemplateId) */
type OrderTemplateEntry = {
  orderTemplateId: string;
  templateId: string;
  template: TemplateWithDetails;
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
  /** Each entry is a unique order-template instance */
  const [entries, setEntries] = useState<OrderTemplateEntry[]>([]);
  /** Keyed by orderTemplateId (NOT templateId) */
  const [templateValues, setTemplateValues] = useState<
    Record<string, TemplateValuesMap>
  >({});
  /** Keyed by orderTemplateId */
  const [extraValues, setExtraValues] = useState<
    Record<string, ExtraValuesMap>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ──────────────────────────────────────────────────────────────────────
  // FETCH ORDER + TEMPLATES
  // ──────────────────────────────────────────────────────────────────────
  const fetchOrder = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const orderData = await getOrder(companyId, orderId);
      setOrder(orderData);

      if (orderData.templates && orderData.templates.length > 0) {
        // Deduplicate getTemplate calls — same templateId fetched once
        const templateCache: Record<string, TemplateWithDetails> = {};
        const uniqueTemplateIds = Array.from(
          new Set(orderData.templates.map((t) => t.templateId))
        );

        const tmplPromises = uniqueTemplateIds.map(async (templateId) => {
          const full = await getTemplate(
            companyId,
            orderData.productId,
            templateId
          );
          templateCache[templateId] = full;
        });
        await Promise.all(tmplPromises);

        // Build entries and value maps keyed by orderTemplateId
        const loadedEntries: OrderTemplateEntry[] = [];
        const loadedValues: Record<string, TemplateValuesMap> = {};
        const loadedExtraValues: Record<string, ExtraValuesMap> = {};

        orderData.templates.forEach((tmplData: OrderTemplateData) => {
          const orderTemplateId = tmplData.id; // API returns `id` as orderTemplateId
          const fullTemplate = templateCache[tmplData.templateId];

          if (!fullTemplate) return;

          loadedEntries.push({
            orderTemplateId,
            templateId: tmplData.templateId,
            template: fullTemplate
          });

          // Map main values — use value OR calculatedValue (for FORMULA cols)
          const valuesMap: TemplateValuesMap = {};
          (tmplData.values || []).forEach((v) => {
            if (!valuesMap[v.rowId]) {
              valuesMap[v.rowId] = {};
            }
            valuesMap[v.rowId][v.columnId] = v.value ?? v.calculatedValue ?? '';
          });
          loadedValues[orderTemplateId] = valuesMap;

          // Map extra values
          const extValMap: ExtraValuesMap = {};
          (tmplData.extraValues || []).forEach((ev) => {
            extValMap[ev.templateExtraFieldId] = {
              value: ev.value,
              orderExtraValueId: ev.id,
              orderIndex: ev.orderIndex
            };
          });
          loadedExtraValues[orderTemplateId] = extValMap;
        });

        setEntries(loadedEntries);
        setTemplateValues(loadedValues);
        setExtraValues(loadedExtraValues);
      }
    } catch (err) {
      setError(getError(err));
    } finally {
      setIsLoading(false);
    }
  }, [companyId, orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const backUrl = `/dashboard/${companyId}/orders`;
  const editUrl = `/dashboard/${companyId}/orders/${orderId}/edit`;

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
        </CardContent>
      </Card>

      {/* Template Values — one card per order-template instance */}
      {entries.length > 0 && (
        <>
          <Separator />
          <div className='space-y-2'>
            <h2 className='text-lg font-semibold'>Template Values</h2>
            <p className='text-muted-foreground text-sm'>
              Values entered for this order&apos;s templates
            </p>
          </div>
          <div className='space-y-6'>
            {entries.map((entry) => (
              <OrderTemplateValues
                key={entry.orderTemplateId}
                template={entry.template}
                values={templateValues[entry.orderTemplateId] || {}}
                onChange={() => {}}
                readOnly
                extraValues={extraValues[entry.orderTemplateId] || {}}
                onExtraValuesChange={() => {}}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
