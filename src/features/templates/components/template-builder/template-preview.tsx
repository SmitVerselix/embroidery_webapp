/**
 * Component: TemplatePreview
 * Description: Live preview of the template with header, footer, and media sections
 *
 * Layout:
 * ┌──────────────────────────────────────────────────────────────┐
 * │  HEADER fields (full width, above the table)                │
 * ├──────────────────────────────────────────────┬───────────────┤
 * │  Main table (columns × rows)                 │  MEDIA fields │
 * │                                              │  (right side) │
 * ├──────────────────────────────────────────────┴───────────────┤
 * │  FOOTER fields (full width, below the table)                │
 * └──────────────────────────────────────────────────────────────┘
 */

'use client';

import { useMemo } from 'react';
import type {
  TemplateColumn,
  TemplateRow,
  TemplateExtra,
  Template,
  TemplateWithDetails,
} from '@/lib/api/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
}

// =============================================================================
// HELPERS
// =============================================================================

/** Icon for each value type */
const ValueTypeIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'TEXT':
      return <Type className="h-3.5 w-3.5" />;
    case 'NUMBER':
      return <Hash className="h-3.5 w-3.5" />;
    case 'DATE':
      return <Calendar className="h-3.5 w-3.5" />;
    case 'IMAGE':
      return <ImageIcon className="h-3.5 w-3.5" />;
    case 'FILE':
      return <Paperclip className="h-3.5 w-3.5" />;
    default:
      return <Type className="h-3.5 w-3.5" />;
  }
};

/** Placeholder value based on valueType */
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

// =============================================================================
// COMPONENT
// =============================================================================

export default function TemplatePreview({
  template,
  columns,
  rows,
  extras = [],
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

  // Resolve extras: prefer prop, fallback to template.extra (API field name)
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

  // ──────────────────────────────────────────────────────────────────────────
  // RENDER: Header Section (above the table, full width)
  // ──────────────────────────────────────────────────────────────────────────
  const renderHeaderSection = () => {
    if (headerExtras.length === 0) return null;

    return (
      <div className="border rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
        {/* Section title bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-blue-200 dark:border-blue-900">
          <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
            Header
          </h4>
          <Badge variant="secondary" className="text-[10px] ml-auto">
            {headerExtras.length} field{headerExtras.length !== 1 ? 's' : ''}
          </Badge>
        </div>

        {/* Fields grid */}
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {headerExtras.map((extra) => (
            <div
              key={extra.id}
              className="bg-white dark:bg-background rounded-md border p-3 space-y-2"
            >
              {/* Label row */}
              <div className="flex items-center gap-1.5">
                <ValueTypeIcon type={extra.valueType} />
                <span className="text-sm font-medium text-foreground">
                  {extra.label}
                </span>
                {extra.isRequired && (
                  <span className="text-destructive text-xs font-bold">*</span>
                )}
              </div>

              {/* Input placeholder */}
              <div className="h-9 flex items-center px-3 text-sm text-muted-foreground border rounded-md bg-muted/30">
                {getPlaceholder(extra.valueType)}
              </div>

              {/* Meta badges */}
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {extra.valueType}
                </Badge>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {extra.visibilityScope}
                </Badge>
                {extra.allowMultiple && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
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
  // RENDER: Footer Section (below the table, full width)
  // ──────────────────────────────────────────────────────────────────────────
  const renderFooterSection = () => {
    if (footerExtras.length === 0) return null;

    return (
      <div className="border rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
        {/* Section title bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-amber-200 dark:border-amber-900">
          <FileText className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            Footer
          </h4>
          <Badge variant="secondary" className="text-[10px] ml-auto">
            {footerExtras.length} field{footerExtras.length !== 1 ? 's' : ''}
          </Badge>
        </div>

        {/* Fields grid */}
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {footerExtras.map((extra) => (
            <div
              key={extra.id}
              className="bg-white dark:bg-background rounded-md border p-3 space-y-2"
            >
              {/* Label row */}
              <div className="flex items-center gap-1.5">
                <ValueTypeIcon type={extra.valueType} />
                <span className="text-sm font-medium text-foreground">
                  {extra.label}
                </span>
                {extra.isRequired && (
                  <span className="text-destructive text-xs font-bold">*</span>
                )}
              </div>

              {/* Input placeholder */}
              <div className="h-9 flex items-center px-3 text-sm text-muted-foreground border rounded-md bg-muted/30">
                {getPlaceholder(extra.valueType)}
              </div>

              {/* Meta badges */}
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {extra.valueType}
                </Badge>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {extra.visibilityScope}
                </Badge>
                {extra.allowMultiple && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
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
  // RENDER: Media Section (right sidebar, beside the table)
  // ──────────────────────────────────────────────────────────────────────────
  const renderMediaSection = () => {
    if (!hasMedia) return null;

    return (
      <div className="w-[240px] flex-shrink-0 border rounded-lg bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900">
        {/* Section title bar */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-purple-200 dark:border-purple-900">
          <ImageIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          <h4 className="text-sm font-semibold text-purple-900 dark:text-purple-100">
            Media
          </h4>
        </div>

        {/* Media field cards */}
        <div className="p-3 space-y-3">
          {mediaExtras.map((extra) => (
            <div
              key={extra.id}
              className="bg-white dark:bg-background rounded-md border p-3 space-y-2"
            >
              {/* Label */}
              <div className="flex items-center gap-1.5">
                <ValueTypeIcon type={extra.valueType} />
                <span className="text-xs font-medium text-foreground">
                  {extra.label}
                </span>
                {extra.isRequired && (
                  <span className="text-destructive text-xs font-bold">*</span>
                )}
              </div>

              {/* Image / File placeholder */}
              {extra.valueType === 'IMAGE' ? (
                <div className="flex flex-col items-center justify-center aspect-[4/3] border-2 border-dashed rounded-md bg-muted/30">
                  <ImageIcon className="h-10 w-10 text-muted-foreground/40 mb-1.5" />
                  <span className="text-[11px] text-muted-foreground">
                    Upload image
                  </span>
                </div>
              ) : extra.valueType === 'FILE' ? (
                <div className="flex flex-col items-center justify-center h-20 border-2 border-dashed rounded-md bg-muted/30">
                  <Paperclip className="h-7 w-7 text-muted-foreground/40 mb-1" />
                  <span className="text-[11px] text-muted-foreground">
                    Attach file
                  </span>
                </div>
              ) : (
                <div className="h-9 flex items-center px-3 text-sm text-muted-foreground border rounded-md bg-muted/30">
                  {getPlaceholder(extra.valueType)}
                </div>
              )}

              {/* Meta badges */}
              <div className="flex flex-wrap items-center gap-1">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {extra.valueType}
                </Badge>
                {extra.allowMultiple && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
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
  // RENDER: Main data table (columns × rows)
  // ──────────────────────────────────────────────────────────────────────────
  const renderMainTable = () => {
    if (!hasData) return null;

    return (
      <div className="border rounded-lg overflow-hidden flex-1 min-w-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold min-w-[150px] sticky left-0 bg-muted/50">
                  Row / Item
                </TableHead>
                {hasColumns ? (
                  sortedColumns.map((column) => (
                    <TableHead
                      key={column.id}
                      className="min-w-[120px] text-center"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-semibold">{column.label}</span>
                        <div className="flex items-center gap-1">
                          <Badge
                            variant={getDataTypeBadgeVariant(column.dataType)}
                            className="text-[10px] px-1.5 py-0"
                          >
                            {column.dataType}
                          </Badge>
                          {column.isRequired && (
                            <span className="text-destructive text-xs">*</span>
                          )}
                        </div>
                      </div>
                    </TableHead>
                  ))
                ) : (
                  <TableHead className="text-center text-muted-foreground">
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
                    <TableCell className="font-medium sticky left-0 bg-background">
                      <div className="flex items-center gap-2">
                        <span>{row.label}</span>
                        {row.rowType === 'TOTAL' && (
                          <Badge variant="outline" className="text-[10px]">
                            TOTAL
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    {hasColumns ? (
                      sortedColumns.map((column) => (
                        <TableCell
                          key={`${row.id}-${column.id}`}
                          className={cn(
                            'text-center',
                            row.rowType === 'TOTAL' && 'bg-muted'
                          )}
                        >
                          {column.dataType === 'FORMULA' ? (
                            <div className="flex items-center justify-center gap-1">
                              <Calculator className="h-3 w-3 text-muted-foreground" />
                              <span className="text-muted-foreground italic text-xs font-mono">
                                {getFormulaText(column)}
                              </span>
                            </div>
                          ) : column.dataType === 'NUMBER' ? (
                            <span className="text-muted-foreground">0</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      ))
                    ) : (
                      <TableCell className="text-center text-muted-foreground">
                        —
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={hasColumns ? sortedColumns.length + 1 : 2}
                    className="text-center text-muted-foreground py-8"
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
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle className="text-lg">Template Preview</CardTitle>
            <CardDescription>
              Live preview of how your template will look
            </CardDescription>
          </div>  
        </div>
      </CardHeader>

      <CardContent>
        {/* Stats bar */}
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Columns className="h-4 w-4" />
            <span>
              {columns.length} column{columns.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Rows className="h-4 w-4" />
            <span>
              {rows.length} row{rows.length !== 1 ? 's' : ''}
            </span>
          </div>
          {hasExtras && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LayoutTemplate className="h-4 w-4" />
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

        {/* Empty state */}
        {!hasData && !hasExtras && (
          <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/30">
            <AlertCircle className="h-10 w-10 text-muted-foreground mb-3" />
            <h3 className="font-medium text-lg">No Data Yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1">
              Add columns, rows, and extra fields to see your template preview.
            </p>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            FULL PREVIEW LAYOUT
            ════════════════════════════════════════════════════════════════ */}
        {(hasData || hasExtras) && (
          <div className="space-y-4">
            {/* ── HEADER (full width, above everything) ─────────────── */}
            {renderHeaderSection()}

            {/* ── MAIN TABLE + MEDIA (side by side) ─────────────────── */}
            <div className="flex gap-4 items-start">
              {/* Left: Table (takes remaining space) */}
              {hasData ? (
                renderMainTable()
              ) : (
                <div className="flex-1 min-w-0 flex items-center justify-center py-12 border rounded-lg bg-muted/30">
                  <p className="text-sm text-muted-foreground">
                    Add columns and rows to see the table
                  </p>
                </div>
              )}

              {/* Right: Media sidebar */}
              {renderMediaSection()}
            </div>

            {/* ── FOOTER (full width, below everything) ─────────────── */}
            {renderFooterSection()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}