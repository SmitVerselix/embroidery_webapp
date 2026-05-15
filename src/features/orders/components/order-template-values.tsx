'use client';

import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import type {
  TemplateWithDetails,
  TemplateColumn,
  TemplateRow,
  TemplateExtra,
  DiscountType,
  TemplateBlock as TemplateBlockApi
} from '@/lib/api/types';
import { DISCOUNT_TYPES } from '@/lib/api/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Calculator,
  Columns,
  Rows,
  AlertCircle,
  LayoutTemplate,
  Percent,
  IndianRupee,
  Layers,
  ChevronDown,
  Check,
  Plus,
  Pencil,
  Trash2,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  parseFormula,
  getFormulaPreview
} from '@/features/templates/components/template-builder/formula-builder';
import OrderExtraValues, { type ExtraValuesMap } from './order-extra-values';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

// =============================================================================
// TYPES
// =============================================================================

export type TemplateValuesMap = Record<string, Record<string, string>>;
export type BlockValuesMap = Record<number, string>;

export type AdditionalCostItem = {
  /** Present when loaded from API (edit mode) */
  id?: string;
  costName: string;
  cost: string;
  notes: string;
  indexNo: number;
};

type TemplateBlock = {
  index: number;
  label: string;
};

type CostDraft = {
  costName: string;
  cost: string;
  notes: string;
};

type CostDraftErrors = {
  costName?: string;
  cost?: string;
};

const EMPTY_DRAFT: CostDraft = { costName: '', cost: '', notes: '' };

export interface OrderTemplateValuesProps {
  template: TemplateWithDetails;
  values: TemplateValuesMap;
  onChange: (values: TemplateValuesMap) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
  readOnly?: boolean;
  extraValues?: ExtraValuesMap;
  onExtraValuesChange?: (values: ExtraValuesMap) => void;
  extraErrors?: Record<string, string>;
  summary?: any;
  discountType?: DiscountType;
  discountValue?: string;
  onDiscountChange?: (type: DiscountType, value: string) => void;
  apiBlocks?: TemplateBlockApi[];
  blockValues?: BlockValuesMap;
  onBlockValuesChange?: (values: BlockValuesMap) => void;
  /** Controlled additional costs */
  additionalCosts?: AdditionalCostItem[];
  onAdditionalCostsChange?: (costs: AdditionalCostItem[]) => void;
}

// =============================================================================
// BLOCK HELPERS
// =============================================================================

function deriveBlocks(columns: TemplateColumn[]): TemplateBlock[] {
  const indices = new Set<number>();
  columns.forEach((col) => indices.add(col.blockIndex));
  if (indices.size === 0) indices.add(0);
  return Array.from(indices)
    .sort((a, b) => a - b)
    .map((index) => ({ index, label: `Block ${index}` }));
}

const blockColors = [
  'bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-800',
  'bg-green-100 dark:bg-green-950/40 text-green-800 dark:text-green-200 border-green-300 dark:border-green-800',
  'bg-purple-100 dark:bg-purple-950/40 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-800',
  'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800',
  'bg-pink-100 dark:bg-pink-950/40 text-pink-800 dark:text-pink-200 border-pink-300 dark:border-pink-800',
  'bg-teal-100 dark:bg-teal-950/40 text-teal-800 dark:text-teal-200 border-teal-300 dark:border-teal-800'
];

// =============================================================================
// FORMULA HELPERS — OPTIMISED
// =============================================================================

function getReferencedInputColumnIds(
  formula: string | null | undefined,
  columns: TemplateColumn[],
  keyToCol: Record<string, TemplateColumn>,
  _visited = new Set<string>()
): string[] {
  if (!formula) return [];
  const parsed = parseFormula(formula);
  if (!parsed) return [];

  const ids: string[] = [];

  parsed.steps.forEach((step: any) => {
    if (step.type === 'constant') return;
    const col = keyToCol[step.columnKey];
    if (!col) return;

    if (col.dataType === 'NUMBER' || col.dataType === 'TEXT') {
      if (!ids.includes(col.id)) ids.push(col.id);
    } else if (
      col.dataType === 'FORMULA' &&
      col.formula &&
      !_visited.has(col.key)
    ) {
      _visited.add(col.key);
      getReferencedInputColumnIds(
        col.formula,
        columns,
        keyToCol,
        _visited
      ).forEach((id) => {
        if (!ids.includes(id)) ids.push(id);
      });
    }
  });

  return ids;
}

function topologicalSortFormulas(
  formulaCols: TemplateColumn[],
  allColumns: TemplateColumn[]
): TemplateColumn[] {
  if (formulaCols.length === 0) return [];

  const formulaKeySet = new Set(formulaCols.map((c) => c.key));
  const keyToFormulaCol: Record<string, TemplateColumn> = {};
  formulaCols.forEach((c) => {
    keyToFormulaCol[c.key] = c;
  });

  const deps: Record<string, Set<string>> = {};
  formulaCols.forEach((col) => {
    deps[col.key] = new Set();
    if (!col.formula) return;
    const parsed = parseFormula(col.formula);
    if (!parsed) return;
    parsed.steps.forEach((step: any) => {
      if (
        step.type !== 'constant' &&
        formulaKeySet.has(step.columnKey) &&
        step.columnKey !== col.key
      ) {
        deps[col.key].add(step.columnKey);
      }
    });
  });

  const reverseDeps: Record<string, Set<string>> = {};
  formulaCols.forEach((c) => {
    reverseDeps[c.key] = new Set();
  });
  formulaCols.forEach((c) => {
    deps[c.key].forEach((depKey) => {
      reverseDeps[depKey]?.add(c.key);
    });
  });

  const inDegree: Record<string, number> = {};
  formulaCols.forEach((c) => {
    inDegree[c.key] = deps[c.key].size;
  });

  const queue: string[] = [];
  formulaCols.forEach((c) => {
    if (inDegree[c.key] === 0) queue.push(c.key);
  });

  const sorted: TemplateColumn[] = [];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const key = queue.shift()!;
    if (visited.has(key)) continue;
    visited.add(key);
    sorted.push(keyToFormulaCol[key]);

    reverseDeps[key]?.forEach((depKey) => {
      inDegree[depKey]--;
      if (inDegree[depKey] <= 0 && !visited.has(depKey)) {
        queue.push(depKey);
      }
    });
  }

  formulaCols.forEach((c) => {
    if (!visited.has(c.key)) sorted.push(c);
  });

  return sorted;
}

function evaluateParsedFormula(
  parsed: ReturnType<typeof parseFormula>,
  keyToValue: Record<string, number>
): number {
  if (!parsed || parsed.steps.length === 0) return 0;

  const stepVal = (step: any): number =>
    step.type === 'constant'
      ? (step.value ?? 0)
      : (keyToValue[step.columnKey] ?? 0);

  let result = stepVal(parsed.steps[0]);
  for (let i = 1; i < parsed.steps.length; i++) {
    const val = stepVal(parsed.steps[i]);
    switch (parsed.operators[i - 1]) {
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
        switch (mod.operator) {
          case '+':
            result += pct;
            break;
          case '-':
            result -= pct;
            break;
          case '*':
            result *= pct;
            break;
          case '/':
            result = pct !== 0 ? result / pct : 0;
            break;
          default:
            result += pct;
        }
        break;
      }
      case 'fixed': {
        switch (mod.operator) {
          case '+':
            result += mod.value;
            break;
          case '-':
            result -= mod.value;
            break;
          case '*':
            result *= mod.value;
            break;
          case '/':
            result = mod.value !== 0 ? result / mod.value : 0;
            break;
          default:
            result += mod.value;
        }
        break;
      }
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

  return result;
}

const formatAmount = (value: string | null | undefined): string => {
  if (!value) return '0';
  const num = parseFloat(value);
  if (isNaN(num)) return '0';
  return num === 0 ? '0' : num.toFixed(2);
};

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
  summary,
  discountType,
  discountValue,
  onDiscountChange,
  apiBlocks = [],
  blockValues = {},
  onBlockValuesChange,
  additionalCosts = [],
  onAdditionalCostsChange
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

  const blocks = useMemo(() => deriveBlocks(columns), [columns]);

  const orderedBlockColumns = useMemo(() => {
    const grouped: { block: TemplateBlock; columns: TemplateColumn[] }[] = [];
    blocks.forEach((block) => {
      const blockCols = columns.filter((col) => col.blockIndex === block.index);
      if (blockCols.length > 0) grouped.push({ block, columns: blockCols });
    });
    return grouped;
  }, [blocks, columns]);

  const flatOrderedColumns = useMemo(
    () => orderedBlockColumns.flatMap((g) => g.columns),
    [orderedBlockColumns]
  );

  const blockBoundaryColumnIds = useMemo(() => {
    const ids = new Set<string>();
    orderedBlockColumns.forEach((group, idx) => {
      if (idx > 0 && group.columns.length > 0) {
        ids.add(group.columns[0].id);
      }
    });
    return ids;
  }, [orderedBlockColumns]);

  const tableWrapperRef = useRef<HTMLDivElement>(null);

  // ── Additional costs local edit state ──────────────────────────────
  /** null = form hidden; -1 = adding new; ≥0 = editing existing index */
  const [editingCostIdx, setEditingCostIdx] = useState<number | null>(null);
  const [costDraft, setCostDraft] = useState<CostDraft>(EMPTY_DRAFT);
  const [costDraftErrors, setCostDraftErrors] = useState<CostDraftErrors>({});

  const openAddCost = useCallback(() => {
    setCostDraft(EMPTY_DRAFT);
    setEditingCostIdx(-1);
  }, []);

  const openEditCost = useCallback(
    (idx: number) => {
      const c = additionalCosts[idx];
      setCostDraft({ costName: c.costName, cost: c.cost, notes: c.notes });
      setEditingCostIdx(idx);
    },
    [additionalCosts]
  );

  const cancelCostEdit = useCallback(() => {
    setEditingCostIdx(null);
    setCostDraft(EMPTY_DRAFT);
    setCostDraftErrors({});
  }, []);

  const saveCostDraft = useCallback(() => {
    const errs: CostDraftErrors = {};
    if (!costDraft.costName.trim()) {
      errs.costName = 'Name is required';
    }
    if (costDraft.cost.trim() === '') {
      errs.cost = 'Cost is required';
    } else if (isNaN(Number(costDraft.cost))) {
      errs.cost = 'Must be a valid number';
    } else if (parseFloat(costDraft.cost) < 0) {
      errs.cost = 'Must be 0 or greater';
    }
    if (Object.keys(errs).length > 0) {
      setCostDraftErrors(errs);
      return;
    }
    setCostDraftErrors({});
    const updated = [...additionalCosts];
    if (editingCostIdx === -1) {
      updated.push({
        costName: costDraft.costName.trim(),
        cost: costDraft.cost,
        notes: costDraft.notes,
        indexNo: updated.length
      });
    } else if (editingCostIdx !== null && editingCostIdx >= 0) {
      updated[editingCostIdx] = {
        ...updated[editingCostIdx],
        costName: costDraft.costName.trim(),
        cost: costDraft.cost,
        notes: costDraft.notes
      };
    }
    const reindexed = updated.map((c, i) => ({ ...c, indexNo: i }));
    onAdditionalCostsChange?.(reindexed);
    cancelCostEdit();
  }, [
    costDraft,
    editingCostIdx,
    additionalCosts,
    onAdditionalCostsChange,
    cancelCostEdit
  ]);

  const deleteCost = useCallback(
    (idx: number) => {
      const updated = additionalCosts
        .filter((_, i) => i !== idx)
        .map((c, i) => ({ ...c, indexNo: i }));
      onAdditionalCostsChange?.(updated);
      if (editingCostIdx === idx) cancelCostEdit();
    },
    [additionalCosts, onAdditionalCostsChange, editingCostIdx, cancelCostEdit]
  );

  // ── JS-based sticky for canvas scroll ─────────────────────────────
  useEffect(() => {
    const el = tableWrapperRef.current;
    if (!el) return;

    const scrollContainer = el.closest(
      '[data-canvas-scroll]'
    ) as HTMLElement | null;
    if (!scrollContainer) return;

    let rafId: number | null = null;

    const update = () => {
      const zoom = parseFloat(
        scrollContainer.getAttribute('data-canvas-zoom') || '1'
      );
      const scrollRect = scrollContainer.getBoundingClientRect();
      const tableRect = el.getBoundingClientRect();

      const thead = el.querySelector('thead') as HTMLElement | null;
      if (thead) {
        const theadH = thead.getBoundingClientRect().height;
        if (
          tableRect.top < scrollRect.top &&
          tableRect.bottom > scrollRect.top + theadH + 20 * zoom
        ) {
          const offset = (scrollRect.top - tableRect.top) / zoom;
          thead.style.transform = `translateY(${offset}px)`;
          thead.style.position = 'relative';
          thead.style.zIndex = '20';
        } else {
          thead.style.transform = '';
          thead.style.position = '';
          thead.style.zIndex = '';
        }
      }

      const stickyCells =
        el.querySelectorAll<HTMLElement>('[data-sticky-left]');
      if (
        tableRect.left < scrollRect.left &&
        tableRect.right > scrollRect.left + 100 * zoom
      ) {
        const offset = (scrollRect.left - tableRect.left) / zoom;
        stickyCells.forEach((cell) => {
          cell.style.transform = `translateX(${offset}px)`;
          cell.style.position = 'relative';
          cell.style.zIndex = '15';
        });
      } else {
        stickyCells.forEach((cell) => {
          cell.style.transform = '';
          cell.style.position = '';
          cell.style.zIndex = '';
        });
      }
    };

    const onScroll = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        update();
      });
    };

    scrollContainer.addEventListener('scroll', onScroll, { passive: true });

    const observer = new MutationObserver(() => requestAnimationFrame(update));
    observer.observe(scrollContainer, {
      attributes: true,
      attributeFilter: ['data-canvas-zoom']
    });

    requestAnimationFrame(update);

    return () => {
      scrollContainer.removeEventListener('scroll', onScroll);
      observer.disconnect();
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  const hasMultipleBlocks = orderedBlockColumns.length > 1;
  const hasColumns = columns.length > 0;
  const hasRows = rows.length > 0;
  const hasData = hasColumns && hasRows;
  const hasHeaderExtras = headerExtras.length > 0;
  const hasFooterExtras = footerExtras.length > 0;
  const hasMediaExtras = mediaExtras.length > 0;
  const hasAnyExtras = hasHeaderExtras || hasFooterExtras || hasMediaExtras;
  const hasApiBlocks = apiBlocks.length > 0;
  const hasSummary =
    summary && typeof summary === 'object' && Object.keys(summary).length > 0;

  const nonTotalRows = useMemo(
    () => rows.filter((r) => r.rowType !== 'TOTAL'),
    [rows]
  );

  // ══════════════════════════════════════════════════════════════════════
  // ROW VISIBILITY
  // ══════════════════════════════════════════════════════════════════════

  const selectableRows = useMemo(
    () => rows.filter((r) => r.rowType !== 'TOTAL'),
    [rows]
  );

  const totalRows = useMemo(
    () => rows.filter((r) => r.rowType === 'TOTAL'),
    [rows]
  );

  const rowsWithValues = useMemo(() => {
    const set = new Set<string>();
    selectableRows.forEach((row) => {
      const rowVals = values[row.id] || {};
      const hasValue = columns.some((col) => {
        if (col.dataType === 'FORMULA') return false;
        const v = rowVals[col.id];
        return v !== undefined && v !== null && v.trim() !== '';
      });
      if (hasValue) set.add(row.id);
    });
    return set;
  }, [selectableRows, values, columns]);

  const [manuallyShownRows, setManuallyShownRows] = useState<Set<string>>(
    new Set()
  );

  const visibleRowIds = useMemo(() => {
    const set = new Set(rowsWithValues);
    manuallyShownRows.forEach((id) => {
      if (selectableRows.some((r) => r.id === id)) set.add(id);
    });
    return set;
  }, [rowsWithValues, manuallyShownRows, selectableRows]);

  const displayRows = useMemo(() => {
    const visibleNonTotal = selectableRows.filter((r) =>
      visibleRowIds.has(r.id)
    );
    if (visibleNonTotal.length > 0 && totalRows.length > 0) {
      return [...visibleNonTotal, ...totalRows];
    }
    return visibleNonTotal;
  }, [selectableRows, totalRows, visibleRowIds]);

  const toggleRowVisibility = useCallback(
    (rowId: string) => {
      if (rowsWithValues.has(rowId)) return;
      setManuallyShownRows((prev) => {
        const next = new Set(prev);
        if (next.has(rowId)) {
          next.delete(rowId);
        } else {
          next.add(rowId);
        }
        return next;
      });
    },
    [rowsWithValues]
  );

  const showAllRows = useCallback(() => {
    const allIds = new Set<string>();
    selectableRows.forEach((r) => {
      if (!rowsWithValues.has(r.id)) allIds.add(r.id);
    });
    setManuallyShownRows(allIds);
  }, [selectableRows, rowsWithValues]);

  const showOnlyWithValues = useCallback(() => {
    setManuallyShownRows(new Set());
  }, []);

  const hiddenRowCount = selectableRows.length - visibleRowIds.size;
  const allRowsVisible = hiddenRowCount === 0;

  // ══════════════════════════════════════════════════════════════════════
  // COLUMN VISIBILITY
  // ══════════════════════════════════════════════════════════════════════

  const columnsWithValues = useMemo(() => {
    if (!readOnly) return new Set(columns.map((c) => c.id));
    const set = new Set<string>();
    columns.forEach((col) => {
      const hasValue = rows.some((row) => {
        const v = values[row.id]?.[col.id];
        return v !== undefined && v !== null && v !== '' && v !== '—';
      });
      if (hasValue) set.add(col.id);
    });
    return set;
  }, [readOnly, columns, rows, values]);

  const visibleOrderedBlockColumns = useMemo(() => {
    return orderedBlockColumns
      .map((group) => ({
        ...group,
        columns: group.columns.filter((col) => columnsWithValues.has(col.id))
      }))
      .filter((group) => group.columns.length > 0);
  }, [orderedBlockColumns, columnsWithValues]);

  const visibleFlatOrderedColumns = useMemo(
    () => visibleOrderedBlockColumns.flatMap((g) => g.columns),
    [visibleOrderedBlockColumns]
  );

  const visibleBlockBoundaryColumnIds = useMemo(() => {
    const ids = new Set<string>();
    visibleOrderedBlockColumns.forEach((group, idx) => {
      if (idx > 0 && group.columns.length > 0) {
        ids.add(group.columns[0].id);
      }
    });
    return ids;
  }, [visibleOrderedBlockColumns]);

  const visibleHasMultipleBlocks = visibleOrderedBlockColumns.length > 1;

  // ──────────────────────────────────────────────────────────────────────
  // FORMULA DATA
  // ──────────────────────────────────────────────────────────────────────

  const keyToCol = useMemo(() => {
    const map: Record<string, TemplateColumn> = {};
    columns.forEach((col) => {
      map[col.key] = col;
    });
    return map;
  }, [columns]);

  const parsedFormulas = useMemo(() => {
    const map: Record<string, ReturnType<typeof parseFormula>> = {};
    columns.forEach((col) => {
      if (col.dataType === 'FORMULA' && col.formula) {
        map[col.key] = parseFormula(col.formula);
      }
    });
    return map;
  }, [columns]);

  const formulaInputDeps = useMemo(() => {
    const map: Record<string, string[]> = {};
    columns.forEach((col) => {
      if (col.dataType === 'FORMULA' && col.formula) {
        map[col.key] = getReferencedInputColumnIds(
          col.formula,
          columns,
          keyToCol
        );
      }
    });
    return map;
  }, [columns, keyToCol]);

  const sortedFormulaColumns = useMemo(() => {
    const formulaCols = columns.filter((c) => c.dataType === 'FORMULA');
    return topologicalSortFormulas(formulaCols, columns);
  }, [columns]);

  const computedFormulaValues = useMemo(() => {
    if (readOnly) return {};

    const result: Record<string, Record<string, string>> = {};

    nonTotalRows.forEach((row) => {
      const rowVals = values[row.id] || {};

      const kv: Record<string, number> = {};
      columns.forEach((col) => {
        if (col.dataType === 'NUMBER' || col.dataType === 'TEXT') {
          kv[col.key] = parseFloat(rowVals[col.id] || '') || 0;
        }
      });

      const computed: Record<string, string> = {};

      sortedFormulaColumns.forEach((col) => {
        const deps = formulaInputDeps[col.key];
        const complete =
          deps &&
          deps.length > 0 &&
          deps.every((id) => {
            const v = rowVals[id];
            return v !== undefined && v !== null && v.trim() !== '';
          });

        if (complete) {
          const parsed = parsedFormulas[col.key];
          if (parsed) {
            const val = evaluateParsedFormula(parsed, kv);
            kv[col.key] = val;
            computed[col.id] = Number.isInteger(val)
              ? String(val)
              : val.toFixed(2);
          } else {
            computed[col.id] = '—';
            kv[col.key] = 0;
          }
        } else {
          computed[col.id] = '—';
          kv[col.key] = 0;
        }
      });

      if (Object.keys(computed).length > 0) result[row.id] = computed;
    });

    return result;
  }, [
    readOnly,
    nonTotalRows,
    columns,
    values,
    sortedFormulaColumns,
    formulaInputDeps,
    parsedFormulas
  ]);

  const computedTotalFormulaValues = useMemo(() => {
    if (readOnly) return {};

    const totalRowsArr = rows.filter((r) => r.rowType === 'TOTAL');
    if (totalRowsArr.length === 0) return {};

    const result: Record<string, Record<string, string>> = {};

    totalRowsArr.forEach((totalRow) => {
      const computed: Record<string, string> = {};

      columns.forEach((col) => {
        if (col.dataType !== 'FORMULA') return;

        let sum = 0;
        let anyComplete = false;

        nonTotalRows.forEach((r) => {
          const perRowVal = computedFormulaValues[r.id]?.[col.id];
          if (perRowVal != null && perRowVal !== '—') {
            const num = parseFloat(perRowVal);
            if (!isNaN(num)) {
              sum += num;
              anyComplete = true;
            }
          }
        });

        computed[col.id] = anyComplete ? sum.toFixed(2) : '—';
      });

      result[totalRow.id] = computed;
    });

    return result;
  }, [readOnly, rows, nonTotalRows, columns, computedFormulaValues]);

  // ──────────────────────────────────────────────────────────────────────
  // CELL VALUE RESOLVERS
  // ──────────────────────────────────────────────────────────────────────

  const getEditModeFormulaValue = useCallback(
    (row: TemplateRow, column: TemplateColumn): string => {
      if (row.rowType === 'TOTAL') {
        return computedTotalFormulaValues[row.id]?.[column.id] ?? '—';
      }
      return computedFormulaValues[row.id]?.[column.id] ?? '—';
    },
    [computedFormulaValues, computedTotalFormulaValues]
  );

  const getReadOnlyFormulaValue = useCallback(
    (row: TemplateRow, column: TemplateColumn): string => {
      const stored = values[row.id]?.[column.id];

      if (row.rowType !== 'TOTAL') {
        return stored && stored !== '' ? formatAmount(stored) : '—';
      }

      if (stored && stored !== '') return formatAmount(stored);

      let sum = 0;
      let any = false;
      nonTotalRows.forEach((r) => {
        const v = values[r.id]?.[column.id];
        if (v && v !== '—' && v !== '') {
          const num = parseFloat(v);
          if (!isNaN(num)) {
            sum += num;
            any = true;
          }
        }
      });
      return any ? sum.toFixed(2) : '—';
    },
    [values, nonTotalRows]
  );

  // ──────────────────────────────────────────────────────────────────────
  // OTHER HANDLERS
  // ──────────────────────────────────────────────────────────────────────

  const handleValueChange = useCallback(
    (rowId: string, columnId: string, value: string) => {
      const newValues = { ...values };
      if (!newValues[rowId]) newValues[rowId] = {};
      newValues[rowId] = { ...newValues[rowId], [columnId]: value };
      onChange(newValues);
    },
    [values, onChange]
  );

  const getValue = useCallback(
    (rowId: string, columnId: string): string =>
      values[rowId]?.[columnId] || '',
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

  const handleBlockValueChange = useCallback(
    (blockIndex: number, templateBlockId: string) => {
      onBlockValuesChange?.({ ...blockValues, [blockIndex]: templateBlockId });
    },
    [blockValues, onBlockValuesChange]
  );

  const handleDiscountTypeChange = useCallback(
    (type: string) => {
      onDiscountChange?.(type as DiscountType, discountValue || '0');
    },
    [onDiscountChange, discountValue]
  );

  const handleDiscountValueChange = useCallback(
    (value: string) => {
      onDiscountChange?.(discountType || 'PERCENT', value);
    },
    [onDiscountChange, discountType]
  );

  // ──────────────────────────────────────────────────────────────────────
  // RENDER: Row Visibility Dropdown
  // ──────────────────────────────────────────────────────────────────────
  const renderRowVisibilityDropdown = () => {
    if (selectableRows.length === 0) return null;

    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant='outline'
            size='sm'
            className='h-7 gap-1.5 px-2.5 text-xs font-medium'
          >
            <Rows className='h-3 w-3' />
            Rows
            {hiddenRowCount > 0 && (
              <Badge
                variant='secondary'
                className='ml-0.5 h-4 min-w-[1rem] px-1 text-[10px]'
              >
                {visibleRowIds.size}/{selectableRows.length}
              </Badge>
            )}
            <ChevronDown className='h-3 w-3 opacity-50' />
          </Button>
        </PopoverTrigger>
        <PopoverContent className='w-[260px] p-0' align='start' side='bottom'>
          <div className='flex items-center justify-between border-b px-3 py-2'>
            <span className='text-xs font-semibold text-slate-700 dark:text-slate-300'>
              Toggle Rows
            </span>
            <div className='flex items-center gap-1'>
              <button
                type='button'
                className='text-primary rounded px-1.5 py-0.5 text-[10px] font-medium hover:bg-slate-100 dark:hover:bg-slate-800'
                onClick={showAllRows}
                disabled={allRowsVisible}
              >
                Show All
              </button>
              <span className='text-muted-foreground text-[10px]'>·</span>
              <button
                type='button'
                className='text-primary rounded px-1.5 py-0.5 text-[10px] font-medium hover:bg-slate-100 dark:hover:bg-slate-800'
                onClick={showOnlyWithValues}
                disabled={manuallyShownRows.size === 0}
              >
                Reset
              </button>
            </div>
          </div>

          <div className='max-h-[280px] overflow-y-auto py-1'>
            {selectableRows.map((row) => {
              const hasValues = rowsWithValues.has(row.id);
              const isVisible = visibleRowIds.has(row.id);
              const isLocked = hasValues;

              return (
                <label
                  key={row.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-2.5 px-3 py-1.5 transition-colors',
                    isLocked ? 'cursor-default opacity-80' : 'hover:bg-accent'
                  )}
                >
                  <Checkbox
                    checked={isVisible}
                    disabled={isLocked}
                    onCheckedChange={() => toggleRowVisibility(row.id)}
                    className='h-3.5 w-3.5'
                  />
                  <span className='min-w-0 flex-1 truncate text-xs'>
                    {row.label}
                  </span>
                  {hasValues && (
                    <span className='text-muted-foreground flex items-center gap-0.5 text-[10px]'>
                      <Check className='h-2.5 w-2.5 text-green-500' />
                      has data
                    </span>
                  )}
                </label>
              );
            })}
          </div>

          <div className='border-t px-3 py-1.5'>
            <p className='text-muted-foreground text-[10px]'>
              {visibleRowIds.size} of {selectableRows.length} rows visible. Rows
              with data cannot be hidden.
            </p>
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  // ──────────────────────────────────────────────────────────────────────
  // RENDER: Discount Controls
  // ──────────────────────────────────────────────────────────────────────
  const renderDiscountControls = () => {
    if (!onDiscountChange || readOnly) return null;
    return (
      <div className='rounded-lg border bg-slate-50/50 p-4 dark:bg-slate-950/20'>
        <h4 className='mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300'>
          Discount Settings
        </h4>
        <div className='flex gap-4'>
          <div className='space-y-1.5'>
            <Label className='text-muted-foreground text-xs'>
              Discount Type
            </Label>
            <Select
              value={discountType || 'PERCENT'}
              onValueChange={handleDiscountTypeChange}
              disabled={disabled}
            >
              <SelectTrigger className='h-9'>
                <SelectValue placeholder='Select type' />
              </SelectTrigger>
              <SelectContent>
                {DISCOUNT_TYPES.map((dt) => (
                  <SelectItem key={dt.value} value={dt.value}>
                    <span className='flex items-center gap-2'>
                      {dt.value === 'PERCENT' ? (
                        <Percent className='h-3 w-3' />
                      ) : (
                        <IndianRupee className='h-3 w-3' />
                      )}
                      {dt.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-1.5'>
            <Label className='text-muted-foreground text-xs'>
              Discount Value{' '}
              {discountType === 'PERCENT' || !discountType ? '(%)' : '(₹)'}
            </Label>
            <div className='flex items-center gap-2'>
              <div className='relative flex-1'>
                <Input
                  type='number'
                  value={discountValue || ''}
                  onChange={(e) => handleDiscountValueChange(e.target.value)}
                  placeholder='0'
                  disabled={disabled}
                  className='h-9 pr-8'
                  step='any'
                />
                <span className='text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 text-xs'>
                  {discountType === 'AMOUNT' ? '₹' : '%'}
                </span>
              </div>
              {/* +/- sign toggle — consistent with Final Calculation table */}
              <div className='flex h-9 overflow-hidden rounded-md border'>
                <button
                  type='button'
                  onClick={() =>
                    handleDiscountValueChange(
                      String(Math.abs(parseFloat(discountValue || '0') || 0))
                    )
                  }
                  disabled={disabled}
                  className={`flex w-9 items-center justify-center text-sm font-semibold transition-colors disabled:opacity-50 ${
                    !(parseFloat(discountValue || '0') < 0)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  +
                </button>
                <div className='bg-border w-px' />
                <button
                  type='button'
                  onClick={() => {
                    const n = Math.abs(parseFloat(discountValue || '0') || 0);
                    handleDiscountValueChange(n === 0 ? '0' : String(-n));
                  }}
                  disabled={disabled}
                  className={`flex w-9 items-center justify-center text-sm font-semibold transition-colors disabled:opacity-50 ${
                    parseFloat(discountValue || '0') < 0
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  −
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ──────────────────────────────────────────────────────────────────────
  // RENDER: Additional Costs Section
  // ──────────────────────────────────────────────────────────────────────
  const renderAdditionalCosts = () => {
    const canEdit = !readOnly && !!onAdditionalCostsChange;
    const hasCosts = additionalCosts.length > 0;
    const isFormOpen = editingCostIdx !== null;

    if (!canEdit && !hasCosts) return null;

    return (
      <div className='space-y-2 border-t pt-3'>
        {/* Section header */}
        <div className='flex items-center justify-between'>
          <span className='text-xs font-semibold text-slate-700 dark:text-slate-300'>
            Additional Costs
          </span>
          {canEdit && !isFormOpen && (
            <Button
              type='button'
              variant='outline'
              size='sm'
              className='h-7 gap-1 px-2 text-xs'
              onClick={openAddCost}
              disabled={disabled}
            >
              <Plus className='h-3 w-3' />
              Add Cost
            </Button>
          )}
        </div>

        {/* Existing cost rows */}
        {hasCosts && (
          <div className='space-y-1'>
            {additionalCosts.map((cost, idx) => {
              const isEditing = editingCostIdx === idx;
              if (isEditing) {
                // render inline edit form for this row
                return (
                  <CostEditForm
                    key={idx}
                    draft={costDraft}
                    onChange={(d) => {
                      setCostDraft(d);
                      setCostDraftErrors({});
                    }}
                    onSave={saveCostDraft}
                    onCancel={cancelCostEdit}
                    disabled={disabled}
                    errors={costDraftErrors}
                  />
                );
              }
              return (
                <div
                  key={idx}
                  className='bg-muted/40 flex items-start justify-between gap-3 rounded-md px-3 py-2 text-sm'
                >
                  <div className='min-w-0 flex-1'>
                    <div className='flex items-center gap-2'>
                      <span className='font-medium'>{cost.costName}</span>
                      <span className='text-muted-foreground font-mono text-xs'>
                        ₹{formatAmount(cost.cost)}
                      </span>
                    </div>
                    {cost.notes && (
                      <p className='text-muted-foreground mt-0.5 truncate text-xs'>
                        {cost.notes}
                      </p>
                    )}
                  </div>
                  {canEdit && !isFormOpen && (
                    <div className='flex shrink-0 items-center gap-1'>
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        className='h-6 w-6'
                        onClick={() => openEditCost(idx)}
                        disabled={disabled}
                      >
                        <Pencil className='h-3 w-3' />
                      </Button>
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        className='text-destructive hover:text-destructive h-6 w-6'
                        onClick={() => deleteCost(idx)}
                        disabled={disabled}
                      >
                        <Trash2 className='h-3 w-3' />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Inline add-new form (editingCostIdx === -1) */}
        {editingCostIdx === -1 && (
          <CostEditForm
            draft={costDraft}
            onChange={(d) => {
              setCostDraft(d);
              setCostDraftErrors({});
            }}
            onSave={saveCostDraft}
            onCancel={cancelCostEdit}
            disabled={disabled}
            errors={costDraftErrors}
          />
        )}

        {/* Total of additional costs */}
        {hasCosts && (
          <div className='flex items-center justify-between border-t pt-2 text-sm'>
            <span className='text-muted-foreground text-xs'>
              Additional Costs Total
            </span>
            <span className='font-mono font-medium'>
              ₹
              {formatAmount(
                String(
                  additionalCosts.reduce(
                    (sum, c) => sum + (parseFloat(c.cost) || 0),
                    0
                  )
                )
              )}
            </span>
          </div>
        )}
      </div>
    );
  };

  // ──────────────────────────────────────────────────────────────────────
  // RENDER: Value Table
  // ──────────────────────────────────────────────────────────────────────
  const renderValueTable = () => {
    if (!hasData) {
      return (
        <div className='bg-muted/30 flex min-w-0 flex-1 items-center justify-center rounded-lg border py-12'>
          <div className='text-center'>
            <AlertCircle className='text-muted-foreground mx-auto mb-2 h-8 w-8' />
            <p className='text-muted-foreground text-sm'>
              This template has no columns or rows defined.
            </p>
          </div>
        </div>
      );
    }

    if (displayRows.length === 0) {
      return (
        <div className='bg-muted/30 flex min-w-0 flex-1 items-center justify-center rounded-lg border py-12'>
          <div className='text-center'>
            <Rows className='text-muted-foreground mx-auto mb-2 h-8 w-8' />
            <p className='text-muted-foreground text-sm'>
              No rows with values. Use the Rows dropdown to show rows.
            </p>
          </div>
        </div>
      );
    }

    const renderBlockColumns = visibleOrderedBlockColumns;
    const renderFlatColumns = visibleFlatOrderedColumns;
    const renderBoundaryIds = visibleBlockBoundaryColumnIds;
    const renderHasMultipleBlocks = visibleHasMultipleBlocks;

    return (
      <div ref={tableWrapperRef} className='min-w-0 flex-1 rounded-lg border'>
        {/* Single-block selector */}
        {!renderHasMultipleBlocks && hasApiBlocks && !readOnly && (
          <div className='flex items-center gap-3 border-b px-4 py-2.5'>
            <Layers className='text-muted-foreground h-4 w-4' />
            <span className='text-muted-foreground text-xs font-medium'>
              Block:
            </span>
            <Select
              value={blockValues[blocks[0]?.index ?? 0] || ''}
              onValueChange={(val) =>
                handleBlockValueChange(blocks[0]?.index ?? 0, val)
              }
              disabled={disabled}
            >
              <SelectTrigger className='h-8 w-[220px] text-xs'>
                <SelectValue placeholder='Select block...' />
              </SelectTrigger>
              <SelectContent>
                {apiBlocks.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {!renderHasMultipleBlocks &&
          hasApiBlocks &&
          readOnly &&
          blockValues[blocks[0]?.index ?? 0] && (
            <div className='flex items-center gap-3 border-b px-4 py-2.5'>
              <Layers className='text-muted-foreground h-4 w-4' />
              <span className='text-muted-foreground text-xs font-medium'>
                Block:
              </span>
              <Badge variant='outline' className='text-xs'>
                {apiBlocks.find(
                  (b) => b.id === blockValues[blocks[0]?.index ?? 0]
                )?.name || '—'}
              </Badge>
            </div>
          )}

        <div>
          <Table>
            <TableHeader>
              {/* Block group headers */}
              {renderHasMultipleBlocks && renderFlatColumns.length > 0 && (
                <TableRow className='bg-muted border-b-2'>
                  <TableHead
                    data-sticky-left
                    className='bg-muted border-r font-semibold'
                    rowSpan={2}
                  >
                    Row / Item
                  </TableHead>
                  {renderBlockColumns.map((group, idx) => {
                    const selectedBlockId =
                      blockValues[group.block.index] || '';
                    const selectedBlock = apiBlocks.find(
                      (b) => b.id === selectedBlockId
                    );
                    return (
                      <TableHead
                        key={group.block.index}
                        colSpan={group.columns.length}
                        className={cn(
                          'border-x text-center text-sm font-bold',
                          blockColors[idx % blockColors.length]
                        )}
                      >
                        <div className='flex flex-col items-center gap-1.5 py-1'>
                          <div className='flex items-center gap-2'>
                            <Layers className='h-3.5 w-3.5' />
                            <span>{group.block.label}</span>
                          </div>
                          {hasApiBlocks &&
                            (readOnly ? (
                              selectedBlock ? (
                                <Badge
                                  variant='outline'
                                  className='text-[10px] font-normal'
                                >
                                  {selectedBlock.name}
                                </Badge>
                              ) : null
                            ) : (
                              <Select
                                value={selectedBlockId}
                                onValueChange={(val) =>
                                  handleBlockValueChange(group.block.index, val)
                                }
                                disabled={disabled}
                              >
                                <SelectTrigger className='h-7 w-full max-w-[200px] border-current/20 bg-white/50 text-xs dark:bg-black/20'>
                                  <SelectValue placeholder='Select block...' />
                                </SelectTrigger>
                                <SelectContent>
                                  {apiBlocks.map((b) => (
                                    <SelectItem key={b.id} value={b.id}>
                                      {b.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ))}
                        </div>
                      </TableHead>
                    );
                  })}
                </TableRow>
              )}

              {/* Column headers */}
              <TableRow className='bg-muted'>
                {!renderHasMultipleBlocks && (
                  <TableHead
                    data-sticky-left
                    className='bg-muted font-semibold'
                  >
                    Row / Item
                  </TableHead>
                )}
                {renderFlatColumns.map((column) => (
                  <TableHead
                    key={column.id}
                    className={cn(
                      'text-center',
                      renderHasMultipleBlocks &&
                        renderBoundaryIds.has(column.id) &&
                        'border-l-border border-l-2'
                    )}
                  >
                    <div className='flex flex-col items-center gap-1'>
                      <span className='font-semibold'>{column.label}</span>
                      <div className='flex items-center gap-1'>
                        <Badge
                          variant={
                            column.dataType === 'NUMBER'
                              ? 'default'
                              : column.dataType === 'FORMULA'
                                ? 'outline'
                                : 'secondary'
                          }
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
                ))}
              </TableRow>
            </TableHeader>

            <TableBody>
              {displayRows.map((row) => {
                const isTotal = row.rowType === 'TOTAL';

                return (
                  <TableRow
                    key={row.id}
                    className={cn(isTotal && 'bg-muted font-semibold')}
                  >
                    <TableCell
                      data-sticky-left
                      className={cn(
                        'font-medium',
                        isTotal ? 'bg-muted' : 'bg-background'
                      )}
                    >
                      <div className='flex items-center gap-2'>
                        <span>{row.label}</span>
                        {isTotal && (
                          <Badge variant='outline' className='text-[10px]'>
                            TOTAL
                          </Badge>
                        )}
                      </div>
                    </TableCell>

                    {renderFlatColumns.map((column) => {
                      const cellKey = getErrorKey(row.id, column.id);
                      const cellError = errors[cellKey];

                      if (column.dataType === 'FORMULA') {
                        const displayValue = readOnly
                          ? getReadOnlyFormulaValue(row, column)
                          : getEditModeFormulaValue(row, column);

                        return (
                          <TableCell
                            key={column.id}
                            className={cn(
                              'text-center',
                              isTotal && 'bg-muted',
                              renderHasMultipleBlocks &&
                                renderBoundaryIds.has(column.id) &&
                                'border-l-border border-l-2'
                            )}
                          >
                            <div className='flex flex-col items-center gap-1'>
                              <div className='flex items-center gap-1.5'>
                                <Calculator className='text-muted-foreground h-3 w-3' />
                                <span className='font-mono text-sm font-medium'>
                                  {displayValue}
                                </span>
                              </div>
                              {!isTotal && (
                                <span className='text-muted-foreground text-[10px] italic'>
                                  {getFormulaText(column)}
                                </span>
                              )}
                            </div>
                          </TableCell>
                        );
                      }

                      if (isTotal) {
                        const apiVal = values[row.id]?.[column.id];
                        const displayValue =
                          column.dataType === 'NUMBER'
                            ? formatAmount(apiVal || '')
                            : apiVal || '—';
                        return (
                          <TableCell
                            key={column.id}
                            className={cn(
                              'bg-muted text-center',
                              renderHasMultipleBlocks &&
                                renderBoundaryIds.has(column.id) &&
                                'border-l-border border-l-2'
                            )}
                          >
                            <span className='font-mono text-sm font-medium'>
                              {displayValue}
                            </span>
                          </TableCell>
                        );
                      }

                      return (
                        <TableCell
                          key={column.id}
                          className={cn(
                            renderHasMultipleBlocks &&
                              renderBoundaryIds.has(column.id) &&
                              'border-l-border border-l-2'
                          )}
                        >
                          <div className='space-y-1'>
                            <Input
                              type={
                                column.dataType === 'NUMBER' ? 'number' : 'text'
                              }
                              value={
                                readOnly && column.dataType === 'NUMBER'
                                  ? formatAmount(getValue(row.id, column.id))
                                  : getValue(row.id, column.id)
                              }
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
                                'h-7 w-[5.5rem] text-center text-xs',
                                cellError && 'border-destructive'
                              )}
                              step={
                                column.dataType === 'NUMBER' ? 'any' : undefined
                              }
                            />
                            {cellError && (
                              <p className='text-destructive text-center text-[10px]'>
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

          {/* Summary + Additional Costs Section */}
          {(hasSummary ||
            additionalCosts.length > 0 ||
            (!readOnly && onAdditionalCostsChange)) && (
            <div className='mt-4 flex justify-end border-t'>
              <div className='w-full max-w-sm space-y-2.5 rounded-lg p-4 text-sm'>
                {hasSummary && (
                  <>
                    <div className='flex items-center justify-between gap-8'>
                      <span className='text-muted-foreground'>Total</span>
                      <span className='font-medium tabular-nums'>
                        {formatAmount(summary.total)}
                      </span>
                    </div>
                    <div className='flex items-center justify-between gap-8'>
                      <span className='text-muted-foreground'>Discount</span>
                      <span className='font-medium tabular-nums'>
                        {summary.discount != null
                          ? `${formatAmount(summary.discount)}${
                              summary.discountType === 'PERCENT'
                                ? '%'
                                : summary.discountType === 'AMOUNT'
                                  ? ' ₹'
                                  : ''
                            }`
                          : '—'}
                      </span>
                    </div>
                    <div className='flex items-center justify-between gap-8'>
                      <span className='text-muted-foreground'>
                        Discount Amount
                      </span>
                      <span
                        className={cn(
                          'font-medium tabular-nums',
                          parseFloat(summary.discountAmount || '0') > 0 &&
                            'text-destructive'
                        )}
                      >
                        {parseFloat(summary.discountAmount || '0') > 0
                          ? '− '
                          : ''}
                        {formatAmount(summary.discountAmount)}
                      </span>
                    </div>
                    <Separator />

                    {/* Per-template additional costs (read-only view) */}
                    {summary.additionalTemplateCosts &&
                      summary.additionalTemplateCosts.length > 0 && (
                        <>
                          {summary.additionalTemplateCosts.map(
                            (c: any, idx: any) => (
                              <div
                                key={idx}
                                className='flex items-start justify-between gap-8'
                              >
                                <div className='min-w-0'>
                                  <span className='text-muted-foreground'>
                                    {c.costName}
                                  </span>
                                  {c.notes && (
                                    <p className='text-muted-foreground mt-0.5 truncate text-xs italic'>
                                      {c.notes}
                                    </p>
                                  )}
                                </div>
                                <span className='shrink-0 font-mono font-medium tabular-nums'>
                                  ₹{formatAmount(String(c.cost))}
                                </span>
                              </div>
                            )
                          )}
                          <Separator />
                        </>
                      )}

                    <div className='flex items-center justify-between gap-8 pt-0.5'>
                      <span className='font-semibold'>
                        Final Payable Amount
                      </span>
                      <span className='text-base font-semibold tabular-nums'>
                        {formatAmount(summary.finalPayableAmount)}
                      </span>
                    </div>
                  </>
                )}

                {/* Edit-mode additional costs (create/edit pages) */}
                {renderAdditionalCosts()}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ──────────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ──────────────────────────────────────────────────────────────────────
  return (
    <Card>
      <CardHeader className='pb-3'>
        <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
          <div className='min-w-0 flex-1'>
            <CardTitle className='flex flex-wrap items-center gap-2 text-base'>
              <LayoutTemplate className='h-4 w-4' />
              <span className='truncate'>{template.name}</span>
              <Badge
                variant={template.type === 'COSTING' ? 'default' : 'secondary'}
                className='text-xs'
              >
                {template.type}
              </Badge>
              {renderRowVisibilityDropdown()}
            </CardTitle>
            {template.description && (
              <CardDescription className='mt-1'>
                {template.description}
              </CardDescription>
            )}
          </div>
          {hasData && (
            <div className='text-muted-foreground flex shrink-0 items-center gap-3 text-xs'>
              {hasMultipleBlocks && (
                <div className='flex items-center gap-1'>
                  <Layers className='h-3 w-3' />
                  {orderedBlockColumns.length} blocks
                </div>
              )}
              {columns.length > 0 && (
                <div className='flex items-center gap-1'>
                  <Columns className='h-3 w-3' />
                  {columns.length} cols
                </div>
              )}
              {rows.length > 0 && (
                <div className='flex items-center gap-1'>
                  <Rows className='h-3 w-3' />
                  {visibleRowIds.size}/{rows.length} rows
                </div>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!hasData && !hasAnyExtras ? (
          <div className='bg-muted/30 flex flex-col items-center justify-center rounded-lg border py-8 text-center'>
            <AlertCircle className='text-muted-foreground mb-2 h-8 w-8' />
            <p className='text-muted-foreground text-sm'>
              This template has no data structure defined.
            </p>
          </div>
        ) : (
          <div className='space-y-4'>
            {hasMultipleBlocks && (
              <div className='flex flex-wrap items-center gap-2'>
                {orderedBlockColumns.map((group, idx) => (
                  <div
                    key={group.block.index}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium',
                      blockColors[idx % blockColors.length]
                    )}
                  >
                    <Layers className='h-3 w-3' />
                    {group.block.label}
                    <Badge
                      variant='secondary'
                      className='ml-1 px-1.5 py-0 text-[10px]'
                    >
                      {group.columns.length} col
                      {group.columns.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {hasHeaderExtras && (
              <OrderExtraValues
                extras={extras}
                values={extraValues}
                onChange={handleExtraChange}
                errors={extraErrors}
                disabled={disabled}
                readOnly={readOnly}
                sectionType='HEADER'
              />
            )}

            <div className='flex items-start gap-4'>
              {renderValueTable()}
              {hasMediaExtras && (
                <div className='w-[220px] flex-shrink-0'>
                  <OrderExtraValues
                    extras={extras}
                    values={extraValues}
                    onChange={handleExtraChange}
                    errors={extraErrors}
                    disabled={disabled}
                    readOnly={readOnly}
                    sectionType='MEDIA'
                  />
                </div>
              )}
            </div>

            {renderDiscountControls()}

            {hasFooterExtras && (
              <OrderExtraValues
                extras={extras}
                values={extraValues}
                onChange={handleExtraChange}
                errors={extraErrors}
                disabled={disabled}
                readOnly={readOnly}
                sectionType='FOOTER'
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// COST EDIT FORM — small isolated sub-component
// =============================================================================

interface CostEditFormProps {
  draft: CostDraft;
  onChange: (d: CostDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  disabled?: boolean;
  errors?: CostDraftErrors;
}

function CostEditForm({
  draft,
  onChange,
  onSave,
  onCancel,
  disabled,
  errors = {}
}: CostEditFormProps) {
  return (
    <div className='rounded-md border bg-slate-50/70 p-3 dark:bg-slate-900/40'>
      <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
        <div className='space-y-1'>
          <Label className='text-muted-foreground text-xs'>
            Name <span className='text-destructive'>*</span>
          </Label>
          <Input
            value={draft.costName}
            onChange={(e) => onChange({ ...draft, costName: e.target.value })}
            placeholder='e.g. Transport'
            className={cn(
              'h-8 text-sm',
              errors.costName && 'border-destructive'
            )}
            disabled={disabled}
            autoFocus
          />
          {errors.costName && (
            <p className='text-destructive text-[10px] leading-tight'>
              {errors.costName}
            </p>
          )}
        </div>
        <div className='space-y-1'>
          <Label className='text-muted-foreground text-xs'>
            Amount (₹) <span className='text-destructive'>*</span>
          </Label>
          <Input
            type='number'
            value={draft.cost}
            onChange={(e) => onChange({ ...draft, cost: e.target.value })}
            placeholder='0'
            className={cn('h-8 text-sm', errors.cost && 'border-destructive')}
            disabled={disabled}
            step='any'
            min='0'
          />
          {errors.cost && (
            <p className='text-destructive text-[10px] leading-tight'>
              {errors.cost}
            </p>
          )}
        </div>
      </div>
      <div className='mt-2 space-y-1'>
        <Label className='text-muted-foreground text-xs'>Notes</Label>
        <Textarea
          value={draft.notes}
          onChange={(e) => onChange({ ...draft, notes: e.target.value })}
          placeholder='Optional notes…'
          className='min-h-[56px] resize-none text-sm'
          disabled={disabled}
          rows={2}
        />
      </div>
      <div className='mt-3 flex items-center justify-end gap-2'>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          className='h-7 px-2 text-xs'
          onClick={onCancel}
          disabled={disabled}
        >
          <X className='mr-1 h-3 w-3' />
          Cancel
        </Button>
        <Button
          type='button'
          size='sm'
          className='h-7 px-3 text-xs'
          onClick={onSave}
          disabled={disabled}
        >
          <Check className='mr-1 h-3 w-3' />
          Save
        </Button>
      </div>
    </div>
  );
}
