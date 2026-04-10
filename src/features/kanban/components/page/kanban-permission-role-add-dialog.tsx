'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import {
  getCompanyRoles,
  createKanbanPermissionRole
} from '@/lib/api/services';
import { getError } from '@/lib/api/axios';
import type { KanbanSection, CompanyRole } from '@/lib/api/types';
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

interface KanbanPermissionRoleAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: KanbanSection[];
  onSuccess?: () => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function KanbanPermissionRoleAddDialog({
  open,
  onOpenChange,
  sections,
  onSuccess
}: KanbanPermissionRoleAddDialogProps) {
  const params = useParams();
  const { currentCompany } = useAuth();

  const companyId =
    (params?.companyId as string) || currentCompany?.company?.id;
  const kanbanId = params?.kanbanId as string;

  // ── State ──────────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [roleId, setRoleId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [canView, setCanView] = useState(false);
  const [canViewAllTasks, setCanViewAllTasks] = useState(false);

  // Roles dropdown
  const [roles, setRoles] = useState<CompanyRole[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);

  // ── Fetch roles ────────────────────────────────────────────────────────
  const fetchRoles = useCallback(async () => {
    if (!companyId) return;
    setIsLoadingRoles(true);
    try {
      const response = await getCompanyRoles(companyId, {
        page: 1,
        limit: 100,
        sortBy: 'createdAt',
        sortOrder: 'DESC'
      });
      setRoles(response.rows);
    } catch (err) {
      console.error('Failed to fetch roles:', getError(err));
    } finally {
      setIsLoadingRoles(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (open) fetchRoles();
  }, [open, fetchRoles]);

  // ── Reset form when dialog closes ─────────────────────────────────────
  useEffect(() => {
    if (!open) {
      setRoleId('');
      setSectionId('');
      setCanView(false);
      setCanViewAllTasks(false);
      setError(null);
    }
  }, [open]);

  // ── Submit ─────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!companyId || !kanbanId) {
      setError('No company or board selected');
      return;
    }
    if (!roleId) {
      setError('Please select a role');
      return;
    }
    if (!sectionId) {
      setError('Please select a section');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await createKanbanPermissionRole(companyId, kanbanId, {
        roleId,
        sectionId,
        canView,
        canViewAllTasks
      });

      onSuccess?.();
    } catch (err) {
      setError(getError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[480px]'>
        <DialogHeader>
          <DialogTitle>Add Role Permission</DialogTitle>
          <DialogDescription>
            Assign permissions to a role for this board.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className='space-y-4'>
          {/* Error */}
          {error && (
            <div className='bg-destructive/15 text-destructive rounded-md p-3 text-sm'>
              {error}
            </div>
          )}

          {/* ── Role ────────────────────────────────────────────────────── */}
          <div className='space-y-2'>
            <Label>
              Role <span className='text-destructive'>*</span>
            </Label>
            <Select
              value={roleId}
              onValueChange={setRoleId}
              disabled={isSubmitting || isLoadingRoles}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    isLoadingRoles ? 'Loading roles...' : 'Select a role'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {roles.length === 0 && !isLoadingRoles ? (
                  <div className='text-muted-foreground px-2 py-4 text-center text-sm'>
                    No roles found
                  </div>
                ) : (
                  roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
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

          {/* ── Can View toggle ─────────────────────────────────────────── */}
          <div className='flex items-center justify-between rounded-lg border p-3'>
            <div className='space-y-0.5'>
              <Label htmlFor='add-role-can-view'>Can View</Label>
              <p className='text-muted-foreground text-sm'>
                Allow this role to view the section
              </p>
            </div>
            <Switch
              id='add-role-can-view'
              checked={canView}
              onCheckedChange={setCanView}
              disabled={isSubmitting}
            />
          </div>

          {/* ── View All Tasks toggle ────────────────────────────────────── */}
          <div className='flex items-center justify-between rounded-lg border p-3'>
            <div className='space-y-0.5'>
              <Label htmlFor='add-role-view-all'>View All Tasks</Label>
              <p className='text-muted-foreground text-sm'>
                Allow this role to view all tasks in the section
              </p>
            </div>
            <Switch
              id='add-role-view-all'
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
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type='submit'
              disabled={isSubmitting || !roleId || !sectionId}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Adding...
                </>
              ) : (
                'Add Permission'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
