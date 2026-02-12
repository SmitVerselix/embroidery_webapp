'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { createCustomer, updateCustomer } from '@/lib/api/services';
import { getError } from '@/lib/api/axios';
import type { Customer } from '@/lib/api/types';
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
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

// =============================================================================
// PROPS
// =============================================================================

interface CustomerFormProps {
  initialData?: Customer | null;
  pageTitle: string;
}

// =============================================================================
// VALIDATION
// =============================================================================

interface FormErrors {
  name?: string;
  referenceCode?: string;
}

function validateForm(data: {
  name: string;
  referenceCode: string;
}): FormErrors {
  const errors: FormErrors = {};

  // Name validation
  const trimmedName = data.name.trim();
  if (!trimmedName) {
    errors.name = 'Customer name is required';
  } else if (trimmedName.length < 2) {
    errors.name = 'Customer name must be at least 2 characters';
  } else if (trimmedName.length > 100) {
    errors.name = 'Customer name must not exceed 100 characters';
  }

  // Reference code validation
  const trimmedCode = data.referenceCode.trim();
  if (!trimmedCode) {
    errors.referenceCode = 'Reference code is required';
  } else if (trimmedCode.length < 1) {
    errors.referenceCode = 'Reference code must be at least 1 character';
  } else if (trimmedCode.length > 50) {
    errors.referenceCode = 'Reference code must not exceed 50 characters';
  } else if (!/^[a-zA-Z0-9_-]+$/.test(trimmedCode)) {
    errors.referenceCode =
      'Reference code can only contain letters, numbers, hyphens, and underscores';
  }

  return errors;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function CustomerForm({
  initialData,
  pageTitle,
}: CustomerFormProps) {
  const router = useRouter();
  const params = useParams();
  const { currentCompany } = useAuth();

  const companyId =
    (params?.companyId as string) || currentCompany?.company?.id;
  const isEditing = !!initialData;

  // Form state
  const [name, setName] = useState(initialData?.name ?? '');
  const [referenceCode, setReferenceCode] = useState(
    initialData?.referenceCode ?? ''
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    const formErrors = validateForm({ name, referenceCode });
    setErrors(formErrors);

    if (Object.keys(formErrors).length > 0) {
      return;
    }

    if (!companyId) {
      setSubmitError('No company selected');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload = {
        name: name.trim(),
        referenceCode: referenceCode.trim(),
      };

      if (isEditing && initialData) {
        await updateCustomer(companyId, initialData.id, payload);
      } else {
        await createCustomer(companyId, payload);
      }

      router.push(`/dashboard/${companyId}/customer`);
      router.refresh();
    } catch (err) {
      setSubmitError(getError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

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

      {/* Form Card */}
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>{pageTitle}</CardTitle>
          <CardDescription>
            {isEditing
              ? 'Update the customer details below.'
              : 'Fill in the details below to create a new customer.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Submit Error */}
            {submitError && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {submitError}
              </div>
            )}

            {/* Name Field */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Customer Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Enter customer name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) {
                    setErrors((prev) => ({ ...prev, name: undefined }));
                  }
                }}
                className={errors.name ? 'border-destructive' : ''}
                disabled={isSubmitting}
                autoFocus
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>

            {/* Reference Code Field */}
            <div className="space-y-2">
              <Label htmlFor="referenceCode">
                Reference Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="referenceCode"
                placeholder="Enter reference code (e.g., CUST001)"
                value={referenceCode}
                onChange={(e) => {
                  setReferenceCode(e.target.value);
                  if (errors.referenceCode) {
                    setErrors((prev) => ({
                      ...prev,
                      referenceCode: undefined,
                    }));
                  }
                }}
                className={errors.referenceCode ? 'border-destructive' : ''}
                disabled={isSubmitting}
              />
              {errors.referenceCode && (
                <p className="text-sm text-destructive">
                  {errors.referenceCode}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Only letters, numbers, hyphens, and underscores are allowed.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isEditing ? 'Updating...' : 'Creating...'}
                  </>
                ) : isEditing ? (
                  'Update Customer'
                ) : (
                  'Create Customer'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() =>
                  router.push(`/dashboard/${companyId}/customer`)
                }
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