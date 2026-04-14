'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { getCompanyRoles, deleteCompanyRole } from '@/lib/api/services';
import { getError } from '@/lib/api/axios';
import type { CompanyRole } from '@/lib/api/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  Shield,
  KeyRound
} from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import { format } from 'date-fns';
import RoleFormDialog from './role-form-dialog';
import RolePermissionDialog from './role-permission-dialog';

// =============================================================================
// PROPS
// =============================================================================

interface RoleListingProps {
  onRefresh?: (refetchFn: () => void) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function RoleListing({ onRefresh }: RoleListingProps) {
  const params = useParams();
  const { currentCompany } = useAuth();

  const companyId =
    (params?.companyId as string) || currentCompany?.company?.id;

  // State
  const [roles, setRoles] = useState<CompanyRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const totalPages = Math.ceil(totalCount / limit);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<CompanyRole | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit dialog
  const [roleToEdit, setRoleToEdit] = useState<CompanyRole | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Permission dialog
  const [roleForPermission, setRoleForPermission] =
    useState<CompanyRole | null>(null);
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);

  // Fetch roles
  const fetchRoles = useCallback(async () => {
    if (!companyId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await getCompanyRoles(companyId, {
        page,
        limit,
        search: debouncedSearch,
        sortBy: 'createdAt',
        sortOrder: 'DESC'
      });

      const filteredRows = response.rows.filter(
        (role) => role.name.toLowerCase() !== 'owner'
      );
      setRoles(filteredRows);
      setTotalCount(
        response.count - (response.rows.length - filteredRows.length)
      );
    } catch (err) {
      setError(getError(err));
    } finally {
      setIsLoading(false);
    }
  }, [companyId, page, limit, debouncedSearch]);

  // Fetch on mount and when dependencies change
  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // Expose refetch to parent
  useEffect(() => {
    onRefresh?.(fetchRoles);
  }, [onRefresh, fetchRoles]);

  // Handle edit click
  const handleEditClick = (role: CompanyRole) => {
    setRoleToEdit(role);
    setEditDialogOpen(true);
  };

  // Handle permission click
  const handlePermissionClick = (role: CompanyRole) => {
    setRoleForPermission(role);
    setPermissionDialogOpen(true);
  };

  // Handle delete click
  const handleDeleteClick = (role: CompanyRole) => {
    setRoleToDelete(role);
    setDeleteDialogOpen(true);
  };

  // Handle delete confirm
  const handleDeleteConfirm = async () => {
    if (!roleToDelete || !companyId) return;

    setIsDeleting(true);
    try {
      await deleteCompanyRole(companyId, roleToDelete.id);
      setRoles((prev) => prev.filter((r) => r.id !== roleToDelete.id));
      setTotalCount((prev) => prev - 1);
      setDeleteDialogOpen(false);
      setRoleToDelete(null);
    } catch (err) {
      setError(getError(err));
    } finally {
      setIsDeleting(false);
    }
  };

  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—';
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return '—';
    }
  };

  // Pagination helpers
  const canGoPrevious = page > 1;
  const canGoNext = page < totalPages;

  if (!companyId) {
    return (
      <div className='flex items-center justify-center py-10'>
        <p className='text-muted-foreground'>No company selected</p>
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-4'>
      {/* Search */}
      <div className='flex items-center gap-4'>
        <div className='relative max-w-sm flex-1'>
          <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
          <Input
            placeholder='Search roles...'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className='pl-10'
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className='bg-destructive/15 text-destructive rounded-md p-4'>
          {error}
        </div>
      )}

      {/* Table */}
      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='min-w-[200px]'>Role Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead>Updated At</TableHead>
              <TableHead className='w-[70px]'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Loading skeleton
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className='h-5 w-32' />
                  </TableCell>
                  <TableCell>
                    <Skeleton className='h-5 w-40' />
                  </TableCell>
                  <TableCell>
                    <Skeleton className='h-5 w-16' />
                  </TableCell>
                  <TableCell>
                    <Skeleton className='h-5 w-16' />
                  </TableCell>
                  <TableCell>
                    <Skeleton className='h-5 w-24' />
                  </TableCell>
                  <TableCell>
                    <Skeleton className='h-5 w-24' />
                  </TableCell>
                  <TableCell>
                    <Skeleton className='h-8 w-8' />
                  </TableCell>
                </TableRow>
              ))
            ) : roles.length === 0 ? (
              // Empty state
              <TableRow>
                <TableCell colSpan={7} className='h-32 text-center'>
                  <div className='flex flex-col items-center gap-2'>
                    <Shield className='text-muted-foreground h-8 w-8' />
                    <p className='text-muted-foreground'>
                      {searchQuery ? 'No roles found' : 'No roles yet'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              // Roles list
              roles.map((role) => (
                <TableRow key={role.id}>
                  {/* Role Name */}
                  <TableCell>
                    <div className='flex items-center gap-3'>
                      <div className='bg-primary/10 flex h-9 w-9 items-center justify-center rounded-full'>
                        <Shield className='text-primary h-4 w-4' />
                      </div>
                      <p className='text-sm font-medium capitalize'>
                        {role.name}
                      </p>
                    </div>
                  </TableCell>

                  {/* Description */}
                  <TableCell className='text-muted-foreground max-w-[200px] truncate'>
                    {role.description || '—'}
                  </TableCell>

                  {/* Type */}
                  <TableCell>
                    <Badge variant={role.isDefault ? 'secondary' : 'outline'}>
                      {role.isDefault ? 'Default' : 'Custom'}
                    </Badge>
                  </TableCell>

                  {/* Status */}
                  <TableCell>
                    <Badge variant={role.isActive ? 'default' : 'destructive'}>
                      {role.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>

                  {/* Created At */}
                  <TableCell className='text-muted-foreground'>
                    {formatDate(role.createdAt)}
                  </TableCell>

                  {/* Updated At */}
                  <TableCell className='text-muted-foreground'>
                    {formatDate(role.updatedAt)}
                  </TableCell>

                  {/* Actions */}
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant='ghost' size='icon' className='h-8 w-8'>
                          <MoreHorizontal className='h-4 w-4' />
                          <span className='sr-only'>Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align='end'>
                        <DropdownMenuItem onClick={() => handleEditClick(role)}>
                          <Pencil className='mr-2 h-4 w-4' />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handlePermissionClick(role)}
                        >
                          <KeyRound className='mr-2 h-4 w-4' />
                          Permissions
                        </DropdownMenuItem>
                        {!role.isDefault && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteClick(role)}
                              className='text-destructive focus:text-destructive'
                            >
                              <Trash2 className='mr-2 h-4 w-4' />
                              Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {!isLoading && roles.length > 0 && (
        <div className='flex items-center justify-between px-2'>
          <div className='text-muted-foreground flex-1 text-sm'>
            Showing {(page - 1) * limit + 1} to{' '}
            {Math.min(page * limit, totalCount)} of {totalCount} roles
          </div>
          <div className='flex items-center space-x-6 lg:space-x-8'>
            <div className='flex items-center space-x-2'>
              <p className='text-sm font-medium'>Rows per page</p>
              <Select
                value={`${limit}`}
                onValueChange={(value) => {
                  setLimit(Number(value));
                  setPage(1);
                }}
              >
                <SelectTrigger className='h-8 w-[70px]'>
                  <SelectValue placeholder={limit} />
                </SelectTrigger>
                <SelectContent side='top'>
                  {[10, 20, 30, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='flex w-[100px] items-center justify-center text-sm font-medium'>
              Page {page} of {totalPages}
            </div>
            <div className='flex items-center space-x-2'>
              <Button
                variant='outline'
                className='hidden h-8 w-8 p-0 lg:flex'
                onClick={() => setPage(1)}
                disabled={!canGoPrevious}
              >
                <span className='sr-only'>Go to first page</span>
                <ChevronsLeft className='h-4 w-4' />
              </Button>
              <Button
                variant='outline'
                className='h-8 w-8 p-0'
                onClick={() => setPage((p) => p - 1)}
                disabled={!canGoPrevious}
              >
                <span className='sr-only'>Go to previous page</span>
                <ChevronLeft className='h-4 w-4' />
              </Button>
              <Button
                variant='outline'
                className='h-8 w-8 p-0'
                onClick={() => setPage((p) => p + 1)}
                disabled={!canGoNext}
              >
                <span className='sr-only'>Go to next page</span>
                <ChevronRight className='h-4 w-4' />
              </Button>
              <Button
                variant='outline'
                className='hidden h-8 w-8 p-0 lg:flex'
                onClick={() => setPage(totalPages)}
                disabled={!canGoNext}
              >
                <span className='sr-only'>Go to last page</span>
                <ChevronsRight className='h-4 w-4' />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{roleToDelete?.name}&quot;?
              This action cannot be undone. Members assigned to this role may be
              affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {isDeleting ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Role Dialog */}
      {editDialogOpen && roleToEdit && (
        <RoleFormDialog
          role={roleToEdit}
          open={editDialogOpen}
          onOpenChange={(value) => {
            setEditDialogOpen(value);
            if (!value) setRoleToEdit(null);
          }}
          onSuccess={() => {
            setEditDialogOpen(false);
            setRoleToEdit(null);
            fetchRoles();
          }}
        />
      )}

      {/* Permission Dialog */}
      {permissionDialogOpen && roleForPermission && (
        <RolePermissionDialog
          role={roleForPermission}
          open={permissionDialogOpen}
          onOpenChange={(value) => {
            setPermissionDialogOpen(value);
            if (!value) setRoleForPermission(null);
          }}
        />
      )}
    </div>
  );
}
