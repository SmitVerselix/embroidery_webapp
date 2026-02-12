'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getProduct } from '@/lib/api/services';
import { getError } from '@/lib/api/axios';
import type { Product } from '@/lib/api/types';
import TemplateListing from '@/features/templates/components/template-listing';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Pencil, AlertCircle, Package, FileText } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

// =============================================================================
// PROPS
// =============================================================================

interface ProductDetailPageProps {
  companyId: string;
  productId: string;
}

// =============================================================================
// LOADING SKELETON
// =============================================================================

function ProductDetailSkeleton() {
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

export default function ProductDetailPage({
  companyId,
  productId,
}: ProductDetailPageProps) {
  const router = useRouter();

  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch product
  useEffect(() => {
    const fetchProduct = async () => {
      if (!companyId || !productId) return;

      setIsLoading(true);
      setError(null);

      try {
        const data = await getProduct(companyId, productId);
        setProduct(data);
      } catch (err) {
        setError(getError(err));
      } finally {
        setIsLoading(false);
      }
    };

    fetchProduct();
  }, [companyId, productId]);

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
    return <ProductDetailSkeleton />;
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4">
        <div className="rounded-full bg-destructive/15 p-3">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <div className="text-center space-y-2">
          <h3 className="font-semibold">Failed to load product</h3>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/dashboard/${companyId}/product`}>Back to Products</Link>
        </Button>
      </div>
    );
  }

  // Not found state
  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4">
        <div className="rounded-full bg-muted p-3">
          <Package className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="text-center space-y-2">
          <h3 className="font-semibold">Product not found</h3>
          <p className="text-sm text-muted-foreground">
            The product you're looking for doesn't exist or has been deleted.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/dashboard/${companyId}/product`}>Back to Products</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link
        href={`/dashboard/${companyId}/product`}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Products
      </Link>

      {/* Product Header Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-2xl">{product.name}</CardTitle>
                <Badge variant={product.isActive ? 'default' : 'secondary'}>
                  {product.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <CardDescription>Product ID: {product.id}</CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={() =>
                router.push(`/dashboard/${companyId}/product/${productId}/edit`)
              }
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit Product
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="font-medium">
                {product.isActive ? 'Active' : 'Inactive'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Created At</p>
              <p className="font-medium">{formatDate(product.createdAt)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Updated At</p>
              <p className="font-medium">{formatDate(product.updatedAt)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Templates and other content */}
      <Tabs defaultValue="templates" className="space-y-4">
        <TabsList>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          <TemplateListing companyId={companyId} productId={productId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}