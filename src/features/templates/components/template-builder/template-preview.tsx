'use client';

import { useMemo } from 'react';
import type {
  TemplateColumn,
  TemplateRow,
  TemplateExtra,
  Template,
  TemplateWithDetails
} from '@/lib/api/types';
import type { TemplateBlock } from './column-form-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Eye,
  Columns,
  Rows,
  AlertCircle,
  Calculator,
  FileText,
  Image as ImageIcon,
  Hash,
  Calendar,
  Type,
  Paperclip,
  LayoutTemplate,
  Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseFormula, getFormulaPreview } from './formula-builder';

// =============================================================================
// PROPS
// =============================================================================

interface TemplatePreviewProps {
  template: Template | TemplateWithDetails;
  columns: TemplateColumn[];
  rows: TemplateRow[];
  extras?: TemplateExtra[];
  blocks?: TemplateBlock[];
}

// =============================================================================
// HELPERS
// =============================================================================

const ValueTypeIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'TEXT':
      return <Type className='h-3.5 w-3.5' />;
    case 'NUMBER':
      return <Hash className='h-3.5 w-3.5' />;
    case 'DATE':
      return <Calendar className='h-3.5 w-3.5' />;
    case 'IMAGE':
      return <ImageIcon className='h-3.5 w-3.5' />;
    case 'FILE':
      return <Paperclip className='h-3.5 w-3.5' />;
    default:
      return <Type className='h-3.5 w-3.5' />;
  }
};

const getPlaceholder = (valueType: string): string => {
  switch (valueType) {
    case 'TEXT':
      return 'Enter text…';
    case 'NUMBER':
      return '0';
    case 'DATE':
      return 'DD/MM/YYYY';
    case 'IMAGE':
      return 'Upload image';
    case 'FILE':
      return 'Attach file';
    default:
      return '—';
  }
};

/** Derive blocks from columns if not provided */
function deriveBlocks(
  columns: TemplateColumn[],
  blocks?: TemplateBlock[]
): TemplateBlock[] {
  if (blocks && blocks.length > 0) return blocks;

  const indices = new Set<number>();
  columns.forEach((col) => indices.add(col.blockIndex));

  if (indices.size === 0) {
    indices.add(0);
  }

  return Array.from(indices)
    .sort((a, b) => a - b)
    .map((index) => ({ index, label: `Block ${index}` }));
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function TemplatePreview({
  template,
  columns,
  rows,
  extras = [],
  blocks: blocksProp
}: TemplatePreviewProps) {
  // Sort columns & rows
  const sortedColumns = useMemo(
    () => [...columns].sort((a, b) => a.orderNo - b.orderNo),
    [columns]
  );
  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => a.orderNo - b.orderNo),
    [rows]
  );

  // Derive blocks
  const blocks = useMemo(
    () => deriveBlocks(columns, blocksProp),
    [columns, blocksProp]
  );

  // Group columns by blockIndex, preserving block order
  const orderedBlockColumns = useMemo(() => {
    const grouped: { block: TemplateBlock; columns: TemplateColumn[] }[] = [];
    blocks.forEach((block) => {
      const blockCols = sortedColumns.filter(
        (col) => col.blockIndex === block.index
      );
      if (blockCols.length > 0) {
        grouped.push({ block, columns: blockCols });
      }
    });
    return grouped;
  }, [blocks, sortedColumns]);

  // Flat list of columns in block order (for rendering table cells)
  const flatOrderedColumns = useMemo(
    () => orderedBlockColumns.flatMap((g) => g.columns),
    [orderedBlockColumns]
  );

  // Check if we have multiple blocks with columns
  const hasMultipleBlocks = orderedBlockColumns.length > 1;

  // Resolve extras
  const allExtras = useMemo(() => {
    if (extras.length > 0) return extras;
    if (
      'extra' in template &&
      Array.isArray((template as TemplateWithDetails).extra)
    ) {
      return (template as TemplateWithDetails).extra!;
    }
    return [];
  }, [extras, template]);

  const sortedExtras = useMemo(
    () => [...allExtras].sort((a, b) => a.orderNo - b.orderNo),
    [allExtras]
  );

  // Group by section type
  const headerExtras = useMemo(
    () => sortedExtras.filter((e) => e.sectionType === 'HEADER'),
    [sortedExtras]
  );
  const footerExtras = useMemo(
    () => sortedExtras.filter((e) => e.sectionType === 'FOOTER'),
    [sortedExtras]
  );
  const mediaExtras = useMemo(
    () => sortedExtras.filter((e) => e.sectionType === 'MEDIA'),
    [sortedExtras]
  );

  const hasColumns = sortedColumns.length > 0;
  const hasRows = sortedRows.length > 0;
  const hasData = hasColumns || hasRows;
  const hasExtras = sortedExtras.length > 0;
  const hasMedia = mediaExtras.length > 0;

  // Formula text helper
  const getFormulaText = (column: TemplateColumn): string => {
    if (!column.formula) return '—';
    const parsed = parseFormula(column.formula);
    if (!parsed) return column.formula;
    return getFormulaPreview(parsed, columns);
  };

  const getDataTypeBadgeVariant = (dataType: string) => {
    switch (dataType) {
      case 'NUMBER':
        return 'default';
      case 'TEXT':
        return 'secondary';
      case 'FORMULA':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getRowTypeStyle = (rowType: string) => {
    if (rowType === 'TOTAL') return 'bg-muted font-semibold';
    return '';
  };

  // Block header colors (cycle through a set of colors)
  const blockColors = [
    'bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-800',
    'bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-200 border-green-300 dark:border-green-800',
    'bg-purple-100 dark:bg-purple-950/40 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-800',
    'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800',
    'bg-pink-100 dark:bg-pink-950/40 text-pink-800 dark:text-pink-200 border-pink-300 dark:border-pink-800',
    'bg-teal-100 dark:bg-teal-950/40 text-teal-800 dark:text-teal-200 border-teal-300 dark:border-teal-800'
  ];

  // ──────────────────────────────────────────────────────────────────────────
  // RENDER: Header Section
  // ──────────────────────────────────────────────────────────────────────────
  const renderHeaderSection = () => {
    if (headerExtras.length === 0) return null;

    return (
      <div className='rounded-lg border border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20'>
        <div className='flex items-center gap-2 border-b border-blue-200 px-4 py-2.5 dark:border-blue-900'>
          <FileText className='h-4 w-4 text-blue-600 dark:text-blue-400' />
          <h4 className='text-sm font-semibold text-blue-900 dark:text-blue-100'>
            Header
          </h4>
          <Badge variant='secondary' className='ml-auto text-[10px]'>
            {headerExtras.length} field{headerExtras.length !== 1 ? 's' : ''}
          </Badge>
        </div>
        <div className='grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3'>
          {headerExtras.map((extra) => (
            <div
              key={extra.id}
              className='dark:bg-background space-y-2 rounded-md border bg-white p-3'
            >
              <div className='flex items-center gap-1.5'>
                <ValueTypeIcon type={extra.valueType} />
                <span className='text-foreground text-sm font-medium'>
                  {extra.label}
                </span>
                {extra.isRequired && (
                  <span className='text-destructive text-xs font-bold'>*</span>
                )}
              </div>
              <div className='text-muted-foreground bg-muted/30 flex h-9 items-center rounded-md border px-3 text-sm'>
                {getPlaceholder(extra.valueType)}
              </div>
              <div className='flex items-center gap-1.5'>
                <Badge variant='outline' className='px-1.5 py-0 text-[10px]'>
                  {extra.valueType}
                </Badge>
                <Badge variant='secondary' className='px-1.5 py-0 text-[10px]'>
                  {extra.visibilityScope}
                </Badge>
                {extra.allowMultiple && (
                  <Badge
                    variant='secondary'
                    className='px-1.5 py-0 text-[10px]'
                  >
                    Multiple
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ──────────────────────────────────────────────────────────────────────────
  // RENDER: Footer Section
  // ──────────────────────────────────────────────────────────────────────────
  const renderFooterSection = () => {
    if (footerExtras.length === 0) return null;

    return (
      <div className='rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20'>
        <div className='flex items-center gap-2 border-b border-amber-200 px-4 py-2.5 dark:border-amber-900'>
          <FileText className='h-4 w-4 text-amber-600 dark:text-amber-400' />
          <h4 className='text-sm font-semibold text-amber-900 dark:text-amber-100'>
            Footer
          </h4>
          <Badge variant='secondary' className='ml-auto text-[10px]'>
            {footerExtras.length} field{footerExtras.length !== 1 ? 's' : ''}
          </Badge>
        </div>
        <div className='grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3'>
          {footerExtras.map((extra) => (
            <div
              key={extra.id}
              className='dark:bg-background space-y-2 rounded-md border bg-white p-3'
            >
              <div className='flex items-center gap-1.5'>
                <ValueTypeIcon type={extra.valueType} />
                <span className='text-foreground text-sm font-medium'>
                  {extra.label}
                </span>
                {extra.isRequired && (
                  <span className='text-destructive text-xs font-bold'>*</span>
                )}
              </div>
              <div className='text-muted-foreground bg-muted/30 flex h-9 items-center rounded-md border px-3 text-sm'>
                {getPlaceholder(extra.valueType)}
              </div>
              <div className='flex items-center gap-1.5'>
                <Badge variant='outline' className='px-1.5 py-0 text-[10px]'>
                  {extra.valueType}
                </Badge>
                <Badge variant='secondary' className='px-1.5 py-0 text-[10px]'>
                  {extra.visibilityScope}
                </Badge>
                {extra.allowMultiple && (
                  <Badge
                    variant='secondary'
                    className='px-1.5 py-0 text-[10px]'
                  >
                    Multiple
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ──────────────────────────────────────────────────────────────────────────
  // RENDER: Media Section
  // ──────────────────────────────────────────────────────────────────────────
  const renderMediaSection = () => {
    if (!hasMedia) return null;

    return (
      <div className='w-[240px] flex-shrink-0 rounded-lg border border-purple-200 bg-purple-50/50 dark:border-purple-900 dark:bg-purple-950/20'>
        <div className='flex items-center gap-2 border-b border-purple-200 px-3 py-2.5 dark:border-purple-900'>
          <ImageIcon className='h-4 w-4 text-purple-600 dark:text-purple-400' />
          <h4 className='text-sm font-semibold text-purple-900 dark:text-purple-100'>
            Media
          </h4>
        </div>
        <div className='space-y-3 p-3'>
          {mediaExtras.map((extra) => (
            <div
              key={extra.id}
              className='dark:bg-background space-y-2 rounded-md border bg-white p-3'
            >
              <div className='flex items-center gap-1.5'>
                <ValueTypeIcon type={extra.valueType} />
                <span className='text-foreground text-xs font-medium'>
                  {extra.label}
                </span>
                {extra.isRequired && (
                  <span className='text-destructive text-xs font-bold'>*</span>
                )}
              </div>
              {extra.valueType === 'IMAGE' ? (
                <div className='bg-muted/30 flex aspect-[4/3] flex-col items-center justify-center rounded-md border-2 border-dashed'>
                  <ImageIcon className='text-muted-foreground/40 mb-1.5 h-10 w-10' />
                  <span className='text-muted-foreground text-[11px]'>
                    Upload image
                  </span>
                </div>
              ) : extra.valueType === 'FILE' ? (
                <div className='bg-muted/30 flex h-20 flex-col items-center justify-center rounded-md border-2 border-dashed'>
                  <Paperclip className='text-muted-foreground/40 mb-1 h-7 w-7' />
                  <span className='text-muted-foreground text-[11px]'>
                    Attach file
                  </span>
                </div>
              ) : (
                <div className='text-muted-foreground bg-muted/30 flex h-9 items-center rounded-md border px-3 text-sm'>
                  {getPlaceholder(extra.valueType)}
                </div>
              )}
              <div className='flex flex-wrap items-center gap-1'>
                <Badge variant='outline' className='px-1.5 py-0 text-[10px]'>
                  {extra.valueType}
                </Badge>
                {extra.allowMultiple && (
                  <Badge
                    variant='secondary'
                    className='px-1.5 py-0 text-[10px]'
                  >
                    Multiple
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ──────────────────────────────────────────────────────────────────────────
  // RENDER: Main data table with BLOCK GROUP HEADERS
  // ──────────────────────────────────────────────────────────────────────────
  const renderMainTable = () => {
    if (!hasData) return null;

    const totalColCount = flatOrderedColumns.length;

    return (
      <div className='min-w-0 flex-1 overflow-hidden rounded-lg border'>
        <div className='overflow-x-auto'>
          <Table>
            <TableHeader>
              {/* ── Row 1: Block Group Headers (only if multiple blocks) ── */}
              {hasMultipleBlocks && hasColumns && (
                <TableRow className='bg-muted/30 border-b-2'>
                  {/* Row label spacer */}
                  <TableHead
                    className='bg-muted/30 sticky left-0 min-w-[150px] border-r font-semibold'
                    rowSpan={2}
                  >
                    Row / Item
                  </TableHead>

                  {/* Block group headers with colspan */}
                  {orderedBlockColumns.map((group, idx) => (
                    <TableHead
                      key={group.block.index}
                      colSpan={group.columns.length}
                      className={cn(
                        'border-x text-center text-sm font-bold',
                        blockColors[idx % blockColors.length]
                      )}
                    >
                      <div className='flex items-center justify-center gap-2 py-1'>
                        <Layers className='h-3.5 w-3.5' />
                        <span>{group.block.label}</span>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              )}

              {/* ── Row 2: Individual Column Headers ── */}
              <TableRow className='bg-muted/50'>
                {/* Row label (only if single block - otherwise it's in the row above with rowSpan) */}
                {!hasMultipleBlocks && (
                  <TableHead className='bg-muted/50 sticky left-0 min-w-[150px] font-semibold'>
                    Row / Item
                  </TableHead>
                )}

                {hasColumns ? (
                  flatOrderedColumns.map((column) => (
                    <TableHead
                      key={column.id}
                      className='min-w-[120px] text-center'
                    >
                      <div className='flex flex-col items-center gap-1'>
                        <span className='font-semibold'>{column.label}</span>
                        <div className='flex items-center gap-1'>
                          <Badge
                            variant={getDataTypeBadgeVariant(column.dataType)}
                            className='px-1.5 py-0 text-[10px]'
                          >
                            {column.dataType}
                          </Badge>
                          {column.isRequired && (
                            <span className='text-destructive text-xs'>*</span>
                          )}
                        </div>
                      </div>
                    </TableHead>
                  ))
                ) : (
                  <TableHead className='text-muted-foreground text-center'>
                    No columns defined
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>

            <TableBody>
              {hasRows ? (
                sortedRows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={cn(getRowTypeStyle(row.rowType))}
                  >
                    <TableCell className='bg-background sticky left-0 font-medium'>
                      <div className='flex items-center gap-2'>
                        <span>{row.label}</span>
                        {row.rowType === 'TOTAL' && (
                          <Badge variant='outline' className='text-[10px]'>
                            TOTAL
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    {hasColumns ? (
                      flatOrderedColumns.map((column) => (
                        <TableCell
                          key={`${row.id}-${column.id}`}
                          className={cn(
                            'text-center',
                            row.rowType === 'TOTAL' && 'bg-muted'
                          )}
                        >
                          {column.dataType === 'FORMULA' ? (
                            <div className='flex items-center justify-center gap-1'>
                              <Calculator className='text-muted-foreground h-3 w-3' />
                              <span className='text-muted-foreground font-mono text-xs italic'>
                                {getFormulaText(column)}
                              </span>
                            </div>
                          ) : column.dataType === 'NUMBER' ? (
                            <span className='text-muted-foreground'>0</span>
                          ) : (
                            <span className='text-muted-foreground'>—</span>
                          )}
                        </TableCell>
                      ))
                    ) : (
                      <TableCell className='text-muted-foreground text-center'>
                        —
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={hasColumns ? totalColCount + 1 : 2}
                    className='text-muted-foreground py-8 text-center'
                  >
                    No rows defined. Add rows to see data entries.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  // ──────────────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <Card>
      <CardHeader>
        <div className='flex items-center gap-2'>
          <Eye className='text-muted-foreground h-5 w-5' />
          <div>
            <CardTitle className='text-lg'>Template Preview</CardTitle>
            <CardDescription>
              Live preview of how your template will look
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Stats bar */}
        <div className='mb-4 flex flex-wrap gap-4'>
          <div className='text-muted-foreground flex items-center gap-2 text-sm'>
            <Layers className='h-4 w-4' />
            <span>
              {blocks.length} block{blocks.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className='text-muted-foreground flex items-center gap-2 text-sm'>
            <Columns className='h-4 w-4' />
            <span>
              {columns.length} column{columns.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className='text-muted-foreground flex items-center gap-2 text-sm'>
            <Rows className='h-4 w-4' />
            <span>
              {rows.length} row{rows.length !== 1 ? 's' : ''}
            </span>
          </div>
          {hasExtras && (
            <div className='text-muted-foreground flex items-center gap-2 text-sm'>
              <LayoutTemplate className='h-4 w-4' />
              <span>
                {sortedExtras.length} extra
                {sortedExtras.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
          <Badge
            variant={template.type === 'COSTING' ? 'default' : 'secondary'}
          >
            {template.type}
          </Badge>
        </div>

        {/* Block legend (if multiple blocks) */}
        {hasMultipleBlocks && (
          <div className='mb-4 flex flex-wrap gap-2'>
            {orderedBlockColumns.map((group, idx) => (
              <div
                key={group.block.index}
                className={cn(
                  'flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium',
                  blockColors[idx % blockColors.length]
                )}
              >
                <Layers className='h-3 w-3' />
                <span>{group.block.label}</span>
                <Badge
                  variant='secondary'
                  className='ml-1 px-1 py-0 text-[9px]'
                >
                  {group.columns.length} col
                  {group.columns.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!hasData && !hasExtras && (
          <div className='bg-muted/30 flex flex-col items-center justify-center rounded-lg border py-12 text-center'>
            <AlertCircle className='text-muted-foreground mb-3 h-10 w-10' />
            <h3 className='text-lg font-medium'>No Data Yet</h3>
            <p className='text-muted-foreground mt-1 max-w-sm text-sm'>
              Add columns, rows, and extra fields to see your template preview.
            </p>
          </div>
        )}

        {/* Full preview layout */}
        {(hasData || hasExtras) && (
          <div className='space-y-4'>
            {renderHeaderSection()}

            <div className='flex items-start gap-4'>
              {hasData ? (
                renderMainTable()
              ) : (
                <div className='bg-muted/30 flex min-w-0 flex-1 items-center justify-center rounded-lg border py-12'>
                  <p className='text-muted-foreground text-sm'>
                    Add columns and rows to see the table
                  </p>
                </div>
              )}
              {renderMediaSection()}
            </div>

            {renderFooterSection()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
