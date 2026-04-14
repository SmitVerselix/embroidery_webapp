'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import {
  getAllPermissions,
  getCompanyRolePermissions,
  createCompanyRolePermission,
  deleteCompanyRolePermission
} from '@/lib/api/services';
import { getError } from '@/lib/api/axios';
import type {
  CompanyRole,
  Permission,
  CompanyRolePermission
} from '@/lib/api/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Shield, Loader2, KeyRound } from 'lucide-react';

// =============================================================================
// PROPS
// =============================================================================

interface RolePermissionDialogProps {
  role: CompanyRole;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function RolePermissionDialog({
  role,
  open,
  onOpenChange
}: RolePermissionDialogProps) {
  const params = useParams();
  const { currentCompany } = useAuth();

  const companyId =
    (params?.companyId as string) || currentCompany?.company?.id;

  // State
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<
    CompanyRolePermission[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  // Fetch all permissions and role-specific permissions
  const fetchData = useCallback(async () => {
    if (!companyId || !open) return;

    setIsLoading(true);
    setError(null);

    try {
      const [permissionsRes, rolePermissionsRes] = await Promise.all([
        getAllPermissions({
          sortBy: 'createdAt',
          sortOrder: 'DESC',
          search: ''
        }),
        getCompanyRolePermissions(companyId, {
          page: 1,
          limit: 100,
          sortBy: 'createdAt',
          sortOrder: 'DESC',
          search: ''
        })
      ]);

      setAllPermissions(permissionsRes);

      // Filter role permissions for the current role
      const filtered = rolePermissionsRes.rows.filter(
        (rp) => rp.roleId === role.id
      );
      setRolePermissions(filtered);
    } catch (err) {
      setError(getError(err));
    } finally {
      setIsLoading(false);
    }
  }, [companyId, role.id, open]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Check if a permission is assigned to this role
  const getAssignedPermission = (permissionId: string) => {
    return rolePermissions.find((rp) => rp.permissionId === permissionId);
  };

  // Toggle permission
  const handleToggle = async (permissionId: string) => {
    if (!companyId) return;

    setTogglingIds((prev) => new Set(prev).add(permissionId));
    setError(null);

    try {
      const existing = getAssignedPermission(permissionId);

      if (existing) {
        // Remove permission
        await deleteCompanyRolePermission(companyId, existing.id);
        setRolePermissions((prev) =>
          prev.filter((rp) => rp.id !== existing.id)
        );
      } else {
        // Add permission
        const newPermission = await createCompanyRolePermission(companyId, {
          roleId: role.id,
          permissionId
        });
        setRolePermissions((prev) => [...prev, newPermission]);
      }
    } catch (err) {
      setError(getError(err));
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(permissionId);
        return next;
      });
    }
  };

  const assignedCount = rolePermissions.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[500px]'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <KeyRound className='h-5 w-5' />
            Permission Access
          </DialogTitle>
          <DialogDescription>
            Manage permissions for the{' '}
            <span className='text-foreground font-medium capitalize'>
              {role.name}
            </span>{' '}
            role. Toggle permissions on or off.
          </DialogDescription>
        </DialogHeader>

        {/* Error */}
        {error && (
          <div className='bg-destructive/15 text-destructive rounded-md p-3 text-sm'>
            {error}
          </div>
        )}

        {/* Summary */}
        {!isLoading && (
          <div className='flex items-center gap-2'>
            <Badge variant='secondary'>
              {assignedCount} of {allPermissions.length} assigned
            </Badge>
          </div>
        )}

        {/* Permissions List */}
        <div className='max-h-[400px] space-y-1 overflow-y-auto pr-1'>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className='flex items-center justify-between rounded-lg border p-3'
              >
                <div className='flex items-center gap-3'>
                  <Skeleton className='h-9 w-9 rounded-full' />
                  <Skeleton className='h-5 w-28' />
                </div>
                <Skeleton className='h-5 w-10' />
              </div>
            ))
          ) : allPermissions.length === 0 ? (
            <div className='flex flex-col items-center gap-2 py-8'>
              <Shield className='text-muted-foreground h-8 w-8' />
              <p className='text-muted-foreground text-sm'>
                No permissions available
              </p>
            </div>
          ) : (
            allPermissions.map((permission) => {
              const isAssigned = !!getAssignedPermission(permission.id);
              const isToggling = togglingIds.has(permission.id);

              return (
                <div
                  key={permission.id}
                  className='hover:bg-muted/50 flex items-center justify-between rounded-lg border p-3 transition-colors'
                >
                  <div className='flex items-center gap-3'>
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full ${
                        isAssigned ? 'bg-primary/10' : 'bg-muted'
                      }`}
                    >
                      <Shield
                        className={`h-4 w-4 ${
                          isAssigned ? 'text-primary' : 'text-muted-foreground'
                        }`}
                      />
                    </div>
                    <div>
                      <p className='text-sm font-medium'>{permission.name}</p>
                    </div>
                  </div>

                  <div className='flex items-center gap-2'>
                    {isToggling && (
                      <Loader2 className='text-muted-foreground h-4 w-4 animate-spin' />
                    )}
                    <Switch
                      checked={isAssigned}
                      onCheckedChange={() => handleToggle(permission.id)}
                      disabled={isToggling}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
