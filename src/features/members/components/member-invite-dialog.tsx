'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/providers/auth-provider';
import { inviteMember } from '@/lib/api/services';
import { getError } from '@/lib/api/axios';
import { MEMBER_ROLES } from '@/lib/api/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, UserPlus } from 'lucide-react';

// =============================================================================
// SCHEMA
// =============================================================================

const inviteFormSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  role: z.enum(['admin', 'member']).pipe(
    z.enum(['admin', 'member']).refine(() => true, {
      message: 'Please select a role'
    })
  )
});

type InviteFormData = z.infer<typeof inviteFormSchema>;

// =============================================================================
// PROPS
// =============================================================================

interface MemberInviteDialogProps {
  onSuccess?: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function MemberInviteDialog({
  onSuccess
}: MemberInviteDialogProps) {
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
  } = useForm<InviteFormData>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: {
      email: '',
      role: 'member'
    }
  });

  const selectedRole = watch('role');

  const onSubmit = async (data: InviteFormData) => {
    if (!companyId) {
      setError('No company selected');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await inviteMember(companyId, {
        email: data.email,
        role: data.role
      });
      reset();
      setOpen(false);
      onSuccess?.();
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
          <UserPlus className='mr-2 h-4 w-4' />
          Invite Member
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>Invite Member</DialogTitle>
          <DialogDescription>
            Send an invitation to join your company. They&apos;ll receive an
            email with instructions.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className='space-y-4'>
          {/* Error Message */}
          {error && (
            <div className='bg-destructive/15 text-destructive rounded-md p-3 text-sm'>
              {error}
            </div>
          )}

          {/* Email */}
          <div className='space-y-2'>
            <Label htmlFor='invite-email'>
              Email Address <span className='text-destructive'>*</span>
            </Label>
            <Input
              id='invite-email'
              placeholder='colleague@example.com'
              type='email'
              autoComplete='off'
              disabled={isSubmitting}
              {...register('email')}
              className={errors.email ? 'border-destructive' : ''}
            />
            {errors.email && (
              <p className='text-destructive text-sm'>{errors.email.message}</p>
            )}
          </div>

          {/* Role */}
          <div className='space-y-2'>
            <Label htmlFor='invite-role'>
              Role <span className='text-destructive'>*</span>
            </Label>
            <Select
              value={selectedRole}
              onValueChange={(value) =>
                setValue('role', value as 'admin' | 'member', {
                  shouldValidate: true
                })
              }
              disabled={isSubmitting}
            >
              <SelectTrigger
                id='invite-role'
                className={errors.role ? 'border-destructive' : ''}
              >
                <SelectValue placeholder='Select a role' />
              </SelectTrigger>
              <SelectContent>
                {MEMBER_ROLES.filter((r) => r.value !== 'owner').map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.role && (
              <p className='text-destructive text-sm'>{errors.role.message}</p>
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
                  Sending...
                </>
              ) : (
                'Send Invitation'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
