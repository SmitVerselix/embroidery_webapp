'use client';

import { useMemo, useCallback } from 'react';
import type {
  TemplateWithDetails,
  TemplateColumn,
  TemplateRow,
  TemplateExtra,
} from '@/lib/api/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Calculator,
  Columns,
  Rows,
  AlertCircle,
  LayoutTemplate,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  parseFormula,
  getFormulaPreview,
} from '@/features/templates/components/template-builder/formula-builder';
import OrderExtraValues, {
  type ExtraValuesMap,
} from './order-extra-values';

// =============================================================================
// TYPES
// =============================================================================

export type TemplateValuesMap = Record<string, Record<string, string>>;
// TemplateValuesMap[rowId][columnId] = value

export interface OrderTemplateValuesProps {
  template: TemplateWithDetails;
  values: TemplateValuesMap;
  onChange: (values: TemplateValuesMap) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
  readOnly?: boolean;
  // Extra values support
  extraValues?: ExtraValuesMap;
  onExtraValuesChange?: (values: ExtraValuesMap) => void;
  extraErrors?: Record<string, string>;
}

// =============================================================================
// FORMULA EVALUATOR (basic client-side for preview)
// =============================================================================

function evaluateFormula(
  formulaString: string | null,
  columns: TemplateColumn[],
  rowValues: Record<string, string>
): string {
  if (!formulaString) return '—';

  const parsed = parseFormula(formulaString);
  if (!parsed || parsed.steps.length === 0) return '—';

  const keyToValue: Record<string, number> = {};
  columns.forEach((col) => {
    if (col.dataType === 'NUMBER') {
      const val = rowValues[col.id];
      keyToValue[col.key] = val ? parseFloat(val) || 0 : 0;
    }
  });

  let result = keyToValue[parsed.steps[0]?.columnKey] ?? 0;

  for (let i = 1; i < parsed.steps.length; i++) {
    const op = parsed.operators[i - 1];
    const val = keyToValue[parsed.steps[i]?.columnKey] ?? 0;

    switch (op) {
      case '+':
        result += val;
        break;
      case '-':
        result -= val;
        break;
      case '*':
        result *= val;
        break;
      case '/':
        result = val !== 0 ? result / val : 0;
        break;
      case '%':
        result = val !== 0 ? result % val : 0;
        break;
      case '^':
        result = Math.pow(result, val);
        break;
    }
  }

  for (const mod of parsed.modifiers) {
    switch (mod.type) {
      case 'percentage': {
        const pct = (result * mod.value) / 100;
        result = mod.operator === '+' ? result + pct : result - pct;
        break;
      }
      case 'fixed':
        result = mod.operator === '+' ? result + mod.value : result - mod.value;
        break;
      case 'round':
        result = parseFloat(result.toFixed(mod.value));
        break;
      case 'abs':
        result = Math.abs(result);
        break;
      case 'ceil':
        result = Math.ceil(result);
        break;
      case 'floor':
        result = Math.floor(result);
        break;
      case 'min':
        result = Math.max(result, mod.value);
        break;
      case 'max':
        result = Math.min(result, mod.value);
        break;
    }
  }

  if (Number.isInteger(result)) return String(result);
  return result.toFixed(2);
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function OrderTemplateValues({
  template,
  values,
  onChange,
  errors = {},
  disabled = false,
  readOnly = false,
  extraValues = {},
  onExtraValuesChange,
  extraErrors = {},
}: OrderTemplateValuesProps) {
  const columns = useMemo(
    () => [...(template.columns || [])].sort((a, b) => a.orderNo - b.orderNo),
    [template.columns]
  );

  const rows = useMemo(
    () => [...(template.rows || [])].sort((a, b) => a.orderNo - b.orderNo),
    [template.rows]
  );

  const extras = useMemo(
    () => [...(template.extra || [])].sort((a, b) => a.orderNo - b.orderNo),
    [template.extra]
  );

  const headerExtras = useMemo(
    () => extras.filter((e) => e.sectionType === 'HEADER'),
    [extras]
  );
  const footerExtras = useMemo(
    () => extras.filter((e) => e.sectionType === 'FOOTER'),
    [extras]
  );
  const mediaExtras = useMemo(
    () => extras.filter((e) => e.sectionType === 'MEDIA'),
    [extras]
  );

  const hasColumns = columns.length > 0;
  const hasRows = rows.length > 0;
  const hasData = hasColumns && hasRows;
  const hasHeaderExtras = headerExtras.length > 0;
  const hasFooterExtras = footerExtras.length > 0;
  const hasMediaExtras = mediaExtras.length > 0;
  const hasAnyExtras = hasHeaderExtras || hasFooterExtras || hasMediaExtras;

  // ──────────────────────────────────────────────────────────────────────
  // HANDLERS
  // ──────────────────────────────────────────────────────────────────────
  const handleValueChange = useCallback(
    (rowId: string, columnId: string, value: string) => {
      const newValues = { ...values };
      if (!newValues[rowId]) {
        newValues[rowId] = {};
      }
      newValues[rowId] = { ...newValues[rowId], [columnId]: value };
      onChange(newValues);
    },
    [values, onChange]
  );

  const getValue = useCallback(
    (rowId: string, columnId: string): string => {
      return values[rowId]?.[columnId] || '';
    },
    [values]
  );

  const getRowValues = useCallback(
    (rowId: string): Record<string, string> => {
      return values[rowId] || {};
    },
    [values]
  );

  const getErrorKey = (rowId: string, columnId: string) =>
    `${rowId}-${columnId}`;

  const getFormulaText = useCallback(
    (column: TemplateColumn): string => {
      if (!column.formula) return '—';
      const parsed = parseFormula(column.formula);
      if (!parsed) return column.formula;
      return getFormulaPreview(parsed, columns);
    },
    [columns]
  );

  const handleExtraChange = useCallback(
    (newExtraValues: ExtraValuesMap) => {
      onExtraValuesChange?.(newExtraValues);
    },
    [onExtraValuesChange]
  );

  // ──────────────────────────────────────────────────────────────────────
  // RENDER: Main Value Entry Table
  // ──────────────────────────────────────────────────────────────────────
  const renderValueTable = () => {
    if (!hasData) {
      return (
        <div className="flex-1 min-w-0 flex items-center justify-center py-12 border rounded-lg bg-muted/30">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              This template has no columns or rows defined.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="border rounded-lg overflow-hidden flex-1 min-w-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold min-w-[140px] sticky left-0 bg-muted/50 z-10">
                  Row / Item
                </TableHead>
                {columns.map((column) => (
                  <TableHead
                    key={column.id}
                    className="min-w-[140px] text-center"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span className="font-semibold">{column.label}</span>
                      <div className="flex items-center gap-1">
                        <Badge
                          variant={
                            column.dataType === 'NUMBER'
                              ? 'default'
                              : column.dataType === 'FORMULA'
                              ? 'outline'
                              : 'secondary'
                          }
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
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const isTotal = row.rowType === 'TOTAL';
                const rowValues = getRowValues(row.id);

                return (
                  <TableRow
                    key={row.id}
                    className={cn(isTotal && 'bg-muted font-semibold')}
                  >
                    <TableCell className="font-medium sticky left-0 bg-background z-10">
                      <div className="flex items-center gap-2">
                        <span>{row.label}</span>
                        {isTotal && (
                          <Badge variant="outline" className="text-[10px]">
                            TOTAL
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    {columns.map((column) => {
                      const cellKey = getErrorKey(row.id, column.id);
                      const cellError = errors[cellKey];

                      if (column.dataType === 'FORMULA') {
                        const calculatedValue = evaluateFormula(
                          column.formula,
                          columns,
                          rowValues
                        );
                        return (
                          <TableCell
                            key={column.id}
                            className={cn(
                              'text-center',
                              isTotal && 'bg-muted'
                            )}
                          >
                            <div className="flex flex-col items-center gap-1">
                              <div className="flex items-center gap-1.5">
                                <Calculator className="h-3 w-3 text-muted-foreground" />
                                <span className="font-mono text-sm font-medium">
                                  {calculatedValue}
                                </span>
                              </div>
                              <span className="text-[10px] text-muted-foreground italic">
                                {getFormulaText(column)}
                              </span>
                            </div>
                          </TableCell>
                        );
                      }

                      return (
                        <TableCell
                          key={column.id}
                          className={cn(isTotal && 'bg-muted')}
                        >
                          <div className="space-y-1">
                            <Input
                              type={
                                column.dataType === 'NUMBER' ? 'number' : 'text'
                              }
                              value={getValue(row.id, column.id)}
                              onChange={(e) =>
                                handleValueChange(
                                  row.id,
                                  column.id,
                                  e.target.value
                                )
                              }
                              placeholder={
                                column.dataType === 'NUMBER'
                                  ? '0'
                                  : 'Enter value'
                              }
                              disabled={disabled || readOnly}
                              className={cn(
                                'h-9 text-center min-w-[100px]',
                                cellError && 'border-destructive'
                              )}
                              step={
                                column.dataType === 'NUMBER' ? 'any' : undefined
                              }
                            />
                            {cellError && (
                              <p className="text-[10px] text-destructive text-center">
                                {cellError}
                              </p>
                            )}
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  // ──────────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ──────────────────────────────────────────────────────────────────────
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <LayoutTemplate className="h-4 w-4" />
              {template.name}
              <Badge
                variant={template.type === 'COSTING' ? 'default' : 'secondary'}
                className="text-xs"
              >
                {template.type}
              </Badge>
            </CardTitle>
            {template.description && (
              <CardDescription className="mt-1">
                {template.description}
              </CardDescription>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Columns className="h-3 w-3" />
              {columns.length} cols
            </div>
            <div className="flex items-center gap-1">
              <Rows className="h-3 w-3" />
              {rows.length} rows
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!hasData && !hasAnyExtras ? (
          <div className="flex flex-col items-center justify-center py-8 text-center border rounded-lg bg-muted/30">
            <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              This template has no data structure defined.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header Extra Fields */}
            {hasHeaderExtras && (
              <OrderExtraValues
                extras={extras}
                values={extraValues}
                onChange={handleExtraChange}
                errors={extraErrors}
                disabled={disabled}
                readOnly={readOnly}
                sectionType="HEADER"
              />
            )}

            {/* Main Table + Media sidebar */}
            <div className="flex gap-4 items-start">
              {renderValueTable()}

              {/* Media Extra Fields (sidebar) */}
              {hasMediaExtras && (
                <div className="w-[220px] flex-shrink-0">
                  <OrderExtraValues
                    extras={extras}
                    values={extraValues}
                    onChange={handleExtraChange}
                    errors={extraErrors}
                    disabled={disabled}
                    readOnly={readOnly}
                    sectionType="MEDIA"
                  />
                </div>
              )}
            </div>

            {/* Footer Extra Fields */}
            {hasFooterExtras && (
              <OrderExtraValues
                extras={extras}
                values={extraValues}
                onChange={handleExtraChange}
                errors={extraErrors}
                disabled={disabled}
                readOnly={readOnly}
                sectionType="FOOTER"
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}