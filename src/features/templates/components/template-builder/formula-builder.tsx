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

export type FormulaStepType = 'column' | 'constant';

export type FormulaStep = {
  id: string;
  type: FormulaStepType;
  columnKey: string; // used when type === 'column'
  value?: number; // used when type === 'constant'
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

export type ModifierOperator = '+' | '-' | '*' | '/';

export type FormulaModifier = {
  id: string;
  type: ModifierType;
  operator: ModifierOperator;
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

const MODIFIER_OPERATORS: {
  label: string;
  value: ModifierOperator;
  symbol: string;
}[] = [
  { label: 'Add', value: '+', symbol: '+' },
  { label: 'Subtract', value: '-', symbol: '−' },
  { label: 'Multiply', value: '*', symbol: '×' },
  { label: 'Divide', value: '/', symbol: '÷' }
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
    description: 'Apply a percentage of the result',
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
    description: 'Apply a fixed number to the result',
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

const STEP_TYPES: { label: string; value: FormulaStepType }[] = [
  { label: 'Column', value: 'column' },
  { label: 'Number', value: 'constant' }
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
    '\u2212': '-',
    '\u00d7': '*',
    '\u00f7': '/',
    '%': '%',
    '^': '^'
  };
  return map[symbol] ?? null;
};

/** Map modifier operator to display symbol */
const getModifierOperatorSymbol = (op: ModifierOperator): string => {
  const map: Record<ModifierOperator, string> = {
    '+': '+',
    '-': '−',
    '*': '×',
    '/': '÷'
  };
  return map[op] || op;
};

/** Map display symbol back to modifier operator */
const symbolToModifierOperator = (symbol: string): ModifierOperator | null => {
  const map: Record<string, ModifierOperator> = {
    '+': '+',
    '\u2212': '-',
    '\u00d7': '*',
    '\u00f7': '/'
  };
  return map[symbol] ?? null;
};

const getModifierConfig = (type: ModifierType) =>
  MODIFIER_TYPES.find((m) => m.value === type);

/** Check if a string looks like a number (integer or decimal) */
const isNumericToken = (token: string): boolean => {
  return /^-?\d+(\.\d+)?$/.test(token);
};

// =============================================================================
// FORMULA STRING FORMAT
// =============================================================================
// The formula is stored and sent as a human-readable string using column KEYS
// and constant numbers.
//
// Examples:
//   Simple:          "qty_0 × rate_0"
//   With constant:   "(total_0 × rate_0) ÷ 1000"
//   With modifier:   "(qty_0 × rate_0) + 10%"
//   Multiply mod:    "(qty_0 × rate_0) × 1.18"
//   Divide mod:      "(qty_0 × rate_0) ÷ 1000"
//   With function:   "ROUND((qty_0 × rate_0) ÷ 1000, 2)"
//   Complex:         "ABS(ROUND((qty_0 + rate_0) − 100, 2))"
//
// Operator symbols: + (add), − (subtract), × (multiply), ÷ (divide), % (modulo), ^ (power)
// =============================================================================

/**
 * Parse formula string to FormulaData.
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
          steps: (
            parsed.steps as (
              | string
              | { type: string; columnKey?: string; value?: number }
            )[]
          ).map((step) => {
            if (typeof step === 'string') {
              if (isNumericToken(step)) {
                return {
                  id: generateId(),
                  type: 'constant' as FormulaStepType,
                  columnKey: '',
                  value: parseFloat(step)
                };
              }
              return {
                id: generateId(),
                type: 'column' as FormulaStepType,
                columnKey: step
              };
            }
            return {
              id: generateId(),
              type: (step.type || 'column') as FormulaStepType,
              columnKey: step.columnKey || '',
              value: step.value
            };
          }),
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
 */
function parseFormulaString(formula: string): FormulaData {
  const modifiers: FormulaModifier[] = [];
  let expr = formula.trim();

  // ── 1. Unwrap outer functions (peel from outside in) ─────────────────────
  let changed = true;
  while (changed) {
    changed = false;

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
  // Supports all 4 operators: +  −  ×  ÷
  changed = true;
  while (changed) {
    changed = false;

    // Percentage modifier: ... [+|−|×|÷] N%
    const pctMatch = expr.match(/^(.+)\s+([+\u2212×÷])\s+([\d.]+)%$/);
    if (pctMatch) {
      const parsedOp = symbolToModifierOperator(pctMatch[2]);
      modifiers.unshift({
        id: generateId(),
        type: 'percentage',
        operator: parsedOp || '+',
        value: parseFloat(pctMatch[3])
      });
      expr = pctMatch[1].trim();
      changed = true;
      continue;
    }

    // Fixed modifier: ... [+|−|×|÷] N  (only if core is wrapped in parens)
    const fixedMatch = expr.match(/^(\(.+\))\s+([+\u2212×÷])\s+([\d.]+)$/);
    if (fixedMatch) {
      const parsedOp = symbolToModifierOperator(fixedMatch[2]);
      modifiers.unshift({
        id: generateId(),
        type: 'fixed',
        operator: parsedOp || '+',
        value: parseFloat(fixedMatch[3])
      });
      expr = fixedMatch[1].trim();
      changed = true;
      continue;
    }
  }

  // ── 3. Strip wrapping parentheses ────────────────────────────────────────
  if (expr.startsWith('(') && expr.endsWith(')')) {
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
  const tokens = expr.split(/\s+/);

  const steps: FormulaStep[] = [];
  const operators: Operator[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const op = symbolToOperator(token);

    if (op !== null) {
      operators.push(op);
    } else if (token) {
      if (isNumericToken(token)) {
        steps.push({
          id: generateId(),
          type: 'constant',
          columnKey: '',
          value: parseFloat(token)
        });
      } else {
        steps.push({
          id: generateId(),
          type: 'column',
          columnKey: token
        });
      }
    }
  }

  return { steps, operators, modifiers };
}

/**
 * Convert FormulaData to string for API.
 */
export const stringifyFormula = (data: FormulaData): string => {
  if (data.steps.length === 0) return '';

  let expression = data.steps
    .map((step, index) => {
      const token =
        step.type === 'constant' ? String(step.value ?? 0) : step.columnKey;

      if (index === 0) return token;
      const op = data.operators[index - 1];
      return `${getOperatorSymbol(op)} ${token}`;
    })
    .join(' ');

  if (data.modifiers.length > 0) {
    expression = `(${expression})`;
  }

  data.modifiers.forEach((mod) => {
    const symbol = getModifierOperatorSymbol(mod.operator);
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

  let expression = data.steps
    .map((step, index) => {
      const label =
        step.type === 'constant'
          ? String(step.value ?? 0)
          : getColumnLabel(step.columnKey);

      if (index === 0) return label;
      const op = data.operators[index - 1];
      return `${getOperatorSymbol(op)} ${label}`;
    })
    .join(' ');

  if (data.modifiers.length > 0) {
    expression = `(${expression})`;
  }

  data.modifiers.forEach((mod) => {
    const symbol = getModifierOperatorSymbol(mod.operator);
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
  if (data.steps.length === 0) {
    return 'Please add at least one column to the formula';
  }

  const availableKeys = new Set(availableColumns.map((c) => c.key));

  for (let i = 0; i < data.steps.length; i++) {
    const step = data.steps[i];

    if (step.type === 'constant') {
      if (
        step.value === undefined ||
        step.value === null ||
        isNaN(step.value)
      ) {
        return `Please enter a valid number for step ${i + 1}`;
      }
    } else {
      if (!step.columnKey || step.columnKey === '') {
        return `Please select a column for step ${i + 1}`;
      }
      if (!availableKeys.has(step.columnKey)) {
        return `Column "${step.columnKey}" in step ${i + 1} is not available. Please select a different column.`;
      }
    }
  }

  if (
    data.steps.length > 1 &&
    data.operators.length !== data.steps.length - 1
  ) {
    return 'Missing operators between columns';
  }

  for (let i = 0; i < data.operators.length; i++) {
    const op = data.operators[i];
    if (!OPERATORS.some((o) => o.value === op)) {
      return `Invalid operator "${op}" between step ${i + 1} and ${i + 2}`;
    }
  }

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
    (step) =>
      step.type === 'column' &&
      step.columnKey &&
      !availableKeys.has(step.columnKey)
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

  const validSteps = data.steps.filter((step) => {
    if (step.type === 'constant') return true;
    return !step.columnKey || availableKeys.has(step.columnKey);
  });

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

  const numberColumns = useMemo(() => availableColumns, [availableColumns]);

  const columnLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    numberColumns.forEach((col) => map.set(col.key, col.label));
    return map;
  }, [numberColumns]);

  const hasInvalidRefs = useMemo(
    () => hasInvalidColumns(value, numberColumns),
    [value, numberColumns]
  );

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

  const addStep = useCallback(
    (type: FormulaStepType = 'column') => {
      const newStep: FormulaStep =
        type === 'constant'
          ? { id: generateId(), type: 'constant', columnKey: '', value: 0 }
          : { id: generateId(), type: 'column', columnKey: '' };

      const newOperators =
        value.steps.length > 0
          ? [...value.operators, '+' as Operator]
          : value.operators;

      onChange({
        ...value,
        steps: [...value.steps, newStep],
        operators: newOperators
      });
    },
    [value, onChange]
  );

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

  const updateStepValue = useCallback(
    (stepId: string, val: number) => {
      onChange({
        ...value,
        steps: value.steps.map((step) =>
          step.id === stepId ? { ...step, value: val } : step
        )
      });
    },
    [value, onChange]
  );

  const updateStepType = useCallback(
    (stepId: string, newType: FormulaStepType) => {
      onChange({
        ...value,
        steps: value.steps.map((step) =>
          step.id === stepId
            ? {
                ...step,
                type: newType,
                columnKey: newType === 'column' ? '' : '',
                value: newType === 'constant' ? 0 : undefined
              }
            : step
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

      if (['abs', 'ceil', 'floor'].includes(type)) {
        const exists = value.modifiers.some((m) => m.type === type);
        if (exists) return;
      }

      if (type === 'min' || type === 'max') {
        const exists = value.modifiers.some((m) => m.type === type);
        if (exists) return;
      }

      const newModifier: FormulaModifier = {
        id: generateId(),
        type,
        operator: '+',
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

  const getColumnLabel = useCallback(
    (columnKey: string): string | null => {
      return columnLabelMap.get(columnKey) || null;
    },
    [columnLabelMap]
  );

  const usedModifierTypes = useMemo(
    () => new Set(value.modifiers.map((m) => m.type)),
    [value.modifiers]
  );

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

      {/* No columns warning */}
      {numberColumns.length === 0 && (
        <div className='flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-400'>
          <AlertCircle className='h-4 w-4 flex-shrink-0' />
          <span>
            No columns available. Create columns first to use in formulas.
          </span>
        </div>
      )}

      {/* Formula Steps */}
      <Card>
        <CardContent className='space-y-4 pt-4'>
          {/* Step 1: Column / Constant Selection */}
          <div className='space-y-3'>
            <div className='flex items-center justify-between'>
              <Label className='text-muted-foreground text-xs tracking-wide uppercase'>
                Select Columns
              </Label>
              <div className='flex gap-1'>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => addStep('column')}
                  disabled={disabled}
                  className='h-7 text-xs'
                >
                  <Plus className='mr-1 h-3 w-3' />
                  Add Column
                </Button>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={() => addStep('constant')}
                  disabled={disabled}
                  className='h-7 text-xs'
                >
                  <Hash className='mr-1 h-3 w-3' />
                  Add Number
                </Button>
              </div>
            </div>

            {value.steps.length === 0 ? (
              <div className='text-muted-foreground rounded-md border-2 border-dashed py-6 text-center text-sm'>
                Click &quot;Add Column&quot; or &quot;Add Number&quot; to start
                building your formula
              </div>
            ) : (
              <div className='space-y-2'>
                {value.steps.map((step, index) => {
                  const isInvalid =
                    step.type === 'column' &&
                    step.columnKey &&
                    !isColumnKeyValid(step.columnKey);
                  const selectedLabel =
                    step.type === 'column' && step.columnKey
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

                      {/* Step type toggle */}
                      <Select
                        value={step.type}
                        onValueChange={(val) =>
                          updateStepType(step.id, val as FormulaStepType)
                        }
                        disabled={disabled}
                      >
                        <SelectTrigger className='h-9 w-[100px]'>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STEP_TYPES.map((st) => (
                            <SelectItem key={st.value} value={st.value}>
                              {st.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Column Selector or Number Input */}
                      {step.type === 'constant' ? (
                        <Input
                          type='number'
                          value={step.value ?? 0}
                          onChange={(e) =>
                            updateStepValue(
                              step.id,
                              parseFloat(e.target.value) || 0
                            )
                          }
                          disabled={disabled}
                          className='h-9 flex-1'
                          placeholder='Enter number...'
                          step='any'
                        />
                      ) : (
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
                      )}

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

                  {showModifierMenu && (
                    <>
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
                              <div className='font-medium'>{modType.label}</div>
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

                        {/* Operator — now with all 4 options */}
                        {config.hasOperator && (
                          <Select
                            value={mod.operator}
                            onValueChange={(val) =>
                              updateModifier(mod.id, {
                                operator: val as ModifierOperator
                              })
                            }
                            disabled={disabled}
                          >
                            <SelectTrigger className='h-9 w-[140px]'>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {MODIFIER_OPERATORS.map((op) => (
                                <SelectItem key={op.value} value={op.value}>
                                  <span className='flex items-center gap-2'>
                                    <span className='w-4 text-center font-mono'>
                                      {op.symbol}
                                    </span>
                                    <span>
                                      {op.label} ({op.symbol})
                                    </span>
                                  </span>
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
