/**
 * Component: OrderExtraValues
 * Description: Editable extra fields (header, footer, media) for order templates.
 *              Supports TEXT, NUMBER, DATE value types with proper validation.
 *              IMAGE and FILE types support upload via the upload-single API.
 *              The uploaded file URL is stored as the extra field value.
 */

'use client';

import { useMemo, useCallback, useState, useRef } from 'react';
import type { TemplateExtra } from '@/lib/api/types';
import { uploadSingleFile } from '@/lib/api/services';
import { getError } from '@/lib/api/axios';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Hash,
  Type,
  Calendar,
  Image as ImageIcon,
  Paperclip,
  AlertCircle,
  Upload,
  X,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ImageViewer from '@/components/ui/image-viewer';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Map of extraFieldId → { value, orderExtraValueId? }
 * orderExtraValueId is present for existing values (needed for update API)
 * For IMAGE/FILE types, value stores the uploaded file URL
 */
export type ExtraValuesMap = Record<
  string,
  {
    value: string;
    orderExtraValueId?: string;
    orderIndex?: number;
  }
>;

export interface OrderExtraValuesProps {
  extras: TemplateExtra[];
  values: ExtraValuesMap;
  onChange: (values: ExtraValuesMap) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
  readOnly?: boolean;
  sectionType: 'HEADER' | 'FOOTER' | 'MEDIA';
}

// =============================================================================
// HELPERS
// =============================================================================

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

const getInputType = (valueType: string): string => {
  switch (valueType) {
    case 'NUMBER':
      return 'number';
    case 'DATE':
      return 'date';
    default:
      return 'text';
  }
};

const getPlaceholder = (valueType: string): string => {
  switch (valueType) {
    case 'TEXT':
      return 'Enter text…';
    case 'NUMBER':
      return '0';
    case 'DATE':
      return 'Select date';
    default:
      return '—';
  }
};

const getSectionConfig = (sectionType: string) => {
  switch (sectionType) {
    case 'HEADER':
      return {
        icon: FileText,
        label: 'Header Fields',
        bgClass: 'bg-blue-50/50 dark:bg-blue-950/20',
        borderClass: 'border-blue-200 dark:border-blue-900',
        iconClass: 'text-blue-600 dark:text-blue-400',
        titleClass: 'text-blue-900 dark:text-blue-100',
      };
    case 'FOOTER':
      return {
        icon: FileText,
        label: 'Footer Fields',
        bgClass: 'bg-amber-50/50 dark:bg-amber-950/20',
        borderClass: 'border-amber-200 dark:border-amber-900',
        iconClass: 'text-amber-600 dark:text-amber-400',
        titleClass: 'text-amber-900 dark:text-amber-100',
      };
    case 'MEDIA':
      return {
        icon: ImageIcon,
        label: 'Media Fields',
        bgClass: 'bg-purple-50/50 dark:bg-purple-950/20',
        borderClass: 'border-purple-200 dark:border-purple-900',
        iconClass: 'text-purple-600 dark:text-purple-400',
        titleClass: 'text-purple-900 dark:text-purple-100',
      };
    default:
      return {
        icon: FileText,
        label: 'Extra Fields',
        bgClass: 'bg-muted/50',
        borderClass: 'border-border',
        iconClass: 'text-muted-foreground',
        titleClass: 'text-foreground',
      };
  }
};

const getAcceptString = (valueType: string): string => {
  if (valueType === 'IMAGE') return 'image/*';
  return '*/*';
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

const isImageUrl = (url: string): boolean => {
  const lower = url.toLowerCase();
  return /\.(png|jpe?g|gif|webp|svg|bmp)(\?|$)/.test(lower);
};

// =============================================================================
// COMPONENT
// =============================================================================

export default function OrderExtraValues({
  extras,
  values,
  onChange,
  errors = {},
  disabled = false,
  readOnly = false,
  sectionType,
}: OrderExtraValuesProps) {
  const sortedExtras = useMemo(
    () =>
      [...extras]
        .filter((e) => e.sectionType === sectionType)
        .sort((a, b) => a.orderNo - b.orderNo),
    [extras, sectionType]
  );

  // Upload state per field
  const [uploadingFields, setUploadingFields] = useState<
    Record<string, boolean>
  >({});
  const [uploadErrors, setUploadErrors] = useState<
    Record<string, string>
  >({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // ── Text/Number/Date value change ──────────────────────────────────
  const handleValueChange = useCallback(
    (extraId: string, newValue: string) => {
      const existing = values[extraId];
      onChange({
        ...values,
        [extraId]: {
          value: newValue,
          orderExtraValueId: existing?.orderExtraValueId,
          orderIndex: existing?.orderIndex ?? 0,
        },
      });
    },
    [values, onChange]
  );

  // ── File upload handler ────────────────────────────────────────────
  const handleFileUpload = useCallback(
    async (extraId: string, file: File) => {
      setUploadErrors((prev) => {
        const next = { ...prev };
        delete next[extraId];
        return next;
      });
      setUploadingFields((prev) => ({ ...prev, [extraId]: true }));

      try {
        const result = await uploadSingleFile(file);

        // Store the uploaded URL as the value
        const existing = values[extraId];
        onChange({
          ...values,
          [extraId]: {
            value: result.url,
            orderExtraValueId: existing?.orderExtraValueId,
            orderIndex: existing?.orderIndex ?? 0,
          },
        });
      } catch (err) {
        setUploadErrors((prev) => ({
          ...prev,
          [extraId]: getError(err),
        }));
      } finally {
        setUploadingFields((prev) => ({ ...prev, [extraId]: false }));
      }
    },
    [values, onChange]
  );

  const handleFileInputChange = useCallback(
    (extraId: string, event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        handleFileUpload(extraId, file);
      }
      event.target.value = '';
    },
    [handleFileUpload]
  );

  // ── Remove file ────────────────────────────────────────────────────
  const handleRemoveFile = useCallback(
    (extraId: string) => {
      const existing = values[extraId];
      onChange({
        ...values,
        [extraId]: {
          value: '',
          orderExtraValueId: existing?.orderExtraValueId,
          orderIndex: existing?.orderIndex ?? 0,
        },
      });
      setUploadErrors((prev) => {
        const next = { ...prev };
        delete next[extraId];
        return next;
      });
    },
    [values, onChange]
  );

  if (sortedExtras.length === 0) return null;

  const config = getSectionConfig(sectionType);
  const SectionIcon = config.icon;

  return (
    <div
      className={cn(
        'border rounded-lg',
        config.bgClass,
        config.borderClass
      )}
    >
      {/* Section Header */}
      <div
        className={cn(
          'flex items-center gap-2 px-4 py-2.5 border-b',
          config.borderClass
        )}
      >
        <SectionIcon className={cn('h-4 w-4', config.iconClass)} />
        <h4 className={cn('text-sm font-semibold', config.titleClass)}>
          {config.label}
        </h4>
        <Badge variant="secondary" className="text-[10px] ml-auto">
          {sortedExtras.length} field{sortedExtras.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Fields Grid */}
      <div
        className={cn(
          'p-4',
          sectionType === 'MEDIA'
            ? 'space-y-3'
            : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'
        )}
      >
        {sortedExtras.map((extra) => {
          const fieldValue = values[extra.id]?.value || '';
          const fieldError = errors[extra.id];
          const isFileType =
            extra.valueType === 'IMAGE' || extra.valueType === 'FILE';
          const isUploading = uploadingFields[extra.id] || false;
          const uploadError = uploadErrors[extra.id];
          const hasValue = !!fieldValue.trim();

          return (
            <div
              key={extra.id}
              className="bg-white dark:bg-background rounded-md border p-3 space-y-2"
            >
              {/* Field Label */}
              <div className="flex items-center gap-1.5">
                <ValueTypeIcon type={extra.valueType} />
                <Label className="text-sm font-medium text-foreground">
                  {extra.label}
                </Label>
                {extra.isRequired && (
                  <span className="text-destructive text-xs font-bold">*</span>
                )}
              </div>

              {/* ── IMAGE / FILE field ─────────────────────────────── */}
              {isFileType ? (
                <div className="space-y-2">
                  {/* Hidden file input */}
                  <input
                    type="file"
                    ref={(el) => {
                      fileInputRefs.current[extra.id] = el;
                    }}
                    accept={getAcceptString(extra.valueType)}
                    onChange={(e) => handleFileInputChange(extra.id, e)}
                    className="hidden"
                    disabled={disabled || readOnly || isUploading}
                  />

                  {isUploading ? (
                    /* Uploading spinner */
                    <div className="flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-md bg-muted/30">
                      <Loader2 className="h-6 w-6 text-primary animate-spin mb-1" />
                      <span className="text-[11px] text-muted-foreground">
                        Uploading...
                      </span>
                    </div>
                  ) : hasValue ? (
                    /* ── Preview: image or file link ────────────────── */
                    <div className="border rounded-md overflow-hidden">
                      {extra.valueType === 'IMAGE' && isImageUrl(fieldValue) ? (
                        /* Image preview — click to open full viewer */
                        <div>
                          <ImageViewer
                            src={fieldValue}
                            alt={extra.label}
                            className="w-full h-32 object-cover"
                          />
                          {!readOnly && (
                            <div className="flex items-center gap-1 p-1.5 border-t bg-muted/30">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs flex-1"
                                onClick={() =>
                                  fileInputRefs.current[extra.id]?.click()
                                }
                                disabled={disabled}
                              >
                                <Upload className="h-3 w-3 mr-1" />
                                Replace
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs flex-1 text-destructive hover:text-destructive"
                                onClick={() => handleRemoveFile(extra.id)}
                                disabled={disabled}
                              >
                                <X className="h-3 w-3 mr-1" />
                                Remove
                              </Button>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* File link */
                        <div className="flex items-center gap-2 p-2">
                          <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <a
                            href={fieldValue}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline truncate flex-1"
                            title={fieldValue}
                          >
                            {getFileNameFromUrl(fieldValue)}
                          </a>
                          <a
                            href={fieldValue}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground flex-shrink-0"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                          {!readOnly && (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 flex-shrink-0"
                              onClick={() => handleRemoveFile(extra.id)}
                              disabled={disabled}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : readOnly ? (
                    /* Read-only empty */
                    <div className="flex flex-col items-center justify-center h-20 border-2 border-dashed rounded-md bg-muted/30">
                      {extra.valueType === 'IMAGE' ? (
                        <>
                          <ImageIcon className="h-6 w-6 text-muted-foreground/40 mb-1" />
                          <span className="text-[11px] text-muted-foreground">
                            No image
                          </span>
                        </>
                      ) : (
                        <>
                          <Paperclip className="h-6 w-6 text-muted-foreground/40 mb-1" />
                          <span className="text-[11px] text-muted-foreground">
                            No file
                          </span>
                        </>
                      )}
                    </div>
                  ) : (
                    /* Upload button */
                    <button
                      type="button"
                      onClick={() =>
                        fileInputRefs.current[extra.id]?.click()
                      }
                      disabled={disabled}
                      className={cn(
                        'flex flex-col items-center justify-center w-full h-20 border-2 border-dashed rounded-md bg-muted/30',
                        'hover:bg-muted/50 hover:border-primary/50 transition-colors cursor-pointer',
                        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                        disabled && 'opacity-50 cursor-not-allowed',
                        fieldError && 'border-destructive'
                      )}
                    >
                      <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                      <span className="text-[11px] text-muted-foreground">
                        {extra.valueType === 'IMAGE'
                          ? 'Click to upload image'
                          : 'Click to attach file'}
                      </span>
                    </button>
                  )}

                  {/* Upload error */}
                  {uploadError && (
                    <div className="flex items-center gap-1 text-[10px] text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      <span>{uploadError}</span>
                    </div>
                  )}

                  {/* Validation error */}
                  {fieldError && (
                    <div className="flex items-center gap-1 text-[10px] text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      <span>{fieldError}</span>
                    </div>
                  )}
                </div>
              ) : readOnly ? (
                /* ── Read-only text/number/date ──────────────────── */
                <div className="h-9 flex items-center px-3 text-sm border rounded-md bg-muted/30">
                  {fieldValue || (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              ) : (
                /* ── Editable text/number/date ───────────────────── */
                <div className="space-y-1">
                  <Input
                    type={getInputType(extra.valueType)}
                    value={fieldValue}
                    onChange={(e) =>
                      handleValueChange(extra.id, e.target.value)
                    }
                    placeholder={getPlaceholder(extra.valueType)}
                    disabled={disabled}
                    className={cn(
                      'h-9',
                      fieldError && 'border-destructive'
                    )}
                    step={extra.valueType === 'NUMBER' ? 'any' : undefined}
                  />
                  {fieldError && (
                    <div className="flex items-center gap-1 text-[10px] text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      <span>{fieldError}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}