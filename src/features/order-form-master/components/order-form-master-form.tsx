'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  createOrderFormMaster,
  updateOrderFormMaster
} from '@/lib/api/services';
import { getError } from '@/lib/api/axios';
import type {
  OrderFormMaster,
  OrderFormFieldType,
  TemplateWithDetails,
  TemplateExtra,
  TemplateRow,
  TemplateColumn
} from '@/lib/api/types';
import { ORDER_FORM_FIELD_TYPES } from '@/lib/api/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Loader2, ArrowLeft, Plus, X, Info, AlertCircle } from 'lucide-react';
import Link from 'next/link';

// =============================================================================
// CONSTANTS
// =============================================================================

const MULTI_VALUE_TYPES: OrderFormFieldType[] = [
  'SELECT',
  'MULTI_SELECT',
  'CHECKBOX',
  'RADIO'
];

const TEMPLATE_LINKED_TYPES: OrderFormFieldType[] = [
  'SELECT_TEMPLATE_EXTRA_FIELD',
  'SELECT_TEMPLATE_VALUE',
  'SELECT_TEMPLATE'
];

// =============================================================================
// SCHEMA
// =============================================================================

const orderFormMasterSchema = z
  .object({
    fieldName: z
      .string()
      .min(1, 'Field name is required')
      .min(2, 'Field name must be at least 2 characters'),
    fieldType: z.enum(
      [
        'TEXT',
        'NUMBER',
        'SELECT',
        'MULTI_SELECT',
        'CHECKBOX',
        'FILE',
        'RADIO',
        'SELECT_TEMPLATE_EXTRA_FIELD',
        'SELECT_TEMPLATE_VALUE',
        'SELECT_TEMPLATE'
      ],
      { message: 'Please select a field type' }
    ),
    description: z.string().optional()
  })
  .passthrough();

type OrderFormMasterFormData = z.infer<typeof orderFormMasterSchema>;

// =============================================================================
// PROPS
// =============================================================================

interface OrderFormMasterFormProps {
  companyId: string;
  productId: string;
  initialData: OrderFormMaster | null;
  templates: TemplateWithDetails[];
  pageTitle: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function OrderFormMasterForm({
  companyId,
  productId,
  initialData,
  templates,
  pageTitle
}: OrderFormMasterFormProps) {
  const router = useRouter();
  const isEditing = !!initialData;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── React Hook Form ─────────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors }
  } = useForm<OrderFormMasterFormData>({
    resolver: zodResolver(orderFormMasterSchema),
    defaultValues: {
      fieldName: initialData?.fieldName || '',
      fieldType: initialData?.fieldType || undefined,
      description: initialData?.description || ''
    }
  });

  const selectedFieldType = watch('fieldType') as OrderFormFieldType;

  // ─── Conditional field state (outside react-hook-form) ────────────────────
  const [fieldValues, setFieldValues] = useState<string[]>(
    initialData?.fieldValues || []
  );
  const [newValueInput, setNewValueInput] = useState('');
  const [fieldValuesError, setFieldValuesError] = useState<string | null>(null);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    initialData?.templateId || ''
  );
  const [selectedExtraId, setSelectedExtraId] = useState<string>(
    initialData?.extraId || ''
  );
  const [extraIndex, setExtraIndex] = useState<number>(
    initialData?.extraIndex ?? 0
  );
  const [selectedRowId, setSelectedRowId] = useState<string>(
    initialData?.rowId || ''
  );
  const [selectedColumnId, setSelectedColumnId] = useState<string>(
    initialData?.columnId || ''
  );

  const [templateError, setTemplateError] = useState<string | null>(null);
  const [extraIdError, setExtraIdError] = useState<string | null>(null);
  const [rowIdError, setRowIdError] = useState<string | null>(null);
  const [columnIdError, setColumnIdError] = useState<string | null>(null);

  // ─── Derived flags ────────────────────────────────────────────────────────
  const showFieldValues = MULTI_VALUE_TYPES.includes(selectedFieldType);
  const showTemplateSelector =
    TEMPLATE_LINKED_TYPES.includes(selectedFieldType);
  const showExtraFields =
    selectedFieldType === 'SELECT_TEMPLATE_EXTRA_FIELD' && !!selectedTemplateId;
  const showRowColumn =
    selectedFieldType === 'SELECT_TEMPLATE_VALUE' && !!selectedTemplateId;

  // ─── Selected template data ───────────────────────────────────────────────
  const selectedTemplate =
    templates.find((t) => t.id === selectedTemplateId) || null;
  const templateExtras: TemplateExtra[] = selectedTemplate?.extra || [];
  const templateRows: TemplateRow[] = selectedTemplate?.rows || [];
  const templateColumns: TemplateColumn[] = selectedTemplate?.columns || [];

  // ─── Reset dependent fields on fieldType change ───────────────────────────
  useEffect(() => {
    if (!showFieldValues) {
      setFieldValues([]);
      setNewValueInput('');
      setFieldValuesError(null);
    }
    if (!showTemplateSelector) {
      setSelectedTemplateId('');
      setSelectedExtraId('');
      setExtraIndex(0);
      setSelectedRowId('');
      setSelectedColumnId('');
      setTemplateError(null);
      setExtraIdError(null);
      setRowIdError(null);
      setColumnIdError(null);
    }
  }, [selectedFieldType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset extra/row/column when template changes
  useEffect(() => {
    setSelectedExtraId('');
    setExtraIndex(0);
    setSelectedRowId('');
    setSelectedColumnId('');
    setExtraIdError(null);
    setRowIdError(null);
    setColumnIdError(null);
  }, [selectedTemplateId]);

  // Auto-set extraIndex from selected extra's orderNo
  useEffect(() => {
    if (selectedExtraId) {
      const extra = templateExtras.find((e) => e.id === selectedExtraId);
      if (extra) setExtraIndex(extra.orderNo);
    }
  }, [selectedExtraId, templateExtras]);

  // Reset form when initialData changes (for edit mode)
  useEffect(() => {
    if (initialData) {
      reset({
        fieldName: initialData.fieldName || '',
        fieldType: initialData.fieldType || undefined,
        description: initialData.description || ''
      });
      setFieldValues(initialData.fieldValues || []);
      setSelectedTemplateId(initialData.templateId || '');
      setSelectedExtraId(initialData.extraId || '');
      setExtraIndex(initialData.extraIndex ?? 0);
      setSelectedRowId(initialData.rowId || '');
      setSelectedColumnId(initialData.columnId || '');
    }
  }, [initialData, reset]);

  // ─── Field values helpers ─────────────────────────────────────────────────
  const addFieldValue = useCallback(() => {
    const trimmed = newValueInput.trim();
    if (!trimmed) return;
    if (fieldValues.includes(trimmed)) {
      setFieldValuesError('Duplicate value');
      return;
    }
    setFieldValues((prev) => [...prev, trimmed]);
    setNewValueInput('');
    setFieldValuesError(null);
  }, [newValueInput, fieldValues]);

  const removeFieldValue = useCallback((index: number) => {
    setFieldValues((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleValueKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addFieldValue();
    }
  };

  // ─── Validate conditional fields ─────────────────────────────────────────
  const validateConditionalFields = (): boolean => {
    let valid = true;

    if (showFieldValues && fieldValues.length === 0) {
      setFieldValuesError('At least one value is required');
      valid = false;
    }

    if (showTemplateSelector && !selectedTemplateId) {
      setTemplateError('Please select a template');
      valid = false;
    }

    if (showExtraFields && !selectedExtraId) {
      setExtraIdError('Please select an extra field');
      valid = false;
    }

    if (showRowColumn && !selectedRowId) {
      setRowIdError('Please select a row');
      valid = false;
    }

    if (showRowColumn && !selectedColumnId) {
      setColumnIdError('Please select a column');
      valid = false;
    }

    return valid;
  };

  // ─── Submit ───────────────────────────────────────────────────────────────
  const onSubmit = async (data: OrderFormMasterFormData) => {
    if (!companyId || !productId) {
      setError('Missing company or product');
      return;
    }

    // Validate conditional fields
    if (!validateConditionalFields()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        fieldName: data.fieldName,
        fieldType: data.fieldType,
        description: data.description || undefined
      };

      // Attach conditional fields
      if (showFieldValues && fieldValues.length > 0) {
        payload.fieldValues = fieldValues;
      }

      if (showTemplateSelector && selectedTemplateId) {
        payload.templateId = selectedTemplateId;
      }

      if (showExtraFields && selectedExtraId) {
        payload.extraId = selectedExtraId;
        payload.extraIndex = extraIndex;
      }

      if (showRowColumn) {
        if (selectedRowId) payload.rowId = selectedRowId;
        if (selectedColumnId) payload.columnId = selectedColumnId;
      }

      if (isEditing && initialData) {
        await updateOrderFormMaster(
          companyId,
          productId,
          initialData.id,
          payload as any
        );
      } else {
        await createOrderFormMaster(companyId, productId, payload as any);
      }

      router.push(`/dashboard/${companyId}/product/${productId}`);
      router.refresh();
    } catch (err) {
      setError(getError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const backUrl = `/dashboard/${companyId}/product/${productId}`;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className='space-y-6'>
      {/* Back Button */}
      <Link
        href={backUrl}
        className='text-muted-foreground hover:text-foreground inline-flex items-center text-sm'
      >
        <ArrowLeft className='mr-2 h-4 w-4' />
        Back to Product
      </Link>

      {/* Form Card */}
      <Card className='mx-auto max-w-2xl'>
        <CardHeader>
          <CardTitle>{pageTitle}</CardTitle>
          <CardDescription>
            {isEditing
              ? 'Update the order form field information below'
              : 'Fill in the details to create a new order form field'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className='space-y-6'>
            {/* Error Message */}
            {error && (
              <div className='bg-destructive/15 text-destructive rounded-md p-3 text-sm'>
                {error}
              </div>
            )}

            {/* ── Basic Fields ────────────────────────────────────────── */}
            <div className='grid gap-4 sm:grid-cols-2'>
              {/* Field Name */}
              <div className='space-y-2'>
                <Label htmlFor='fieldName'>
                  Field Name <span className='text-destructive'>*</span>
                </Label>
                <Input
                  id='fieldName'
                  placeholder='e.g. Color, Size, Material'
                  disabled={isSubmitting}
                  {...register('fieldName')}
                  className={errors.fieldName ? 'border-destructive' : ''}
                />
                {errors.fieldName && (
                  <p className='text-destructive text-sm'>
                    {errors.fieldName.message}
                  </p>
                )}
              </div>

              {/* Field Type */}
              <div className='space-y-2'>
                <Label htmlFor='fieldType'>
                  Field Type <span className='text-destructive'>*</span>
                </Label>
                <Select
                  value={selectedFieldType}
                  onValueChange={(value) =>
                    setValue('fieldType', value as OrderFormFieldType)
                  }
                  disabled={isSubmitting}
                >
                  <SelectTrigger
                    className={errors.fieldType ? 'border-destructive' : ''}
                  >
                    <SelectValue placeholder='Select field type' />
                  </SelectTrigger>
                  <SelectContent>
                    {ORDER_FORM_FIELD_TYPES.map((ft) => (
                      <SelectItem key={ft.value} value={ft.value}>
                        <div className='flex flex-col'>
                          <span>{ft.label}</span>
                          <span className='text-muted-foreground text-xs'>
                            {ft.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.fieldType && (
                  <p className='text-destructive text-sm'>
                    {errors.fieldType.message}
                  </p>
                )}
              </div>
            </div>

            {/* Description */}
            <div className='space-y-2'>
              <Label htmlFor='description'>Description</Label>
              <Textarea
                id='description'
                placeholder='Enter a description (optional)'
                disabled={isSubmitting}
                rows={3}
                {...register('description')}
              />
            </div>

            {/* ── Field Values (SELECT, MULTI_SELECT, CHECKBOX, RADIO) ── */}
            {showFieldValues && (
              <>
                <Separator />
                <div className='space-y-3'>
                  <div className='flex items-center gap-2'>
                    <Label>
                      Field Values <span className='text-destructive'>*</span>
                    </Label>
                    <span className='text-muted-foreground flex items-center gap-1 text-xs'>
                      <Info className='h-3 w-3' />
                      Add the options users can choose from
                    </span>
                  </div>

                  <div className='flex gap-2'>
                    <Input
                      placeholder='Type a value and press Enter or click Add'
                      value={newValueInput}
                      onChange={(e) => setNewValueInput(e.target.value)}
                      onKeyDown={handleValueKeyDown}
                      disabled={isSubmitting}
                      className='flex-1'
                    />
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={addFieldValue}
                      disabled={!newValueInput.trim() || isSubmitting}
                    >
                      <Plus className='mr-1 h-4 w-4' />
                      Add
                    </Button>
                  </div>

                  {fieldValuesError && (
                    <p className='text-destructive flex items-center gap-1 text-xs'>
                      <AlertCircle className='h-3 w-3' />
                      {fieldValuesError}
                    </p>
                  )}

                  {fieldValues.length > 0 && (
                    <div className='flex flex-wrap gap-2'>
                      {fieldValues.map((val, idx) => (
                        <Badge
                          key={idx}
                          variant='secondary'
                          className='flex items-center gap-1 px-3 py-1.5 text-sm'
                        >
                          {val}
                          <button
                            type='button'
                            onClick={() => removeFieldValue(idx)}
                            className='hover:text-destructive ml-1 rounded-full p-0.5'
                          >
                            <X className='h-3 w-3' />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}

                  <p className='text-muted-foreground text-xs'>
                    {fieldValues.length} value
                    {fieldValues.length !== 1 ? 's' : ''} added
                  </p>
                </div>
              </>
            )}

            {/* ── Template Configuration ─────────────────────────────── */}
            {showTemplateSelector && (
              <>
                <Separator />
                <div className='space-y-4'>
                  <h4 className='text-sm font-medium'>
                    Template Configuration
                  </h4>

                  {/* Template dropdown */}
                  <div className='space-y-2'>
                    <Label htmlFor='templateId'>
                      Template <span className='text-destructive'>*</span>
                    </Label>
                    {templates.length === 0 ? (
                      <p className='text-muted-foreground text-sm'>
                        No templates available for this product. Please create a
                        template first.
                      </p>
                    ) : (
                      <Select
                        value={selectedTemplateId}
                        onValueChange={(val) => {
                          setSelectedTemplateId(val);
                          setTemplateError(null);
                        }}
                        disabled={isSubmitting}
                      >
                        <SelectTrigger
                          className={templateError ? 'border-destructive' : ''}
                        >
                          <SelectValue placeholder='Select a template' />
                        </SelectTrigger>
                        <SelectContent>
                          {templates.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}{' '}
                              <span className='text-muted-foreground'>
                                ({t.type})
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {templateError && (
                      <p className='text-destructive text-sm'>
                        {templateError}
                      </p>
                    )}
                  </div>

                  {/* ── Extra Field selector (SELECT_TEMPLATE_EXTRA_FIELD only) ── */}
                  {showExtraFields && (
                    <div className='space-y-4 rounded-md border p-4'>
                      <h5 className='text-sm font-medium'>
                        Extra Field Selection
                      </h5>

                      <div className='space-y-2'>
                        <Label htmlFor='extraId'>
                          Extra Field{' '}
                          <span className='text-destructive'>*</span>
                        </Label>
                        {templateExtras.length === 0 ? (
                          <p className='text-muted-foreground text-sm'>
                            No extra fields found for the selected template.
                          </p>
                        ) : (
                          <Select
                            value={selectedExtraId}
                            onValueChange={(val) => {
                              setSelectedExtraId(val);
                              setExtraIdError(null);
                            }}
                            disabled={isSubmitting}
                          >
                            <SelectTrigger
                              className={
                                extraIdError ? 'border-destructive' : ''
                              }
                            >
                              <SelectValue placeholder='Select an extra field' />
                            </SelectTrigger>
                            <SelectContent>
                              {templateExtras.map((extra) => (
                                <SelectItem key={extra.id} value={extra.id}>
                                  <div className='flex items-center gap-2'>
                                    <span>{extra.label}</span>
                                    <span className='text-muted-foreground text-xs'>
                                      ({extra.sectionType} · {extra.valueType})
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {extraIdError && (
                          <p className='text-destructive text-sm'>
                            {extraIdError}
                          </p>
                        )}
                      </div>

                      {selectedExtraId && (
                        <div className='space-y-2'>
                          <Label htmlFor='extraIndex'>
                            Extra Index (Order No)
                          </Label>
                          <Input
                            id='extraIndex'
                            type='number'
                            value={extraIndex}
                            onChange={(e) =>
                              setExtraIndex(parseInt(e.target.value, 10) || 0)
                            }
                            disabled={isSubmitting}
                          />
                          <p className='text-muted-foreground text-xs'>
                            Auto-filled from the selected extra field&apos;s
                            order number. You can adjust if needed.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Row & Column selector (SELECT_TEMPLATE_VALUE only) ── */}
                  {showRowColumn && (
                    <div className='space-y-4 rounded-md border p-4'>
                      <h5 className='text-sm font-medium'>
                        Row & Column Selection
                      </h5>

                      <div className='grid gap-4 sm:grid-cols-2'>
                        {/* Row */}
                        <div className='space-y-2'>
                          <Label htmlFor='rowId'>
                            Row <span className='text-destructive'>*</span>
                          </Label>
                          {templateRows.length === 0 ? (
                            <p className='text-muted-foreground text-sm'>
                              No rows found for the selected template.
                            </p>
                          ) : (
                            <Select
                              value={selectedRowId}
                              onValueChange={(val) => {
                                setSelectedRowId(val);
                                setRowIdError(null);
                              }}
                              disabled={isSubmitting}
                            >
                              <SelectTrigger
                                className={
                                  rowIdError ? 'border-destructive' : ''
                                }
                              >
                                <SelectValue placeholder='Select a row' />
                              </SelectTrigger>
                              <SelectContent>
                                {templateRows.map((row) => (
                                  <SelectItem key={row.id} value={row.id}>
                                    <div className='flex items-center gap-2'>
                                      <span>{row.label}</span>
                                      <span className='text-muted-foreground text-xs'>
                                        ({row.rowType})
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {rowIdError && (
                            <p className='text-destructive text-sm'>
                              {rowIdError}
                            </p>
                          )}
                        </div>

                        {/* Column */}
                        <div className='space-y-2'>
                          <Label htmlFor='columnId'>
                            Column <span className='text-destructive'>*</span>
                          </Label>
                          {templateColumns.length === 0 ? (
                            <p className='text-muted-foreground text-sm'>
                              No columns found for the selected template.
                            </p>
                          ) : (
                            <Select
                              value={selectedColumnId}
                              onValueChange={(val) => {
                                setSelectedColumnId(val);
                                setColumnIdError(null);
                              }}
                              disabled={isSubmitting}
                            >
                              <SelectTrigger
                                className={
                                  columnIdError ? 'border-destructive' : ''
                                }
                              >
                                <SelectValue placeholder='Select a column' />
                              </SelectTrigger>
                              <SelectContent>
                                {templateColumns.map((col) => (
                                  <SelectItem key={col.id} value={col.id}>
                                    <div className='flex items-center gap-2'>
                                      <span>{col.label}</span>
                                      <span className='text-muted-foreground text-xs'>
                                        ({col.dataType}) Block: (
                                        {col.blockIndex})
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {columnIdError && (
                            <p className='text-destructive text-sm'>
                              {columnIdError}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── Submit ─────────────────────────────────────────────── */}
            <div className='flex gap-4'>
              <Button type='submit' disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    {isEditing ? 'Updating...' : 'Creating...'}
                  </>
                ) : isEditing ? (
                  'Update Field'
                ) : (
                  'Create Field'
                )}
              </Button>
              <Button
                type='button'
                variant='outline'
                onClick={() => router.push(backUrl)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
