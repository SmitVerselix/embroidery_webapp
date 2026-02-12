'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/providers/auth-provider';
import { createProduct, updateProduct } from '@/lib/api/services';
import { getError } from '@/lib/api/axios';
import type { Product } from '@/lib/api/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

// =============================================================================
// SCHEMA (Zod v4 compatible)
// =============================================================================

const productFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Product name is required')
    .min(2, 'Product name must be at least 2 characters'),
});

type ProductFormData = z.infer<typeof productFormSchema>;

// =============================================================================
// PROPS
// =============================================================================

interface ProductFormProps {
  initialData: Product | null;
  pageTitle: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function ProductForm({ initialData, pageTitle }: ProductFormProps) {
  const router = useRouter();
  const params = useParams();
  const { currentCompany } = useAuth();

  const companyId = (params?.companyId as string) || currentCompany?.company?.id;
  const isEditing = !!initialData;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: initialData?.name || '',
    },
  });

  // Reset form when initialData changes (for edit mode)
  useEffect(() => {
    if (initialData) {
      reset({
        name: initialData.name || '',
      });
    }
  }, [initialData, reset]);

  const onSubmit = async (data: ProductFormData) => {
    if (!companyId) {
      setError('No company selected');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (isEditing && initialData) {
        // Update existing product
        await updateProduct(companyId, initialData.id, {
          name: data.name,
        });
        // Redirect to product detail page after edit
        router.push(`/dashboard/${companyId}/product/${initialData.id}`);
      } else {
        // Create new product
        const newProduct = await createProduct(companyId, {
          name: data.name,
        });
        // Redirect to product detail page after create
        router.push(`/dashboard/${companyId}/product/${newProduct.id}`);
      }
      router.refresh();
    } catch (err) {
      setError(getError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!companyId) {
    return (
      <div className="flex items-center justify-center py-10">
        <p className="text-muted-foreground">No company selected</p>
      </div>
    );
  }

  // Dynamic back URL based on context
  const backUrl = isEditing && initialData
    ? `/dashboard/${companyId}/product/${initialData.id}`
    : `/dashboard/${companyId}/product`;

  const backLabel = isEditing ? 'Back to Product' : 'Back to Products';

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link
        href={backUrl}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {backLabel}
      </Link>

      {/* Form Card */}
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>{pageTitle}</CardTitle>
          <CardDescription>
            {isEditing
              ? 'Update the product information below'
              : 'Fill in the details to create a new product'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Product Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Product Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Enter product name"
                disabled={isSubmitting}
                {...register('name')}
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex gap-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isEditing ? 'Updating...' : 'Creating...'}
                  </>
                ) : isEditing ? (
                  'Update Product'
                ) : (
                  'Create Product'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(backUrl)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}