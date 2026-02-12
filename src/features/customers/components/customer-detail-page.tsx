'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCustomer } from '@/lib/api/services';
import { getError } from '@/lib/api/axios';
import type { Customer } from '@/lib/api/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ArrowLeft, Pencil, AlertCircle, Users } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

// =============================================================================
// PROPS
// =============================================================================

interface CustomerDetailPageProps {
  companyId: string;
  customerId: string;
}

// =============================================================================
// LOADING SKELETON
// =============================================================================

function CustomerDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-5 w-32" />
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-10 w-20" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-24" />
            </div>
            <div className="space-y-1">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-32" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function CustomerDetailPage({
  companyId,
  customerId,
}: CustomerDetailPageProps) {
  const router = useRouter();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch customer
  useEffect(() => {
    const fetchCustomer = async () => {
      if (!companyId || !customerId) return;

      setIsLoading(true);
      setError(null);

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
  }, [companyId, customerId]);

  // Format date
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy HH:mm');
    } catch {
      return dateString;
    }
  };

  // Loading state
  if (isLoading) {
    return <CustomerDetailSkeleton />;
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

  // Not found state
  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4">
        <div className="rounded-full bg-muted p-3">
          <Users className="h-6 w-6 text-muted-foreground" />
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

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link
        href={`/dashboard/${companyId}/customer`}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Customers
      </Link>

      {/* Customer Header Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-2xl">{customer.name}</CardTitle>
                <Badge
                  variant={customer.isActive ? 'default' : 'secondary'}
                >
                  {customer.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <CardDescription>
                Customer ID: {customer.id}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={() =>
                router.push(
                  `/dashboard/${companyId}/customer/${customerId}/edit`
                )
              }
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit Customer
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Reference Code</p>
              <p className="font-medium">{customer.referenceCode}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="font-medium">
                {customer.isActive ? 'Active' : 'Inactive'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Created At</p>
              <p className="font-medium">{formatDate(customer.createdAt)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Updated At</p>
              <p className="font-medium">{formatDate(customer.updatedAt)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}