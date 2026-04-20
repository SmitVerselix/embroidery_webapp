'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { deleteOrderFormMaster } from '@/lib/api/services';
import { getError } from '@/lib/api/axios';
import type { OrderFormMaster } from '@/lib/api/types';
import { ORDER_FORM_FIELD_TYPES } from '@/lib/api/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
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
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  ClipboardList,
  Loader2,
  Eye,
  List
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import OrderFormMasterPreview from './order-form-master-preview';

// =============================================================================
// HELPERS
// =============================================================================

function getFieldTypeLabel(value: string): string {
  return (
    ORDER_FORM_FIELD_TYPES.find((ft) => ft.value === value)?.label || value
  );
}

function getFieldTypeBadgeVariant(
  value: string
): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (value) {
    case 'SELECT':
    case 'MULTI_SELECT':
      return 'default';
    case 'CHECKBOX':
    case 'RADIO':
      return 'secondary';
    case 'SELECT_TEMPLATE_EXTRA_FIELD':
    case 'SELECT_TEMPLATE_VALUE':
    case 'SELECT_TEMPLATE':
      return 'outline';
    default:
      return 'secondary';
  }
}

/** Get sort index — handles both `index` (product/get) and `orderNo` (list) */
function getSortIndex(field: OrderFormMaster): number {
  if ('index' in field && typeof (field as any).index === 'number') {
    return (field as any).index;
  }
  return field.orderNo ?? 0;
}

// =============================================================================
// PROPS
// =============================================================================

interface OrderFormMasterListingProps {
  companyId: string;
  productId: string;
  /** Order form master data from product/get response */
  initialData: OrderFormMaster[];
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function OrderFormMasterListing({
  companyId,
  productId,
  initialData
}: OrderFormMasterListingProps) {
  const router = useRouter();

  // Local state — seeded from parent
  const [items, setItems] = useState<OrderFormMaster[]>(() =>
    [...initialData].sort((a, b) => getSortIndex(a) - getSortIndex(b))
  );

  // Filters
  const [search, setSearch] = useState('');

  // Active tab
  const [activeTab, setActiveTab] = useState('list');

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<OrderFormMaster | null>(
    null
  );
  const [isDeleting, setIsDeleting] = useState(false);

  // ─── Sync with parent when initialData changes ────────────────────────────
  // (e.g. after parent refetches product)
  const parentIds = initialData.map((d) => d.id).join(',');
  useState(() => {
    setItems(
      [...initialData].sort((a, b) => getSortIndex(a) - getSortIndex(b))
    );
  });

  // ─── Filtered items ───────────────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (item) =>
        item.fieldName.toLowerCase().includes(q) ||
        item.fieldType.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q)
    );
  }, [items, search]);

  // ─── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      await deleteOrderFormMaster(companyId, productId, deleteTarget.id);
      toast.success('Order form field deleted successfully');
      // Remove from local state
      setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      toast.error(getError(err));
    } finally {
      setIsDeleting(false);
    }
  };

  // ─── Reorder callback from preview ────────────────────────────────────────
  const handleFieldsChange = (reorderedFields: OrderFormMaster[]) => {
    setItems(reorderedFields);
  };

  // ─── Format date ─────────────────────────────────────────────────────────
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return dateString;
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className='space-y-4'>
      {/* Header */}
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <div className='relative w-full sm:max-w-xs'>
          <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
          <Input
            placeholder='Search order form fields...'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className='pl-9'
          />
        </div>
        <Button
          onClick={() =>
            router.push(
              `/dashboard/${companyId}/product/${productId}/order-form-master/new`
            )
          }
        >
          <Plus className='mr-2 h-4 w-4' />
          Add Field
        </Button>
      </div>

      {/* Tabs: List & Preview */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className='grid w-full max-w-xs grid-cols-2'>
          <TabsTrigger value='list' className='flex items-center gap-2'>
            <List className='h-4 w-4' />
            List ({items.length})
          </TabsTrigger>
          <TabsTrigger value='preview' className='flex items-center gap-2'>
            <Eye className='h-4 w-4' />
            Preview
          </TabsTrigger>
        </TabsList>

        {/* ── LIST TAB ── */}
        <TabsContent value='list' className='mt-4'>
          <Card>
            <CardContent className='p-0'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='w-[50px]'>#</TableHead>
                    <TableHead>Field Name</TableHead>
                    <TableHead>Field Type</TableHead>
                    <TableHead>Values</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead className='w-[70px] text-right'>
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <div className='flex flex-col items-center justify-center py-10'>
                          <div className='bg-muted rounded-full p-3'>
                            <ClipboardList className='text-muted-foreground h-6 w-6' />
                          </div>
                          <p className='text-muted-foreground mt-3 text-sm'>
                            {search
                              ? 'No fields match your search.'
                              : 'No order form fields yet. Create your first one.'}
                          </p>
                          {!search && (
                            <Button
                              variant='outline'
                              size='sm'
                              className='mt-3'
                              onClick={() =>
                                router.push(
                                  `/dashboard/${companyId}/product/${productId}/order-form-master/new`
                                )
                              }
                            >
                              <Plus className='mr-2 h-4 w-4' />
                              Add Field
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredItems.map((item, index) => (
                      <TableRow key={item.id}>
                        <TableCell className='text-muted-foreground font-medium'>
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className='font-medium'>{item.fieldName}</p>
                            {item.description && (
                              <p className='text-muted-foreground line-clamp-1 text-xs'>
                                {item.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={getFieldTypeBadgeVariant(item.fieldType)}
                          >
                            {getFieldTypeLabel(item.fieldType)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {item.fieldType === 'SELECT_TEMPLATE_VALUE' ? (
                            item.row || item.column ? (
                              <div className='flex flex-wrap gap-1'>
                                {item.row && (
                                  <Badge variant='outline' className='text-xs'>
                                    <span className='text-muted-foreground mr-1'>
                                      Row:
                                    </span>
                                    {item.row.label}
                                  </Badge>
                                )}
                                {item.column && (
                                  <Badge variant='outline' className='text-xs'>
                                    <span className='text-muted-foreground mr-1'>
                                      Col:
                                    </span>
                                    {item.column.label}
                                    {item.column.blockIndex !== undefined && (
                                      <span className='text-muted-foreground ml-1'>
                                        (B-{item.column.blockIndex})
                                      </span>
                                    )}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className='text-muted-foreground text-xs'>
                                —
                              </span>
                            )
                          ) : item.fieldType === 'SELECT_TEMPLATE' ? (
                            item.template ? (
                              <Badge variant='outline' className='text-xs'>
                                <span className='text-muted-foreground mr-1'>
                                  Template:
                                </span>
                                {item.template.name}
                              </Badge>
                            ) : item.templateId ? (
                              <span className='text-muted-foreground font-mono text-xs'>
                                {item.templateId.slice(0, 8)}…
                              </span>
                            ) : (
                              <span className='text-muted-foreground text-xs'>
                                —
                              </span>
                            )
                          ) : item.fieldValues &&
                            item.fieldValues.length > 0 ? (
                            <div className='flex flex-wrap gap-1'>
                              {item.fieldValues.slice(0, 3).map((val, i) => (
                                <Badge
                                  key={i}
                                  variant='outline'
                                  className='text-xs'
                                >
                                  {val}
                                </Badge>
                              ))}
                              {item.fieldValues.length > 3 && (
                                <Badge variant='outline' className='text-xs'>
                                  +{item.fieldValues.length - 3} more
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className='text-muted-foreground text-xs'>
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell className='text-muted-foreground text-sm'>
                          {formatDate(item.createdAt)}
                        </TableCell>
                        <TableCell className='text-right'>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant='ghost'
                                size='icon'
                                className='h-8 w-8'
                              >
                                <MoreHorizontal className='h-4 w-4' />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align='end'>
                              <DropdownMenuItem
                                onClick={() =>
                                  router.push(
                                    `/dashboard/${companyId}/product/${productId}/order-form-master/${item.id}/edit`
                                  )
                                }
                              >
                                <Pencil className='mr-2 h-4 w-4' />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setDeleteTarget(item)}
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── PREVIEW TAB ── */}
        <TabsContent value='preview' className='mt-4'>
          <OrderFormMasterPreview
            companyId={companyId}
            productId={productId}
            fields={items}
            onFieldsChange={handleFieldsChange}
          />
        </TabsContent>
      </Tabs>

      {/* Delete Dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order Form Field</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;
              {deleteTarget?.fieldName}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {isDeleting ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Deleting…
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
