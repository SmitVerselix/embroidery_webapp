'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { getCustomer } from '@/lib/api/services';
import { getError } from '@/lib/api/axios';
import type { Customer } from '@/lib/api/types';
import CustomerForm from './customer-form';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

// =============================================================================
// PROPS
// =============================================================================

interface CustomerViewPageProps {
  customerId: string;
}

// =============================================================================
// LOADING SKELETON
// =============================================================================

function FormSkeleton() {
  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="flex gap-4">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function CustomerViewPage({
  customerId,
}: CustomerViewPageProps) {
  const params = useParams();
  const { currentCompany, isLoading: authLoading } = useAuth();

  // Get companyId from URL params (preferred) or current company
  const companyId =
    (params?.companyId as string) || currentCompany?.company?.id;
  const isNew = customerId === 'new';

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  // Fetch customer if editing
  useEffect(() => {
    const fetchCustomer = async () => {
      // Skip if creating new customer
      if (isNew) {
        setIsLoading(false);
        return;
      }

      // Wait for companyId to be available
      if (!companyId) {
        return;
      }

      // Prevent double fetch
      if (hasFetched) {
        return;
      }

      setIsLoading(true);
      setError(null);
      setHasFetched(true);

      try {
        const data = await getCustomer(companyId, customerId);
        setCustomer(data);
      } catch (err) {
        setError(getError(err));
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomer();
  }, [customerId, companyId, isNew, hasFetched]);

  // Show loading if auth is loading or we're fetching
  if (authLoading || (isLoading && !isNew)) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-5 w-32" />
        <FormSkeleton />
      </div>
    );
  }

  // No company selected
  if (!companyId) {
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4">
        <div className="rounded-full bg-muted p-3">
          <AlertCircle className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="text-center space-y-2">
          <h3 className="font-semibold">No company selected</h3>
          <p className="text-sm text-muted-foreground">
            Please select a company first.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard/select-company">Select Company</Link>
        </Button>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4">
        <div className="rounded-full bg-destructive/15 p-3">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <div className="text-center space-y-2">
          <h3 className="font-semibold">Failed to load customer</h3>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/dashboard/${companyId}/customer`}>
            Back to Customers
          </Link>
        </Button>
      </div>
    );
  }

  // Not found state (for edit mode only after fetch completed)
  if (!isNew && !customer && hasFetched && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4">
        <div className="rounded-full bg-muted p-3">
          <AlertCircle className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="text-center space-y-2">
          <h3 className="font-semibold">Customer not found</h3>
          <p className="text-sm text-muted-foreground">
            The customer you&apos;re looking for doesn&apos;t exist or has been
            deleted.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/dashboard/${companyId}/customer`}>
            Back to Customers
          </Link>
        </Button>
      </div>
    );
  }

  const pageTitle = isNew ? 'Create New Customer' : 'Edit Customer';

  return <CustomerForm initialData={customer} pageTitle={pageTitle} />;
}