'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { getProducts, deleteProduct } from '@/lib/api/services';
import { getError } from '@/lib/api/axios';
import type { Product } from '@/lib/api/types';
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
  Package,
  Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';
import { format } from 'date-fns';

// =============================================================================
// COMPONENT
// =============================================================================

export default function ProductListingPage() {
  const router = useRouter();
  const params = useParams();
  const { currentCompany } = useAuth();

  const companyId =
    (params?.companyId as string) || currentCompany?.company?.id;

  // State
  const [products, setProducts] = useState<Product[]>([]);
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
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch products
  const fetchProducts = useCallback(async () => {
    if (!companyId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await getProducts(companyId, {
        page,
        limit,
        search: debouncedSearch,
        sortBy: 'createdAt',
        sortOrder: 'DESC'
      });

      setProducts(response.rows);
      setTotalCount(response.count);
    } catch (err) {
      setError(getError(err));
    } finally {
      setIsLoading(false);
    }
  }, [companyId, page, limit, debouncedSearch]);

  // Fetch on mount and when dependencies change
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // Handle view (go to product detail with templates)
  const handleView = (productId: string) => {
    router.push(`/dashboard/${companyId}/product/${productId}`);
  };

  // Handle edit (go to dedicated edit page)
  const handleEdit = (productId: string) => {
    router.push(`/dashboard/${companyId}/product/${productId}/edit`);
  };

  // Handle delete click
  const handleDeleteClick = (product: Product) => {
    setProductToDelete(product);
    setDeleteDialogOpen(true);
  };

  // Handle delete confirm
  const handleDeleteConfirm = async () => {
    if (!productToDelete || !companyId) return;

    setIsDeleting(true);
    try {
      await deleteProduct(companyId, productToDelete.id);
      setProducts((prev) => prev.filter((p) => p.id !== productToDelete.id));
      setTotalCount((prev) => prev - 1);
      setDeleteDialogOpen(false);
      setProductToDelete(null);
    } catch (err) {
      setError(getError(err));
    } finally {
      setIsDeleting(false);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return dateString;
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
            placeholder='Search products...'
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
              <TableHead>Name</TableHead>
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
            ) : products.length === 0 ? (
              // Empty state
              <TableRow>
                <TableCell colSpan={5} className='h-32 text-center'>
                  <div className='flex flex-col items-center gap-2'>
                    <Package className='text-muted-foreground h-8 w-8' />
                    <p className='text-muted-foreground'>
                      {searchQuery ? 'No products found' : 'No products yet'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              // Products list
              products.map((product) => (
                <TableRow
                  key={product.id}
                  onClick={() => handleView(product.id)}
                  className='hover:bg-muted/50 cursor-pointer'
                >
                  <TableCell className='text-primary font-medium hover:underline'>
                    {product.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant={product.isActive ? 'default' : 'secondary'}>
                      {product.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className='text-muted-foreground'>
                    {formatDate(product.createdAt)}
                  </TableCell>
                  <TableCell className='text-muted-foreground'>
                    {formatDate(product.updatedAt)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant='ghost' size='icon' className='h-8 w-8'>
                          <MoreHorizontal className='h-4 w-4' />
                          <span className='sr-only'>Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align='end'>
                        <DropdownMenuItem
                          onClick={() => handleView(product.id)}
                        >
                          <Eye className='mr-2 h-4 w-4' />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleEdit(product.id)}
                        >
                          <Pencil className='mr-2 h-4 w-4' />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteClick(product)}
                          className='text-destructive focus:text-destructive'
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
      {!isLoading && products.length > 0 && (
        <div className='flex items-center justify-between px-2'>
          <div className='text-muted-foreground flex-1 text-sm'>
            Showing {(page - 1) * limit + 1} to{' '}
            {Math.min(page * limit, totalCount)} of {totalCount} products
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
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{productToDelete?.name}"? This
              action cannot be undone.
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
    </div>
  );
}
