'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createTemplate, updateTemplate } from '@/lib/api/services';
import { getError } from '@/lib/api/axios';
import type { Template, TemplateType } from '@/lib/api/types';
import { TEMPLATE_TYPES } from '@/lib/api/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

const templateFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Template name is required')
    .min(2, 'Template name must be at least 2 characters'),
  type: z.enum(['COSTING', 'DETAIL'], {
    message: 'Please select a template type',
  }),
  description: z.string().optional(),
});

type TemplateFormData = z.infer<typeof templateFormSchema>;

// =============================================================================
// PROPS
// =============================================================================

interface TemplateFormProps {
  companyId: string;
  productId: string;
  initialData: Template | null;
  pageTitle: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function TemplateForm({
  companyId,
  productId,
  initialData,
  pageTitle,
}: TemplateFormProps) {
  const router = useRouter();
  const isEditing = !!initialData;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TemplateFormData>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: initialData?.name || '',
      type: initialData?.type || undefined,
      description: initialData?.description || '',
    },
  });

  const selectedType = watch('type');

  // Reset form when initialData changes (for edit mode)
  useEffect(() => {
    if (initialData) {
      reset({
        name: initialData.name || '',
        type: initialData.type || undefined,
        description: initialData.description || '',
      });
    }
  }, [initialData, reset]);

  const onSubmit = async (data: TemplateFormData) => {
    if (!companyId || !productId) {
      setError('Missing company or product');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (isEditing && initialData) {
        // Update existing template
        await updateTemplate(companyId, productId, initialData.id, {
          name: data.name,
          type: data.type as TemplateType,
          description: data.description,
        });
      } else {
        // Create new template
        await createTemplate(companyId, productId, {
          name: data.name,
          type: data.type as TemplateType,
          description: data.description,
        });
      }

      // Redirect to product detail / templates list
      router.push(`/dashboard/${companyId}/product/${productId}`);
      router.refresh();
    } catch (err) {
      setError(getError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const backUrl = `/dashboard/${companyId}/product/${productId}`;

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link
        href={backUrl}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Product
      </Link>

      {/* Form Card */}
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>{pageTitle}</CardTitle>
          <CardDescription>
            {isEditing
              ? 'Update the template information below'
              : 'Fill in the details to create a new template'}
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

            {/* Template Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Template Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Enter template name"
                disabled={isSubmitting}
                {...register('name')}
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            {/* Template Type */}
            <div className="space-y-2">
              <Label htmlFor="type">
                Template Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={selectedType}
                onValueChange={(value) => setValue('type', value as TemplateType)}
                disabled={isSubmitting}
              >
                <SelectTrigger className={errors.type ? 'border-destructive' : ''}>
                  <SelectValue placeholder="Select template type" />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.type && (
                <p className="text-sm text-destructive">{errors.type.message}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Enter template description (optional)"
                disabled={isSubmitting}
                rows={4}
                {...register('description')}
                className={errors.description ? 'border-destructive' : ''}
              />
              {errors.description && (
                <p className="text-sm text-destructive">
                  {errors.description.message}
                </p>
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
                  'Update Template'
                ) : (
                  'Create Template'
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