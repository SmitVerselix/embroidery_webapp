'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getOrderHistory } from '@/lib/api/services';
import { getError } from '@/lib/api/axios';
import type {
  OrderHistoryItem,
  OrderHistoryAction,
  OrderHistoryParams
} from '@/lib/api/types';
import { ORDER_HISTORY_ACTIONS } from '@/lib/api/types';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  History,
  Eye,
  ArrowUpDown,
  X
} from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import { format } from 'date-fns';

// =============================================================================
// HELPERS
// =============================================================================

const getActionBadgeVariant = (
  action: OrderHistoryAction
): 'default' | 'secondary' | 'destructive' | 'outline' => {
  switch (action) {
    case 'CREATE_ORDER':
      return 'default';
    case 'ADD_TEMPLATE_VALUE':
    case 'ADD_TEMPLATE_EXTRA_VALUE':
      return 'default';
    case 'UPDATE_TEMPLATE_VALUE':
    case 'UPDATE_TEMPLATE_EXTRA_VALUE':
    case 'UPDATE_TEMPLATE_SUMMARY':
    case 'UPDATE_FINAL_COSTING':
      return 'secondary';
    case 'DELETE_TEMPLATE_VALUE':
    case 'DELETE_TEMPLATE_EXTRA_VALUE':
      return 'destructive';
    case 'CALCULATE_ORDER':
      return 'outline';
    default:
      return 'outline';
  }
};

const getActionLabel = (action: OrderHistoryAction): string => {
  const found = ORDER_HISTORY_ACTIONS.find((a) => a.value === action);
  return found?.label ?? action;
};

const formatDate = (d: string) => {
  try {
    return format(new Date(d), 'MMM dd, yyyy');
  } catch {
    return d;
  }
};

const formatDateTime = (d: string) => {
  try {
    return format(new Date(d), 'MMM dd, yyyy hh:mm a');
  } catch {
    return d;
  }
};

const formatKey = (key: string): string => {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
};

// =============================================================================
// VALUE DETAIL DIALOG
// =============================================================================

function ValueDetailDialog({ item }: { item: OrderHistoryItem }) {
  const hasOldValue = item.oldValue && Object.keys(item.oldValue).length > 0;
  const hasNewValue = item.newValue && Object.keys(item.newValue).length > 0;

  if (!hasOldValue && !hasNewValue)
    return <span className='text-muted-foreground'>—</span>;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant='ghost'
          size='icon'
          className='h-8 w-8'
          onClick={(e) => e.stopPropagation()}
        >
          <Eye className='h-4 w-4' />
        </Button>
      </DialogTrigger>
      <DialogContent className='max-h-[80vh] max-w-2xl overflow-y-auto'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Badge variant={getActionBadgeVariant(item.action)}>
              {getActionLabel(item.action)}
            </Badge>
            <span className='text-muted-foreground text-sm font-normal'>
              {item.description}
            </span>
          </DialogTitle>
          <DialogDescription>
            {formatDateTime(item.createdAt)} · by {item.user.name} (
            {item.user.email})
          </DialogDescription>
        </DialogHeader>

        <div className='mt-4 grid gap-4 sm:grid-cols-2'>
          {/* Old Value */}
          <div className='space-y-2'>
            <h4 className='text-muted-foreground text-sm font-semibold'>
              Old Value
            </h4>
            {hasOldValue ? (
              <div className='bg-muted/50 space-y-1 rounded-md border p-3 font-mono text-xs'>
                {Object.entries(item.oldValue!).map(([key, value]) => (
                  <div key={key} className='flex gap-2'>
                    <span className='text-muted-foreground min-w-[120px] shrink-0'>
                      {formatKey(key)}:
                    </span>
                    <span className='text-foreground break-all'>
                      {value === null || value === undefined
                        ? 'null'
                        : typeof value === 'object'
                          ? JSON.stringify(value, null, 2)
                          : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className='bg-muted/30 text-muted-foreground rounded-md border p-3 text-xs italic'>
                No previous value
              </div>
            )}
          </div>

          {/* New Value */}
          <div className='space-y-2'>
            <h4 className='text-muted-foreground text-sm font-semibold'>
              New Value
            </h4>
            {hasNewValue ? (
              <div className='bg-muted/50 space-y-1 rounded-md border p-3 font-mono text-xs'>
                {Object.entries(item.newValue!).map(([key, value]) => (
                  <div key={key} className='flex gap-2'>
                    <span className='text-muted-foreground min-w-[120px] shrink-0'>
                      {formatKey(key)}:
                    </span>
                    <span className='text-foreground break-all'>
                      {value === null || value === undefined
                        ? 'null'
                        : typeof value === 'object'
                          ? JSON.stringify(value, null, 2)
                          : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className='bg-muted/30 text-muted-foreground rounded-md border p-3 text-xs italic'>
                No new value
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// PROPS
// =============================================================================

interface OrderHistoryProps {
  companyId: string;
  orderId: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function OrderHistory({
  companyId,
  orderId
}: OrderHistoryProps) {
  const router = useRouter();

  const [historyItems, setHistoryItems] = useState<OrderHistoryItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<OrderHistoryAction | ''>('');
  const [sortOrder, setSortOrder] = useState<'DESC' | 'ASC'>('DESC');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const debouncedSearch = useDebounce(searchQuery, 300);

  // ──────────────────────────────────────────────────────────────────────
  // FETCH
  // ──────────────────────────────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    if (!companyId || !orderId) return;
    setIsLoading(true);
    setError(null);
    try {
      const params: OrderHistoryParams = {
        page,
        limit,
        search: debouncedSearch,
        sortBy: 'createdAt',
        sortOrder,
        ...(actionFilter ? { action: actionFilter } : {})
      };
      const res = await getOrderHistory(companyId, orderId, params);
      setHistoryItems(res.rows);
      setTotalCount(res.count);
    } catch (err) {
      setError(getError(err));
    } finally {
      setIsLoading(false);
    }
  }, [
    companyId,
    orderId,
    page,
    limit,
    debouncedSearch,
    sortOrder,
    actionFilter
  ]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, actionFilter, sortOrder]);

  const totalPages = Math.ceil(totalCount / limit);
  const hasFilters = !!searchQuery || !!actionFilter;

  // Pagination helpers
  const canGoPrevious = page > 1;
  const canGoNext = page < totalPages;

  // ──────────────────────────────────────────────────────────────────────
  // HANDLERS
  // ──────────────────────────────────────────────────────────────────────
  const handleActionFilterChange = (value: string) => {
    setActionFilter(value === 'ALL' ? '' : (value as OrderHistoryAction));
  };

  const handleSortToggle = () => {
    setSortOrder((prev) => (prev === 'DESC' ? 'ASC' : 'DESC'));
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setActionFilter('');
    setSortOrder('DESC');
  };

  // ──────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────
  return (
    <div className='flex flex-col gap-4'>
      {/* Filters */}
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
        {/* Search */}
        <div className='relative max-w-sm flex-1'>
          <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
          <Input
            placeholder='Search history...'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className='pl-10'
          />
        </div>

        {/* Action filter */}
        <Select
          value={actionFilter || 'ALL'}
          onValueChange={handleActionFilterChange}
        >
          <SelectTrigger className='w-full sm:w-[220px]'>
            <SelectValue placeholder='All Actions' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='ALL'>All Actions</SelectItem>
            {ORDER_HISTORY_ACTIONS.map((action) => (
              <SelectItem key={action.value} value={action.value}>
                {action.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sort toggle */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant='outline'
                size='icon'
                className='h-9 w-9 shrink-0'
                onClick={handleSortToggle}
              >
                <ArrowUpDown className='h-4 w-4' />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {sortOrder === 'DESC' ? 'Newest first' : 'Oldest first'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Clear filters */}
        {hasFilters && (
          <Button
            variant='ghost'
            size='sm'
            onClick={handleClearFilters}
            className='text-muted-foreground shrink-0'
          >
            <X className='mr-1 h-3 w-3' />
            Clear
          </Button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className='bg-destructive/15 text-destructive flex items-center justify-between rounded-md p-4'>
          <span>{error}</span>
          <Button variant='ghost' size='sm' onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Table */}
      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-[180px]'>Action</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Field</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className='w-[80px] text-center'>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className='h-5 w-20' />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : historyItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className='h-32 text-center'>
                  <div className='flex flex-col items-center gap-2'>
                    <History className='text-muted-foreground h-8 w-8' />
                    <p className='text-muted-foreground'>
                      {hasFilters
                        ? 'No history entries match your filters'
                        : 'No history entries yet'}
                    </p>
                    {hasFilters && (
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={handleClearFilters}
                      >
                        Clear filters
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              historyItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Badge variant={getActionBadgeVariant(item.action)}>
                      {getActionLabel(item.action)}
                    </Badge>
                  </TableCell>
                  <TableCell className='text-muted-foreground max-w-[250px] truncate'>
                    {item.description}
                  </TableCell>
                  <TableCell className='font-mono text-xs'>
                    {item.field}
                  </TableCell>
                  <TableCell>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className='cursor-default'>
                          <span className='font-medium'>{item.user.name}</span>
                        </TooltipTrigger>
                        <TooltipContent>{item.user.email}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className='text-muted-foreground'>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className='cursor-default'>
                          {formatDate(item.createdAt)}
                        </TooltipTrigger>
                        <TooltipContent>
                          {formatDateTime(item.createdAt)}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className='text-center'>
                    <ValueDetailDialog item={item} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {!isLoading && historyItems.length > 0 && (
        <div className='flex items-center justify-between px-2'>
          <div className='text-muted-foreground flex-1 text-sm'>
            Showing {(page - 1) * limit + 1} to{' '}
            {Math.min(page * limit, totalCount)} of {totalCount} entries
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
    </div>
  );
}
