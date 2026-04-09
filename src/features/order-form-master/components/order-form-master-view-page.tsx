'use client';

import { useState, useEffect } from 'react';
import { getProduct, getOrderFormMaster } from '@/lib/api/services';
import { getError } from '@/lib/api/axios';
import type { OrderFormMaster, TemplateWithDetails } from '@/lib/api/types';
import OrderFormMasterForm from './order-form-master-form';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

// =============================================================================
// PROPS
// =============================================================================

interface OrderFormMasterViewPageProps {
  companyId: string;
  productId: string;
  orderFormMasterId: string;
}

// =============================================================================
// LOADING SKELETON
// =============================================================================

function FormSkeleton() {
  return (
    <Card className='mx-auto max-w-2xl'>
      <CardHeader className='space-y-2'>
        <Skeleton className='h-8 w-48' />
        <Skeleton className='h-4 w-72' />
      </CardHeader>
      <CardContent className='space-y-6'>
        <div className='space-y-2'>
          <Skeleton className='h-4 w-24' />
          <Skeleton className='h-10 w-full' />
        </div>
        <div className='space-y-2'>
          <Skeleton className='h-4 w-24' />
          <Skeleton className='h-10 w-full' />
        </div>
        <div className='space-y-2'>
          <Skeleton className='h-4 w-24' />
          <Skeleton className='h-24 w-full' />
        </div>
        <div className='flex gap-4'>
          <Skeleton className='h-10 w-32' />
          <Skeleton className='h-10 w-24' />
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function OrderFormMasterViewPage({
  companyId,
  productId,
  orderFormMasterId
}: OrderFormMasterViewPageProps) {
  const isNew = orderFormMasterId === 'new';

  const [orderFormMaster, setOrderFormMaster] =
    useState<OrderFormMaster | null>(null);
  const [templates, setTemplates] = useState<TemplateWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  // Fetch product (for templates) and order form master (if editing)
  useEffect(() => {
    const fetchData = async () => {
      if (!companyId || !productId) return;
      if (hasFetched) return;

      setIsLoading(true);
      setError(null);
      setHasFetched(true);

      try {
        // Always fetch product to get templates for the form
        const product = await getProduct(companyId, productId);
        setTemplates((product.templates || []) as TemplateWithDetails[]);

        // Fetch order form master if editing
        if (!isNew) {
          const data = await getOrderFormMaster(
            companyId,
            productId,
            orderFormMasterId
          );
          setOrderFormMaster(data);
        }
      } catch (err) {
        setError(getError(err));
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [companyId, productId, orderFormMasterId, isNew, hasFetched]);

  // Loading state
  if (isLoading) {
    return (
      <div className='space-y-6'>
        <Skeleton className='h-5 w-32' />
        <FormSkeleton />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className='flex flex-col items-center justify-center space-y-4 py-10'>
        <div className='bg-destructive/15 rounded-full p-3'>
          <AlertCircle className='text-destructive h-6 w-6' />
        </div>
        <div className='space-y-2 text-center'>
          <h3 className='font-semibold'>Failed to load data</h3>
          <p className='text-muted-foreground text-sm'>{error}</p>
        </div>
        <Button asChild variant='outline'>
          <Link href={`/dashboard/${companyId}/product/${productId}`}>
            Back to Product
          </Link>
        </Button>
      </div>
    );
  }

  // Not found state (for edit mode only after fetch completed)
  if (!isNew && !orderFormMaster && hasFetched && !isLoading) {
    return (
      <div className='flex flex-col items-center justify-center space-y-4 py-10'>
        <div className='bg-muted rounded-full p-3'>
          <AlertCircle className='text-muted-foreground h-6 w-6' />
        </div>
        <div className='space-y-2 text-center'>
          <h3 className='font-semibold'>Order form field not found</h3>
          <p className='text-muted-foreground text-sm'>
            The order form field you&apos;re looking for doesn&apos;t exist or
            has been deleted.
          </p>
        </div>
        <Button asChild variant='outline'>
          <Link href={`/dashboard/${companyId}/product/${productId}`}>
            Back to Product
          </Link>
        </Button>
      </div>
    );
  }

  const pageTitle = isNew ? 'Create Order Form Field' : 'Edit Order Form Field';

  return (
    <OrderFormMasterForm
      companyId={companyId}
      productId={productId}
      initialData={orderFormMaster}
      templates={templates}
      pageTitle={pageTitle}
    />
  );
}
