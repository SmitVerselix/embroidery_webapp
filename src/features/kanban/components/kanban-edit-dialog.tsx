'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/providers/auth-provider';
import { updateKanbanBoard } from '@/lib/api/services';
import { getError } from '@/lib/api/axios';
import type { KanbanBoard } from '@/lib/api/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';

// =============================================================================
// SCHEMA
// =============================================================================

const editBoardSchema = z.object({
  name: z
    .string()
    .min(1, 'Board name is required')
    .max(100, 'Board name must be 100 characters or less'),
  description: z
    .string()
    .max(500, 'Description must be 500 characters or less')
    .optional(),
  isDefault: z.boolean()
});

type EditBoardFormData = z.infer<typeof editBoardSchema>;

// =============================================================================
// PROPS
// =============================================================================

interface KanbanEditDialogProps {
  board: KanbanBoard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function KanbanEditDialog({
  board,
  open,
  onOpenChange,
  onSuccess
}: KanbanEditDialogProps) {
  const params = useParams();
  const { currentCompany } = useAuth();

  const companyId =
    (params?.companyId as string) || currentCompany?.company?.id;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors }
  } = useForm<EditBoardFormData>({
    resolver: zodResolver(editBoardSchema),
    defaultValues: {
      name: '',
      description: '',
      isDefault: false
    }
  });

  const isDefault = watch('isDefault');

  // Sync form when board changes
  useEffect(() => {
    if (board) {
      reset({
        name: board.name,
        description: board.description || '',
        isDefault: board.isDefault
      });
      setError(null);
    }
  }, [board, reset]);

  const onSubmit = async (data: EditBoardFormData) => {
    if (!companyId || !board) {
      setError('No company or board selected');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await updateKanbanBoard(companyId, board.id, {
        name: data.name.trim(),
        description: data.description?.trim() || undefined,
        isDefault: data.isDefault
      });

      onSuccess?.();
    } catch (err) {
      setError(getError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>Edit Board</DialogTitle>
          <DialogDescription>
            Update the details of this Kanban board.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className='space-y-4'>
          {/* Error Message */}
          {error && (
            <div className='bg-destructive/15 text-destructive rounded-md p-3 text-sm'>
              {error}
            </div>
          )}

          {/* Name */}
          <div className='space-y-2'>
            <Label htmlFor='edit-board-name'>
              Board Name <span className='text-destructive'>*</span>
            </Label>
            <Input
              id='edit-board-name'
              placeholder='e.g. Sprint Board'
              autoComplete='off'
              disabled={isSubmitting}
              {...register('name')}
              className={errors.name ? 'border-destructive' : ''}
            />
            {errors.name && (
              <p className='text-destructive text-sm'>{errors.name.message}</p>
            )}
          </div>

          {/* Description */}
          <div className='space-y-2'>
            <Label htmlFor='edit-board-description'>Description</Label>
            <Textarea
              id='edit-board-description'
              placeholder='Brief description of this board...'
              disabled={isSubmitting}
              rows={3}
              {...register('description')}
              className={errors.description ? 'border-destructive' : ''}
            />
            {errors.description && (
              <p className='text-destructive text-sm'>
                {errors.description.message}
              </p>
            )}
          </div>

          {/* Default toggle */}
          <div className='flex items-center justify-between rounded-lg border p-3'>
            <div className='space-y-0.5'>
              <Label htmlFor='edit-board-default'>Default Board</Label>
              <p className='text-muted-foreground text-sm'>
                Set as the default board for this company
              </p>
            </div>
            <Switch
              id='edit-board-default'
              checked={isDefault}
              onCheckedChange={(checked) => setValue('isDefault', checked)}
              disabled={isSubmitting}
            />
          </div>

          {/* Footer */}
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type='submit' disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
