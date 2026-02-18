'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Plus,
  Trash2,
  Calculator,
  Percent,
  Hash,
  AlertCircle,
  AlertTriangle,
  ArrowUpDown,
  Sigma
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TemplateColumn } from '@/lib/api/types';

// =============================================================================
// TYPES
// =============================================================================

export type Operator = '+' | '-' | '*' | '/' | '%' | '^';

export type FormulaStep = {
  id: string;
  columnKey: string;
};

export type ModifierType =
  | 'percentage'
  | 'fixed'
  | 'round'
  | 'abs'
  | 'ceil'
  | 'floor'
  | 'min'
  | 'max';

export type FormulaModifier = {
  id: string;
  type: ModifierType;
  operator: '+' | '-';
  value: number;
};

export type FormulaData = {
  steps: FormulaStep[];
  operators: Operator[];
  modifiers: FormulaModifier[];
};

// =============================================================================
// CONSTANTS
// =============================================================================

const OPERATORS: { label: string; value: Operator; symbol: string }[] = [
  { label: 'Add', value: '+', symbol: '+' },
  { label: 'Subtract', value: '-', symbol: '−' },
  { label: 'Multiply', value: '*', symbol: '×' },
  { label: 'Divide', value: '/', symbol: '÷' },
  { label: 'Modulo', value: '%', symbol: '%' },
  { label: 'Power', value: '^', symbol: '^' }
];

const MODIFIER_OPERATORS: { label: string; value: '+' | '-' }[] = [
  { label: 'Add', value: '+' },
  { label: 'Subtract', value: '-' }
];

const MODIFIER_TYPES: {
  value: ModifierType;
  label: string;
  description: string;
  icon: typeof Percent;
  hasOperator: boolean;
  hasValue: boolean;
  valueLabel?: string;
  valuePlaceholder?: string;
  valueMin?: number;
  valueMax?: number;
  valueStep?: number;
  defaultValue: number;
}[] = [
  {
    value: 'percentage',
    label: '% Percentage',
    description: 'Add/subtract a percentage of the result',
    icon: Percent,
    hasOperator: true,
    hasValue: true,
    valueLabel: 'Percent',
    valueMin: 0,
    valueMax: 1000,
    valueStep: 1,
    defaultValue: 10
  },
  {
    value: 'fixed',
    label: '# Fixed Number',
    description: 'Add/subtract a fixed number',
    icon: Hash,
    hasOperator: true,
    hasValue: true,
    valueLabel: 'Amount',
    valueStep: 0.01,
    defaultValue: 100
  },
  {
    value: 'round',
    label: '≈ Round',
    description: 'Round to N decimal places',
    icon: ArrowUpDown,
    hasOperator: false,
    hasValue: true,
    valueLabel: 'Decimals',
    valuePlaceholder: '2',
    valueMin: 0,
    valueMax: 10,
    valueStep: 1,
    defaultValue: 2
  },
  {
    value: 'abs',
    label: '|x| Absolute',
    description: 'Convert result to absolute (positive) value',
    icon: Sigma,
    hasOperator: false,
    hasValue: false,
    defaultValue: 0
  },
  {
    value: 'ceil',
    label: '⌈x⌉ Ceil',
    description: 'Round up to nearest integer',
    icon: ArrowUpDown,
    hasOperator: false,
    hasValue: false,
    defaultValue: 0
  },
  {
    value: 'floor',
    label: '⌊x⌋ Floor',
    description: 'Round down to nearest integer',
    icon: ArrowUpDown,
    hasOperator: false,
    hasValue: false,
    defaultValue: 0
  },
  {
    value: 'min',
    label: '↓ Min Cap',
    description: 'Set minimum value (result cannot go below this)',
    icon: ArrowUpDown,
    hasOperator: false,
    hasValue: true,
    valueLabel: 'Min value',
    valueStep: 0.01,
    defaultValue: 0
  },
  {
    value: 'max',
    label: '↑ Max Cap',
    description: 'Set maximum value (result cannot exceed this)',
    icon: ArrowUpDown,
    hasOperator: false,
    hasValue: true,
    valueLabel: 'Max value',
    valueStep: 0.01,
    defaultValue: 99999
  }
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const generateId = () => Math.random().toString(36).substring(2, 9);

const getOperatorSymbol = (op: Operator): string => {
  const found = OPERATORS.find((o) => o.value === op);
  return found?.symbol || op;
};

/** Map display symbol back to Operator value */
const symbolToOperator = (symbol: string): Operator | null => {
  const map: Record<string, Operator> = {
    '+': '+',
    '−': '-',
    '×': '*',
    '÷': '/',
    '%': '%',
    '^': '^'
  };
  return map[symbol] ?? null;
};

const getModifierConfig = (type: ModifierType) =>
  MODIFIER_TYPES.find((m) => m.value === type);

// =============================================================================
// FORMULA STRING FORMAT
// =============================================================================
// The formula is stored and sent as a human-readable string using column KEYS.
//
// Examples:
//   Simple:        "qty_0 × rate_0"
//   With modifier: "(qty_0 × rate_0) + 10%"
//   With function: "ROUND((qty_0 × rate_0) + 10%, 2)"
//   Complex:       "ABS(ROUND((qty_0 + rate_0) − 100, 2))"
//
// Operator symbols: + (add), − (subtract), × (multiply), ÷ (divide), % (modulo), ^ (power)
// Note: "−" is U+2212 (minus sign), not ASCII hyphen.
// =============================================================================

/**
 * Parse formula string to FormulaData.
 * Supports both:
 *   - Legacy JSON format: '{"steps":["qty_0"],"operators":["+"],"modifiers":[...]}'
 *   - New readable string format: "qty_0 × rate_0"
 */
export const parseFormula = (
  formulaString: string | null
): FormulaData | null => {
  if (!formulaString) return null;

  const trimmed = formulaString.trim();
  if (!trimmed) return null;

  // ── Try legacy JSON format first ──────────────────────────────────────────
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.steps && Array.isArray(parsed.steps)) {
        return {
          steps: (parsed.steps as string[]).map((columnKey: string) => ({
            id: generateId(),
            columnKey
          })),
          operators: parsed.operators || [],
          modifiers: (parsed.modifiers || []).map(
            (mod: Omit<FormulaModifier, 'id'>) => ({
              id: generateId(),
              ...mod
            })
          )
        };
      }
    } catch {
      // Not valid JSON, fall through to string parser
    }
  }

  // ── Parse readable string format ──────────────────────────────────────────
  try {
    return parseFormulaString(trimmed);
  } catch {
    return null;
  }
};

/**
 * Parse a human-readable formula string into FormulaData.
 *
 * Strategy:
 * 1. Unwrap outer functions (ROUND, ABS, CEIL, FLOOR, MAX/min-cap, MIN/max-cap)
 *    to extract modifiers (outermost first → they were applied last).
 * 2. Strip optional parentheses around the core expression.
 * 3. Parse trailing percentage / fixed modifiers (e.g. "+ 10%", "− 50").
 * 4. Parse the remaining core tokens into steps + operators.
 */
function parseFormulaString(formula: string): FormulaData {
  const modifiers: FormulaModifier[] = [];
  let expr = formula.trim();

  // ── 1. Unwrap outer functions (peel from outside in) ─────────────────────
  // We loop because functions can nest: ABS(ROUND(..., 2))
  let changed = true;
  while (changed) {
    changed = false;

    // ROUND(inner, N)
    const roundMatch = expr.match(/^ROUND\((.+),\s*(\d+)\)$/);
    if (roundMatch) {
      modifiers.unshift({
        id: generateId(),
        type: 'round',
        operator: '+',
        value: parseInt(roundMatch[2], 10)
      });
      expr = roundMatch[1].trim();
      changed = true;
      continue;
    }

    // ABS(inner)
    const absMatch = expr.match(/^ABS\((.+)\)$/);
    if (absMatch) {
      modifiers.unshift({
        id: generateId(),
        type: 'abs',
        operator: '+',
        value: 0
      });
      expr = absMatch[1].trim();
      changed = true;
      continue;
    }

    // CEIL(inner)
    const ceilMatch = expr.match(/^CEIL\((.+)\)$/);
    if (ceilMatch) {
      modifiers.unshift({
        id: generateId(),
        type: 'ceil',
        operator: '+',
        value: 0
      });
      expr = ceilMatch[1].trim();
      changed = true;
      continue;
    }

    // FLOOR(inner)
    const floorMatch = expr.match(/^FLOOR\((.+)\)$/);
    if (floorMatch) {
      modifiers.unshift({
        id: generateId(),
        type: 'floor',
        operator: '+',
        value: 0
      });
      expr = floorMatch[1].trim();
      changed = true;
      continue;
    }

    // MAX(inner, value)  →  min cap (result cannot go below value)
    const maxMatch = expr.match(/^MAX\((.+),\s*([\d.]+)\)$/);
    if (maxMatch) {
      modifiers.unshift({
        id: generateId(),
        type: 'min',
        operator: '+',
        value: parseFloat(maxMatch[2])
      });
      expr = maxMatch[1].trim();
      changed = true;
      continue;
    }

    // MIN(inner, value)  →  max cap (result cannot exceed value)
    const minMatch = expr.match(/^MIN\((.+),\s*([\d.]+)\)$/);
    if (minMatch) {
      modifiers.unshift({
        id: generateId(),
        type: 'max',
        operator: '+',
        value: parseFloat(minMatch[2])
      });
      expr = minMatch[1].trim();
      changed = true;
      continue;
    }
  }

  // ── 2. Parse trailing percentage/fixed modifiers ─────────────────────────
  // Pattern: "(core) + 10%" or "(core) − 50"
  // We peel from right to left since they were appended in order.
  changed = true;
  while (changed) {
    changed = false;

    // Percentage modifier: ... [+|−] N%
    const pctMatch = expr.match(/^(.+)\s+([+\u2212])\s+([\d.]+)%$/);
    if (pctMatch) {
      modifiers.unshift({
        id: generateId(),
        type: 'percentage',
        operator: pctMatch[2] === '+' ? '+' : '-',
        value: parseFloat(pctMatch[3])
      });
      expr = pctMatch[1].trim();
      changed = true;
      continue;
    }

    // Fixed modifier: ... [+|−] N  (only if core is wrapped in parens)
    // We check parens to avoid confusing "key1 + key2" with a fixed modifier
    const fixedMatch = expr.match(/^(\(.+\))\s+([+\u2212])\s+([\d.]+)$/);
    if (fixedMatch) {
      modifiers.unshift({
        id: generateId(),
        type: 'fixed',
        operator: fixedMatch[2] === '+' ? '+' : '-',
        value: parseFloat(fixedMatch[3])
      });
      expr = fixedMatch[1].trim();
      changed = true;
      continue;
    }
  }

  // ── 3. Strip wrapping parentheses ────────────────────────────────────────
  if (expr.startsWith('(') && expr.endsWith(')')) {
    // Only strip if these parens are balanced and wrap the whole expression
    let depth = 0;
    let wrapsAll = true;
    for (let i = 0; i < expr.length; i++) {
      if (expr[i] === '(') depth++;
      if (expr[i] === ')') depth--;
      if (depth === 0 && i < expr.length - 1) {
        wrapsAll = false;
        break;
      }
    }
    if (wrapsAll) {
      expr = expr.slice(1, -1).trim();
    }
  }

  // ── 4. Tokenize core expression into steps and operators ─────────────────
  // Split by operator symbols: +  −  ×  ÷  %  ^
  // Operator symbols are surrounded by spaces in our format.
  const tokens = expr.split(/\s+/);

  const steps: FormulaStep[] = [];
  const operators: Operator[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const op = symbolToOperator(token);

    if (op !== null) {
      operators.push(op);
    } else if (token) {
      steps.push({
        id: generateId(),
        columnKey: token
      });
    }
  }

  return { steps, operators, modifiers };
}

/**
 * Convert FormulaData to string for API.
 * Produces a human-readable formula using column KEYS and operator symbols.
 * e.g. "qty_0 × rate_0", "ROUND((qty_0 × rate_0) + 10%, 2)"
 */
export const stringifyFormula = (data: FormulaData): string => {
  if (data.steps.length === 0) return '';

  // Build main expression using column keys
  let expression = data.steps
    .map((step, index) => {
      const key = step.columnKey;
      if (index === 0) return key;
      const op = data.operators[index - 1];
      return `${getOperatorSymbol(op)} ${key}`;
    })
    .join(' ');

  // Wrap in parentheses if there are modifiers
  if (data.modifiers.length > 0) {
    expression = `(${expression})`;
  }

  // Apply modifiers (same logic as getFormulaPreview)
  data.modifiers.forEach((mod) => {
    const symbol = mod.operator === '+' ? '+' : '−';
    switch (mod.type) {
      case 'percentage':
        expression += ` ${symbol} ${mod.value}%`;
        break;
      case 'fixed':
        expression += ` ${symbol} ${mod.value}`;
        break;
      case 'round':
        expression = `ROUND(${expression}, ${mod.value})`;
        break;
      case 'abs':
        expression = `ABS(${expression})`;
        break;
      case 'ceil':
        expression = `CEIL(${expression})`;
        break;
      case 'floor':
        expression = `FLOOR(${expression})`;
        break;
      case 'min':
        expression = `MAX(${expression}, ${mod.value})`;
        break;
      case 'max':
        expression = `MIN(${expression}, ${mod.value})`;
        break;
    }
  });

  return expression;
};

/**
 * Create human-readable formula preview (uses column LABELS for display)
 */
export const getFormulaPreview = (
  data: FormulaData,
  columns: TemplateColumn[]
): string => {
  if (data.steps.length === 0) return '';

  const getColumnLabel = (key: string) => {
    const col = columns.find((c) => c.key === key);
    return col?.label || `[${key}]`;
  };

  // Build main expression
  let expression = data.steps
    .map((step, index) => {
      const label = getColumnLabel(step.columnKey);
      if (index === 0) return label;
      const op = data.operators[index - 1];
      return `${getOperatorSymbol(op)} ${label}`;
    })
    .join(' ');

  // Wrap in parentheses if there are modifiers
  if (data.modifiers.length > 0) {
    expression = `(${expression})`;
  }

  // Add modifiers
  data.modifiers.forEach((mod) => {
    const symbol = mod.operator === '+' ? '+' : '−';
    switch (mod.type) {
      case 'percentage':
        expression += ` ${symbol} ${mod.value}%`;
        break;
      case 'fixed':
        expression += ` ${symbol} ${mod.value}`;
        break;
      case 'round':
        expression = `ROUND(${expression}, ${mod.value})`;
        break;
      case 'abs':
        expression = `ABS(${expression})`;
        break;
      case 'ceil':
        expression = `CEIL(${expression})`;
        break;
      case 'floor':
        expression = `FLOOR(${expression})`;
        break;
      case 'min':
        expression = `MAX(${expression}, ${mod.value})`;
        break;
      case 'max':
        expression = `MIN(${expression}, ${mod.value})`;
        break;
    }
  });

  return expression;
};

/**
 * Validate formula with detailed error messages
 */
export const validateFormula = (
  data: FormulaData,
  availableColumns: TemplateColumn[]
): string | null => {
  // Must have at least one step
  if (data.steps.length === 0) {
    return 'Please add at least one column to the formula';
  }

  // Check all columns exist and are selected
  const availableKeys = new Set(availableColumns.map((c) => c.key));
  const usedKeys: string[] = [];

  for (let i = 0; i < data.steps.length; i++) {
    const step = data.steps[i];
    if (!step.columnKey || step.columnKey === '') {
      return `Please select a column for step ${i + 1}`;
    }
    if (!availableKeys.has(step.columnKey)) {
      return `Column "${step.columnKey}" in step ${i + 1} is not available. Please select a different column.`;
    }
    usedKeys.push(step.columnKey);
  }

  // Check operators count matches steps
  if (
    data.steps.length > 1 &&
    data.operators.length !== data.steps.length - 1
  ) {
    return 'Missing operators between columns';
  }

  // Validate each operator
  for (let i = 0; i < data.operators.length; i++) {
    const op = data.operators[i];
    if (!OPERATORS.some((o) => o.value === op)) {
      return `Invalid operator "${op}" between step ${i + 1} and ${i + 2}`;
    }
  }

  // Validate modifiers
  for (let i = 0; i < data.modifiers.length; i++) {
    const mod = data.modifiers[i];
    const config = getModifierConfig(mod.type);

    if (!config) {
      return `Invalid modifier type "${mod.type}"`;
    }

    if (config.hasValue) {
      if (mod.value === undefined || mod.value === null || isNaN(mod.value)) {
        return `Please enter a valid number for the ${config.label} modifier`;
      }
      if (mod.type === 'percentage' && (mod.value < 0 || mod.value > 1000)) {
        return 'Percentage must be between 0 and 1000';
      }
      if (
        mod.type === 'round' &&
        (mod.value < 0 || mod.value > 10 || !Number.isInteger(mod.value))
      ) {
        return 'Round decimals must be a whole number between 0 and 10';
      }
    }

    if (config.hasOperator && !mod.operator) {
      return `Please select an operator for the ${config.label} modifier`;
    }
  }

  // Check min < max if both exist
  const minMod = data.modifiers.find((m) => m.type === 'min');
  const maxMod = data.modifiers.find((m) => m.type === 'max');
  if (minMod && maxMod && minMod.value >= maxMod.value) {
    return 'Min cap value must be less than max cap value';
  }

  return null;
};

/**
 * Check if formula data references any invalid columns
 */
const hasInvalidColumns = (
  data: FormulaData,
  availableColumns: TemplateColumn[]
): boolean => {
  const availableKeys = new Set(availableColumns.map((c) => c.key));
  return data.steps.some(
    (step) => step.columnKey && !availableKeys.has(step.columnKey)
  );
};

/**
 * Clean formula data by removing steps with invalid column references
 */
const cleanFormulaData = (
  data: FormulaData,
  availableColumns: TemplateColumn[]
): FormulaData => {
  const availableKeys = new Set(availableColumns.map((c) => c.key));

  const validSteps = data.steps.filter(
    (step) => !step.columnKey || availableKeys.has(step.columnKey)
  );

  const newOperators = data.operators.slice(
    0,
    Math.max(0, validSteps.length - 1)
  );

  return {
    steps: validSteps,
    operators: newOperators,
    modifiers: data.modifiers
  };
};

// =============================================================================
// PROPS
// =============================================================================

interface FormulaBuilderProps {
  value: FormulaData;
  onChange: (data: FormulaData) => void;
  availableColumns: TemplateColumn[];
  error?: string | null;
  disabled?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function FormulaBuilder({
  value,
  onChange,
  availableColumns,
  error,
  disabled = false
}: FormulaBuilderProps) {
  const [hasShownInvalidWarning, setHasShownInvalidWarning] = useState(false);
  const [showModifierMenu, setShowModifierMenu] = useState(false);

  // Filter only NUMBER columns
  const numberColumns = useMemo(
    () => availableColumns.filter((col) => col.dataType === 'NUMBER'),
    [availableColumns]
  );

  // Build a lookup map for quick label resolution
  const columnLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    numberColumns.forEach((col) => map.set(col.key, col.label));
    return map;
  }, [numberColumns]);

  // Check if current formula has invalid column references
  const hasInvalidRefs = useMemo(
    () => hasInvalidColumns(value, numberColumns),
    [value, numberColumns]
  );

  // Auto-clean invalid columns when availableColumns changes
  useEffect(() => {
    if (hasInvalidRefs && !hasShownInvalidWarning) {
      setHasShownInvalidWarning(true);
      const cleanedData = cleanFormulaData(value, numberColumns);
      if (JSON.stringify(cleanedData) !== JSON.stringify(value)) {
        onChange(cleanedData);
      }
    }
  }, [hasInvalidRefs, value, numberColumns, onChange, hasShownInvalidWarning]);

  useEffect(() => {
    if (!hasInvalidRefs) {
      setHasShownInvalidWarning(false);
    }
  }, [hasInvalidRefs]);

  // ==========================================================================
  // STEP HANDLERS
  // ==========================================================================

  const addStep = useCallback(() => {
    const newStep: FormulaStep = {
      id: generateId(),
      columnKey: ''
    };

    const newOperators =
      value.steps.length > 0
        ? [...value.operators, '+' as Operator]
        : value.operators;

    onChange({
      ...value,
      steps: [...value.steps, newStep],
      operators: newOperators
    });
  }, [value, onChange]);

  const updateStep = useCallback(
    (stepId: string, columnKey: string) => {
      onChange({
        ...value,
        steps: value.steps.map((step) =>
          step.id === stepId ? { ...step, columnKey } : step
        )
      });
    },
    [value, onChange]
  );

  const removeStep = useCallback(
    (stepId: string) => {
      const stepIndex = value.steps.findIndex((s) => s.id === stepId);
      if (stepIndex === -1) return;

      const newSteps = value.steps.filter((s) => s.id !== stepId);

      let newOperators = [...value.operators];
      if (stepIndex > 0) {
        newOperators.splice(stepIndex - 1, 1);
      } else if (newOperators.length > 0) {
        newOperators.splice(0, 1);
      }

      onChange({
        ...value,
        steps: newSteps,
        operators: newOperators
      });
    },
    [value, onChange]
  );

  const updateOperator = useCallback(
    (index: number, operator: Operator) => {
      const newOperators = [...value.operators];
      newOperators[index] = operator;
      onChange({
        ...value,
        operators: newOperators
      });
    },
    [value, onChange]
  );

  // ==========================================================================
  // MODIFIER HANDLERS
  // ==========================================================================

  const addModifier = useCallback(
    (type: ModifierType) => {
      const config = getModifierConfig(type);
      if (!config) return;

      // Prevent duplicate single-instance modifiers (abs, ceil, floor)
      if (['abs', 'ceil', 'floor'].includes(type)) {
        const exists = value.modifiers.some((m) => m.type === type);
        if (exists) return;
      }

      // Prevent duplicate min/max
      if (type === 'min' || type === 'max') {
        const exists = value.modifiers.some((m) => m.type === type);
        if (exists) return;
      }

      const newModifier: FormulaModifier = {
        id: generateId(),
        type,
        operator: config.hasOperator ? '+' : '+',
        value: config.defaultValue
      };

      onChange({
        ...value,
        modifiers: [...value.modifiers, newModifier]
      });
      setShowModifierMenu(false);
    },
    [value, onChange]
  );

  const updateModifier = useCallback(
    (modifierId: string, updates: Partial<FormulaModifier>) => {
      onChange({
        ...value,
        modifiers: value.modifiers.map((mod) =>
          mod.id === modifierId ? { ...mod, ...updates } : mod
        )
      });
    },
    [value, onChange]
  );

  const removeModifier = useCallback(
    (modifierId: string) => {
      onChange({
        ...value,
        modifiers: value.modifiers.filter((mod) => mod.id !== modifierId)
      });
    },
    [value, onChange]
  );

  // ==========================================================================
  // COMPUTED VALUES
  // ==========================================================================

  const preview = useMemo(
    () => getFormulaPreview(value, availableColumns),
    [value, availableColumns]
  );

  const validationError = useMemo(
    () => validateFormula(value, numberColumns),
    [value, numberColumns]
  );

  const displayError = error || validationError;
  const hasSteps = value.steps.length > 0;

  const isColumnKeyValid = useCallback(
    (columnKey: string) => {
      if (!columnKey) return false;
      return numberColumns.some((col) => col.key === columnKey);
    },
    [numberColumns]
  );

  // Get label for a column key (for rendering in SelectValue)
  const getColumnLabel = useCallback(
    (columnKey: string): string | null => {
      return columnLabelMap.get(columnKey) || null;
    },
    [columnLabelMap]
  );

  // Check which modifier types are already used (for disabling in menu)
  const usedModifierTypes = useMemo(
    () => new Set(value.modifiers.map((m) => m.type)),
    [value.modifiers]
  );

  // Build a lookup map for quick blockIndex resolution
  const columnBlockMap = useMemo(() => {
    const map = new Map<string, number>();
    numberColumns.forEach((col) => map.set(col.key, col.blockIndex));
    return map;
  }, [numberColumns]);

  const getColumnBlock = useCallback(
    (columnKey: string): number | null => {
      return columnBlockMap.get(columnKey) ?? null;
    },
    [columnBlockMap]
  );

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className='space-y-4'>
      {/* Header */}
      <div className='flex items-center gap-2'>
        <Calculator className='text-muted-foreground h-4 w-4' />
        <Label className='text-sm font-medium'>Formula Builder</Label>
      </div>

      {/* Invalid columns warning */}
      {hasInvalidRefs && (
        <div className='flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-400'>
          <AlertTriangle className='h-4 w-4 flex-shrink-0' />
          <span>
            Some column references are no longer available and have been
            removed.
          </span>
        </div>
      )}

      {/* No NUMBER columns warning */}
      {numberColumns.length === 0 && (
        <div className='flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-400'>
          <AlertCircle className='h-4 w-4 flex-shrink-0' />
          <span>
            No number columns available. Create NUMBER type columns first to use
            in formulas.
          </span>
        </div>
      )}

      {/* Formula Steps */}
      {numberColumns.length > 0 && (
        <Card>
          <CardContent className='space-y-4 pt-4'>
            {/* Step 1: Column Selection */}
            <div className='space-y-3'>
              <div className='flex items-center justify-between'>
                <Label className='text-muted-foreground text-xs tracking-wide uppercase'>
                  Select Columns
                </Label>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={addStep}
                  disabled={disabled}
                  className='h-7 text-xs'
                >
                  <Plus className='mr-1 h-3 w-3' />
                  Add Column
                </Button>
              </div>

              {value.steps.length === 0 ? (
                <div className='text-muted-foreground rounded-md border-2 border-dashed py-6 text-center text-sm'>
                  Click &quot;Add Column&quot; to start building your formula
                </div>
              ) : (
                <div className='space-y-2'>
                  {value.steps.map((step, index) => {
                    const isInvalid =
                      step.columnKey && !isColumnKeyValid(step.columnKey);
                    const selectedLabel = step.columnKey
                      ? getColumnLabel(step.columnKey)
                      : null;

                    return (
                      <div key={step.id} className='flex items-center gap-2'>
                        {/* Operator (not for first step) */}
                        {index > 0 && (
                          <Select
                            value={value.operators[index - 1] || '+'}
                            onValueChange={(val) =>
                              updateOperator(index - 1, val as Operator)
                            }
                            disabled={disabled}
                          >
                            <SelectTrigger className='h-9 w-[90px]'>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {OPERATORS.map((op) => (
                                <SelectItem key={op.value} value={op.value}>
                                  <span className='flex items-center gap-2'>
                                    <span className='w-4 text-center font-mono'>
                                      {op.symbol}
                                    </span>
                                    <span className='text-muted-foreground text-xs'>
                                      {op.label}
                                    </span>
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}

                        {/* Column Selector */}
                        <Select
                          value={step.columnKey || undefined}
                          onValueChange={(val) => updateStep(step.id, val)}
                          disabled={disabled}
                        >
                          <SelectTrigger
                            className={cn(
                              'h-9 flex-1',
                              !step.columnKey && 'text-muted-foreground',
                              isInvalid && 'border-destructive'
                            )}
                          >
                            <SelectValue placeholder='Select column'>
                              {step.columnKey ? (
                                isInvalid ? (
                                  <span className='text-destructive flex items-center gap-2'>
                                    <AlertTriangle className='h-3 w-3' />
                                    Invalid: {step.columnKey}
                                  </span>
                                ) : (
                                  <span className='flex items-center gap-2'>
                                    <span>{selectedLabel}</span>
                                    <Badge
                                      variant='outline'
                                      className='px-1 py-0 text-[10px]'
                                    >
                                      {step.columnKey}
                                    </Badge>
                                    <Badge
                                      variant='secondary'
                                      className='px-1 py-0 text-[10px]'
                                    >
                                      B{getColumnBlock(step.columnKey)}
                                    </Badge>
                                  </span>
                                )
                              ) : (
                                'Select column'
                              )}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {numberColumns.length === 0 ? (
                              <div className='text-muted-foreground px-2 py-3 text-center text-sm'>
                                No columns available
                              </div>
                            ) : (
                              numberColumns.map((col) => (
                                <SelectItem key={col.id} value={col.key}>
                                  <span className='flex items-center gap-2'>
                                    <span>{col.label}</span>
                                    <Badge
                                      variant='outline'
                                      className='px-1.5 py-0 text-[10px]'
                                    >
                                      {col.key}
                                    </Badge>
                                    <Badge
                                      variant='secondary'
                                      className='px-1.5 py-0 text-[10px]'
                                    >
                                      Block {col.blockIndex}
                                    </Badge>
                                  </span>
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>

                        {/* Remove Button */}
                        <Button
                          type='button'
                          variant='ghost'
                          size='icon'
                          onClick={() => removeStep(step.id)}
                          disabled={disabled}
                          className='text-muted-foreground hover:text-destructive h-9 w-9'
                        >
                          <Trash2 className='h-4 w-4' />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Step 2: Modifiers */}
            {hasSteps && (
              <div className='space-y-3 border-t pt-3'>
                <div className='flex items-center justify-between'>
                  <Label className='text-muted-foreground text-xs tracking-wide uppercase'>
                    Additional Operations (Optional)
                  </Label>
                  <div className='relative'>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={() => setShowModifierMenu(!showModifierMenu)}
                      disabled={disabled}
                      className='h-7 text-xs'
                    >
                      <Plus className='mr-1 h-3 w-3' />
                      Add Operation
                    </Button>

                    {/* Modifier type selection dropdown */}
                    {showModifierMenu && (
                      <>
                        {/* Backdrop to close menu */}
                        <div
                          className='fixed inset-0 z-40'
                          onClick={() => setShowModifierMenu(false)}
                        />
                        <div className='bg-popover absolute top-full right-0 z-50 mt-1 w-[240px] rounded-md border p-1 shadow-md'>
                          {MODIFIER_TYPES.map((modType) => {
                            const isSingleUse = [
                              'abs',
                              'ceil',
                              'floor',
                              'min',
                              'max'
                            ].includes(modType.value);
                            const isUsed = usedModifierTypes.has(modType.value);
                            const isDisabled = isSingleUse && isUsed;

                            return (
                              <button
                                key={modType.value}
                                type='button'
                                className={cn(
                                  'hover:bg-accent hover:text-accent-foreground w-full rounded-sm px-3 py-2 text-left text-sm',
                                  isDisabled &&
                                    'cursor-not-allowed opacity-50 hover:bg-transparent hover:text-inherit'
                                )}
                                onClick={() => {
                                  if (!isDisabled) addModifier(modType.value);
                                }}
                                disabled={isDisabled}
                              >
                                <div className='font-medium'>
                                  {modType.label}
                                </div>
                                <div className='text-muted-foreground text-xs'>
                                  {modType.description}
                                  {isDisabled && ' (already added)'}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {value.modifiers.length > 0 && (
                  <div className='space-y-2'>
                    {value.modifiers.map((mod) => {
                      const config = getModifierConfig(mod.type);
                      if (!config) return null;

                      return (
                        <div
                          key={mod.id}
                          className='flex flex-wrap items-center gap-2'
                        >
                          {/* Type Badge */}
                          <Badge
                            variant='secondary'
                            className='h-9 shrink-0 px-3'
                          >
                            {config.label}
                          </Badge>

                          {/* Operator (only for percentage and fixed) */}
                          {config.hasOperator && (
                            <Select
                              value={mod.operator}
                              onValueChange={(val) =>
                                updateModifier(mod.id, {
                                  operator: val as '+' | '-'
                                })
                              }
                              disabled={disabled}
                            >
                              <SelectTrigger className='h-9 w-[110px]'>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {MODIFIER_OPERATORS.map((op) => (
                                  <SelectItem key={op.value} value={op.value}>
                                    {op.value === '+'
                                      ? 'Add (+)'
                                      : 'Subtract (−)'}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}

                          {/* Value (if applicable) */}
                          {config.hasValue && (
                            <div className='flex items-center gap-1'>
                              <Input
                                type='number'
                                value={mod.value}
                                onChange={(e) =>
                                  updateModifier(mod.id, {
                                    value: parseFloat(e.target.value) || 0
                                  })
                                }
                                disabled={disabled}
                                className='h-9 w-[100px]'
                                min={config.valueMin}
                                max={config.valueMax}
                                step={config.valueStep}
                                placeholder={config.valuePlaceholder}
                              />
                              {mod.type === 'percentage' && (
                                <span className='text-muted-foreground text-sm'>
                                  %
                                </span>
                              )}
                            </div>
                          )}

                          {/* Remove Button */}
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon'
                            onClick={() => removeModifier(mod.id)}
                            disabled={disabled}
                            className='text-muted-foreground hover:text-destructive h-9 w-9'
                          >
                            <Trash2 className='h-4 w-4' />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Formula Preview */}
      {preview && (
        <div className='space-y-1'>
          <Label className='text-muted-foreground text-xs'>
            Formula Preview
          </Label>
          <div className='bg-muted rounded-md p-3 font-mono text-sm break-all'>
            {preview}
          </div>
        </div>
      )}

      {/* Error Display */}
      {displayError && (
        <div className='text-destructive flex items-center gap-2 text-sm'>
          <AlertCircle className='h-4 w-4 flex-shrink-0' />
          <span>{displayError}</span>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// EMPTY FORMULA DATA
// =============================================================================

export const createEmptyFormula = (): FormulaData => ({
  steps: [],
  operators: [],
  modifiers: []
});
