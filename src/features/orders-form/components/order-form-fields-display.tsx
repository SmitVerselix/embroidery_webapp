'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  OrderFormMaster,
  OrderTemplateData,
  TemplateWithDetails,
  ExtraValueType
} from '@/lib/api/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  ImageIcon,
  Upload,
  X,
  Loader2,
  Paperclip,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

export type ResolvedOrderFormField = {
  id: string;
  fieldName: string;
  fieldType: string;
  description: string | null;
  fieldValues: string[] | null;
  resolvedValue: string;
  value: string;
  templateId: string | null;
  rowId: string | null;
  columnId: string | null;
  extraId: string | null;
  extraIndex: number | null;
  extraValueType: ExtraValueType | null;
  sortOrder: number;
  /** Name of the referenced template (for SELECT_TEMPLATE_VALUE) */
  templateName: string | null;
  /** Label of the referenced row (for SELECT_TEMPLATE_VALUE) */
  rowLabel: string | null;
  /** Label of the referenced column (for SELECT_TEMPLATE_VALUE) */
  columnLabel: string | null;
};

// =============================================================================
// RESOLVE HELPER
// =============================================================================

export function resolveOrderFormFields(
  orderForms: OrderFormMaster[],
  orderTemplates: OrderTemplateData[],
  templateCache: Record<string, TemplateWithDetails>
): ResolvedOrderFormField[] {
  const otLookup: Record<string, OrderTemplateData> = {};
  for (const ot of orderTemplates) {
    if (!otLookup[ot.templateId]) otLookup[ot.templateId] = ot;
  }

  return orderForms
    .slice()
    .sort((a, b) => {
      const aSort = (a as any).index ?? a.orderNo ?? 0;
      const bSort = (b as any).index ?? b.orderNo ?? 0;
      return aSort - bSort;
    })
    .map((field) => {
      let resolvedValue = '';
      let extraValueType: ExtraValueType | null = null;
      const sortOrder = (field as any).index ?? field.orderNo ?? 0;

      // ── Extract template / row / column names ────────────────────
      const templateName: string | null =
        (field as any).template?.name ??
        (field.templateId
          ? (templateCache[field.templateId]?.name ?? null)
          : null);

      let rowLabel: string | null = (field as any).row?.label ?? null;
      let columnLabel: string | null = (field as any).column?.label ?? null;

      // Fallback: look up from templateCache if not embedded
      if (
        !rowLabel &&
        field.templateId &&
        field.rowId &&
        templateCache[field.templateId]
      ) {
        const tmpl = templateCache[field.templateId];
        const row = (tmpl.rows || []).find((r) => r.id === field.rowId);
        if (row) rowLabel = row.label;
      }
      if (
        !columnLabel &&
        field.templateId &&
        field.columnId &&
        templateCache[field.templateId]
      ) {
        const tmpl = templateCache[field.templateId];
        const col = (tmpl.columns || []).find((c) => c.id === field.columnId);
        if (col) columnLabel = col.label;
      }

      if (
        field.fieldType === 'SELECT_TEMPLATE_VALUE' &&
        field.templateId &&
        field.rowId &&
        field.columnId
      ) {
        const ot = otLookup[field.templateId];
        if (ot) {
          const found = (ot.values || []).find(
            (v) => v.rowId === field.rowId && v.columnId === field.columnId
          );
          if (found) resolvedValue = found.calculatedValue ?? found.value ?? '';
          if (!resolvedValue && ot.children) {
            for (const child of ot.children) {
              const cf = (child.values || []).find(
                (v) => v.rowId === field.rowId && v.columnId === field.columnId
              );
              if (cf) {
                resolvedValue = cf.calculatedValue ?? cf.value ?? '';
                break;
              }
            }
          }
        }
      }

      if (
        field.fieldType === 'SELECT_TEMPLATE_EXTRA_FIELD' &&
        field.templateId &&
        field.extraId
      ) {
        if (templateCache[field.templateId]) {
          const extra = (templateCache[field.templateId].extra || []).find(
            (e) => e.id === field.extraId
          );
          if (extra) extraValueType = extra.valueType as ExtraValueType;
        }
        const ot = otLookup[field.templateId];
        if (ot) {
          const matching = (ot.extraValues || [])
            .filter((ev) => ev.templateExtraFieldId === field.extraId)
            .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
          const idx = field.extraIndex ?? 0;
          if (matching[idx]) resolvedValue = matching[idx].value;
          else if (matching.length > 0) resolvedValue = matching[0].value;
          if (!resolvedValue && ot.children) {
            for (const child of ot.children) {
              const cm = (child.extraValues || [])
                .filter((ev) => ev.templateExtraFieldId === field.extraId)
                .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
              if (cm[idx]) {
                resolvedValue = cm[idx].value;
                break;
              } else if (cm.length > 0) {
                resolvedValue = cm[0].value;
                break;
              }
            }
          }
        }
      }

      return {
        id: field.id,
        fieldName: field.fieldName,
        fieldType: field.fieldType,
        description: field.description,
        fieldValues: field.fieldValues,
        resolvedValue,
        value: resolvedValue,
        templateId: field.templateId,
        rowId: field.rowId,
        columnId: field.columnId,
        extraId: field.extraId,
        extraIndex: field.extraIndex ?? null,
        extraValueType,
        sortOrder,
        templateName,
        rowLabel,
        columnLabel
      };
    });
}

// =============================================================================
// HELPERS
// =============================================================================

const isImageUrl = (url: string): boolean => {
  const lower = url.toLowerCase();
  return /\.(png|jpe?g|gif|webp|svg|bmp)(\?|$)/.test(lower);
};

const getFileNameFromUrl = (url: string): string => {
  try {
    const pathname = new URL(url).pathname;
    const last = pathname.split('/').pop() || 'file';
    return decodeURIComponent(last);
  } catch {
    return url.split('/').pop() || 'file';
  }
};

/**
 * Check if a finalPayableAmount value is valid (non-null, non-empty, non-zero).
 */
function isValidFinalPayableAmount(value: string | null | undefined): boolean {
  if (value == null || value === '') return false;
  const n = parseFloat(value);
  return !isNaN(n) && n !== 0;
}

/**
 * Check whether a resolved value is a "real" non-zero value.
 */
function hasNonZeroResolvedValue(value: string | null | undefined): boolean {
  if (value == null || value.trim() === '') return false;
  const n = parseFloat(value);
  return !isNaN(n) && n !== 0;
}

// =============================================================================
// PROPS
// =============================================================================

interface OrderFormFieldsDisplayProps {
  fields: ResolvedOrderFormField[];
  onFieldValueChange: (fieldId: string, value: string) => void;
  /** Called when a user picks a file for an IMAGE / FILE field. The parent
   *  should upload it (via uploadSingleFile) and then call onFieldValueChange
   *  with the returned URL. */
  onFileUpload?: (fieldId: string, file: File) => Promise<void>;
  /** Set of field IDs that currently have an upload in progress. */
  uploadingFieldIds?: Set<string>;
  /**
   * Template summaries keyed by templateId.
   * Used by SELECT_TEMPLATE fields to derive checkbox state from finalPayableAmount.
   */
  templateSummaries?: Record<string, { finalPayableAmount: string | null }>;
  disabled?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function OrderFormFieldsDisplay({
  fields,
  onFieldValueChange,
  onFileUpload,
  uploadingFieldIds,
  templateSummaries,
  disabled = false
}: OrderFormFieldsDisplayProps) {
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // ── SELECT_TEMPLATE checkbox state ──────────────────────────────────
  const [selectTemplateChecked, setSelectTemplateChecked] = useState<
    Record<string, boolean>
  >({});
  const initRef = useRef(false);

  // ── SELECT_TEMPLATE_VALUE checkbox state ────────────────────────────
  const [selectTemplateValueChecked, setSelectTemplateValueChecked] = useState<
    Record<string, boolean>
  >({});
  const stvInitRef = useRef(false);

  // Initialize SELECT_TEMPLATE checkbox states once
  useEffect(() => {
    if (initRef.current) return;

    const selectTemplateFields = fields.filter(
      (f) => f.fieldType === 'SELECT_TEMPLATE' && f.templateId
    );
    if (selectTemplateFields.length === 0) return;

    initRef.current = true;

    const states: Record<string, boolean> = {};
    selectTemplateFields.forEach((field) => {
      const fpa =
        templateSummaries?.[field.templateId!]?.finalPayableAmount ?? null;
      const hasValidFpa = isValidFinalPayableAmount(fpa);
      const hasFieldValue = isValidFinalPayableAmount(field.value);

      if (hasValidFpa || hasFieldValue) {
        states[field.id] = true;
        if (hasValidFpa && !hasFieldValue) {
          onFieldValueChange(field.id, fpa!);
        }
      } else {
        states[field.id] = false;
      }
    });
    setSelectTemplateChecked(states);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields, templateSummaries]);

  // Initialize SELECT_TEMPLATE_VALUE checkbox states once — checked by default
  useEffect(() => {
    if (stvInitRef.current) return;

    const stvFields = fields.filter(
      (f) => f.fieldType === 'SELECT_TEMPLATE_VALUE' && f.templateId
    );
    if (stvFields.length === 0) return;

    stvInitRef.current = true;

    const states: Record<string, boolean> = {};
    stvFields.forEach((field) => {
      // Checked by default
      states[field.id] = true;
    });
    setSelectTemplateValueChecked(states);
  }, [fields]);

  const handleSelectTemplateToggle = useCallback(
    (fieldId: string, templateId: string, checked: boolean) => {
      setSelectTemplateChecked((prev) => ({ ...prev, [fieldId]: checked }));

      if (!checked) {
        onFieldValueChange(fieldId, '');
      } else {
        const fpa = templateSummaries?.[templateId]?.finalPayableAmount ?? null;
        if (isValidFinalPayableAmount(fpa)) {
          onFieldValueChange(fieldId, fpa!);
        }
      }
    },
    [onFieldValueChange, templateSummaries]
  );

  const handleSelectTemplateValueToggle = useCallback(
    (fieldId: string, checked: boolean) => {
      setSelectTemplateValueChecked((prev) => ({
        ...prev,
        [fieldId]: checked
      }));

      if (!checked) {
        // Unchecked → clear the value
        onFieldValueChange(fieldId, '');
      } else {
        // Checked → restore resolvedValue if it was non-zero
        const field = fields.find((f) => f.id === fieldId);
        if (field && hasNonZeroResolvedValue(field.resolvedValue)) {
          onFieldValueChange(fieldId, field.resolvedValue);
        }
      }
    },
    [onFieldValueChange, fields]
  );

  const handleFileInputChange = useCallback(
    (fieldId: string, event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file && onFileUpload) {
        onFileUpload(fieldId, file);
      }
      event.target.value = '';
    },
    [onFileUpload]
  );

  const handleRemoveFile = useCallback(
    (fieldId: string) => {
      onFieldValueChange(fieldId, '');
    },
    [onFieldValueChange]
  );

  if (fields.length === 0) return null;

  return (
    <>
      {fields.map((field) => {
        const isUploading = uploadingFieldIds?.has(field.id) ?? false;

        // ── SELECT_TEMPLATE → checkbox + conditional input ──────────
        if (field.fieldType === 'SELECT_TEMPLATE' && field.templateId) {
          const fpa =
            templateSummaries?.[field.templateId]?.finalPayableAmount ?? null;
          const hasValidFpa = isValidFinalPayableAmount(fpa);
          const isChecked = selectTemplateChecked[field.id] ?? false;

          const showInput = isChecked && !hasValidFpa;

          const isValueMissing =
            isChecked &&
            !hasValidFpa &&
            (!field.value ||
              field.value.trim() === '' ||
              parseFloat(field.value) === 0);

          return (
            <div key={field.id} className='space-y-2'>
              <div className='flex items-center gap-3'>
                <Checkbox
                  id={`select-template-${field.id}`}
                  checked={isChecked}
                  onCheckedChange={(checked) =>
                    handleSelectTemplateToggle(
                      field.id,
                      field.templateId!,
                      !!checked
                    )
                  }
                  disabled={disabled}
                />
                <Label
                  htmlFor={`select-template-${field.id}`}
                  className='cursor-pointer text-sm font-medium'
                >
                  {field.fieldName}
                </Label>

                {isChecked && hasValidFpa && (
                  <span className='text-muted-foreground font-mono text-sm tabular-nums'>
                    ₹{parseFloat(fpa!).toFixed(2)}
                  </span>
                )}
              </div>

              {showInput && (
                <div className='ml-7 space-y-1'>
                  <Input
                    type='number'
                    step='0.01'
                    min='0'
                    value={field.value || ''}
                    onChange={(e) =>
                      onFieldValueChange(field.id, e.target.value)
                    }
                    disabled={disabled}
                    placeholder='Enter value'
                    className={cn(
                      'max-w-[220px] font-mono tabular-nums',
                      isValueMissing &&
                        'border-red-400 ring-1 ring-red-300 focus-visible:ring-red-400 dark:border-red-600 dark:ring-red-700'
                    )}
                  />
                  {isValueMissing && (
                    <p className='text-[10px] font-medium text-red-500 dark:text-red-400'>
                      Required — enter a value to include this template
                    </p>
                  )}
                </div>
              )}

              {field.description && (
                <p className='text-muted-foreground ml-7 text-xs'>
                  {field.description}
                </p>
              )}
            </div>
          );
        }

        // ── SELECT_TEMPLATE_VALUE → checkbox + template/row/column ref ──
        if (field.fieldType === 'SELECT_TEMPLATE_VALUE') {
          const isChecked = selectTemplateValueChecked[field.id] ?? true;
          const hasResolved = hasNonZeroResolvedValue(field.resolvedValue);

          // When checked & no resolved value → user must enter a value
          const needsInput = isChecked && !hasResolved;
          const isValueMissing =
            needsInput &&
            (!field.value ||
              field.value.trim() === '' ||
              parseFloat(field.value) === 0);

          return (
            <div key={field.id} className='space-y-2'>
              <div className='flex items-center gap-3'>
                <Checkbox
                  id={`stv-${field.id}`}
                  checked={isChecked}
                  onCheckedChange={(checked) =>
                    handleSelectTemplateValueToggle(field.id, !!checked)
                  }
                  disabled={disabled}
                />
                <div className='flex-1'>
                  <Label
                    htmlFor={`stv-${field.id}`}
                    className='cursor-pointer text-sm font-medium'
                  >
                    {field.fieldName}
                  </Label>
                  {(field.templateName ||
                    field.rowLabel ||
                    field.columnLabel) && (
                    <p className='text-muted-foreground text-xs'>
                      {[field.templateName, field.rowLabel, field.columnLabel]
                        .filter(Boolean)
                        .join(' › ')}
                    </p>
                  )}
                </div>

                {/* If checked and value exists → show (-) */}
                {isChecked && hasResolved && (
                  <span className='text-muted-foreground rounded bg-gray-100 px-2 py-0.5 font-mono text-sm tabular-nums dark:bg-gray-800'>
                    (-)
                  </span>
                )}
              </div>

              {/* If checked and no resolved value → mandatory input */}
              {needsInput && (
                <div className='ml-7 space-y-1'>
                  <Input
                    type='number'
                    step='0.01'
                    value={field.value || ''}
                    onChange={(e) =>
                      onFieldValueChange(field.id, e.target.value)
                    }
                    disabled={disabled}
                    placeholder='Enter value'
                    className={cn(
                      'max-w-[220px] font-mono tabular-nums',
                      isValueMissing &&
                        'border-red-400 ring-1 ring-red-300 focus-visible:ring-red-400 dark:border-red-600 dark:ring-red-700'
                    )}
                  />
                  {isValueMissing && (
                    <p className='text-[10px] font-medium text-red-500 dark:text-red-400'>
                      Required — enter a value
                    </p>
                  )}
                </div>
              )}

              {field.description && (
                <p className='text-muted-foreground ml-7 text-xs'>
                  {field.description}
                </p>
              )}
            </div>
          );
        }

        // ── IMAGE extra → image preview + upload ────────────────────
        if (
          field.fieldType === 'SELECT_TEMPLATE_EXTRA_FIELD' &&
          field.extraValueType === 'IMAGE'
        ) {
          const hasValue = !!field.value?.trim();

          return (
            <div key={field.id} className='space-y-2'>
              <Label>{field.fieldName}</Label>

              <input
                type='file'
                ref={(el) => {
                  fileInputRefs.current[field.id] = el;
                }}
                accept='image/*'
                onChange={(e) => handleFileInputChange(field.id, e)}
                className='hidden'
                disabled={disabled || isUploading}
              />

              {isUploading ? (
                <div className='bg-muted/30 flex h-32 flex-col items-center justify-center rounded-lg border-2 border-dashed'>
                  <Loader2 className='text-primary mb-1 h-6 w-6 animate-spin' />
                  <span className='text-muted-foreground text-xs'>
                    Uploading image…
                  </span>
                </div>
              ) : hasValue ? (
                <div className='overflow-hidden rounded-lg border'>
                  {isImageUrl(field.value) ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={field.value}
                        alt={field.fieldName}
                        className='h-auto max-h-64 w-full object-contain'
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          img.style.display = 'none';
                          const fb = img.nextElementSibling;
                          if (fb) (fb as HTMLElement).style.display = 'flex';
                        }}
                      />
                      <div className='bg-muted text-muted-foreground hidden h-32 items-center justify-center gap-2 text-sm'>
                        <ImageIcon className='h-5 w-5' />
                        Failed to load image
                      </div>
                    </>
                  ) : (
                    <div className='bg-muted text-muted-foreground flex h-32 items-center justify-center gap-2 text-sm'>
                      <ImageIcon className='h-5 w-5' />
                      Image uploaded
                    </div>
                  )}

                  {onFileUpload && (
                    <div className='bg-muted/30 flex items-center gap-1 border-t p-1.5'>
                      <Button
                        type='button'
                        size='sm'
                        variant='ghost'
                        className='h-7 flex-1 text-xs'
                        onClick={() => fileInputRefs.current[field.id]?.click()}
                        disabled={disabled}
                      >
                        <Upload className='mr-1 h-3 w-3' />
                        Replace
                      </Button>
                      <Button
                        type='button'
                        size='sm'
                        variant='ghost'
                        className='text-destructive hover:text-destructive h-7 flex-1 text-xs'
                        onClick={() => handleRemoveFile(field.id)}
                        disabled={disabled}
                      >
                        <X className='mr-1 h-3 w-3' />
                        Remove
                      </Button>
                    </div>
                  )}
                </div>
              ) : onFileUpload ? (
                <button
                  type='button'
                  onClick={() => fileInputRefs.current[field.id]?.click()}
                  disabled={disabled}
                  className={cn(
                    'bg-muted/30 flex h-32 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed',
                    'hover:bg-muted/50 hover:border-primary/50 cursor-pointer transition-colors',
                    'focus:ring-ring focus:ring-2 focus:ring-offset-2 focus:outline-none',
                    disabled && 'cursor-not-allowed opacity-50'
                  )}
                >
                  <Upload className='text-muted-foreground mb-1 h-5 w-5' />
                  <span className='text-muted-foreground text-xs'>
                    Click to upload image
                  </span>
                </button>
              ) : (
                <div className='bg-muted text-muted-foreground flex h-32 items-center justify-center gap-2 rounded-lg border text-sm'>
                  <ImageIcon className='h-5 w-5' />
                  No image uploaded
                </div>
              )}
            </div>
          );
        }

        // ── FILE extra → file link + upload ─────────────────────────
        if (
          field.fieldType === 'SELECT_TEMPLATE_EXTRA_FIELD' &&
          field.extraValueType === 'FILE'
        ) {
          const hasValue = !!field.value?.trim();

          return (
            <div key={field.id} className='space-y-2'>
              <Label>{field.fieldName}</Label>

              <input
                type='file'
                ref={(el) => {
                  fileInputRefs.current[field.id] = el;
                }}
                accept='*/*'
                onChange={(e) => handleFileInputChange(field.id, e)}
                className='hidden'
                disabled={disabled || isUploading}
              />

              {isUploading ? (
                <div className='bg-muted/30 flex h-20 flex-col items-center justify-center rounded-lg border-2 border-dashed'>
                  <Loader2 className='text-primary mb-1 h-6 w-6 animate-spin' />
                  <span className='text-muted-foreground text-xs'>
                    Uploading file…
                  </span>
                </div>
              ) : hasValue ? (
                <div className='flex items-center gap-2 rounded-md border p-2'>
                  <Paperclip className='text-muted-foreground h-4 w-4 flex-shrink-0' />
                  <a
                    href={field.value}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-primary flex-1 truncate text-xs hover:underline'
                    title={field.value}
                  >
                    {getFileNameFromUrl(field.value)}
                  </a>
                  <a
                    href={field.value}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-muted-foreground hover:text-foreground flex-shrink-0'
                  >
                    <ExternalLink className='h-3.5 w-3.5' />
                  </a>
                  {onFileUpload && (
                    <>
                      <Button
                        type='button'
                        size='icon'
                        variant='ghost'
                        className='h-6 w-6 flex-shrink-0'
                        onClick={() => fileInputRefs.current[field.id]?.click()}
                        disabled={disabled}
                        title='Replace file'
                      >
                        <Upload className='h-3.5 w-3.5' />
                      </Button>
                      <Button
                        type='button'
                        size='icon'
                        variant='ghost'
                        className='h-6 w-6 flex-shrink-0'
                        onClick={() => handleRemoveFile(field.id)}
                        disabled={disabled}
                        title='Remove file'
                      >
                        <X className='h-3.5 w-3.5' />
                      </Button>
                    </>
                  )}
                </div>
              ) : onFileUpload ? (
                <button
                  type='button'
                  onClick={() => fileInputRefs.current[field.id]?.click()}
                  disabled={disabled}
                  className={cn(
                    'bg-muted/30 flex h-20 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed',
                    'hover:bg-muted/50 hover:border-primary/50 cursor-pointer transition-colors',
                    'focus:ring-ring focus:ring-2 focus:ring-offset-2 focus:outline-none',
                    disabled && 'cursor-not-allowed opacity-50'
                  )}
                >
                  <Upload className='text-muted-foreground mb-1 h-5 w-5' />
                  <span className='text-muted-foreground text-xs'>
                    Click to attach file
                  </span>
                </button>
              ) : (
                <p className='text-muted-foreground text-sm'>No file</p>
              )}
            </div>
          );
        }

        // ── Standalone IMAGE field → image preview + upload ─────────
        if (field.fieldType === 'IMAGE') {
          const hasValue = !!field.value?.trim();

          return (
            <div key={field.id} className='space-y-2'>
              <Label>{field.fieldName}</Label>

              <input
                type='file'
                ref={(el) => {
                  fileInputRefs.current[field.id] = el;
                }}
                accept='image/*'
                onChange={(e) => handleFileInputChange(field.id, e)}
                className='hidden'
                disabled={disabled || isUploading}
              />

              {isUploading ? (
                <div className='bg-muted/30 flex h-32 flex-col items-center justify-center rounded-lg border-2 border-dashed'>
                  <Loader2 className='text-primary mb-1 h-6 w-6 animate-spin' />
                  <span className='text-muted-foreground text-xs'>
                    Uploading image…
                  </span>
                </div>
              ) : hasValue ? (
                <div className='overflow-hidden rounded-lg border'>
                  {isImageUrl(field.value) ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={field.value}
                        alt={field.fieldName}
                        className='h-auto max-h-64 w-full object-contain'
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          img.style.display = 'none';
                          const fb = img.nextElementSibling;
                          if (fb) (fb as HTMLElement).style.display = 'flex';
                        }}
                      />
                      <div className='bg-muted text-muted-foreground hidden h-32 items-center justify-center gap-2 text-sm'>
                        <ImageIcon className='h-5 w-5' />
                        Failed to load image
                      </div>
                    </>
                  ) : (
                    <div className='bg-muted text-muted-foreground flex h-32 items-center justify-center gap-2 text-sm'>
                      <ImageIcon className='h-5 w-5' />
                      Image uploaded
                    </div>
                  )}

                  {onFileUpload && (
                    <div className='bg-muted/30 flex items-center gap-1 border-t p-1.5'>
                      <Button
                        type='button'
                        size='sm'
                        variant='ghost'
                        className='h-7 flex-1 text-xs'
                        onClick={() => fileInputRefs.current[field.id]?.click()}
                        disabled={disabled}
                      >
                        <Upload className='mr-1 h-3 w-3' />
                        Replace
                      </Button>
                      <Button
                        type='button'
                        size='sm'
                        variant='ghost'
                        className='text-destructive hover:text-destructive h-7 flex-1 text-xs'
                        onClick={() => handleRemoveFile(field.id)}
                        disabled={disabled}
                      >
                        <X className='mr-1 h-3 w-3' />
                        Remove
                      </Button>
                    </div>
                  )}
                </div>
              ) : onFileUpload ? (
                <button
                  type='button'
                  onClick={() => fileInputRefs.current[field.id]?.click()}
                  disabled={disabled}
                  className={cn(
                    'bg-muted/30 flex h-32 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed',
                    'hover:bg-muted/50 hover:border-primary/50 cursor-pointer transition-colors',
                    'focus:ring-ring focus:ring-2 focus:ring-offset-2 focus:outline-none',
                    disabled && 'cursor-not-allowed opacity-50'
                  )}
                >
                  <Upload className='text-muted-foreground mb-1 h-5 w-5' />
                  <span className='text-muted-foreground text-xs'>
                    Click to upload image
                  </span>
                </button>
              ) : (
                <div className='bg-muted text-muted-foreground flex h-32 items-center justify-center gap-2 rounded-lg border text-sm'>
                  <ImageIcon className='h-5 w-5' />
                  No image uploaded
                </div>
              )}
            </div>
          );
        }

        // ── Standalone FILE field → file link + upload ──────────────
        if (field.fieldType === 'FILE') {
          const hasValue = !!field.value?.trim();

          return (
            <div key={field.id} className='space-y-2'>
              <Label>{field.fieldName}</Label>

              <input
                type='file'
                ref={(el) => {
                  fileInputRefs.current[field.id] = el;
                }}
                accept='*/*'
                onChange={(e) => handleFileInputChange(field.id, e)}
                className='hidden'
                disabled={disabled || isUploading}
              />

              {isUploading ? (
                <div className='bg-muted/30 flex h-20 flex-col items-center justify-center rounded-lg border-2 border-dashed'>
                  <Loader2 className='text-primary mb-1 h-6 w-6 animate-spin' />
                  <span className='text-muted-foreground text-xs'>
                    Uploading file…
                  </span>
                </div>
              ) : hasValue ? (
                <div className='overflow-hidden rounded-md border'>
                  {isImageUrl(field.value) && (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={field.value}
                        alt={field.fieldName}
                        className='h-auto max-h-48 w-full object-contain'
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </>
                  )}
                  <div className='flex items-center gap-2 border-t p-2'>
                    <Paperclip className='text-muted-foreground h-4 w-4 flex-shrink-0' />
                    <a
                      href={field.value}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='text-primary flex-1 truncate text-xs hover:underline'
                      title={field.value}
                    >
                      {getFileNameFromUrl(field.value)}
                    </a>
                    <a
                      href={field.value}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='text-muted-foreground hover:text-foreground flex-shrink-0'
                    >
                      <ExternalLink className='h-3.5 w-3.5' />
                    </a>
                    {onFileUpload && (
                      <>
                        <Button
                          type='button'
                          size='icon'
                          variant='ghost'
                          className='h-6 w-6 flex-shrink-0'
                          onClick={() =>
                            fileInputRefs.current[field.id]?.click()
                          }
                          disabled={disabled}
                          title='Replace file'
                        >
                          <Upload className='h-3.5 w-3.5' />
                        </Button>
                        <Button
                          type='button'
                          size='icon'
                          variant='ghost'
                          className='h-6 w-6 flex-shrink-0'
                          onClick={() => handleRemoveFile(field.id)}
                          disabled={disabled}
                          title='Remove file'
                        >
                          <X className='h-3.5 w-3.5' />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ) : onFileUpload ? (
                <button
                  type='button'
                  onClick={() => fileInputRefs.current[field.id]?.click()}
                  disabled={disabled}
                  className={cn(
                    'bg-muted/30 flex h-20 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed',
                    'hover:bg-muted/50 hover:border-primary/50 cursor-pointer transition-colors',
                    'focus:ring-ring focus:ring-2 focus:ring-offset-2 focus:outline-none',
                    disabled && 'cursor-not-allowed opacity-50'
                  )}
                >
                  <Upload className='text-muted-foreground mb-1 h-5 w-5' />
                  <span className='text-muted-foreground text-xs'>
                    Click to attach file
                  </span>
                </button>
              ) : (
                <p className='text-muted-foreground text-sm'>No file</p>
              )}
            </div>
          );
        }

        // ── SELECT → dropdown ───────────────────────────────────────
        if (field.fieldType === 'SELECT' && field.fieldValues) {
          return (
            <div key={field.id} className='space-y-2'>
              <Label>{field.fieldName}</Label>
              <Select
                value={field.value}
                onValueChange={(v) => onFieldValueChange(field.id, v)}
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue placeholder={`Select ${field.fieldName}`} />
                </SelectTrigger>
                <SelectContent>
                  {field.fieldValues.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        }

        // ── RADIO ───────────────────────────────────────────────────
        if (field.fieldType === 'RADIO' && field.fieldValues) {
          return (
            <div key={field.id} className='space-y-2'>
              <Label>{field.fieldName}</Label>
              <div className='flex flex-wrap gap-3'>
                {field.fieldValues.map((opt) => (
                  <label
                    key={opt}
                    className='flex cursor-pointer items-center gap-1.5 text-sm'
                  >
                    <input
                      type='radio'
                      name={`radio-${field.id}`}
                      value={opt}
                      checked={field.value === opt}
                      onChange={() => onFieldValueChange(field.id, opt)}
                      disabled={disabled}
                      className='accent-primary'
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
          );
        }

        // ── CHECKBOX / MULTI_SELECT ─────────────────────────────────
        if (
          (field.fieldType === 'CHECKBOX' ||
            field.fieldType === 'MULTI_SELECT') &&
          field.fieldValues
        ) {
          const cur = field.value
            ? field.value.split(',').map((v) => v.trim())
            : [];
          return (
            <div key={field.id} className='space-y-2'>
              <Label>{field.fieldName}</Label>
              <div className='flex flex-wrap gap-3'>
                {field.fieldValues.map((opt) => {
                  const checked = cur.includes(opt);
                  return (
                    <label
                      key={opt}
                      className='flex cursor-pointer items-center gap-1.5 text-sm'
                    >
                      <input
                        type='checkbox'
                        checked={checked}
                        onChange={() => {
                          const next = checked
                            ? cur.filter((v) => v !== opt)
                            : [...cur, opt];
                          onFieldValueChange(
                            field.id,
                            next.filter(Boolean).join(', ')
                          );
                        }}
                        disabled={disabled}
                        className='accent-primary'
                      />
                      {opt}
                    </label>
                  );
                })}
              </div>
            </div>
          );
        }

        // ── Default: text/number input ──────────────────────────────
        return (
          <div key={field.id} className='space-y-2'>
            <Label>{field.fieldName}</Label>
            <Input
              value={field.value}
              onChange={(e) => onFieldValueChange(field.id, e.target.value)}
              disabled={disabled}
              placeholder={`Enter ${field.fieldName}`}
              type={field.fieldType === 'NUMBER' ? 'number' : 'text'}
            />
          </div>
        );
      })}
    </>
  );
}
