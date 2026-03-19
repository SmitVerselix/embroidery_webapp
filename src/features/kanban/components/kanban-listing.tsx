'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { getKanbanBoards, deleteKanbanBoard } from '@/lib/api/services';
import { getError } from '@/lib/api/axios';
import type { KanbanBoard } from '@/lib/api/types';
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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
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
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  LayoutGrid,
  MoreHorizontal,
  Pencil,
  Trash2,
  ExternalLink,
  Loader2,
  Settings
} from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import { format } from 'date-fns';
import KanbanEditDialog from './kanban-edit-dialog';

// =============================================================================
// HELPERS
// =============================================================================

function formatDate(dateString: string | null): string {
  if (!dateString) return '—';
  try {
    return format(new Date(dateString), 'MMM dd, yyyy');
  } catch {
    return '—';
  }
}

// =============================================================================
// PROPS
// =============================================================================

interface KanbanListingProps {
  onRefresh?: (refetchFn: () => void) => void;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function KanbanListing({ onRefresh }: KanbanListingProps) {
  const params = useParams();
  const router = useRouter();
  const { currentCompany } = useAuth();

  const companyId =
    (params?.companyId as string) || currentCompany?.company?.id;

  // ── State ──────────────────────────────────────────────────────────────
  const [boards, setBoards] = useState<KanbanBoard[]>([]);
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
  const [deleteBoard, setDeleteBoard] = useState<KanbanBoard | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit dialog
  const [editBoard, setEditBoard] = useState<KanbanBoard | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  // ── Fetch boards ───────────────────────────────────────────────────────
  const fetchBoards = useCallback(async () => {
    if (!companyId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await getKanbanBoards(companyId, {
        page,
        limit,
        search: debouncedSearch,
        sortBy: 'createdAt',
        sortOrder: 'DESC'
      });

      setBoards(response.rows);
      setTotalCount(response.count);
    } catch (err) {
      setError(getError(err));
    } finally {
      setIsLoading(false);
    }
  }, [companyId, page, limit, debouncedSearch]);

  useEffect(() => {
    fetchBoards();
  }, [fetchBoards]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    onRefresh?.(fetchBoards);
  }, [onRefresh, fetchBoards]);

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleOpenBoard = (board: KanbanBoard) => {
    router.push(`/dashboard/${companyId}/kanban/${board.id}`);
  };

  const handleEditClick = (board: KanbanBoard) => {
    setEditBoard(board);
    setShowEditDialog(true);
  };

  const handleEditSuccess = () => {
    setShowEditDialog(false);
    setEditBoard(null);
    fetchBoards();
  };

  const handleDeleteClick = (board: KanbanBoard) => {
    setDeleteBoard(board);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!companyId || !deleteBoard) return;

    setIsDeleting(true);
    try {
      await deleteKanbanBoard(companyId, deleteBoard.id);
      setShowDeleteDialog(false);
      setDeleteBoard(null);
      fetchBoards();
    } catch (err) {
      setError(getError(err));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteDialog(false);
    setDeleteBoard(null);
  };

  // ── Navigate to Settings (User Permissions) PAGE ────────────────────────
  const handleSettingsClick = (board: KanbanBoard) => {
    router.push(`/dashboard/${companyId}/kanban/${board.id}/permissions`);
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
            placeholder='Search boards...'
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
              <TableHead className='min-w-[200px]'>Board Name</TableHead>
              <TableHead className='min-w-[250px]'>Description</TableHead>
              <TableHead>Default</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead className='w-[70px]'></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className='h-4 w-36' />
                  </TableCell>
                  <TableCell>
                    <Skeleton className='h-4 w-48' />
                  </TableCell>
                  <TableCell>
                    <Skeleton className='h-5 w-16' />
                  </TableCell>
                  <TableCell>
                    <Skeleton className='h-4 w-24' />
                  </TableCell>
                  <TableCell>
                    <Skeleton className='h-8 w-8' />
                  </TableCell>
                </TableRow>
              ))
            ) : boards.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className='h-32 text-center'>
                  <div className='flex flex-col items-center gap-2'>
                    <LayoutGrid className='text-muted-foreground h-8 w-8' />
                    <p className='text-muted-foreground'>
                      {searchQuery
                        ? 'No boards match your search'
                        : 'No boards yet. Create your first board to get started.'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              boards.map((board) => (
                <TableRow
                  key={board.id}
                  className='cursor-pointer'
                  onClick={() => handleOpenBoard(board)}
                >
                  <TableCell>
                    <p className='text-sm font-medium'>{board.name}</p>
                  </TableCell>
                  <TableCell>
                    <p className='text-muted-foreground line-clamp-1 text-sm'>
                      {board.description || '—'}
                    </p>
                  </TableCell>
                  <TableCell>
                    {board.isDefault ? (
                      <Badge variant='default'>Default</Badge>
                    ) : (
                      <Badge variant='outline'>No</Badge>
                    )}
                  </TableCell>
                  <TableCell className='text-muted-foreground'>
                    {formatDate(board.createdAt)}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant='ghost' className='h-8 w-8 p-0'>
                          <span className='sr-only'>Actions</span>
                          <MoreHorizontal className='h-4 w-4' />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align='end'>
                        <DropdownMenuItem
                          onClick={() => handleOpenBoard(board)}
                        >
                          <ExternalLink className='mr-2 h-4 w-4' />
                          Open Board
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleSettingsClick(board)}
                        >
                          <Settings className='mr-2 h-4 w-4' />
                          Settings
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleEditClick(board)}
                        >
                          <Pencil className='mr-2 h-4 w-4' />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteClick(board)}
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

      {/* Pagination */}
      {!isLoading && boards.length > 0 && (
        <div className='flex items-center justify-between px-2'>
          <div className='text-muted-foreground flex-1 text-sm'>
            Showing {(page - 1) * limit + 1} to{' '}
            {Math.min(page * limit, totalCount)} of {totalCount} boards
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

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Board</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              <span className='font-semibold'>
                &quot;{deleteBoard?.name}&quot;
              </span>
              ? This action cannot be undone. All sections and tasks within this
              board will be permanently removed.
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
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <KanbanEditDialog
        board={editBoard}
        open={showEditDialog}
        onOpenChange={(open) => {
          setShowEditDialog(open);
          if (!open) setEditBoard(null);
        }}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
}
