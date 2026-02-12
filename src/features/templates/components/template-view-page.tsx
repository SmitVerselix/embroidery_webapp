'use client';

import { useState, useEffect } from 'react';
import { getTemplate } from '@/lib/api/services';
import { getError } from '@/lib/api/axios';
import type { Template } from '@/lib/api/types';
import TemplateForm from './template-form';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

// =============================================================================
// PROPS
// =============================================================================

interface TemplateViewPageProps {
  companyId: string;
  productId: string;
  templateId: string;
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
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-24 w-full" />
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

export default function TemplateViewPage({
  companyId,
  productId,
  templateId,
}: TemplateViewPageProps) {
  const isNew = templateId === 'new';

  const [template, setTemplate] = useState<Template | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  // Fetch template if editing
  useEffect(() => {
    const fetchTemplate = async () => {
      // Skip if creating new template
      if (isNew) {
        setIsLoading(false);
        return;
      }

      // Wait for IDs to be available
      if (!companyId || !productId) {
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
        const data = await getTemplate(companyId, productId, templateId);
        setTemplate(data);
      } catch (err) {
        setError(getError(err));
      } finally {
        setIsLoading(false);
      }
    };

    fetchTemplate();
  }, [templateId, companyId, productId, isNew, hasFetched]);

  // Loading state
  if (isLoading && !isNew) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-5 w-32" />
        <FormSkeleton />
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
          <h3 className="font-semibold">Failed to load template</h3>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/dashboard/${companyId}/product/${productId}`}>
            Back to Product
          </Link>
        </Button>
      </div>
    );
  }

  // Not found state (for edit mode only after fetch completed)
  if (!isNew && !template && hasFetched && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4">
        <div className="rounded-full bg-muted p-3">
          <AlertCircle className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="text-center space-y-2">
          <h3 className="font-semibold">Template not found</h3>
          <p className="text-sm text-muted-foreground">
            The template you're looking for doesn't exist or has been deleted.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/dashboard/${companyId}/product/${productId}`}>
            Back to Product
          </Link>
        </Button>
      </div>
    );
  }

  const pageTitle = isNew ? 'Create New Template' : 'Edit Template';

  return (
    <TemplateForm
      companyId={companyId}
      productId={productId}
      initialData={template}
      pageTitle={pageTitle}
    />
  );
}