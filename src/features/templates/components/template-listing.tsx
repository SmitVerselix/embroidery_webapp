'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  deleteTemplate,
  reorderTemplates,
  createColumn,
  updateColumn,
  deleteColumn,
  reorderColumns,
  createRow,
  updateRow,
  deleteRow,
  reorderRows,
  createExtra,
  updateExtra,
  deleteExtra,
  reorderExtras
} from '@/lib/api/services';
import { getError } from '@/lib/api/axios';
import type {
  Template,
  TemplateWithDetails,
  TemplateColumn,
  TemplateRow,
  TemplateExtra,
  ColumnDataType,
  RowType,
  ExtraSectionType,
  ExtraValueType,
  ExtraVisibilityScope
} from '@/lib/api/types';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  FileText,
  Plus,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  Columns,
  Rows,
  Eye,
  GripVertical,
  LayoutTemplate
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

import ColumnFormDialog from './template-builder/column-form-dialog';
import RowFormDialog from './template-builder/row-form-dialog';
import ExtraFormDialog from './template-builder/extra-form-dialog';
import TemplatePreview from './template-builder/template-preview';
import {
  parseFormula,
  stringifyFormula
} from './template-builder/formula-builder';

// =============================================================================
// SORTABLE TEMPLATE ROW
// =============================================================================

interface SortableTemplateRowProps {
  template: Template;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  children?: React.ReactNode;
}

function SortableTemplateRow({
  template,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  children
}: SortableTemplateRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: template.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const formatDate = (d: string) => {
    try {
      return format(new Date(d), 'MMM dd, yyyy');
    } catch {
      return d;
    }
  };

  return (
    <Collapsible open={isExpanded} asChild>
      <>
        <TableRow
          ref={setNodeRef}
          style={style}
          className={cn(
            'hover:bg-muted/50',
            isDragging && 'bg-muted opacity-50'
          )}
        >
          <TableCell className='w-[40px]'>
            <button
              type='button'
              className='hover:bg-muted cursor-grab touch-none rounded p-1 active:cursor-grabbing'
              {...attributes}
              {...listeners}
            >
              <GripVertical className='text-muted-foreground h-4 w-4' />
            </button>
          </TableCell>
          <TableCell className='w-[40px]'>
            <CollapsibleTrigger asChild>
              <Button
                variant='ghost'
                size='icon'
                className='h-7 w-7'
                onClick={onToggleExpand}
              >
                {isExpanded ? (
                  <ChevronDown className='h-4 w-4' />
                ) : (
                  <ChevronRightIcon className='h-4 w-4' />
                )}
              </Button>
            </CollapsibleTrigger>
          </TableCell>
          <TableCell className='font-medium'>{template.name}</TableCell>
          <TableCell>
            <Badge
              variant={template.type === 'COSTING' ? 'default' : 'secondary'}
            >
              {template.type}
            </Badge>
          </TableCell>
          <TableCell>
            <Badge variant={template.isActive ? 'default' : 'secondary'}>
              {template.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </TableCell>
          <TableCell className='text-muted-foreground'>
            {formatDate(template.createdAt)}
          </TableCell>
          <TableCell>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='ghost' size='icon' className='h-8 w-8'>
                  <MoreHorizontal className='h-4 w-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                <DropdownMenuItem onClick={onToggleExpand}>
                  <Eye className='mr-2 h-4 w-4' />
                  {isExpanded ? 'Collapse' : 'Expand'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className='mr-2 h-4 w-4' />
                  Edit Template
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDelete}
                  className='text-destructive focus:text-destructive'
                >
                  <Trash2 className='mr-2 h-4 w-4' />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>
        </TableRow>
        {children}
      </>
    </Collapsible>
  );
}

// =============================================================================
// SORTABLE ITEMS (Column / Row / Extra)
// =============================================================================

function SortableColumnItem({
  column,
  onEdit,
  onDelete
}: {
  column: TemplateColumn;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: column.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && 'bg-muted opacity-50')}
    >
      <TableCell className='w-[40px] py-2'>
        <button
          type='button'
          className='hover:bg-muted cursor-grab touch-none rounded p-1 active:cursor-grabbing'
          {...attributes}
          {...listeners}
        >
          <GripVertical className='text-muted-foreground h-4 w-4' />
        </button>
      </TableCell>
      <TableCell className='py-2 text-sm font-medium'>{column.label}</TableCell>
      <TableCell className='py-2'>
        <Badge variant='outline' className='text-xs'>
          {column.dataType}
        </Badge>
      </TableCell>
      <TableCell className='py-2'>
        {column.isRequired ? (
          <Badge variant='destructive' className='text-xs'>
            Yes
          </Badge>
        ) : (
          <span className='text-muted-foreground text-xs'>No</span>
        )}
      </TableCell>
      <TableCell className='py-2'>
        <div className='flex gap-1'>
          <Button
            variant='ghost'
            size='icon'
            className='h-7 w-7'
            onClick={onEdit}
          >
            <Pencil className='h-3 w-3' />
          </Button>
          <Button
            variant='ghost'
            size='icon'
            className='text-destructive hover:text-destructive h-7 w-7'
            onClick={onDelete}
          >
            <Trash2 className='h-3 w-3' />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function SortableRowItem({
  row,
  onEdit,
  onDelete
}: {
  row: TemplateRow;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: row.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && 'bg-muted opacity-50')}
    >
      <TableCell className='w-[40px] py-2'>
        <button
          type='button'
          className='hover:bg-muted cursor-grab touch-none rounded p-1 active:cursor-grabbing'
          {...attributes}
          {...listeners}
        >
          <GripVertical className='text-muted-foreground h-4 w-4' />
        </button>
      </TableCell>
      <TableCell className='py-2 text-sm font-medium'>{row.label}</TableCell>
      <TableCell className='py-2'>
        <Badge
          variant={row.rowType === 'TOTAL' ? 'default' : 'secondary'}
          className='text-xs'
        >
          {row.rowType}
        </Badge>
      </TableCell>
      <TableCell className='py-2'>
        {row.isCalculated ? (
          <Badge variant='outline' className='text-xs'>
            Yes
          </Badge>
        ) : (
          <span className='text-muted-foreground text-xs'>No</span>
        )}
      </TableCell>
      <TableCell className='py-2'>
        <div className='flex gap-1'>
          <Button
            variant='ghost'
            size='icon'
            className='h-7 w-7'
            onClick={onEdit}
          >
            <Pencil className='h-3 w-3' />
          </Button>
          <Button
            variant='ghost'
            size='icon'
            className='text-destructive hover:text-destructive h-7 w-7'
            onClick={onDelete}
          >
            <Trash2 className='h-3 w-3' />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function SortableExtraItem({
  extra,
  onEdit,
  onDelete
}: {
  extra: TemplateExtra;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: extra.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const variant =
    extra.sectionType === 'HEADER'
      ? 'default'
      : extra.sectionType === 'FOOTER'
        ? 'secondary'
        : 'outline';
  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && 'bg-muted opacity-50')}
    >
      <TableCell className='w-[40px] py-2'>
        <button
          type='button'
          className='hover:bg-muted cursor-grab touch-none rounded p-1 active:cursor-grabbing'
          {...attributes}
          {...listeners}
        >
          <GripVertical className='text-muted-foreground h-4 w-4' />
        </button>
      </TableCell>
      <TableCell className='py-2 text-sm font-medium'>{extra.label}</TableCell>
      <TableCell className='py-2'>
        <Badge variant={variant} className='text-xs'>
          {extra.sectionType}
        </Badge>
      </TableCell>
      <TableCell className='py-2'>
        <Badge variant='outline' className='text-xs'>
          {extra.valueType}
        </Badge>
      </TableCell>
      <TableCell className='py-2'>
        <span className='text-muted-foreground text-xs'>
          {extra.visibilityScope}
        </span>
      </TableCell>
      <TableCell className='py-2'>
        <div className='flex gap-1'>
          <Button
            variant='ghost'
            size='icon'
            className='h-7 w-7'
            onClick={onEdit}
          >
            <Pencil className='h-3 w-3' />
          </Button>
          <Button
            variant='ghost'
            size='icon'
            className='text-destructive hover:text-destructive h-7 w-7'
            onClick={onDelete}
          >
            <Trash2 className='h-3 w-3' />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// =============================================================================
// PROPS & EXPANDED STATE
// =============================================================================

interface TemplateListingProps {
  companyId: string;
  productId: string;
  /** Templates data from product/get API — no separate template API calls needed */
  initialTemplates: TemplateWithDetails[];
}

interface ExpandedTemplateData {
  template: TemplateWithDetails | null;
  columns: TemplateColumn[];
  rows: TemplateRow[];
  extras: TemplateExtra[];
}

// =============================================================================
// HELPER: Build expandedData map from TemplateWithDetails[]
// =============================================================================

function buildExpandedDataMap(
  templates: TemplateWithDetails[]
): Record<string, ExpandedTemplateData> {
  const map: Record<string, ExpandedTemplateData> = {};
  for (const t of templates) {
    map[t.id] = {
      template: t,
      columns: [...(t.columns || [])].sort((a, b) => a.orderNo - b.orderNo),
      rows: [...(t.rows || [])].sort((a, b) => a.orderNo - b.orderNo),
      // API returns "extra" (singular)
      extras: [...(t.extra || [])].sort((a, b) => a.orderNo - b.orderNo)
    };
  }
  return map;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function TemplateListing({
  companyId,
  productId,
  initialTemplates
}: TemplateListingProps) {
  const router = useRouter();

  // Derive sorted templates list from initialTemplates
  const [templates, setTemplates] = useState<TemplateWithDetails[]>(() =>
    [...initialTemplates].sort((a, b) => a.orderNo - b.orderNo)
  );

  const [error, setError] = useState<string | null>(null);

  // Client-side search (no API call)
  const [searchQuery, setSearchQuery] = useState('');

  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(
    null
  );

  // Pre-populate expanded data from product/get response — no template/get API needed
  const [expandedData, setExpandedData] = useState<
    Record<string, ExpandedTemplateData>
  >(() => buildExpandedDataMap(initialTemplates));

  const [isReordering, setIsReordering] = useState(false);

  // Delete template
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] =
    useState<TemplateWithDetails | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Column dialog
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState<TemplateColumn | null>(
    null
  );
  const [columnTemplateId, setColumnTemplateId] = useState<string | null>(null);
  const [isColumnLoading, setIsColumnLoading] = useState(false);
  const [columnError, setColumnError] = useState<string | null>(null);

  // Row dialog
  const [rowDialogOpen, setRowDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<TemplateRow | null>(null);
  const [rowTemplateId, setRowTemplateId] = useState<string | null>(null);
  const [isRowLoading, setIsRowLoading] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  // Extra dialog
  const [extraDialogOpen, setExtraDialogOpen] = useState(false);
  const [editingExtra, setEditingExtra] = useState<TemplateExtra | null>(null);
  const [extraTemplateId, setExtraTemplateId] = useState<string | null>(null);
  const [isExtraLoading, setIsExtraLoading] = useState(false);
  const [extraError, setExtraError] = useState<string | null>(null);

  // Delete item
  const [deleteItemDialogOpen, setDeleteItemDialogOpen] = useState(false);
  const [deleteItemType, setDeleteItemType] = useState<
    'column' | 'row' | 'extra' | null
  >(null);
  const [itemToDelete, setItemToDelete] = useState<
    TemplateColumn | TemplateRow | TemplateExtra | null
  >(null);
  const [deleteItemTemplateId, setDeleteItemTemplateId] = useState<
    string | null
  >(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ──────────────────────────────────────────────────────────────────────
  // SYNC WITH PARENT when initialTemplates changes (e.g. product refetch)
  // ──────────────────────────────────────────────────────────────────────
  useEffect(() => {
    setTemplates([...initialTemplates].sort((a, b) => a.orderNo - b.orderNo));
    setExpandedData(buildExpandedDataMap(initialTemplates));
  }, [initialTemplates]);

  // ──────────────────────────────────────────────────────────────────────
  // EXPAND / COLLAPSE — no API call, data already available
  // ──────────────────────────────────────────────────────────────────────
  const handleToggleExpand = (templateId: string) => {
    setExpandedTemplateId((prev) => (prev === templateId ? null : templateId));
  };

  // ──────────────────────────────────────────────────────────────────────
  // TEMPLATE CRUD
  // ──────────────────────────────────────────────────────────────────────
  const handleCreate = () =>
    router.push(`/dashboard/${companyId}/product/${productId}/template/new`);
  const handleEditTemplate = (id: string) =>
    router.push(
      `/dashboard/${companyId}/product/${productId}/template/${id}/edit`
    );

  const handleDeleteTemplateClick = (t: TemplateWithDetails) => {
    setTemplateToDelete(t);
    setDeleteDialogOpen(true);
  };
  const handleDeleteTemplateConfirm = async () => {
    if (!templateToDelete) return;
    setIsDeleting(true);
    try {
      await deleteTemplate(companyId, productId, templateToDelete.id);
      setTemplates((prev) => prev.filter((t) => t.id !== templateToDelete.id));
      setExpandedData((prev) => {
        const next = { ...prev };
        delete next[templateToDelete.id];
        return next;
      });
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
      if (expandedTemplateId === templateToDelete.id)
        setExpandedTemplateId(null);
    } catch (err) {
      setError(getError(err));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTemplateDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldI = templates.findIndex((t) => t.id === active.id);
    const newI = templates.findIndex((t) => t.id === over.id);
    if (oldI === -1 || newI === -1) return;
    const reordered = arrayMove(templates, oldI, newI);
    setTemplates(reordered);
    setIsReordering(true);
    try {
      await reorderTemplates(companyId, productId, {
        ids: reordered.map((t) => t.id)
      });
    } catch (err) {
      setTemplates(templates);
      setError(getError(err));
    } finally {
      setIsReordering(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────
  // COLUMN HANDLERS
  // ──────────────────────────────────────────────────────────────────────
  const handleAddColumn = (tid: string) => {
    setEditingColumn(null);
    setColumnTemplateId(tid);
    setColumnError(null);
    setColumnDialogOpen(true);
  };
  const handleEditColumn = (tid: string, col: TemplateColumn) => {
    setEditingColumn(col);
    setColumnTemplateId(tid);
    setColumnError(null);
    setColumnDialogOpen(true);
  };

  const handleColumnSubmit = async (data: {
    key: string;
    label: string;
    dataType: ColumnDataType;
    blockIndex: number;
    isRequired: boolean;
    isFinalCalculation: boolean;
    formula?: string;
  }) => {
    if (!columnTemplateId) return;
    setIsColumnLoading(true);
    setColumnError(null);
    try {
      if (editingColumn) {
        const generatedKey =
          data.label.toLowerCase().replace(/\s+/g, '_') + '_0';
        const oldKey = editingColumn.key;
        const keyChanged = oldKey !== generatedKey;
        const tid = columnTemplateId;

        await updateColumn(companyId, productId, tid, editingColumn.id, {
          key: generatedKey,
          label: data.label,
          dataType: data.dataType,
          blockIndex: data.blockIndex,
          isRequired: data.isRequired,
          isFinalCalculation: data.isFinalCalculation,
          formula: data.formula
        });

        let updatedColumns = (expandedData[tid]?.columns || []).map((c) =>
          c.id === editingColumn.id ? { ...c, ...data, key: generatedKey } : c
        );

        if (keyChanged) {
          const escapedOldKey = oldKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const keyRegex = new RegExp(`\\b${escapedOldKey}\\b`, 'g');

          const affectedFormulaColumns = updatedColumns.filter(
            (col) =>
              col.id !== editingColumn.id &&
              col.dataType === 'FORMULA' &&
              col.formula &&
              keyRegex.test(col.formula)
          );

          for (const formulaCol of affectedFormulaColumns) {
            const updatedFormula = formulaCol.formula!.replace(
              new RegExp(`\\b${escapedOldKey}\\b`, 'g'),
              generatedKey
            );

            await updateColumn(companyId, productId, tid, formulaCol.id, {
              key: formulaCol.key,
              label: formulaCol.label,
              dataType: formulaCol.dataType,
              blockIndex: formulaCol.blockIndex,
              isRequired: formulaCol.isRequired,
              isFinalCalculation: formulaCol.isFinalCalculation,
              formula: updatedFormula
            });

            updatedColumns = updatedColumns.map((col) =>
              col.id === formulaCol.id
                ? { ...col, formula: updatedFormula }
                : col
            );
          }
        }

        setExpandedData((prev) => ({
          ...prev,
          [tid]: { ...prev[tid], columns: updatedColumns }
        }));
      } else {
        const newCol = await createColumn(
          companyId,
          productId,
          columnTemplateId,
          data
        );
        setExpandedData((prev) => ({
          ...prev,
          [columnTemplateId]: {
            ...prev[columnTemplateId],
            columns: [...prev[columnTemplateId].columns, newCol].sort(
              (a, b) => a.orderNo - b.orderNo
            )
          }
        }));
      }
      setColumnDialogOpen(false);
    } catch (err) {
      setColumnError(getError(err));
      throw err;
    } finally {
      setIsColumnLoading(false);
    }
  };

  const handleColumnDragEnd = async (event: DragEndEvent, tid: string) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const cur = expandedData[tid]?.columns || [];
    const oldI = cur.findIndex((c) => c.id === active.id);
    const newI = cur.findIndex((c) => c.id === over.id);
    if (oldI === -1 || newI === -1) return;
    const reordered = arrayMove(cur, oldI, newI);
    setExpandedData((p) => ({
      ...p,
      [tid]: { ...p[tid], columns: reordered }
    }));
    setIsReordering(true);
    try {
      await reorderColumns(companyId, productId, tid, {
        ids: reordered.map((c) => c.id)
      });
      setExpandedData((p) => ({
        ...p,
        [tid]: {
          ...p[tid],
          columns: reordered.map((c, i) => ({ ...c, orderNo: i + 1 }))
        }
      }));
    } catch (err) {
      setExpandedData((p) => ({ ...p, [tid]: { ...p[tid], columns: cur } }));
      setError(getError(err));
    } finally {
      setIsReordering(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────
  // ROW HANDLERS
  // ──────────────────────────────────────────────────────────────────────
  const handleAddRow = (tid: string) => {
    setEditingRow(null);
    setRowTemplateId(tid);
    setRowError(null);
    setRowDialogOpen(true);
  };
  const handleEditRow = (tid: string, row: TemplateRow) => {
    setEditingRow(row);
    setRowTemplateId(tid);
    setRowError(null);
    setRowDialogOpen(true);
  };

  const handleRowSubmit = async (data: {
    label: string;
    rowType: RowType;
    isCalculated: boolean;
  }) => {
    if (!rowTemplateId) return;
    setIsRowLoading(true);
    setRowError(null);
    try {
      if (editingRow) {
        await updateRow(
          companyId,
          productId,
          rowTemplateId,
          editingRow.id,
          data
        );
        setExpandedData((p) => ({
          ...p,
          [rowTemplateId]: {
            ...p[rowTemplateId],
            rows: p[rowTemplateId].rows.map((r) =>
              r.id === editingRow.id ? { ...r, ...data } : r
            )
          }
        }));
      } else {
        const newRow = await createRow(
          companyId,
          productId,
          rowTemplateId,
          data
        );
        setExpandedData((p) => ({
          ...p,
          [rowTemplateId]: {
            ...p[rowTemplateId],
            rows: [...p[rowTemplateId].rows, newRow].sort(
              (a, b) => a.orderNo - b.orderNo
            )
          }
        }));
      }
      setRowDialogOpen(false);
    } catch (err) {
      setRowError(getError(err));
      throw err;
    } finally {
      setIsRowLoading(false);
    }
  };

  const handleRowDragEnd = async (event: DragEndEvent, tid: string) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const cur = expandedData[tid]?.rows || [];
    const oldI = cur.findIndex((r) => r.id === active.id);
    const newI = cur.findIndex((r) => r.id === over.id);
    if (oldI === -1 || newI === -1) return;
    const reordered = arrayMove(cur, oldI, newI);
    setExpandedData((p) => ({ ...p, [tid]: { ...p[tid], rows: reordered } }));
    setIsReordering(true);
    try {
      await reorderRows(companyId, productId, tid, {
        ids: reordered.map((r) => r.id)
      });
      setExpandedData((p) => ({
        ...p,
        [tid]: {
          ...p[tid],
          rows: reordered.map((r, i) => ({ ...r, orderNo: i + 1 }))
        }
      }));
    } catch (err) {
      setExpandedData((p) => ({ ...p, [tid]: { ...p[tid], rows: cur } }));
      setError(getError(err));
    } finally {
      setIsReordering(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────
  // EXTRA HANDLERS
  // ──────────────────────────────────────────────────────────────────────
  const handleAddExtra = (tid: string) => {
    setEditingExtra(null);
    setExtraTemplateId(tid);
    setExtraError(null);
    setExtraDialogOpen(true);
  };
  const handleEditExtra = (tid: string, extra: TemplateExtra) => {
    setEditingExtra(extra);
    setExtraTemplateId(tid);
    setExtraError(null);
    setExtraDialogOpen(true);
  };

  const handleExtraSubmit = async (data: {
    key: string;
    sectionType: ExtraSectionType;
    valueType: ExtraValueType;
    visibilityScope: ExtraVisibilityScope;
    label: string;
    isRequired: boolean;
    allowMultiple: boolean;
  }) => {
    if (!extraTemplateId) return;
    setIsExtraLoading(true);
    setExtraError(null);
    try {
      if (editingExtra) {
        await updateExtra(
          companyId,
          productId,
          extraTemplateId,
          editingExtra.id,
          {
            label: data.label,
            sectionType: data.sectionType,
            valueType: data.valueType,
            visibilityScope: data.visibilityScope,
            isRequired: data.isRequired,
            allowMultiple: data.allowMultiple
          }
        );
        setExpandedData((p) => ({
          ...p,
          [extraTemplateId]: {
            ...p[extraTemplateId],
            extras: p[extraTemplateId].extras.map((e) =>
              e.id === editingExtra.id ? { ...e, ...data } : e
            )
          }
        }));
      } else {
        const newExtra = await createExtra(
          companyId,
          productId,
          extraTemplateId,
          data
        );
        setExpandedData((p) => ({
          ...p,
          [extraTemplateId]: {
            ...p[extraTemplateId],
            extras: [...p[extraTemplateId].extras, newExtra].sort(
              (a, b) => a.orderNo - b.orderNo
            )
          }
        }));
      }
      setExtraDialogOpen(false);
    } catch (err) {
      setExtraError(getError(err));
      throw err;
    } finally {
      setIsExtraLoading(false);
    }
  };

  const handleExtraDragEnd = async (event: DragEndEvent, tid: string) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const cur = expandedData[tid]?.extras || [];
    const oldI = cur.findIndex((e) => e.id === active.id);
    const newI = cur.findIndex((e) => e.id === over.id);
    if (oldI === -1 || newI === -1) return;
    const reordered = arrayMove(cur, oldI, newI);
    setExpandedData((p) => ({ ...p, [tid]: { ...p[tid], extras: reordered } }));
    setIsReordering(true);
    try {
      await reorderExtras(companyId, productId, tid, {
        ids: reordered.map((e) => e.id)
      });
      setExpandedData((p) => ({
        ...p,
        [tid]: {
          ...p[tid],
          extras: reordered.map((e, i) => ({ ...e, orderNo: i + 1 }))
        }
      }));
    } catch (err) {
      setExpandedData((p) => ({ ...p, [tid]: { ...p[tid], extras: cur } }));
      setError(getError(err));
    } finally {
      setIsReordering(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────
  // DELETE ITEM (column / row / extra)
  // ──────────────────────────────────────────────────────────────────────
  const handleDeleteItemClick = (
    type: 'column' | 'row' | 'extra',
    tid: string,
    item: TemplateColumn | TemplateRow | TemplateExtra
  ) => {
    setDeleteItemType(type);
    setDeleteItemTemplateId(tid);
    setItemToDelete(item);
    setDeleteItemDialogOpen(true);
  };

  const handleDeleteItemConfirm = async () => {
    if (!itemToDelete || !deleteItemType || !deleteItemTemplateId) return;
    setIsDeletingItem(true);
    try {
      const tid = deleteItemTemplateId;
      if (deleteItemType === 'column') {
        const deletedColumn = itemToDelete as TemplateColumn;
        await deleteColumn(companyId, productId, tid, deletedColumn.id);

        let updatedColumns = (expandedData[tid]?.columns || []).filter(
          (c) => c.id !== deletedColumn.id
        );

        const deletedKey = deletedColumn.key;
        const escapedKey = deletedKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const keyRegex = new RegExp(`\\b${escapedKey}\\b`);

        const affectedFormulaColumns = updatedColumns.filter(
          (col) =>
            col.dataType === 'FORMULA' &&
            col.formula &&
            keyRegex.test(col.formula)
        );

        for (const formulaCol of affectedFormulaColumns) {
          const parsed = parseFormula(formulaCol.formula!);
          if (!parsed) continue;

          let stepIndex: number;
          while (
            (stepIndex = parsed.steps.findIndex(
              (s) => s.columnKey === deletedKey
            )) !== -1
          ) {
            parsed.steps.splice(stepIndex, 1);
            if (stepIndex > 0) {
              parsed.operators.splice(stepIndex - 1, 1);
            } else if (parsed.operators.length > 0) {
              parsed.operators.splice(0, 1);
            }
          }

          const updatedFormula =
            parsed.steps.length > 0 ? stringifyFormula(parsed) : '';

          await updateColumn(companyId, productId, tid, formulaCol.id, {
            key: formulaCol.key,
            label: formulaCol.label,
            dataType: formulaCol.dataType,
            blockIndex: formulaCol.blockIndex,
            isRequired: formulaCol.isRequired,
            isFinalCalculation: formulaCol.isFinalCalculation,
            formula: updatedFormula
          });

          updatedColumns = updatedColumns.map((col) =>
            col.id === formulaCol.id ? { ...col, formula: updatedFormula } : col
          );
        }

        setExpandedData((p) => ({
          ...p,
          [tid]: { ...p[tid], columns: updatedColumns }
        }));
      } else if (deleteItemType === 'row') {
        await deleteRow(companyId, productId, tid, itemToDelete.id);
        setExpandedData((p) => ({
          ...p,
          [tid]: {
            ...p[tid],
            rows: p[tid].rows.filter((r) => r.id !== itemToDelete.id)
          }
        }));
      } else if (deleteItemType === 'extra') {
        await deleteExtra(companyId, productId, tid, itemToDelete.id);
        setExpandedData((p) => ({
          ...p,
          [tid]: {
            ...p[tid],
            extras: p[tid].extras.filter((e) => e.id !== itemToDelete.id)
          }
        }));
      }
      setDeleteItemDialogOpen(false);
      setItemToDelete(null);
      setDeleteItemType(null);
      setDeleteItemTemplateId(null);
    } catch (err) {
      setError(getError(err));
    } finally {
      setIsDeletingItem(false);
    }
  };

  // Client-side search filter
  const filteredTemplates = templates.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ──────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────
  return (
    <div className='flex flex-col gap-4'>
      {/* Header */}
      <div className='flex items-center justify-between gap-4'>
        <div className='relative max-w-sm flex-1'>
          <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
          <Input
            placeholder='Search templates...'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className='pl-10'
          />
        </div>
        <Button onClick={handleCreate}>
          <Plus className='mr-2 h-4 w-4' />
          Add Template
        </Button>
      </div>

      {error && (
        <div className='bg-destructive/15 text-destructive flex items-center justify-between rounded-md p-4'>
          <span>{error}</span>
          <Button variant='ghost' size='sm' onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {isReordering && (
        <div className='text-muted-foreground flex items-center gap-2 text-sm'>
          <Loader2 className='h-4 w-4 animate-spin' />
          Saving order...
        </div>
      )}

      {/* Table */}
      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className='w-[40px]' />
              <TableHead className='w-[40px]' />
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead className='w-[100px]'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTemplates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className='h-32 text-center'>
                  <div className='flex flex-col items-center gap-2'>
                    <FileText className='text-muted-foreground h-8 w-8' />
                    <p className='text-muted-foreground'>
                      {searchQuery ? 'No templates found' : 'No templates yet'}
                    </p>
                    {!searchQuery && (
                      <Button size='sm' onClick={handleCreate} className='mt-2'>
                        <Plus className='mr-2 h-4 w-4' />
                        Create First Template
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleTemplateDragEnd}
              >
                <SortableContext
                  items={filteredTemplates.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {filteredTemplates.map((tmpl) => {
                    const isExpanded = expandedTemplateId === tmpl.id;
                    const td = expandedData[tmpl.id];

                    return (
                      <SortableTemplateRow
                        key={tmpl.id}
                        template={tmpl}
                        isExpanded={isExpanded}
                        onToggleExpand={() => handleToggleExpand(tmpl.id)}
                        onEdit={() => handleEditTemplate(tmpl.id)}
                        onDelete={() => handleDeleteTemplateClick(tmpl)}
                      >
                        <CollapsibleContent asChild>
                          <TableRow className='bg-muted/30 hover:bg-muted/30'>
                            <TableCell colSpan={7} className='p-0'>
                              <div className='space-y-4 p-4'>
                                <Tabs defaultValue='columns' className='w-full'>
                                  <TabsList className='grid w-full max-w-lg grid-cols-4'>
                                    <TabsTrigger
                                      value='columns'
                                      className='text-xs'
                                    >
                                      <Columns className='mr-1 h-3 w-3' />
                                      Columns ({td?.columns?.length || 0})
                                    </TabsTrigger>
                                    <TabsTrigger
                                      value='rows'
                                      className='text-xs'
                                    >
                                      <Rows className='mr-1 h-3 w-3' />
                                      Rows ({td?.rows?.length || 0})
                                    </TabsTrigger>
                                    <TabsTrigger
                                      value='extras'
                                      className='text-xs'
                                    >
                                      <LayoutTemplate className='mr-1 h-3 w-3' />
                                      Extra ({td?.extras?.length || 0})
                                    </TabsTrigger>
                                    <TabsTrigger
                                      value='preview'
                                      className='text-xs'
                                    >
                                      <Eye className='mr-1 h-3 w-3' />
                                      Preview
                                    </TabsTrigger>
                                  </TabsList>

                                  {/* Columns */}
                                  <TabsContent value='columns' className='mt-4'>
                                    <Card>
                                      <CardHeader className='py-3'>
                                        <div className='flex items-center justify-between'>
                                          <div>
                                            <CardTitle className='text-sm font-medium'>
                                              Columns
                                            </CardTitle>
                                            <p className='text-muted-foreground mt-1 text-xs'>
                                              Drag{' '}
                                              <GripVertical className='inline h-3 w-3' />{' '}
                                              to reorder
                                            </p>
                                          </div>
                                          <Button
                                            size='sm'
                                            onClick={() =>
                                              handleAddColumn(tmpl.id)
                                            }
                                          >
                                            <Plus className='mr-1 h-3 w-3' />
                                            Add Column
                                          </Button>
                                        </div>
                                      </CardHeader>
                                      <CardContent className='pt-0'>
                                        {!td?.columns?.length ? (
                                          <div className='text-muted-foreground py-6 text-center text-sm'>
                                            No columns yet.
                                          </div>
                                        ) : (
                                          <div className='rounded border'>
                                            <DndContext
                                              sensors={sensors}
                                              collisionDetection={closestCenter}
                                              onDragEnd={(e) =>
                                                handleColumnDragEnd(e, tmpl.id)
                                              }
                                            >
                                              <Table>
                                                <TableHeader>
                                                  <TableRow>
                                                    <TableHead className='w-[40px]' />
                                                    <TableHead className='text-xs'>
                                                      Label
                                                    </TableHead>
                                                    <TableHead className='text-xs'>
                                                      Type
                                                    </TableHead>
                                                    <TableHead className='text-xs'>
                                                      Required
                                                    </TableHead>
                                                    <TableHead className='w-[80px] text-xs'>
                                                      Actions
                                                    </TableHead>
                                                  </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                  <SortableContext
                                                    items={td.columns.map(
                                                      (c) => c.id
                                                    )}
                                                    strategy={
                                                      verticalListSortingStrategy
                                                    }
                                                  >
                                                    {td.columns.map((col) => (
                                                      <SortableColumnItem
                                                        key={col.id}
                                                        column={col}
                                                        onEdit={() =>
                                                          handleEditColumn(
                                                            tmpl.id,
                                                            col
                                                          )
                                                        }
                                                        onDelete={() =>
                                                          handleDeleteItemClick(
                                                            'column',
                                                            tmpl.id,
                                                            col
                                                          )
                                                        }
                                                      />
                                                    ))}
                                                  </SortableContext>
                                                </TableBody>
                                              </Table>
                                            </DndContext>
                                          </div>
                                        )}
                                      </CardContent>
                                    </Card>
                                  </TabsContent>

                                  {/* Rows */}
                                  <TabsContent value='rows' className='mt-4'>
                                    <Card>
                                      <CardHeader className='py-3'>
                                        <div className='flex items-center justify-between'>
                                          <div>
                                            <CardTitle className='text-sm font-medium'>
                                              Rows
                                            </CardTitle>
                                            <p className='text-muted-foreground mt-1 text-xs'>
                                              Drag{' '}
                                              <GripVertical className='inline h-3 w-3' />{' '}
                                              to reorder
                                            </p>
                                          </div>
                                          <Button
                                            size='sm'
                                            onClick={() =>
                                              handleAddRow(tmpl.id)
                                            }
                                          >
                                            <Plus className='mr-1 h-3 w-3' />
                                            Add Row
                                          </Button>
                                        </div>
                                      </CardHeader>
                                      <CardContent className='pt-0'>
                                        {!td?.rows?.length ? (
                                          <div className='text-muted-foreground py-6 text-center text-sm'>
                                            No rows yet.
                                          </div>
                                        ) : (
                                          <div className='rounded border'>
                                            <DndContext
                                              sensors={sensors}
                                              collisionDetection={closestCenter}
                                              onDragEnd={(e) =>
                                                handleRowDragEnd(e, tmpl.id)
                                              }
                                            >
                                              <Table>
                                                <TableHeader>
                                                  <TableRow>
                                                    <TableHead className='w-[40px]' />
                                                    <TableHead className='text-xs'>
                                                      Label
                                                    </TableHead>
                                                    <TableHead className='text-xs'>
                                                      Type
                                                    </TableHead>
                                                    <TableHead className='text-xs'>
                                                      Calculated
                                                    </TableHead>
                                                    <TableHead className='w-[80px] text-xs'>
                                                      Actions
                                                    </TableHead>
                                                  </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                  <SortableContext
                                                    items={td.rows.map(
                                                      (r) => r.id
                                                    )}
                                                    strategy={
                                                      verticalListSortingStrategy
                                                    }
                                                  >
                                                    {td.rows.map((row) => (
                                                      <SortableRowItem
                                                        key={row.id}
                                                        row={row}
                                                        onEdit={() =>
                                                          handleEditRow(
                                                            tmpl.id,
                                                            row
                                                          )
                                                        }
                                                        onDelete={() =>
                                                          handleDeleteItemClick(
                                                            'row',
                                                            tmpl.id,
                                                            row
                                                          )
                                                        }
                                                      />
                                                    ))}
                                                  </SortableContext>
                                                </TableBody>
                                              </Table>
                                            </DndContext>
                                          </div>
                                        )}
                                      </CardContent>
                                    </Card>
                                  </TabsContent>

                                  {/* Extra */}
                                  <TabsContent value='extras' className='mt-4'>
                                    <Card>
                                      <CardHeader className='py-3'>
                                        <div className='flex items-center justify-between'>
                                          <div>
                                            <CardTitle className='text-sm font-medium'>
                                              Extra Fields
                                            </CardTitle>
                                            <p className='text-muted-foreground mt-1 text-xs'>
                                              Drag{' '}
                                              <GripVertical className='inline h-3 w-3' />{' '}
                                              to reorder
                                            </p>
                                          </div>
                                          <Button
                                            size='sm'
                                            onClick={() =>
                                              handleAddExtra(tmpl.id)
                                            }
                                          >
                                            <Plus className='mr-1 h-3 w-3' />
                                            Add Field
                                          </Button>
                                        </div>
                                      </CardHeader>
                                      <CardContent className='pt-0'>
                                        {!td?.extras?.length ? (
                                          <div className='text-muted-foreground py-6 text-center text-sm'>
                                            No extra fields yet.
                                          </div>
                                        ) : (
                                          <div className='rounded border'>
                                            <DndContext
                                              sensors={sensors}
                                              collisionDetection={closestCenter}
                                              onDragEnd={(e) =>
                                                handleExtraDragEnd(e, tmpl.id)
                                              }
                                            >
                                              <Table>
                                                <TableHeader>
                                                  <TableRow>
                                                    <TableHead className='w-[40px]' />
                                                    <TableHead className='text-xs'>
                                                      Label
                                                    </TableHead>
                                                    <TableHead className='text-xs'>
                                                      Section
                                                    </TableHead>
                                                    <TableHead className='text-xs'>
                                                      Value Type
                                                    </TableHead>
                                                    <TableHead className='text-xs'>
                                                      Visibility
                                                    </TableHead>
                                                    <TableHead className='w-[80px] text-xs'>
                                                      Actions
                                                    </TableHead>
                                                  </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                  <SortableContext
                                                    items={td.extras.map(
                                                      (e) => e.id
                                                    )}
                                                    strategy={
                                                      verticalListSortingStrategy
                                                    }
                                                  >
                                                    {td.extras.map((extra) => (
                                                      <SortableExtraItem
                                                        key={extra.id}
                                                        extra={extra}
                                                        onEdit={() =>
                                                          handleEditExtra(
                                                            tmpl.id,
                                                            extra
                                                          )
                                                        }
                                                        onDelete={() =>
                                                          handleDeleteItemClick(
                                                            'extra',
                                                            tmpl.id,
                                                            extra
                                                          )
                                                        }
                                                      />
                                                    ))}
                                                  </SortableContext>
                                                </TableBody>
                                              </Table>
                                            </DndContext>
                                          </div>
                                        )}
                                      </CardContent>
                                    </Card>
                                  </TabsContent>

                                  {/* Preview */}
                                  <TabsContent value='preview' className='mt-4'>
                                    <TemplatePreview
                                      template={td?.template || tmpl}
                                      columns={td?.columns || []}
                                      rows={td?.rows || []}
                                      extras={td?.extras || []}
                                    />
                                  </TabsContent>
                                </Tabs>
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      </SortableTemplateRow>
                    );
                  })}
                </SortableContext>
              </DndContext>
            )}
          </TableBody>
        </Table>
      </div>

      {filteredTemplates.length > 0 && (
        <div className='text-muted-foreground text-sm'>
          {filteredTemplates.length} template
          {filteredTemplates.length !== 1 ? 's' : ''}
          {searchQuery && ` matching "${searchQuery}"`}
        </div>
      )}

      {/* ══════════════ DIALOGS ══════════════ */}

      {/* Delete Template */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{templateToDelete?.name}
              &quot;? This will also delete all columns, rows, and extra fields.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTemplateConfirm}
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

      {/* Delete Item */}
      <AlertDialog
        open={deleteItemDialogOpen}
        onOpenChange={setDeleteItemDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete{' '}
              {deleteItemType === 'column'
                ? 'Column'
                : deleteItemType === 'row'
                  ? 'Row'
                  : 'Extra Field'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;
              {itemToDelete && 'label' in itemToDelete
                ? itemToDelete.label
                : ''}
              &quot;?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingItem}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteItemConfirm}
              disabled={isDeletingItem}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              {isDeletingItem ? (
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

      <ColumnFormDialog
        open={columnDialogOpen}
        onOpenChange={setColumnDialogOpen}
        onSubmit={handleColumnSubmit}
        initialData={editingColumn}
        availableColumns={
          columnTemplateId ? expandedData[columnTemplateId]?.columns || [] : []
        }
        isLoading={isColumnLoading}
        error={columnError}
      />
      <RowFormDialog
        open={rowDialogOpen}
        onOpenChange={setRowDialogOpen}
        onSubmit={handleRowSubmit}
        initialData={editingRow}
        isLoading={isRowLoading}
        error={rowError}
      />
      <ExtraFormDialog
        open={extraDialogOpen}
        onOpenChange={setExtraDialogOpen}
        onSubmit={handleExtraSubmit}
        initialData={editingExtra}
        isLoading={isExtraLoading}
        error={extraError}
      />
    </div>
  );
}
