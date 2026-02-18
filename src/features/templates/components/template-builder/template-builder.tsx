'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  getTemplate,
  createColumn,
  updateColumn,
  deleteColumn,
  createRow,
  updateRow,
  deleteRow,
  createExtra,
  updateExtra,
  deleteExtra
} from '@/lib/api/services';
import { getError } from '@/lib/api/axios';
import type {
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Plus,
  MoreHorizontal,
  Columns,
  Rows,
  Eye,
  AlertCircle,
  Loader2,
  Settings,
  LayoutTemplate,
  Layers
} from 'lucide-react';
import Link from 'next/link';

import ColumnFormDialog, { type TemplateBlock } from './column-form-dialog';
import RowFormDialog from './row-form-dialog';
import ExtraFormDialog from './extra-form-dialog';
import TemplatePreview from './template-preview';
import { parseFormula, stringifyFormula } from './formula-builder';

// =============================================================================
// PROPS
// =============================================================================

interface TemplateBuilderProps {
  companyId: string;
  productId: string;
  templateId: string;
}

// =============================================================================
// LOADING SKELETON
// =============================================================================

function BuilderSkeleton() {
  return (
    <div className='space-y-6'>
      <Skeleton className='h-5 w-32' />
      <Card>
        <CardHeader>
          <Skeleton className='h-8 w-48' />
          <Skeleton className='h-4 w-72' />
        </CardHeader>
        <CardContent>
          <Skeleton className='h-64 w-full' />
        </CardContent>
      </Card>
    </div>
  );
}

// =============================================================================
// HELPER: Derive blocks from existing columns
// =============================================================================

function deriveBlocksFromColumns(columns: TemplateColumn[]): TemplateBlock[] {
  const blockIndices = new Set<number>();
  columns.forEach((col) => blockIndices.add(col.blockIndex));

  // Always have at least block 0
  if (blockIndices.size === 0) {
    blockIndices.add(0);
  }

  return Array.from(blockIndices)
    .sort((a, b) => a - b)
    .map((index) => ({
      index,
      label: `Block ${index}`
    }));
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function TemplateBuilder({
  companyId,
  productId,
  templateId
}: TemplateBuilderProps) {
  const router = useRouter();

  // Data state
  const [template, setTemplate] = useState<TemplateWithDetails | null>(null);
  const [columns, setColumns] = useState<TemplateColumn[]>([]);
  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [extras, setExtras] = useState<TemplateExtra[]>([]);

  // Block management
  const [blocks, setBlocks] = useState<TemplateBlock[]>([
    { index: 0, label: 'Block 0' }
  ]);
  const [newBlockLabel, setNewBlockLabel] = useState('');
  const [editingBlockIndex, setEditingBlockIndex] = useState<number | null>(
    null
  );
  const [editingBlockLabel, setEditingBlockLabel] = useState('');

  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isColumnLoading, setIsColumnLoading] = useState(false);
  const [isRowLoading, setIsRowLoading] = useState(false);
  const [isExtraLoading, setIsExtraLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Column dialog
  const [columnDialogOpen, setColumnDialogOpen] = useState(false);
  const [editingColumn, setEditingColumn] = useState<TemplateColumn | null>(
    null
  );
  const [columnError, setColumnError] = useState<string | null>(null);

  // Row dialog
  const [rowDialogOpen, setRowDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<TemplateRow | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  // Extra dialog
  const [extraDialogOpen, setExtraDialogOpen] = useState(false);
  const [editingExtra, setEditingExtra] = useState<TemplateExtra | null>(null);
  const [extraError, setExtraError] = useState<string | null>(null);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteType, setDeleteType] = useState<
    'column' | 'row' | 'extra' | null
  >(null);
  const [itemToDelete, setItemToDelete] = useState<
    TemplateColumn | TemplateRow | TemplateExtra | null
  >(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ──────────────────────────────────────────────────────────────────────
  // FETCH
  // ──────────────────────────────────────────────────────────────────────
  const fetchTemplate = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getTemplate(companyId, productId, templateId);
      setTemplate(data);
      const sortedCols = [...(data.columns || [])].sort(
        (a, b) => a.orderNo - b.orderNo
      );
      setColumns(sortedCols);
      setRows([...(data.rows || [])].sort((a, b) => a.orderNo - b.orderNo));
      setExtras([...(data.extra || [])].sort((a, b) => a.orderNo - b.orderNo));

      // Derive blocks from existing columns
      const derivedBlocks = deriveBlocksFromColumns(sortedCols);
      setBlocks(derivedBlocks);
    } catch (err) {
      setError(getError(err));
    } finally {
      setIsLoading(false);
    }
  }, [companyId, productId, templateId]);

  useEffect(() => {
    fetchTemplate();
  }, [fetchTemplate]);

  // Group extras by section type
  const groupedExtras = useMemo(() => {
    const header = extras.filter((e) => e.sectionType === 'HEADER');
    const footer = extras.filter((e) => e.sectionType === 'FOOTER');
    const media = extras.filter((e) => e.sectionType === 'MEDIA');
    return { header, footer, media };
  }, [extras]);

  // Group columns by blockIndex
  const columnsByBlock = useMemo(() => {
    const grouped: Record<number, TemplateColumn[]> = {};
    blocks.forEach((block) => {
      grouped[block.index] = [];
    });
    columns.forEach((col) => {
      if (!grouped[col.blockIndex]) {
        grouped[col.blockIndex] = [];
      }
      grouped[col.blockIndex].push(col);
    });
    // Sort within each block
    Object.keys(grouped).forEach((key) => {
      grouped[Number(key)].sort((a, b) => a.orderNo - b.orderNo);
    });
    return grouped;
  }, [columns, blocks]);

  // ──────────────────────────────────────────────────────────────────────
  // BLOCK HANDLERS
  // ──────────────────────────────────────────────────────────────────────
  const handleAddBlock = () => {
    if (!newBlockLabel.trim()) return;
    const maxIndex =
      blocks.length > 0 ? Math.max(...blocks.map((b) => b.index)) : -1;
    const newIndex = maxIndex + 1;
    setBlocks((prev) => [
      ...prev,
      { index: newIndex, label: newBlockLabel.trim() }
    ]);
    setNewBlockLabel('');
  };

  const handleUpdateBlockLabel = (blockIndex: number) => {
    if (!editingBlockLabel.trim()) return;
    setBlocks((prev) =>
      prev.map((b) =>
        b.index === blockIndex ? { ...b, label: editingBlockLabel.trim() } : b
      )
    );
    setEditingBlockIndex(null);
    setEditingBlockLabel('');
  };

  const handleRemoveBlock = (blockIndex: number) => {
    // Only allow removing blocks that have no columns
    const blockColumns = columns.filter((c) => c.blockIndex === blockIndex);
    if (blockColumns.length > 0) {
      setError(
        'Cannot remove a block that has columns. Delete the columns first.'
      );
      return;
    }
    // Don't allow removing the last block
    if (blocks.length <= 1) {
      setError('Must have at least one block.');
      return;
    }
    setBlocks((prev) => prev.filter((b) => b.index !== blockIndex));
  };

  // ──────────────────────────────────────────────────────────────────────
  // COLUMN HANDLERS
  // ──────────────────────────────────────────────────────────────────────
  const handleAddColumn = () => {
    setEditingColumn(null);
    setColumnError(null);
    setColumnDialogOpen(true);
  };

  const handleEditColumn = (column: TemplateColumn) => {
    setEditingColumn(column);
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
    setIsColumnLoading(true);
    setColumnError(null);
    try {
      if (editingColumn) {
        const generatedKey =
          data.label.toLowerCase().replace(/\s+/g, '_') + '_0';
        const oldKey = editingColumn.key;
        const keyChanged = oldKey !== generatedKey;

        // Update the edited column (with correct blockIndex)
        await updateColumn(companyId, productId, templateId, editingColumn.id, {
          key: generatedKey,
          label: data.label,
          dataType: data.dataType,
          blockIndex: data.blockIndex,
          isRequired: data.isRequired,
          isFinalCalculation: data.isFinalCalculation,
          formula: data.formula
        });

        let updatedColumns = columns.map((col) =>
          col.id === editingColumn.id
            ? { ...col, ...data, key: generatedKey }
            : col
        );

        // If key changed, update all FORMULA columns referencing the old key
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

            await updateColumn(
              companyId,
              productId,
              templateId,
              formulaCol.id,
              {
                key: formulaCol.key,
                label: formulaCol.label,
                dataType: formulaCol.dataType,
                blockIndex: formulaCol.blockIndex,
                isRequired: formulaCol.isRequired,
                isFinalCalculation: formulaCol.isFinalCalculation,
                formula: updatedFormula
              }
            );

            updatedColumns = updatedColumns.map((col) =>
              col.id === formulaCol.id
                ? { ...col, formula: updatedFormula }
                : col
            );
          }
        }

        setColumns(updatedColumns);
      } else {
        // Create new column with the correct blockIndex
        const newColumn = await createColumn(
          companyId,
          productId,
          templateId,
          data
        );
        setColumns((prev) => [...prev, newColumn]);
      }
      setColumnDialogOpen(false);
    } catch (err) {
      setColumnError(getError(err));
      throw err;
    } finally {
      setIsColumnLoading(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────
  // ROW HANDLERS
  // ──────────────────────────────────────────────────────────────────────
  const handleAddRow = () => {
    setEditingRow(null);
    setRowError(null);
    setRowDialogOpen(true);
  };

  const handleEditRow = (row: TemplateRow) => {
    setEditingRow(row);
    setRowError(null);
    setRowDialogOpen(true);
  };

  const handleRowSubmit = async (data: {
    label: string;
    rowType: RowType;
    isCalculated: boolean;
  }) => {
    setIsRowLoading(true);
    setRowError(null);
    try {
      if (editingRow) {
        await updateRow(companyId, productId, templateId, editingRow.id, data);
        setRows((prev) =>
          prev.map((r) => (r.id === editingRow.id ? { ...r, ...data } : r))
        );
      } else {
        const newRow = await createRow(companyId, productId, templateId, data);
        setRows((prev) => [...prev, newRow]);
      }
      setRowDialogOpen(false);
    } catch (err) {
      setRowError(getError(err));
      throw err;
    } finally {
      setIsRowLoading(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────
  // EXTRA HANDLERS
  // ──────────────────────────────────────────────────────────────────────
  const handleAddExtra = () => {
    setEditingExtra(null);
    setExtraError(null);
    setExtraDialogOpen(true);
  };

  const handleEditExtra = (extra: TemplateExtra) => {
    setEditingExtra(extra);
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
    setIsExtraLoading(true);
    setExtraError(null);
    try {
      if (editingExtra) {
        await updateExtra(companyId, productId, templateId, editingExtra.id, {
          label: data.label,
          sectionType: data.sectionType,
          valueType: data.valueType,
          visibilityScope: data.visibilityScope,
          isRequired: data.isRequired,
          allowMultiple: data.allowMultiple
        });
        setExtras((prev) =>
          prev.map((e) => (e.id === editingExtra.id ? { ...e, ...data } : e))
        );
      } else {
        const newExtra = await createExtra(
          companyId,
          productId,
          templateId,
          data
        );
        setExtras((prev) =>
          [...prev, newExtra].sort((a, b) => a.orderNo - b.orderNo)
        );
      }
      setExtraDialogOpen(false);
    } catch (err) {
      setExtraError(getError(err));
      throw err;
    } finally {
      setIsExtraLoading(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────
  // DELETE HANDLERS
  // ──────────────────────────────────────────────────────────────────────
  const handleDeleteClick = (
    type: 'column' | 'row' | 'extra',
    item: TemplateColumn | TemplateRow | TemplateExtra
  ) => {
    setDeleteType(type);
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!itemToDelete || !deleteType) return;
    setIsDeleting(true);
    try {
      if (deleteType === 'column') {
        const deletedColumn = itemToDelete as TemplateColumn;
        await deleteColumn(companyId, productId, templateId, deletedColumn.id);

        let updatedColumns = columns.filter((c) => c.id !== deletedColumn.id);

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

          await updateColumn(companyId, productId, templateId, formulaCol.id, {
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
        setColumns(updatedColumns);
      } else if (deleteType === 'row') {
        await deleteRow(companyId, productId, templateId, itemToDelete.id);
        setRows((prev) => prev.filter((r) => r.id !== itemToDelete.id));
      } else if (deleteType === 'extra') {
        await deleteExtra(companyId, productId, templateId, itemToDelete.id);
        setExtras((prev) => prev.filter((e) => e.id !== itemToDelete.id));
      }
      setDeleteDialogOpen(false);
      setItemToDelete(null);
      setDeleteType(null);
    } catch (err) {
      setError(getError(err));
    } finally {
      setIsDeleting(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────
  // LOADING / ERROR STATES
  // ──────────────────────────────────────────────────────────────────────
  if (isLoading) return <BuilderSkeleton />;

  if (error && !template) {
    return (
      <div className='flex flex-col items-center justify-center space-y-4 py-10'>
        <div className='bg-destructive/15 rounded-full p-3'>
          <AlertCircle className='text-destructive h-6 w-6' />
        </div>
        <div className='space-y-2 text-center'>
          <h3 className='font-semibold'>Failed to load template</h3>
          <p className='text-muted-foreground text-sm'>{error}</p>
        </div>
        <Button asChild variant='outline'>
          <Link href={`/dashboard/${companyId}/product/${productId}`}>
            Back to Product
          </Link>
        </Button>
      </div>
    );
  }

  if (!template) return null;

  const backUrl = `/dashboard/${companyId}/product/${productId}`;

  // ──────────────────────────────────────────────────────────────────────
  // RENDER: Extra section table
  // ──────────────────────────────────────────────────────────────────────
  const renderExtraSection = (
    title: string,
    description: string,
    items: TemplateExtra[]
  ) => (
    <div className='space-y-3'>
      <div>
        <h4 className='text-sm font-medium'>{title}</h4>
        <p className='text-muted-foreground text-xs'>{description}</p>
      </div>

      {items.length === 0 ? (
        <div className='text-muted-foreground rounded-md border border-dashed py-4 text-center text-sm'>
          No {title.toLowerCase()} added yet
        </div>
      ) : (
        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Value Type</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead>Required</TableHead>
                <TableHead>Multiple</TableHead>
                <TableHead className='w-[70px]'>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((extra) => (
                <TableRow key={extra.id}>
                  <TableCell className='font-medium'>{extra.label}</TableCell>
                  <TableCell>
                    <Badge variant='outline'>{extra.valueType}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant='secondary' className='text-xs'>
                      {extra.visibilityScope}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {extra.isRequired ? (
                      <Badge variant='destructive' className='text-xs'>
                        Yes
                      </Badge>
                    ) : (
                      <span className='text-muted-foreground text-sm'>No</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {extra.allowMultiple ? (
                      <Badge variant='outline' className='text-xs'>
                        Yes
                      </Badge>
                    ) : (
                      <span className='text-muted-foreground text-sm'>No</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant='ghost' size='icon' className='h-8 w-8'>
                          <MoreHorizontal className='h-4 w-4' />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align='end'>
                        <DropdownMenuItem
                          onClick={() => handleEditExtra(extra)}
                        >
                          <Pencil className='mr-2 h-4 w-4' />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteClick('extra', extra)}
                          className='text-destructive focus:text-destructive'
                        >
                          <Trash2 className='mr-2 h-4 w-4' />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );

  // ──────────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ──────────────────────────────────────────────────────────────────────
  return (
    <div className='space-y-6'>
      {/* Back */}
      <Link
        href={backUrl}
        className='text-muted-foreground hover:text-foreground inline-flex items-center text-sm'
      >
        <ArrowLeft className='mr-2 h-4 w-4' />
        Back to Product
      </Link>

      {/* Template Header */}
      <Card>
        <CardHeader>
          <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
            <div className='space-y-1'>
              <div className='flex items-center gap-2'>
                <CardTitle className='text-2xl'>{template.name}</CardTitle>
                <Badge
                  variant={
                    template.type === 'COSTING' ? 'default' : 'secondary'
                  }
                >
                  {template.type}
                </Badge>
              </div>
              <CardDescription>
                Build your template by adding columns, rows, and extra fields
              </CardDescription>
            </div>
            <Button
              variant='outline'
              onClick={() =>
                router.push(
                  `/dashboard/${companyId}/product/${productId}/template/${templateId}/edit`
                )
              }
            >
              <Settings className='mr-2 h-4 w-4' />
              Edit Template
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Error */}
      {error && (
        <div className='bg-destructive/15 text-destructive flex items-center justify-between rounded-md p-4'>
          <span>{error}</span>
          <Button variant='ghost' size='sm' onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {/* ══════════════ TABS ══════════════ */}
      <Tabs defaultValue='preview' className='space-y-4'>
        <TabsList className='grid w-full grid-cols-5'>
          <TabsTrigger value='preview' className='flex items-center gap-2'>
            <Eye className='h-4 w-4' />
            Preview
          </TabsTrigger>
          <TabsTrigger value='blocks' className='flex items-center gap-2'>
            <Layers className='h-4 w-4' />
            Blocks ({blocks.length})
          </TabsTrigger>
          <TabsTrigger value='columns' className='flex items-center gap-2'>
            <Columns className='h-4 w-4' />
            Columns ({columns.length})
          </TabsTrigger>
          <TabsTrigger value='rows' className='flex items-center gap-2'>
            <Rows className='h-4 w-4' />
            Rows ({rows.length})
          </TabsTrigger>
          <TabsTrigger value='extras' className='flex items-center gap-2'>
            <LayoutTemplate className='h-4 w-4' />
            Extra ({extras.length})
          </TabsTrigger>
        </TabsList>

        {/* ── Preview Tab ─────────────────────────────────────────── */}
        <TabsContent value='preview'>
          <TemplatePreview
            template={template}
            columns={columns}
            rows={rows}
            extras={extras}
            blocks={blocks}
          />
        </TabsContent>

        {/* ── Blocks Tab ──────────────────────────────────────────── */}
        <TabsContent value='blocks'>
          <Card>
            <CardHeader>
              <div className='flex items-center justify-between'>
                <div>
                  <CardTitle className='text-lg'>Block Groups</CardTitle>
                  <CardDescription>
                    Define column groups (e.g., &quot;Before Line
                    Balancing&quot;, &quot;After Line Balancing&quot;). Each
                    block groups related columns together with a shared header.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className='space-y-6'>
              {/* Add new block */}
              <div className='flex items-end gap-3'>
                <div className='flex-1 space-y-2'>
                  <Label>New Block Name</Label>
                  <Input
                    placeholder='e.g., Before Line Balancing'
                    value={newBlockLabel}
                    onChange={(e) => setNewBlockLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddBlock();
                      }
                    }}
                  />
                </div>
                <Button
                  onClick={handleAddBlock}
                  disabled={!newBlockLabel.trim()}
                >
                  <Plus className='mr-2 h-4 w-4' />
                  Add Block
                </Button>
              </div>

              {/* Existing blocks */}
              <div className='space-y-3'>
                {blocks.map((block) => {
                  const blockCols = columnsByBlock[block.index] || [];
                  const isEditing = editingBlockIndex === block.index;

                  return (
                    <div
                      key={block.index}
                      className='flex items-center gap-3 rounded-lg border p-4'
                    >
                      {/* Block index badge */}
                      <Badge
                        variant='outline'
                        className='shrink-0 font-mono text-sm'
                      >
                        {block.index}
                      </Badge>

                      {/* Block label (editable) */}
                      <div className='flex-1'>
                        {isEditing ? (
                          <div className='flex items-center gap-2'>
                            <Input
                              value={editingBlockLabel}
                              onChange={(e) =>
                                setEditingBlockLabel(e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleUpdateBlockLabel(block.index);
                                }
                                if (e.key === 'Escape') {
                                  setEditingBlockIndex(null);
                                  setEditingBlockLabel('');
                                }
                              }}
                              className='h-8'
                              autoFocus
                            />
                            <Button
                              size='sm'
                              variant='outline'
                              className='h-8'
                              onClick={() =>
                                handleUpdateBlockLabel(block.index)
                              }
                            >
                              Save
                            </Button>
                            <Button
                              size='sm'
                              variant='ghost'
                              className='h-8'
                              onClick={() => {
                                setEditingBlockIndex(null);
                                setEditingBlockLabel('');
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <div className='flex items-center gap-2'>
                            <span className='font-medium'>{block.label}</span>
                            <Badge variant='secondary' className='text-xs'>
                              {blockCols.length} column
                              {blockCols.length !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      {!isEditing && (
                        <div className='flex items-center gap-1'>
                          <Button
                            variant='ghost'
                            size='icon'
                            className='h-8 w-8'
                            onClick={() => {
                              setEditingBlockIndex(block.index);
                              setEditingBlockLabel(block.label);
                            }}
                          >
                            <Pencil className='h-4 w-4' />
                          </Button>
                          <Button
                            variant='ghost'
                            size='icon'
                            className='text-destructive hover:text-destructive h-8 w-8'
                            onClick={() => handleRemoveBlock(block.index)}
                            disabled={blocks.length <= 1}
                          >
                            <Trash2 className='h-4 w-4' />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Info */}
              <div className='flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-400'>
                <Layers className='mt-0.5 h-4 w-4 flex-shrink-0' />
                <div>
                  <p className='font-medium'>How blocks work</p>
                  <p className='mt-1 text-xs'>
                    Blocks group related columns together. When adding a column,
                    you select which block it belongs to. The block index is
                    sent as{' '}
                    <code className='rounded bg-blue-100 px-1 dark:bg-blue-900'>
                      blockIndex
                    </code>{' '}
                    in the API call. Each column creation triggers its own API
                    call with the correct blockIndex.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Columns Tab ─────────────────────────────────────────── */}
        <TabsContent value='columns'>
          <Card>
            <CardHeader>
              <div className='flex items-center justify-between'>
                <div>
                  <CardTitle className='text-lg'>Columns</CardTitle>
                  <CardDescription>
                    Define the columns (fields) for your template, grouped by
                    blocks
                  </CardDescription>
                </div>
                <Button onClick={handleAddColumn}>
                  <Plus className='mr-2 h-4 w-4' />
                  Add Column
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {columns.length === 0 ? (
                <div className='bg-muted/30 flex flex-col items-center justify-center rounded-lg border py-12 text-center'>
                  <Columns className='text-muted-foreground mb-3 h-10 w-10' />
                  <h3 className='text-lg font-medium'>No Columns Yet</h3>
                  <p className='text-muted-foreground mt-1 max-w-sm text-sm'>
                    Add columns to define the structure of your template.
                  </p>
                  <Button className='mt-4' onClick={handleAddColumn}>
                    <Plus className='mr-2 h-4 w-4' />
                    Add First Column
                  </Button>
                </div>
              ) : (
                <div className='space-y-6'>
                  {blocks.map((block) => {
                    const blockCols = columnsByBlock[block.index] || [];
                    return (
                      <div key={block.index} className='space-y-3'>
                        {/* Block header */}
                        <div className='flex items-center gap-2'>
                          <Badge variant='outline' className='font-mono'>
                            Block {block.index}
                          </Badge>
                          <h4 className='text-sm font-semibold'>
                            {block.label}
                          </h4>
                          <Badge variant='secondary' className='text-xs'>
                            {blockCols.length} column
                            {blockCols.length !== 1 ? 's' : ''}
                          </Badge>
                        </div>

                        {blockCols.length === 0 ? (
                          <div className='text-muted-foreground rounded-md border border-dashed py-4 text-center text-sm'>
                            No columns in this block yet
                          </div>
                        ) : (
                          <div className='rounded-md border'>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Label</TableHead>
                                  <TableHead>Key</TableHead>
                                  <TableHead>Data Type</TableHead>
                                  <TableHead>Required</TableHead>
                                  <TableHead>Formula</TableHead>
                                  <TableHead className='w-[70px]'>
                                    Actions
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {blockCols.map((column) => (
                                  <TableRow key={column.id}>
                                    <TableCell className='font-medium'>
                                      {column.label}
                                    </TableCell>
                                    <TableCell>
                                      <code className='bg-muted rounded px-2 py-1 text-xs'>
                                        {column.key}
                                      </code>
                                    </TableCell>
                                    <TableCell>
                                      <Badge
                                        variant={
                                          column.dataType === 'NUMBER'
                                            ? 'default'
                                            : column.dataType === 'FORMULA'
                                              ? 'outline'
                                              : 'secondary'
                                        }
                                      >
                                        {column.dataType}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      {column.isRequired ? (
                                        <Badge variant='destructive'>Yes</Badge>
                                      ) : (
                                        <span className='text-muted-foreground'>
                                          No
                                        </span>
                                      )}
                                    </TableCell>
                                    <TableCell className='max-w-[150px] truncate'>
                                      {column.formula || '—'}
                                    </TableCell>
                                    <TableCell>
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
                                              handleEditColumn(column)
                                            }
                                          >
                                            <Pencil className='mr-2 h-4 w-4' />
                                            Edit
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() =>
                                              handleDeleteClick(
                                                'column',
                                                column
                                              )
                                            }
                                            className='text-destructive focus:text-destructive'
                                          >
                                            <Trash2 className='mr-2 h-4 w-4' />
                                            Delete
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Rows Tab ────────────────────────────────────────────── */}
        <TabsContent value='rows'>
          <Card>
            <CardHeader>
              <div className='flex items-center justify-between'>
                <div>
                  <CardTitle className='text-lg'>Rows</CardTitle>
                  <CardDescription>
                    Define the rows (data entries) for your template
                  </CardDescription>
                </div>
                <Button onClick={handleAddRow}>
                  <Plus className='mr-2 h-4 w-4' />
                  Add Row
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {rows.length === 0 ? (
                <div className='bg-muted/30 flex flex-col items-center justify-center rounded-lg border py-12 text-center'>
                  <Rows className='text-muted-foreground mb-3 h-10 w-10' />
                  <h3 className='text-lg font-medium'>No Rows Yet</h3>
                  <p className='text-muted-foreground mt-1 max-w-sm text-sm'>
                    Add rows to define the data entries of your template.
                  </p>
                  <Button className='mt-4' onClick={handleAddRow}>
                    <Plus className='mr-2 h-4 w-4' />
                    Add First Row
                  </Button>
                </div>
              ) : (
                <div className='rounded-md border'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Label</TableHead>
                        <TableHead>Row Type</TableHead>
                        <TableHead>Is Calculated</TableHead>
                        <TableHead>Order</TableHead>
                        <TableHead className='w-[70px]'>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows
                        .sort((a, b) => a.orderNo - b.orderNo)
                        .map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className='font-medium'>
                              {row.label}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  row.rowType === 'TOTAL'
                                    ? 'default'
                                    : 'secondary'
                                }
                              >
                                {row.rowType}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {row.isCalculated ? (
                                <Badge variant='outline'>Yes</Badge>
                              ) : (
                                <span className='text-muted-foreground'>
                                  No
                                </span>
                              )}
                            </TableCell>
                            <TableCell>{row.orderNo}</TableCell>
                            <TableCell>
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
                                    onClick={() => handleEditRow(row)}
                                  >
                                    <Pencil className='mr-2 h-4 w-4' />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleDeleteClick('row', row)
                                    }
                                    className='text-destructive focus:text-destructive'
                                  >
                                    <Trash2 className='mr-2 h-4 w-4' />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Extra Tab ───────────────────────────────────────────── */}
        <TabsContent value='extras'>
          <Card>
            <CardHeader>
              <div className='flex items-center justify-between'>
                <div>
                  <CardTitle className='text-lg'>Extra Fields</CardTitle>
                  <CardDescription>
                    Add headers, footers, and media fields to your template
                  </CardDescription>
                </div>
                <Button onClick={handleAddExtra}>
                  <Plus className='mr-2 h-4 w-4' />
                  Add Field
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {extras.length === 0 ? (
                <div className='bg-muted/30 flex flex-col items-center justify-center rounded-lg border py-12 text-center'>
                  <LayoutTemplate className='text-muted-foreground mb-3 h-10 w-10' />
                  <h3 className='text-lg font-medium'>No Extra Fields Yet</h3>
                  <p className='text-muted-foreground mt-1 max-w-sm text-sm'>
                    Add header, footer, or media fields to enhance your template
                    layout.
                  </p>
                  <Button className='mt-4' onClick={handleAddExtra}>
                    <Plus className='mr-2 h-4 w-4' />
                    Add First Field
                  </Button>
                </div>
              ) : (
                <div className='space-y-6'>
                  {renderExtraSection(
                    'Header Fields',
                    'Fields displayed at the top of the template',
                    groupedExtras.header
                  )}
                  {renderExtraSection(
                    'Footer Fields',
                    'Fields displayed at the bottom of the template',
                    groupedExtras.footer
                  )}
                  {renderExtraSection(
                    'Media Fields',
                    'Images and files displayed on the right side of the template',
                    groupedExtras.media
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ══════════════ DIALOGS ══════════════ */}
      <ColumnFormDialog
        open={columnDialogOpen}
        onOpenChange={setColumnDialogOpen}
        onSubmit={handleColumnSubmit}
        initialData={editingColumn}
        availableColumns={columns}
        blocks={blocks}
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete{' '}
              {deleteType === 'column'
                ? 'Column'
                : deleteType === 'row'
                  ? 'Row'
                  : 'Extra Field'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;
              {itemToDelete && 'label' in itemToDelete
                ? itemToDelete.label
                : ''}
              &quot;? This action cannot be undone.
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
