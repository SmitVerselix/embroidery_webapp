'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { TemplateBlock } from '@/lib/api/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Loader2, AlertCircle } from 'lucide-react';

// =============================================================================
// SCHEMA
// =============================================================================

const blockFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Block name is required')
    .min(2, 'Block name must be at least 2 characters')
    .max(100, 'Block name must be less than 100 characters')
});

type BlockFormData = z.infer<typeof blockFormSchema>;

// =============================================================================
// PROPS
// =============================================================================

interface BlockFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string }) => Promise<void>;
  initialData?: TemplateBlock | null;
  isLoading?: boolean;
  error?: string | null;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function BlockFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  isLoading = false,
  error
}: BlockFormDialogProps) {
  const isEditing = !!initialData;
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<BlockFormData>({
    resolver: zodResolver(blockFormSchema),
    defaultValues: {
      name: initialData?.name || ''
    }
  });

  // Reset form when dialog opens/closes or initialData changes
  useEffect(() => {
    if (open) {
      reset({
        name: initialData?.name || ''
      });
      setSubmitError(null);
    }
  }, [open, initialData, reset]);

  // Handle form submission
  const handleFormSubmit = async (data: BlockFormData) => {
    setSubmitError(null);

    try {
      await onSubmit({ name: data.name });
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to save block'
      );
      throw err;
    }
  };

  const displayError = error || submitError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Block' : 'Add Block'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the block name below.'
              : 'Enter a name to create a new block.'}
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

          {/* Name */}
          <div className='space-y-2'>
            <Label htmlFor='block-name'>
              Block Name <span className='text-destructive'>*</span>
            </Label>
            <Input
              id='block-name'
              placeholder='e.g., Before Line Balancing, After Line Balancing'
              disabled={isLoading}
              {...register('name')}
              className={errors.name ? 'border-destructive' : ''}
            />
            {errors.name && (
              <p className='text-destructive text-sm'>{errors.name.message}</p>
            )}
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
                'Update Block'
              ) : (
                'Add Block'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
