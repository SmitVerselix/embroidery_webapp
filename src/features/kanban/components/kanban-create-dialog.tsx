'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/providers/auth-provider';
import { createKanbanBoard } from '@/lib/api/services';
import { getError } from '@/lib/api/axios';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Plus } from 'lucide-react';

// =============================================================================
// SCHEMA
// =============================================================================

const createBoardSchema = z.object({
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

type CreateBoardFormData = z.infer<typeof createBoardSchema>;

// =============================================================================
// PROPS
// =============================================================================

interface KanbanCreateDialogProps {
  onSuccess?: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function KanbanCreateDialog({
  onSuccess
}: KanbanCreateDialogProps) {
  const params = useParams();
  const { currentCompany } = useAuth();

  const companyId =
    (params?.companyId as string) || currentCompany?.company?.id;

  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors }
  } = useForm<CreateBoardFormData>({
    resolver: zodResolver(createBoardSchema),
    defaultValues: {
      name: '',
      description: '',
      isDefault: false
    }
  });

  const isDefault = watch('isDefault');

  const onSubmit = async (data: CreateBoardFormData) => {
    if (!companyId) {
      setError('No company selected');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await createKanbanBoard(companyId, {
        name: data.name.trim(),
        description: data.description?.trim() || undefined,
        isDefault: data.isDefault
      });

      onSuccess?.();
      handleOpenChange(false);
    } catch (err) {
      setError(getError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (value: boolean) => {
    setOpen(value);
    if (!value) {
      reset();
      setError(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className='mr-2 h-4 w-4' />
          New Board
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>Create New Board</DialogTitle>
          <DialogDescription>
            Add a new Kanban board for your team to manage tasks.
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
            <Label htmlFor='board-name'>
              Board Name <span className='text-destructive'>*</span>
            </Label>
            <Input
              id='board-name'
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
            <Label htmlFor='board-description'>Description</Label>
            <Textarea
              id='board-description'
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
              <Label htmlFor='board-default'>Default Board</Label>
              <p className='text-muted-foreground text-sm'>
                Set as the default board for this company
              </p>
            </div>
            <Switch
              id='board-default'
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
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type='submit' disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Creating...
                </>
              ) : (
                'Create Board'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
