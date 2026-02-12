'use client';

import { useParams } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import OrderForm from './order-form';
import OrderEditForm from './order-edit-form';

// =============================================================================
// PROPS
// =============================================================================

interface OrderViewPageProps {
  orderId: string;
}

// =============================================================================
// LOADING SKELETON
// =============================================================================

function FormSkeleton() {
  return (
    <Card className="mx-auto max-w-4xl">
      <CardHeader className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
        <Skeleton className="h-48 w-full" />
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

export default function OrderViewPage({ orderId }: OrderViewPageProps) {
  const params = useParams();
  const { currentCompany, isLoading: authLoading } = useAuth();

  // Get companyId from URL params (preferred) or current company
  const companyId =
    (params?.companyId as string) || currentCompany?.company?.id;
  const isNew = orderId === 'new';

  // Show loading if auth is loading
  if (authLoading) {
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

  // New order → render create form
  if (isNew) {
    return <OrderForm companyId={companyId} />;
  }

  // Existing order → render edit form
  return <OrderEditForm companyId={companyId} orderId={orderId} />;
}