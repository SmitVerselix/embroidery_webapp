'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { TemplateColumn, ColumnDataType } from '@/lib/api/types';
import { COLUMN_DATA_TYPES } from '@/lib/api/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Loader2, AlertCircle, Info } from 'lucide-react';

import FormulaBuilder, {
  type FormulaData,
  createEmptyFormula,
  parseFormula,
  stringifyFormula,
  validateFormula
} from './formula-builder';

// =============================================================================
// BLOCK TYPE (shared across components)
// =============================================================================

export type TemplateBlock = {
  index: number; // blockIndex value (0, 1, 2, ...)
  label: string; // display name (e.g., "Before Line Balancing")
};

// =============================================================================
// SCHEMA
// =============================================================================

const columnFormSchema = z.object({
  label: z
    .string()
    .min(1, 'Label is required')
    .min(2, 'Label must be at least 2 characters')
    .max(50, 'Label must be less than 50 characters'),
  dataType: z.enum(['NUMBER', 'TEXT', 'FORMULA'], {
    message: 'Please select a data type'
  }),
  blockIndex: z.number().min(0, 'Please select a block'),
  isRequired: z.boolean(),
  isFinalCalculation: z.boolean()
});

type ColumnFormData = z.infer<typeof columnFormSchema>;

// =============================================================================
// PROPS
// =============================================================================

interface ColumnFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    key: string;
    label: string;
    dataType: ColumnDataType;
    blockIndex: number;
    isRequired: boolean;
    isFinalCalculation: boolean;
    formula?: string;
  }) => Promise<void>;
  initialData?: TemplateColumn | null;
  availableColumns?: TemplateColumn[];
  blocks?: TemplateBlock[];
  isLoading?: boolean;
  error?: string | null;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const generateKey = (label: string): string => {
  const cleanLabel = label
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return `${cleanLabel}_0`;
};

// =============================================================================
// COMPONENT
// =============================================================================

export default function ColumnFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  availableColumns = [],
  blocks = [],
  isLoading = false,
  error
}: ColumnFormDialogProps) {
  const isEditing = !!initialData;
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formulaData, setFormulaData] =
    useState<FormulaData>(createEmptyFormula());
  const [formulaError, setFormulaError] = useState<string | null>(null);

  // Ensure we always have at least one block to select
  const availableBlocks = useMemo(() => {
    if (blocks.length > 0) return blocks;
    return [{ index: 0, label: 'Default Block' }];
  }, [blocks]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors }
  } = useForm<ColumnFormData>({
    resolver: zodResolver(columnFormSchema),
    defaultValues: {
      label: initialData?.label || '',
      dataType: initialData?.dataType || undefined,
      blockIndex: initialData?.blockIndex ?? availableBlocks[0]?.index ?? 0,
      isRequired: initialData?.isRequired || false,
      isFinalCalculation: initialData?.isFinalCalculation || false
    }
  });

  const selectedDataType = watch('dataType');
  const selectedBlockIndex = watch('blockIndex');
  const isFormulaType = selectedDataType === 'FORMULA';

  // Filter available columns for formula builder
  const formulaAvailableColumns = useMemo(() => {
    let filtered = availableColumns.filter((col) => {
      if (isEditing && initialData && col.id === initialData.id) {
        return false;
      }
      return col.dataType === 'NUMBER';
    });
    return filtered.sort((a, b) => a.orderNo - b.orderNo);
  }, [availableColumns, isEditing, initialData]);

  // Reset form when dialog opens/closes or initialData changes
  useEffect(() => {
    if (open) {
      reset({
        label: initialData?.label || '',
        dataType: initialData?.dataType || undefined,
        blockIndex: initialData?.blockIndex ?? availableBlocks[0]?.index ?? 0,
        isRequired: initialData?.isRequired || false,
        isFinalCalculation: initialData?.isFinalCalculation || false
      });

      if (initialData?.dataType === 'FORMULA' && initialData?.formula) {
        const parsed = parseFormula(initialData.formula);
        setFormulaData(parsed || createEmptyFormula());
      } else {
        setFormulaData(createEmptyFormula());
      }

      setSubmitError(null);
      setFormulaError(null);
    }
  }, [open, initialData, reset, availableBlocks]);

  // Reset formula when data type changes away from FORMULA
  useEffect(() => {
    if (!isFormulaType) {
      setFormulaData(createEmptyFormula());
      setFormulaError(null);
    }
  }, [isFormulaType]);

  // Validate formula in real-time
  useEffect(() => {
    if (isFormulaType && formulaData.steps.length > 0) {
      const error = validateFormula(formulaData, formulaAvailableColumns);
      setFormulaError(error);
    } else {
      setFormulaError(null);
    }
  }, [isFormulaType, formulaData, formulaAvailableColumns]);

  // Handle form submission
  const handleFormSubmit = async (data: ColumnFormData) => {
    setSubmitError(null);
    setFormulaError(null);

    if (data.dataType === 'FORMULA') {
      const validationError = validateFormula(
        formulaData,
        formulaAvailableColumns
      );
      if (validationError) {
        setFormulaError(validationError);
        return;
      }
      if (formulaData.steps.length === 0) {
        setFormulaError('Please add at least one column to the formula');
        return;
      }
    }

    try {
      const key =
        isEditing && initialData ? initialData.key : generateKey(data.label);

      const submitData = {
        key,
        label: data.label,
        dataType: data.dataType as ColumnDataType,
        blockIndex: data.blockIndex,
        isRequired: data.isRequired,
        isFinalCalculation: data.isFinalCalculation,
        ...(data.dataType === 'FORMULA'
          ? { formula: stringifyFormula(formulaData) }
          : {})
      };

      await onSubmit(submitData);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to save column'
      );
      throw err;
    }
  };

  const displayError = error || submitError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          isFormulaType
            ? 'max-h-[90vh] overflow-y-auto sm:max-w-[650px]'
            : 'sm:max-w-[425px]'
        }
      >
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Column' : 'Add Column'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the column properties below.'
              : 'Fill in the details to create a new column.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className='space-y-4'>
          {/* Error Message */}
          {displayError && (
            <div className='bg-destructive/15 text-destructive flex items-start gap-2 rounded-md p-3 text-sm'>
              <AlertCircle className='mt-0.5 h-4 w-4 flex-shrink-0' />
              <span>{displayError}</span>
            </div>
          )}

          {/* Label */}
          <div className='space-y-2'>
            <Label htmlFor='label'>
              Label <span className='text-destructive'>*</span>
            </Label>
            <Input
              id='label'
              placeholder='e.g., QTY, Price, Total'
              disabled={isLoading}
              {...register('label')}
              className={errors.label ? 'border-destructive' : ''}
            />
            {errors.label && (
              <p className='text-destructive text-sm'>{errors.label.message}</p>
            )}
          </div>

          {/* Block Selection */}
          {availableBlocks.length > 0 && (
            <div className='space-y-2'>
              <Label htmlFor='blockIndex'>
                Block / Group <span className='text-destructive'>*</span>
              </Label>
              <Select
                value={String(selectedBlockIndex ?? '')}
                onValueChange={(value) =>
                  setValue('blockIndex', parseInt(value, 10))
                }
                disabled={isLoading}
              >
                <SelectTrigger
                  className={errors.blockIndex ? 'border-destructive' : ''}
                >
                  <SelectValue placeholder='Select block' />
                </SelectTrigger>
                <SelectContent>
                  {availableBlocks.map((block) => (
                    <SelectItem key={block.index} value={String(block.index)}>
                      <div className='flex items-center gap-2'>
                        <span className='text-muted-foreground bg-muted rounded px-1.5 py-0.5 font-mono text-xs'>
                          {block.index}
                        </span>
                        <span>{block.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.blockIndex && (
                <p className='text-destructive text-sm'>
                  {errors.blockIndex.message}
                </p>
              )}
              <p className='text-muted-foreground text-xs'>
                Assign this column to a block group (e.g., &quot;Before Line
                Balancing&quot;, &quot;After Line Balancing&quot;)
              </p>
            </div>
          )}

          {/* Data Type */}
          <div className='space-y-2'>
            <Label htmlFor='dataType'>
              Data Type <span className='text-destructive'>*</span>
            </Label>
            <Select
              value={selectedDataType}
              onValueChange={(value) =>
                setValue('dataType', value as ColumnDataType)
              }
              disabled={isLoading}
            >
              <SelectTrigger
                className={errors.dataType ? 'border-destructive' : ''}
              >
                <SelectValue placeholder='Select data type' />
              </SelectTrigger>
              <SelectContent>
                {COLUMN_DATA_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className='flex flex-col'>
                      <span>{type.label}</span>
                      <span className='text-muted-foreground text-xs'>
                        {type.value === 'NUMBER' &&
                          'For numeric values (quantity, price, etc.)'}
                        {type.value === 'TEXT' &&
                          'For text values (name, description, etc.)'}
                        {type.value === 'FORMULA' &&
                          'Calculate value from other columns'}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.dataType && (
              <p className='text-destructive text-sm'>
                {errors.dataType.message}
              </p>
            )}
          </div>

          {/* Formula Builder */}
          {isFormulaType && (
            <>
              {formulaAvailableColumns.length === 0 && (
                <div className='flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-400'>
                  <Info className='mt-0.5 h-4 w-4 flex-shrink-0' />
                  <div>
                    <p className='font-medium'>No NUMBER columns available</p>
                    <p className='mt-1 text-xs'>
                      Create NUMBER type columns first before creating formulas.
                    </p>
                  </div>
                </div>
              )}
              <FormulaBuilder
                value={formulaData}
                onChange={setFormulaData}
                availableColumns={formulaAvailableColumns}
                error={formulaError}
                disabled={isLoading}
              />
            </>
          )}

          {/* Is Required */}
          <div className='flex items-center justify-between rounded-lg border p-3'>
            <div className='space-y-0.5'>
              <Label htmlFor='isRequired'>Required Field</Label>
              <p className='text-muted-foreground text-xs'>
                Make this column mandatory
              </p>
            </div>
            <Switch
              id='isRequired'
              checked={watch('isRequired')}
              onCheckedChange={(checked) => setValue('isRequired', checked)}
              disabled={isLoading}
            />
          </div>

          {/* Is Final Calculation */}
          <div className='flex items-center justify-between rounded-lg border p-3'>
            <div className='space-y-0.5'>
              <Label htmlFor='isFinalCalculation'>
                Final Calculation Field
              </Label>
              <p className='text-muted-foreground text-xs'>
                Mark this column as the final calculation result
              </p>
            </div>
            <Switch
              id='isFinalCalculation'
              checked={watch('isFinalCalculation')}
              onCheckedChange={(checked) =>
                setValue('isFinalCalculation', checked)
              }
              disabled={isLoading}
            />
          </div>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type='submit'
              disabled={isLoading || (isFormulaType && !!formulaError)}
            >
              {isLoading ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  {isEditing ? 'Updating...' : 'Creating...'}
                </>
              ) : isEditing ? (
                'Update Column'
              ) : (
                'Add Column'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
