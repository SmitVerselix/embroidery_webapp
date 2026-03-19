'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import {
  getKanbanPermissionUsers,
  getKanbanSections,
  deleteKanbanPermissionUser
} from '@/lib/api/services';
import { getError } from '@/lib/api/axios';
import type { KanbanPermission, KanbanSection } from '@/lib/api/types';
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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  AlertDialog,
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
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Users,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  Check,
  X
} from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import PageContainer from '@/components/layout/page-container';
import KanbanPermissionAddDialog from './kanban-permission-add-dialog';
import KanbanPermissionEditDialog from './kanban-permission-edit-dialog';

// =============================================================================
// HELPERS
// =============================================================================

function PermissionBadge({ allowed }: { allowed: boolean }) {
  return allowed ? (
    <Badge variant='default' className='gap-1 px-1.5'>
      <Check className='h-3 w-3' />
    </Badge>
  ) : (
    <Badge variant='outline' className='text-muted-foreground gap-1 px-1.5'>
      <X className='h-3 w-3' />
    </Badge>
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function KanbanPermissionUsersPage() {
  const params = useParams();
  const { currentCompany } = useAuth();

  const companyId =
    (params?.companyId as string) || currentCompany?.company?.id;
  const kanbanId = params?.kanbanId as string;

  // ── State ──────────────────────────────────────────────────────────────
  const [permissions, setPermissions] = useState<KanbanPermission[]>([]);
  const [sections, setSections] = useState<KanbanSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const totalPages = Math.ceil(totalCount / limit);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');

  // Add dialog
  const [showAddDialog, setShowAddDialog] = useState(false);

  // Edit dialog
  const [editPermission, setEditPermission] = useState<KanbanPermission | null>(
    null
  );
  const [showEditDialog, setShowEditDialog] = useState(false);

  // Delete dialog
  const [deletePermission, setDeletePermission] =
    useState<KanbanPermission | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Fetch sections (one-time) ──────────────────────────────────────────
  const fetchSections = useCallback(async () => {
    if (!companyId || !kanbanId) return;
    try {
      const data = await getKanbanSections(companyId, kanbanId);
      setSections(data);
    } catch (err) {
      console.error('Failed to fetch sections:', getError(err));
    }
  }, [companyId, kanbanId]);

  // ── Fetch permissions ──────────────────────────────────────────────────
  const fetchPermissions = useCallback(async () => {
    if (!companyId || !kanbanId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await getKanbanPermissionUsers(companyId, kanbanId, {
        page,
        limit,
        search: debouncedSearch,
        sortBy: 'createdAt',
        sortOrder: 'DESC',
        ...(selectedSectionId ? { sectionId: selectedSectionId } : {})
      });

      setPermissions(response.rows);
      setTotalCount(response.count);
    } catch (err) {
      setError(getError(err));
    } finally {
      setIsLoading(false);
    }
  }, [companyId, kanbanId, page, limit, debouncedSearch, selectedSectionId]);

  useEffect(() => {
    fetchSections();
  }, [fetchSections]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedSectionId]);

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleEditClick = (perm: KanbanPermission) => {
    setEditPermission(perm);
    setShowEditDialog(true);
  };

  const handleEditSuccess = () => {
    setShowEditDialog(false);
    setEditPermission(null);
    fetchPermissions();
  };

  const handleAddSuccess = () => {
    setShowAddDialog(false);
    fetchPermissions();
  };

  const handleDeleteClick = (perm: KanbanPermission) => {
    setDeletePermission(perm);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!companyId || !kanbanId || !deletePermission) return;

    setIsDeleting(true);
    try {
      await deleteKanbanPermissionUser(
        companyId,
        kanbanId,
        deletePermission.id
      );
      setShowDeleteDialog(false);
      setDeletePermission(null);
      fetchPermissions();
    } catch (err) {
      setError(getError(err));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteDialog(false);
    setDeletePermission(null);
  };

  // Pagination helpers
  const canGoPrevious = page > 1;
  const canGoNext = page < totalPages;

  if (!companyId || !kanbanId) {
    return (
      <div className='flex items-center justify-center py-10'>
        <p className='text-muted-foreground'>No board selected</p>
      </div>
    );
  }

  return (
    <PageContainer
      pageTitle='User Permissions'
      pageDescription='Manage user access and permissions for this board.'
      pageHeaderAction={
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className='mr-2 h-4 w-4' />
          Add User Permission
        </Button>
      }
    >
      <div className='flex flex-col gap-4'>
        {/* ── Filters ───────────────────────────────────────────────────── */}
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
          <div className='relative max-w-sm flex-1'>
            <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
            <Input
              placeholder='Search users...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='pl-10'
            />
          </div>

          <Select
            value={selectedSectionId || 'all'}
            onValueChange={(value) =>
              setSelectedSectionId(value === 'all' ? '' : value)
            }
          >
            <SelectTrigger className='w-full sm:w-[200px]'>
              <SelectValue placeholder='All Sections' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>All Sections</SelectItem>
              {sections.map((section) => (
                <SelectItem key={section.id} value={section.id}>
                  {section.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Error */}
        {error && (
          <div className='bg-destructive/15 text-destructive rounded-md p-4'>
            {error}
          </div>
        )}

        {/* ── Table ─────────────────────────────────────────────────────── */}
        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='min-w-[180px]'>User</TableHead>
                <TableHead className='min-w-[120px]'>Section</TableHead>
                <TableHead className='text-center'>View</TableHead>
                <TableHead className='text-center'>Create</TableHead>
                <TableHead className='text-center'>Edit</TableHead>
                <TableHead className='text-center'>Delete</TableHead>
                <TableHead className='text-center'>Move</TableHead>
                <TableHead className='text-center'>View All</TableHead>
                <TableHead className='w-[70px]'></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className='h-4 w-32' />
                    </TableCell>
                    <TableCell>
                      <Skeleton className='h-4 w-20' />
                    </TableCell>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j} className='text-center'>
                        <Skeleton className='mx-auto h-5 w-8' />
                      </TableCell>
                    ))}
                    <TableCell>
                      <Skeleton className='h-8 w-8' />
                    </TableCell>
                  </TableRow>
                ))
              ) : permissions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className='h-32 text-center'>
                    <div className='flex flex-col items-center gap-2'>
                      <Users className='text-muted-foreground h-8 w-8' />
                      <p className='text-muted-foreground'>
                        {searchQuery || selectedSectionId
                          ? 'No users match your filters.'
                          : 'No user permissions found. Add your first user.'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                permissions.map((perm) => (
                  <TableRow key={perm.id}>
                    <TableCell>
                      <div>
                        <p className='text-sm font-medium'>
                          {perm.user.name || '—'}
                        </p>
                        <p className='text-muted-foreground text-xs'>
                          {perm.user.email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant='outline'>{perm.section.name}</Badge>
                    </TableCell>
                    <TableCell className='text-center'>
                      <PermissionBadge allowed={perm.canView} />
                    </TableCell>
                    <TableCell className='text-center'>
                      <PermissionBadge allowed={perm.canCreate} />
                    </TableCell>
                    <TableCell className='text-center'>
                      <PermissionBadge allowed={perm.canEdit} />
                    </TableCell>
                    <TableCell className='text-center'>
                      <PermissionBadge allowed={perm.canDelete} />
                    </TableCell>
                    <TableCell className='text-center'>
                      <PermissionBadge allowed={perm.canMove} />
                    </TableCell>
                    <TableCell className='text-center'>
                      <PermissionBadge allowed={perm.canViewAllTasks} />
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant='ghost' className='h-8 w-8 p-0'>
                            <span className='sr-only'>Actions</span>
                            <MoreHorizontal className='h-4 w-4' />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='end'>
                          <DropdownMenuItem
                            onClick={() => handleEditClick(perm)}
                          >
                            <Pencil className='mr-2 h-4 w-4' />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeleteClick(perm)}
                            className='text-red-600'
                          >
                            <Trash2 className='mr-2 h-4 w-4' />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* ── Pagination ────────────────────────────────────────────────── */}
        {!isLoading && permissions.length > 0 && (
          <div className='flex items-center justify-between px-2'>
            <div className='text-muted-foreground flex-1 text-sm'>
              Showing {(page - 1) * limit + 1} to{' '}
              {Math.min(page * limit, totalCount)} of {totalCount}
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
                    {[10, 20, 30, 50].map((size) => (
                      <SelectItem key={size} value={`${size}`}>
                        {size}
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
      </div>

      {/* ── Add Permission Dialog ─────────────────────────────────────── */}
      <KanbanPermissionAddDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        sections={sections}
        onSuccess={handleAddSuccess}
      />

      {/* ── Edit Permission Dialog ────────────────────────────────────── */}
      <KanbanPermissionEditDialog
        permission={editPermission}
        open={showEditDialog}
        onOpenChange={(open) => {
          setShowEditDialog(open);
          if (!open) setEditPermission(null);
        }}
        sections={sections}
        onSuccess={handleEditSuccess}
      />

      {/* ── Delete Confirmation ───────────────────────────────────────── */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove User Permission</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove permissions for{' '}
              <span className='font-semibold'>
                &quot;
                {deletePermission?.user?.name || deletePermission?.user?.email}
                &quot;
              </span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant='destructive'
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Removing...
                </>
              ) : (
                'Remove'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
