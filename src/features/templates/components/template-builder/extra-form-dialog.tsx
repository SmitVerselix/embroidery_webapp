'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type {
  TemplateExtra,
  ExtraSectionType,
  ExtraValueType,
  ExtraVisibilityScope
} from '@/lib/api/types';
import {
  EXTRA_SECTION_TYPES,
  EXTRA_VALUE_TYPES,
  EXTRA_VISIBILITY_SCOPES
} from '@/lib/api/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Loader2, AlertCircle } from 'lucide-react';

// =============================================================================
// SCHEMA
// =============================================================================

const extraFormSchema = z.object({
  label: z
    .string()
    .min(1, 'Label is required')
    .min(2, 'Label must be at least 2 characters')
    .max(50, 'Label must be less than 50 characters'),
  sectionType: z.enum(['HEADER', 'FOOTER', 'MEDIA'], {
    message: 'Please select a section type'
  }),
  valueType: z.enum(['TEXT', 'NUMBER', 'DATE', 'IMAGE', 'FILE'], {
    message: 'Please select a value type'
  }),
  visibilityScope: z.enum(['ALWAYS', 'ONLY_CHILD', 'ONLY_ROOT'], {
    message: 'Please select a visibility scope'
  }),
  isRequired: z.boolean(),
  allowMultiple: z.boolean()
});

type ExtraFormData = z.infer<typeof extraFormSchema>;

// =============================================================================
// PROPS
// =============================================================================

interface ExtraFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    key: string;
    sectionType: ExtraSectionType;
    valueType: ExtraValueType;
    visibilityScope: ExtraVisibilityScope;
    label: string;
    isRequired: boolean;
    allowMultiple: boolean;
  }) => Promise<void>;
  initialData?: TemplateExtra | null;
  /** Optional: pre-select a section type when opening from a section-specific "Add" button */
  defaultSectionType?: ExtraSectionType;
  isLoading?: boolean;
  error?: string | null;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate key from label
 * Example: "Blue Dhaga use" becomes "blue_dhaga_use_0"
 */
const generateKey = (label: string): string => {
  const cleanLabel = label
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return `${cleanLabel}_0`;
};

// =============================================================================
// COMPONENT
// =============================================================================

export default function ExtraFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  defaultSectionType,
  isLoading = false,
  error
}: ExtraFormDialogProps) {
  const isEditing = !!initialData;
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors }
  } = useForm<ExtraFormData>({
    resolver: zodResolver(extraFormSchema),
    defaultValues: {
      label: initialData?.label || '',
      sectionType: initialData?.sectionType || defaultSectionType || undefined,
      valueType: initialData?.valueType || undefined,
      visibilityScope: initialData?.visibilityScope || 'ALWAYS',
      isRequired: initialData?.isRequired || false,
      allowMultiple: initialData?.allowMultiple || false
    }
  });

  const selectedSectionType = watch('sectionType');
  const selectedValueType = watch('valueType');

  // Reset form when dialog opens/closes or initialData changes
  useEffect(() => {
    if (open) {
      reset({
        label: initialData?.label || '',
        sectionType:
          initialData?.sectionType || defaultSectionType || undefined,
        valueType: initialData?.valueType || undefined,
        visibilityScope: initialData?.visibilityScope || 'ALWAYS',
        isRequired: initialData?.isRequired || false,
        allowMultiple: initialData?.allowMultiple || false
      });
      setSubmitError(null);
    }
  }, [open, initialData, defaultSectionType, reset]);

  // Handle form submission
  const handleFormSubmit = async (data: ExtraFormData) => {
    setSubmitError(null);

    try {
      const key = (isEditing && initialData?.key) || generateKey(data.label);

      await onSubmit({
        key,
        label: data.label,
        sectionType: data.sectionType as ExtraSectionType,
        valueType: data.valueType as ExtraValueType,
        visibilityScope: data.visibilityScope as ExtraVisibilityScope,
        isRequired: data.isRequired,
        allowMultiple: data.allowMultiple
      });
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to save extra field'
      );
      throw err;
    }
  };

  const displayError = error || submitError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[500px]'>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Extra Field' : 'Add Extra Field'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the extra field properties below.'
              : 'Add a header, footer, or media field to your template.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className='space-y-4'>
          {/* Error Message */}
          {displayError && (
            <div className='bg-destructive/15 text-destructive flex items-start gap-2 rounded-md p-3 text-sm'>
              <AlertCircle className='mt-0.5 h-4 w-4 flex-shrink-0' />
              <span>{displayError}</span>
            </div>
          )}

          {/* Label */}
          <div className='space-y-2'>
            <Label htmlFor='extra-label'>
              Label <span className='text-destructive'>*</span>
            </Label>
            <Input
              id='extra-label'
              placeholder='e.g., Company Name, Invoice Date, Logo'
              disabled={isLoading}
              {...register('label')}
              className={errors.label ? 'border-destructive' : ''}
            />
            {errors.label && (
              <p className='text-destructive text-sm'>{errors.label.message}</p>
            )}
          </div>

          {/* Section Type */}
          <div className='space-y-2'>
            <Label>
              Section Type <span className='text-destructive'>*</span>
            </Label>
            <Select
              value={selectedSectionType}
              onValueChange={(value) =>
                setValue('sectionType', value as ExtraSectionType)
              }
              disabled={isLoading}
            >
              <SelectTrigger
                className={errors.sectionType ? 'border-destructive' : ''}
              >
                <SelectValue placeholder='Select section type' />
              </SelectTrigger>
              <SelectContent>
                {EXTRA_SECTION_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className='flex flex-col'>
                      <span>{type.label}</span>
                      <span className='text-muted-foreground text-xs'>
                        {type.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.sectionType && (
              <p className='text-destructive text-sm'>
                {errors.sectionType.message}
              </p>
            )}
          </div>

          {/* Value Type */}
          <div className='space-y-2'>
            <Label>
              Value Type <span className='text-destructive'>*</span>
            </Label>
            <Select
              value={selectedValueType}
              onValueChange={(value) =>
                setValue('valueType', value as ExtraValueType)
              }
              disabled={isLoading}
            >
              <SelectTrigger
                className={errors.valueType ? 'border-destructive' : ''}
              >
                <SelectValue placeholder='Select value type' />
              </SelectTrigger>
              <SelectContent>
                {EXTRA_VALUE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className='flex flex-col'>
                      <span>{type.label}</span>
                      <span className='text-muted-foreground text-xs'>
                        {type.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.valueType && (
              <p className='text-destructive text-sm'>
                {errors.valueType.message}
              </p>
            )}
          </div>

          {/* Visibility Scope */}
          <div className='space-y-2'>
            <Label>
              Visibility Scope <span className='text-destructive'>*</span>
            </Label>
            <Select
              value={watch('visibilityScope')}
              onValueChange={(value) =>
                setValue('visibilityScope', value as ExtraVisibilityScope)
              }
              disabled={isLoading}
            >
              <SelectTrigger
                className={errors.visibilityScope ? 'border-destructive' : ''}
              >
                <SelectValue placeholder='Select visibility' />
              </SelectTrigger>
              <SelectContent>
                {EXTRA_VISIBILITY_SCOPES.map((scope) => (
                  <SelectItem key={scope.value} value={scope.value}>
                    <div className='flex flex-col'>
                      <span>{scope.label}</span>
                      <span className='text-muted-foreground text-xs'>
                        {scope.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.visibilityScope && (
              <p className='text-destructive text-sm'>
                {errors.visibilityScope.message}
              </p>
            )}
          </div>

          {/* Is Required */}
          <div className='flex items-center justify-between rounded-lg border p-3'>
            <div className='space-y-0.5'>
              <Label htmlFor='extra-isRequired'>Required Field</Label>
              <p className='text-muted-foreground text-xs'>
                Make this field mandatory when filling the template
              </p>
            </div>
            <Switch
              id='extra-isRequired'
              checked={watch('isRequired')}
              onCheckedChange={(checked) => setValue('isRequired', checked)}
              disabled={isLoading}
            />
          </div>

          {/* Allow Multiple */}
          <div className='flex items-center justify-between rounded-lg border p-3'>
            <div className='space-y-0.5'>
              <Label htmlFor='extra-allowMultiple'>Allow Multiple</Label>
              <p className='text-muted-foreground text-xs'>
                Allow multiple values for this field
              </p>
            </div>
            <Switch
              id='extra-allowMultiple'
              checked={watch('allowMultiple')}
              onCheckedChange={(checked) => setValue('allowMultiple', checked)}
              disabled={isLoading}
            />
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type='submit' disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  {isEditing ? 'Updating...' : 'Creating...'}
                </>
              ) : isEditing ? (
                'Update Field'
              ) : (
                'Add Field'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
