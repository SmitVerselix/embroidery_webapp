'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { updateKanbanPermissionUser } from '@/lib/api/services';
import { getError } from '@/lib/api/axios';
import type { KanbanPermission, KanbanSection } from '@/lib/api/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

// =============================================================================
// PROPS
// =============================================================================

interface KanbanPermissionEditDialogProps {
  permission: KanbanPermission | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: KanbanSection[];
  onSuccess?: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function KanbanPermissionEditDialog({
  permission,
  open,
  onOpenChange,
  sections,
  onSuccess
}: KanbanPermissionEditDialogProps) {
  const params = useParams();
  const { currentCompany } = useAuth();

  const companyId =
    (params?.companyId as string) || currentCompany?.company?.id;
  const kanbanId = params?.kanbanId as string;

  // ── State ──────────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [sectionId, setSectionId] = useState('');
  const [canViewAllTasks, setCanViewAllTasks] = useState(true);

  // ── Sync form when permission changes ──────────────────────────────────
  useEffect(() => {
    if (permission) {
      setSectionId(permission.sectionId || '');
      setCanViewAllTasks(permission.canViewAllTasks ?? true);
      setError(null);
    }
  }, [permission]);

  // ── Submit ─────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!companyId || !kanbanId || !permission) {
      setError('No company, board, or permission selected');
      return;
    }
    if (!sectionId) {
      setError('Please select a section');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await updateKanbanPermissionUser(companyId, kanbanId, permission.id, {
        userId: permission.userId,
        sectionId,
        canViewAllTasks
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
      <DialogContent className='sm:max-w-[480px]'>
        <DialogHeader>
          <DialogTitle>Edit User Permission</DialogTitle>
          <DialogDescription>
            Update permissions for this user on the board.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className='space-y-4'>
          {/* Error */}
          {error && (
            <div className='bg-destructive/15 text-destructive rounded-md p-3 text-sm'>
              {error}
            </div>
          )}

          {/* ── User (read-only) ────────────────────────────────────────── */}
          <div className='space-y-2'>
            <Label>User</Label>
            <div className='bg-muted/50 flex items-center gap-3 rounded-md border p-3'>
              <div className='min-w-0 flex-1'>
                <p className='truncate text-sm font-medium'>
                  {permission?.user?.name || 'Unknown'}
                </p>
                <p className='text-muted-foreground truncate text-xs'>
                  {permission?.user?.email}
                </p>
              </div>
            </div>
          </div>

          {/* ── Section ─────────────────────────────────────────────────── */}
          <div className='space-y-2'>
            <Label>
              Section <span className='text-destructive'>*</span>
            </Label>
            <Select
              value={sectionId}
              onValueChange={setSectionId}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue placeholder='Select a section' />
              </SelectTrigger>
              <SelectContent>
                {sections.map((section) => (
                  <SelectItem key={section.id} value={section.id}>
                    {section.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ── View All Tasks toggle ────────────────────────────────────── */}
          <div className='flex items-center justify-between rounded-lg border p-3'>
            <div className='space-y-0.5'>
              <Label htmlFor='edit-view-all'>View All Tasks</Label>
              <p className='text-muted-foreground text-sm'>
                Allow this user to view all tasks in the section
              </p>
            </div>
            <Switch
              id='edit-view-all'
              checked={canViewAllTasks}
              onCheckedChange={setCanViewAllTasks}
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
            <Button type='submit' disabled={isSubmitting || !sectionId}>
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
