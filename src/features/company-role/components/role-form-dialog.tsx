'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/providers/auth-provider';
import { createCompanyRole, updateCompanyRole } from '@/lib/api/services';
import { getError } from '@/lib/api/axios';
import type { CompanyRole } from '@/lib/api/types';
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
import { Loader2, Plus } from 'lucide-react';

// =============================================================================
// SCHEMA
// =============================================================================

const roleFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Role name is required')
    .min(2, 'Role name must be at least 2 characters')
    .max(50, 'Role name must be less than 50 characters'),
  description: z
    .string()
    .max(255, 'Description must be less than 255 characters')
    .optional()
    .or(z.literal(''))
});

type RoleFormData = z.infer<typeof roleFormSchema>;

// =============================================================================
// PROPS
// =============================================================================

interface RoleFormDialogProps {
  role?: CompanyRole | null;
  onSuccess?: () => void;
  trigger?: React.ReactNode;
  /** Controlled mode: pass open + onOpenChange to manage from parent */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function RoleFormDialog({
  role,
  onSuccess,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange
}: RoleFormDialogProps) {
  const params = useParams();
  const { currentCompany } = useAuth();

  const companyId =
    (params?.companyId as string) || currentCompany?.company?.id;

  const isEditing = !!role;
  const isControlled = controlledOpen !== undefined;

  const [internalOpen, setInternalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = isControlled ? controlledOpen : internalOpen;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<RoleFormData>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: {
      name: role?.name || '',
      description: role?.description || ''
    }
  });

  // Reset form when role changes or dialog opens
  useEffect(() => {
    if (open) {
      reset({ name: role?.name || '', description: role?.description || '' });
      setError(null);
    }
  }, [open, role, reset]);

  const handleOpenChange = (value: boolean) => {
    if (isControlled) {
      controlledOnOpenChange?.(value);
    } else {
      setInternalOpen(value);
    }
    if (!value) {
      reset();
      setError(null);
    }
  };

  const onSubmit = async (data: RoleFormData) => {
    if (!companyId) {
      setError('No company selected');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (isEditing && role) {
        await updateCompanyRole(companyId, role.id, {
          name: data.name,
          description: data.description || undefined
        });
      } else {
        await createCompanyRole(companyId, {
          name: data.name,
          description: data.description || undefined
        });
      }

      handleOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(getError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* Only render trigger in uncontrolled (create) mode */}
      {!isControlled && (
        <DialogTrigger asChild>
          {trigger || (
            <Button>
              <Plus className='mr-2 h-4 w-4' />
              Add Role
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Role' : 'Create Role'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the role name. This will affect all members assigned to this role.'
              : 'Create a new role for your company. You can assign this role to members later.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className='space-y-4'>
          {/* Error Message */}
          {error && (
            <div className='bg-destructive/15 text-destructive rounded-md p-3 text-sm'>
              {error}
            </div>
          )}

          {/* Role Name */}
          <div className='space-y-2'>
            <Label htmlFor='role-name'>
              Role Name <span className='text-destructive'>*</span>
            </Label>
            <Input
              id='role-name'
              placeholder='e.g. manager, editor, viewer'
              type='text'
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
            <Label htmlFor='role-description'>Description</Label>
            <Textarea
              id='role-description'
              placeholder='Brief description of this roles responsibilities'
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
                  {isEditing ? 'Updating...' : 'Creating...'}
                </>
              ) : isEditing ? (
                'Update Role'
              ) : (
                'Create Role'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
