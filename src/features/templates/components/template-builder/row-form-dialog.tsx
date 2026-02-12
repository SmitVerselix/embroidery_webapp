/**
 * Component: RowFormDialog
 * Description: Dialog for creating/editing template rows
 */

'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { TemplateRow, RowType } from '@/lib/api/types';
import { ROW_TYPES } from '@/lib/api/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

// =============================================================================
// SCHEMA
// =============================================================================

const rowFormSchema = z.object({
  label: z
    .string()
    .min(1, 'Label is required')
    .min(2, 'Label must be at least 2 characters'),
  rowType: z.enum(['NORMAL', 'TOTAL'], {
    message: 'Please select a row type',
  }),
});

type RowFormData = z.infer<typeof rowFormSchema>;

// =============================================================================
// PROPS
// =============================================================================

interface RowFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    label: string;
    rowType: RowType;
    isCalculated: boolean;
  }) => Promise<void>;
  initialData?: TemplateRow | null;
  isLoading?: boolean;
  error?: string | null;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function RowFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  isLoading = false,
  error,
}: RowFormDialogProps) {
  const isEditing = !!initialData;
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RowFormData>({
    resolver: zodResolver(rowFormSchema),
    defaultValues: {
      label: initialData?.label || '',
      rowType: initialData?.rowType || undefined,
    },
  });

  const selectedRowType = watch('rowType');

  // Reset form when dialog opens/closes or initialData changes
  useEffect(() => {
    if (open) {
      reset({
        label: initialData?.label || '',
        rowType: initialData?.rowType || undefined,
      });
      setSubmitError(null);
    }
  }, [open, initialData, reset]);

  // Handle form submission
  const handleFormSubmit = async (data: RowFormData) => {
    setSubmitError(null);

    try {
      // isCalculated is true if rowType is TOTAL, false if NORMAL
      const isCalculated = data.rowType === 'TOTAL';

      await onSubmit({
        label: data.label,
        rowType: data.rowType as RowType,
        isCalculated,
      });

      onOpenChange(false);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save row');
    }
  };

  const displayError = error || submitError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Row' : 'Add Row'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the row properties below.'
              : 'Fill in the details to create a new row.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          {/* Error Message */}
          {displayError && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {displayError}
            </div>
          )}

          {/* Label */}
          <div className="space-y-2">
            <Label htmlFor="label">
              Label <span className="text-destructive">*</span>
            </Label>
            <Input
              id="label"
              placeholder="e.g., Item, Material, Total"
              disabled={isLoading}
              {...register('label')}
              className={errors.label ? 'border-destructive' : ''}
            />
            {errors.label && (
              <p className="text-sm text-destructive">{errors.label.message}</p>
            )}
          </div>

          {/* Row Type */}
          <div className="space-y-2">
            <Label htmlFor="rowType">
              Row Type <span className="text-destructive">*</span>
            </Label>
            <Select
              value={selectedRowType}
              onValueChange={(value) => setValue('rowType', value as RowType)}
              disabled={isLoading}
            >
              <SelectTrigger className={errors.rowType ? 'border-destructive' : ''}>
                <SelectValue placeholder="Select row type" />
              </SelectTrigger>
              <SelectContent>
                {ROW_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.rowType && (
              <p className="text-sm text-destructive">{errors.rowType.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {selectedRowType === 'TOTAL'
                ? 'Total rows are calculated automatically.'
                : 'Normal rows contain regular data entries.'}
            </p>
          </div>

          {/* Info about isCalculated */}
          {selectedRowType && (
            <div className="rounded-lg border p-3 bg-muted/50">
              <p className="text-sm">
                <span className="font-medium">Is Calculated:</span>{' '}
                <span className={selectedRowType === 'TOTAL' ? 'text-green-600' : 'text-muted-foreground'}>
                  {selectedRowType === 'TOTAL' ? 'Yes' : 'No'}
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedRowType === 'TOTAL'
                  ? 'This row will be calculated based on other rows.'
                  : 'This is a regular data row.'}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditing ? 'Updating...' : 'Creating...'}
                </>
              ) : isEditing ? (
                'Update Row'
              ) : (
                'Add Row'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}