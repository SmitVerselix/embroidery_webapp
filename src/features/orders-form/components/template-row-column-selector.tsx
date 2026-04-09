'use client';

import { useCallback, useMemo, useState, useEffect } from 'react';
import type { TemplateWithDetails } from '@/lib/api/types';
import type { TemplateValuesMap } from '@/features/orders/components/order-template-values';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Layers } from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

export type SelectedRowsColumnsMap = {
  rows: Set<string>;
  columns: Set<string>;
};

/**
 * A single manual value override: which row+column the user typed a value for.
 */
export type ManualValue = {
  rowId: string;
  columnId: string;
  value: string;
};

/**
 * Per-row block selection: maps rowId → blockIndex.
 */
export type RowBlockSelectionsMap = Record<string, number>;

/**
 * Flags indicating which cells were saved with isManual=true on the API.
 * Structure: rowId → columnId → true
 */
export type ManualFlagsMap = Record<string, Record<string, boolean>>;

interface TemplateRowColumnSelectorProps {
  template: TemplateWithDetails;
  /** Values from the referenced order (calculatedValue keyed by rowId → columnId) */
  values: TemplateValuesMap;
  selection: SelectedRowsColumnsMap;
  onSelectionChange: (selection: SelectedRowsColumnsMap) => void;
  /**
   * Called whenever a manual value changes.
   * Provides the full current list of manual values for this template instance.
   */
  onManualValuesChange?: (manualValues: ManualValue[]) => void;
  /**
   * Called whenever per-row block selections change.
   */
  onRowBlockSelectionsChange?: (map: RowBlockSelectionsMap) => void;
  /**
   * Optional initial manual values to pre-fill editable cells.
   */
  initialManualValues?: ManualValue[];
  /**
   * Optional initial per-row block selections (for edit mode).
   */
  initialRowBlockSelections?: RowBlockSelectionsMap;
  /**
   * Flags for cells that were saved as manual (isManual: true from API).
   * These cells are rendered as editable inputs (pre-filled with the saved value)
   * so the user can update them.
   */
  manualFlags?: ManualFlagsMap;
  disabled?: boolean;
}

// =============================================================================
// HELPERS
// =============================================================================

function isNullOrZero(v: string | null | undefined): boolean {
  if (v == null || v === '') return true;
  if (
    v === '0' ||
    v === '0.0' ||
    v === '0.00' ||
    v === '0.000' ||
    v === '0.0000'
  )
    return true;
  const n = parseFloat(v);
  return !isNaN(n) && n === 0;
}

function formatDisplay(v: string | null | undefined): string {
  if (v == null || v === '') return '—';
  const n = parseFloat(v);
  return !isNaN(n) ? n.toFixed(2) : v;
}

// =============================================================================
// BLOCK HELPERS
// =============================================================================

type BlockGroup = {
  blockIndex: number;
  label: string;
  columns: TemplateWithDetails['columns'];
};

const blockColors = [
  'bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-800',
  'bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-200 border-green-300 dark:border-green-800',
  'bg-purple-100 dark:bg-purple-950/40 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-800',
  'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800',
  'bg-pink-100 dark:bg-pink-950/40 text-pink-800 dark:text-pink-200 border-pink-300 dark:border-pink-800',
  'bg-teal-100 dark:bg-teal-950/40 text-teal-800 dark:text-teal-200 border-teal-300 dark:border-teal-800'
];

const blockBorderColors = [
  'border-blue-200 dark:border-blue-800',
  'border-green-200 dark:border-green-800',
  'border-purple-200 dark:border-purple-800',
  'border-amber-200 dark:border-amber-800',
  'border-pink-200 dark:border-pink-800',
  'border-teal-200 dark:border-teal-800'
];

// =============================================================================
// COMPONENT
// =============================================================================

export default function TemplateRowColumnSelector({
  template,
  values,
  selection,
  onSelectionChange,
  onManualValuesChange,
  onRowBlockSelectionsChange,
  initialManualValues,
  initialRowBlockSelections,
  manualFlags,
  disabled = false
}: TemplateRowColumnSelectorProps) {
  const rows = useMemo(
    () => [...(template.rows || [])].sort((a, b) => a.orderNo - b.orderNo),
    [template.rows]
  );

  /**
   * finalCalcColumns: ALL columns where isFinalCalculation === true.
   */
  const finalCalcColumns = useMemo(
    () =>
      (template.columns || [])
        .filter((c) => c.isFinalCalculation === true)
        .sort((a, b) => a.orderNo - b.orderNo),
    [template.columns]
  );

  /**
   * Group finalCalcColumns by blockIndex.
   */
  const blockGroups: BlockGroup[] = useMemo(() => {
    const map = new Map<number, typeof finalCalcColumns>();
    finalCalcColumns.forEach((col) => {
      const bi = col.blockIndex ?? 0;
      if (!map.has(bi)) map.set(bi, []);
      map.get(bi)!.push(col);
    });

    // Build a lookup from block orderNo → block name
    const blockNameMap = new Map<number, string>();
    (template.blocks || []).forEach((block: any) => {
      blockNameMap.set(block.orderNo, block.name);
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([blockIndex, columns]) => ({
        blockIndex,
        label: blockNameMap.get(blockIndex) || '',
        columns: columns.sort((a, b) => a.orderNo - b.orderNo)
      }));
  }, [finalCalcColumns, template.blocks]);

  const hasMultipleBlocks = blockGroups.length > 1;
  const hasFinalCalcCols = finalCalcColumns.length > 0;
  const defaultBlockIndex =
    blockGroups.length > 0 ? blockGroups[0].blockIndex : 0;

  // ── Per-row block selection state ────────────────────────────────────
  const [rowBlockSelections, setRowBlockSelections] =
    useState<RowBlockSelectionsMap>(() => {
      const init: RowBlockSelectionsMap = {};
      rows.forEach((r) => {
        init[r.id] = defaultBlockIndex;
      });
      if (initialRowBlockSelections) {
        Object.entries(initialRowBlockSelections).forEach(([rowId, bi]) => {
          init[rowId] = bi;
        });
      }
      return init;
    });

  // Re-seed row block selections when template changes
  useEffect(() => {
    const defBI = blockGroups.length > 0 ? blockGroups[0].blockIndex : 0;
    setRowBlockSelections((prev) => {
      const next: RowBlockSelectionsMap = {};
      rows.forEach((r) => {
        next[r.id] = prev[r.id] ?? defBI;
      });
      if (initialRowBlockSelections) {
        Object.entries(initialRowBlockSelections).forEach(([rowId, bi]) => {
          next[rowId] = bi;
        });
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.id]);

  /** Get the columns that apply for a given row (based on its block selection). */
  const getColumnsForRow = useCallback(
    (rowId: string) => {
      if (!hasMultipleBlocks) return finalCalcColumns;
      const blockIdx = rowBlockSelections[rowId] ?? defaultBlockIndex;
      return finalCalcColumns.filter((c) => (c.blockIndex ?? 0) === blockIdx);
    },
    [hasMultipleBlocks, rowBlockSelections, finalCalcColumns, defaultBlockIndex]
  );

  /**
   * Determine whether a cell needs manual input.
   * A cell is "manually editable" when:
   *   (a) the API value is null/zero (no computed value exists), OR
   *   (b) it was previously saved with isManual=true (user entered it before)
   *
   * In case (b) the API value IS a real number — we pre-fill localValues with
   * it so the user sees and can edit their previously saved entry.
   */
  const isCellManuallyEditable = useCallback(
    (
      rowId: string,
      columnId: string,
      apiVal: string | null | undefined
    ): boolean => {
      if (isNullOrZero(apiVal)) return true;
      if (manualFlags?.[rowId]?.[columnId] === true) return true;
      return false;
    },
    [manualFlags]
  );

  /**
   * Build localValues — the editable state for all cells.
   *
   * Priority for each cell:
   *  1. initialManualValues override (edit-mode restore from parent)
   *  2. Saved-manual cell with a real API value → pre-fill with that value
   *  3. Default: raw API value (empty string if no computed value)
   */
  const buildLocalValues = useCallback(() => {
    const init: Record<string, Record<string, string>> = {};
    rows.forEach((row) => {
      init[row.id] = {};
      finalCalcColumns.forEach((col) => {
        const apiVal = values[row.id]?.[col.id] ?? '';
        const isSavedManual = manualFlags?.[row.id]?.[col.id] === true;

        // 1. Explicit override from parent
        const manualOverride = initialManualValues?.find(
          (mv) => mv.rowId === row.id && mv.columnId === col.id
        );
        if (manualOverride) {
          init[row.id][col.id] = manualOverride.value;
        } else if (isSavedManual && !isNullOrZero(apiVal)) {
          // 2. Previously saved as manual with a real value — show it so user can edit
          init[row.id][col.id] = apiVal;
        } else {
          // 3. Use raw API value (may be empty for cells with no computed value)
          init[row.id][col.id] = apiVal;
        }
      });
    });
    return init;
  }, [rows, finalCalcColumns, values, initialManualValues, manualFlags]);

  const [localValues, setLocalValues] =
    useState<Record<string, Record<string, string>>>(buildLocalValues);

  // Re-seed if the referenced order or template changes
  useEffect(() => {
    setLocalValues(buildLocalValues());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.id]);

  // ── Bubble up manual values whenever localValues, selection, or block changes ──
  useEffect(() => {
    if (!onManualValuesChange) return;
    const manuals: ManualValue[] = [];
    selection.rows.forEach((rowId) => {
      const rowCols = getColumnsForRow(rowId);
      rowCols.forEach((col) => {
        const apiVal = values[rowId]?.[col.id];
        // Emit manual values for any cell the user needs to enter/has entered manually
        if (isCellManuallyEditable(rowId, col.id, apiVal)) {
          const typed = localValues[rowId]?.[col.id] ?? '';
          if (typed.trim() !== '') {
            manuals.push({ rowId, columnId: col.id, value: typed.trim() });
          }
        }
      });
    });
    onManualValuesChange(manuals);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localValues, selection.rows, rowBlockSelections]);

  // ── Row block change handler ────────────────────────────────────────
  const handleRowBlockChange = useCallback(
    (rowId: string, blockIndex: number) => {
      setRowBlockSelections((prev) => {
        const next = { ...prev, [rowId]: blockIndex };
        onRowBlockSelectionsChange?.(next);
        return next;
      });
    },
    [onRowBlockSelectionsChange]
  );

  // ── Row toggle ──────────────────────────────────────────────────────
  const toggleRow = useCallback(
    (rowId: string) => {
      const next = new Set(selection.rows);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      onSelectionChange({ ...selection, rows: next });
    },
    [selection, onSelectionChange]
  );

  const toggleAllRows = useCallback(() => {
    const allSelected = rows.every((r) => selection.rows.has(r.id));
    const next = allSelected
      ? new Set<string>()
      : new Set(rows.map((r) => r.id));
    onSelectionChange({ ...selection, rows: next });
  }, [rows, selection, onSelectionChange]);

  // ── Cell edit ───────────────────────────────────────────────────────
  const handleCellChange = useCallback(
    (rowId: string, columnId: string, value: string) => {
      setLocalValues((prev) => ({
        ...prev,
        [rowId]: { ...(prev[rowId] || {}), [columnId]: value }
      }));
    },
    []
  );

  // ── Derived ─────────────────────────────────────────────────────────
  const allRowsChecked =
    rows.length > 0 && rows.every((r) => selection.rows.has(r.id));
  const someRowsChecked =
    rows.some((r) => selection.rows.has(r.id)) && !allRowsChecked;

  if (rows.length === 0) {
    return (
      <div className='text-muted-foreground rounded-md border p-6 text-center text-sm'>
        No rows defined for this template.
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════

  return (
    <div className='space-y-2'>
      {/* Summary badges */}
      <div className='flex flex-wrap items-center gap-2 px-1'>
        <Badge variant='outline' className='text-xs font-normal'>
          {selection.rows.size}/{rows.length} rows selected
        </Badge>
        {hasFinalCalcCols && (
          <Badge
            variant='outline'
            className='border-amber-300 bg-amber-50 text-[10px] font-normal text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400'
          >
            {finalCalcColumns.length} final-calc{' '}
            {finalCalcColumns.length === 1 ? 'column' : 'columns'}
          </Badge>
        )}
        {hasMultipleBlocks && (
          <Badge variant='outline' className='text-[10px] font-normal'>
            <Layers className='mr-1 h-3 w-3' />
            {blockGroups.length} blocks (per-row)
          </Badge>
        )}
      </div>

      <div className='overflow-auto rounded-md border'>
        <table className='w-full text-sm'>
          <thead>
            {/* Block grouping header row (only when multiple blocks) */}
            {hasMultipleBlocks && hasFinalCalcCols && (
              <tr className='bg-muted/30 border-b-2'>
                {/* Checkbox + Row + Block columns */}
                <th
                  className='bg-muted/30 border-r px-3 py-2'
                  colSpan={hasMultipleBlocks && !disabled ? 3 : 2}
                />
                {blockGroups.map((group, idx) => (
                  <th
                    key={group.blockIndex}
                    colSpan={group.columns.length}
                    className={cn(
                      'border-x px-3 py-2 text-center text-xs font-bold',
                      blockColors[idx % blockColors.length]
                    )}
                  >
                    <div className='flex flex-col items-center gap-0.5'>
                      <div className='flex items-center gap-1.5'>
                        <Layers className='h-3 w-3' />
                        <span>Block {group.blockIndex}</span>
                      </div>
                      {group.label && (
                        <span className='text-[10px] font-normal opacity-80'>
                          ({group.label})
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            )}

            <tr className='bg-muted/50 border-b'>
              <th className='w-10 px-3 py-2.5'>
                <div className='flex items-center justify-center'>
                  <Checkbox
                    checked={
                      allRowsChecked
                        ? true
                        : someRowsChecked
                          ? 'indeterminate'
                          : false
                    }
                    onCheckedChange={toggleAllRows}
                    disabled={disabled}
                    aria-label='Select all rows'
                  />
                </div>
              </th>

              <th className='min-w-[160px] px-3 py-2.5 text-left font-medium'>
                Row
              </th>

              {/* Block column header (only when multiple blocks and not disabled) */}
              {hasMultipleBlocks && !disabled && (
                <th className='min-w-[120px] px-3 py-2.5 text-left font-medium'>
                  Block
                </th>
              )}

              {/* All final-calc columns from all blocks */}
              {hasFinalCalcCols &&
                blockGroups.map((group) => {
                  const origIdx = blockGroups.indexOf(group);
                  return group.columns.map((col, colIdx) => (
                    <th
                      key={col.id}
                      className={cn(
                        'min-w-[160px] px-3 py-2.5 text-left font-medium',
                        hasMultipleBlocks && [
                          colIdx === 0 &&
                            blockBorderColors[
                              origIdx % blockBorderColors.length
                            ],
                          colIdx === 0 && 'border-l-2'
                        ]
                      )}
                    >
                      <div className='flex items-center gap-1.5'>
                        <span>{col.label}</span>
                        <Badge
                          variant='outline'
                          className='border-amber-300 bg-amber-50 text-[9px] font-normal text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400'
                        >
                          Final
                        </Badge>
                        {!hasMultipleBlocks && blockGroups.length === 1 && (
                          <Badge
                            variant='outline'
                            className='text-[9px] font-normal opacity-60'
                          >
                            B{group.blockIndex}
                          </Badge>
                        )}
                      </div>
                    </th>
                  ));
                })}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const isChecked = selection.rows.has(row.id);
              const isFinalCalcRow = (row as any).isFinalCalculation === true;
              const rowBlockIdx =
                rowBlockSelections[row.id] ?? defaultBlockIndex;

              return (
                <tr
                  key={row.id}
                  className={cn(
                    'border-b transition-colors',
                    isChecked ? 'bg-primary/5' : 'opacity-40'
                  )}
                >
                  <td className='px-3 py-2'>
                    <div className='flex items-center justify-center'>
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleRow(row.id)}
                        disabled={disabled}
                        aria-label={`Select row ${row.label}`}
                      />
                    </div>
                  </td>

                  <td className='px-3 py-2'>
                    <div className='flex items-center gap-1.5'>
                      <span className='truncate text-xs font-medium'>
                        {row.label}
                      </span>
                      {row.rowType === 'TOTAL' && (
                        <Badge
                          variant='secondary'
                          className='text-[9px] font-normal'
                        >
                          Total
                        </Badge>
                      )}
                      {isFinalCalcRow && (
                        <Badge
                          variant='outline'
                          className='border-amber-300 bg-amber-50 text-[9px] font-normal text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400'
                        >
                          Final Calc
                        </Badge>
                      )}
                    </div>
                  </td>

                  {/* Per-row block selector (only when multiple blocks and not disabled) */}
                  {hasMultipleBlocks && !disabled && (
                    <td className='px-3 py-2'>
                      {isChecked ? (
                        <Select
                          value={String(rowBlockIdx)}
                          onValueChange={(v) =>
                            handleRowBlockChange(row.id, parseInt(v, 10))
                          }
                          disabled={disabled}
                        >
                          <SelectTrigger className='h-7 w-28 text-xs'>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {blockGroups.map((g) => (
                              <SelectItem
                                key={g.blockIndex}
                                value={String(g.blockIndex)}
                              >
                                <span className='flex items-center gap-1.5'>
                                  <Layers className='h-3 w-3' />
                                  Block {g.blockIndex}
                                  {g.label && (
                                    <span className='text-muted-foreground text-[10px]'>
                                      ({g.label})
                                    </span>
                                  )}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className='text-muted-foreground text-xs'>—</span>
                      )}
                    </td>
                  )}

                  {/* Value cells for ALL columns from ALL blocks */}
                  {hasFinalCalcCols &&
                    blockGroups.map((group) => {
                      const origIdx = blockGroups.indexOf(group);
                      const isActiveBlock =
                        !hasMultipleBlocks || group.blockIndex === rowBlockIdx;

                      return group.columns.map((col, colIdx) => {
                        const apiVal = values[row.id]?.[col.id];
                        const localVal = localValues[row.id]?.[col.id] ?? '';

                        const isCellActive = isActiveBlock;
                        const isEditable = isCellManuallyEditable(
                          row.id,
                          col.id,
                          apiVal
                        );

                        // "Required" warning only applies when there is no computed value at all
                        const needsManualEntry = isNullOrZero(apiVal);
                        const isEmptyRequired =
                          isChecked &&
                          isCellActive &&
                          needsManualEntry &&
                          localVal.trim() === '';

                        return (
                          <td
                            key={col.id}
                            className={cn(
                              'px-3 py-2',
                              hasMultipleBlocks &&
                                colIdx === 0 && [
                                  'border-l-2',
                                  blockBorderColors[
                                    origIdx % blockBorderColors.length
                                  ]
                                ],
                              isChecked &&
                                hasMultipleBlocks &&
                                !isCellActive &&
                                'bg-muted/20'
                            )}
                          >
                            {!isChecked ? (
                              <span className='text-muted-foreground font-mono text-xs tabular-nums'>
                                —
                              </span>
                            ) : !isCellActive ? (
                              <span className='text-muted-foreground/50 font-mono text-xs tabular-nums'>
                                —
                              </span>
                            ) : isEditable && !disabled ? (
                              /* ── Editable: no computed value OR previously saved as manual ── */
                              <div className='flex flex-col gap-0.5'>
                                <Input
                                  type='text'
                                  inputMode='decimal'
                                  placeholder='Enter value'
                                  className={cn(
                                    'h-7 w-36 text-xs',
                                    isEmptyRequired &&
                                      'border-red-400 ring-1 ring-red-300 focus-visible:ring-red-400 dark:border-red-600 dark:ring-red-700'
                                  )}
                                  value={localVal}
                                  onChange={(e) =>
                                    handleCellChange(
                                      row.id,
                                      col.id,
                                      e.target.value
                                    )
                                  }
                                />
                                {isEmptyRequired && (
                                  <span className='text-[10px] font-medium text-red-500 dark:text-red-400'>
                                    Required
                                  </span>
                                )}
                              </div>
                            ) : isEditable && disabled ? (
                              /* ── Read-only view of a manually-entered value ── */
                              <Input
                                type='text'
                                className='h-7 w-36 text-xs font-medium tabular-nums disabled:opacity-70'
                                disabled
                                readOnly
                                value={formatDisplay(localVal || apiVal)}
                              />
                            ) : (
                              /* ── Computed (non-manual) value ── */
                              <span className='font-mono text-xs tabular-nums'>
                                {formatDisplay(apiVal)}
                              </span>
                            )}
                          </td>
                        );
                      });
                    })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
