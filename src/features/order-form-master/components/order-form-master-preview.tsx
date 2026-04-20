'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { reorderOrderFormMasters } from '@/lib/api/services';
import { getError } from '@/lib/api/axios';
import type { OrderFormMaster, OrderFormFieldType } from '@/lib/api/types';
import { ORDER_FORM_FIELD_TYPES } from '@/lib/api/types';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Eye,
  GripVertical,
  Type,
  Hash,
  ListFilter,
  CheckSquare,
  Upload,
  CircleDot,
  LayoutTemplate,
  Table2,
  FileText,
  Loader2,
  Calendar,
  AlertCircle,
  ClipboardList,
  Image as ImageIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// =============================================================================
// HELPERS
// =============================================================================

function getFieldTypeLabel(value: string): string {
  return (
    ORDER_FORM_FIELD_TYPES.find((ft) => ft.value === value)?.label || value
  );
}

function getFieldTypeIcon(fieldType: OrderFormFieldType) {
  switch (fieldType) {
    case 'TEXT':
      return <Type className='h-3.5 w-3.5' />;
    case 'NUMBER':
      return <Hash className='h-3.5 w-3.5' />;
    case 'SELECT':
      return <ListFilter className='h-3.5 w-3.5' />;
    case 'MULTI_SELECT':
      return <ListFilter className='h-3.5 w-3.5' />;
    case 'CHECKBOX':
      return <CheckSquare className='h-3.5 w-3.5' />;
    case 'FILE':
      return <Upload className='h-3.5 w-3.5' />;
    case 'RADIO':
      return <CircleDot className='h-3.5 w-3.5' />;
    case 'SELECT_TEMPLATE_EXTRA_FIELD':
      return <LayoutTemplate className='h-3.5 w-3.5' />;
    case 'SELECT_TEMPLATE_VALUE':
      return <Table2 className='h-3.5 w-3.5' />;
    case 'SELECT_TEMPLATE':
      return <LayoutTemplate className='h-3.5 w-3.5' />;
    default:
      return <Type className='h-3.5 w-3.5' />;
  }
}

/** Determine if a field should be rendered on the right (media) side */
function isMediaField(field: OrderFormMaster): boolean {
  if (field.fieldType === 'FILE') return true;
  // SELECT_TEMPLATE_EXTRA_FIELD pointing to an IMAGE extra goes to right side
  if (
    field.fieldType === 'SELECT_TEMPLATE_EXTRA_FIELD' &&
    field.extra?.valueType === 'IMAGE'
  ) {
    return true;
  }
  return false;
}

/** Get the sort index — handles both `index` (product/get) and `orderNo` */
function getSortIndex(field: OrderFormMaster): number {
  if ('index' in field && typeof (field as any).index === 'number') {
    return (field as any).index;
  }
  return field.orderNo ?? 0;
}

// =============================================================================
// INLINE INPUT RENDERERS (compact form-row style)
// =============================================================================

function InlineInput({ field }: { field: OrderFormMaster }) {
  const chevron = (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width='14'
      height='14'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
      className='text-muted-foreground/60 shrink-0'
    >
      <path d='m6 9 6 6 6-6' />
    </svg>
  );

  switch (field.fieldType) {
    case 'TEXT':
      return (
        <div className='border-muted-foreground/30 flex h-8 flex-1 items-center border-b border-dashed px-1'>
          <span className='text-muted-foreground/40 text-xs italic'>
            Enter {field.fieldName.toLowerCase()}…
          </span>
        </div>
      );

    case 'NUMBER':
      return (
        <div className='border-muted-foreground/30 flex h-8 w-28 items-center justify-end border-b border-dashed px-1'>
          <span className='text-muted-foreground/40 text-xs italic'>0.00</span>
        </div>
      );

    case 'SELECT':
      return (
        <div className='border-muted-foreground/30 flex h-8 flex-1 items-center justify-between border-b border-dashed px-1'>
          <span className='text-muted-foreground/40 text-xs italic'>
            Select…
          </span>
          {chevron}
        </div>
      );

    case 'MULTI_SELECT':
      return (
        <div className='border-muted-foreground/30 flex h-8 flex-1 items-center justify-between border-b border-dashed px-1'>
          <span className='text-muted-foreground/40 text-xs italic'>
            Select multiple…
          </span>
          {chevron}
        </div>
      );

    case 'CHECKBOX':
      return (
        <div className='flex flex-1 flex-wrap items-center gap-x-3 gap-y-1'>
          {(field.fieldValues && field.fieldValues.length > 0
            ? field.fieldValues.slice(0, 4)
            : ['Option 1', 'Option 2']
          ).map((val, i) => (
            <label key={i} className='flex items-center gap-1.5 text-xs'>
              <div className='border-muted-foreground/40 h-3.5 w-3.5 rounded-sm border' />
              <span className='text-muted-foreground/70'>{val}</span>
            </label>
          ))}
          {field.fieldValues && field.fieldValues.length > 4 && (
            <span className='text-muted-foreground/50 text-[10px]'>
              +{field.fieldValues.length - 4}
            </span>
          )}
        </div>
      );

    case 'RADIO':
      return (
        <div className='flex flex-1 flex-wrap items-center gap-x-3 gap-y-1'>
          {(field.fieldValues && field.fieldValues.length > 0
            ? field.fieldValues.slice(0, 4)
            : ['Option 1', 'Option 2']
          ).map((val, i) => (
            <label key={i} className='flex items-center gap-1.5 text-xs'>
              <div className='border-muted-foreground/40 h-3.5 w-3.5 rounded-full border' />
              <span className='text-muted-foreground/70'>{val}</span>
            </label>
          ))}
          {field.fieldValues && field.fieldValues.length > 4 && (
            <span className='text-muted-foreground/50 text-[10px]'>
              +{field.fieldValues.length - 4}
            </span>
          )}
        </div>
      );

    case 'SELECT_TEMPLATE_EXTRA_FIELD':
      return (
        <div className='border-muted-foreground/30 flex h-8 flex-1 items-center justify-between border-b border-dashed px-1'>
          <div className='flex items-center gap-1.5'>
            <LayoutTemplate className='text-muted-foreground/40 h-3 w-3' />
            <span className='text-muted-foreground/40 text-xs italic'>
              Template extra…
            </span>
          </div>
          {chevron}
        </div>
      );

    case 'SELECT_TEMPLATE_VALUE':
      return (
        <div className='border-muted-foreground/30 flex h-8 flex-1 items-center justify-between border-b border-dashed px-1'>
          <div className='flex items-center gap-1.5'>
            <Table2 className='text-muted-foreground/40 h-3 w-3' />
            <span className='text-muted-foreground/40 text-xs italic'>
              Template value…
            </span>
          </div>
          {chevron}
        </div>
      );

    case 'SELECT_TEMPLATE':
      return (
        <div className='border-muted-foreground/30 flex h-8 flex-1 items-center justify-between border-b border-dashed px-1'>
          <div className='flex items-center gap-1.5'>
            <LayoutTemplate className='text-muted-foreground/40 h-3 w-3' />
            <span className='text-muted-foreground/40 text-xs italic'>
              Select template…
            </span>
          </div>
          {chevron}
        </div>
      );

    default:
      return (
        <div className='border-muted-foreground/30 flex h-8 flex-1 items-center border-b border-dashed px-1'>
          <span className='text-muted-foreground/40 text-xs'>—</span>
        </div>
      );
  }
}

// =============================================================================
// SORTABLE FORM ROW (left-side regular fields)
// =============================================================================

function SortableFormRow({ field }: { field: OrderFormMaster }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  const hasValues =
    field.fieldValues &&
    field.fieldValues.length > 0 &&
    !['CHECKBOX', 'RADIO'].includes(field.fieldType);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-start gap-2 rounded px-2 py-2 transition-colors',
        'hover:bg-muted/40',
        isDragging && 'z-50 opacity-30'
      )}
    >
      {/* Drag handle */}
      <button
        type='button'
        className={cn(
          'mt-1 cursor-grab touch-none rounded p-0.5 transition-opacity',
          'opacity-0 group-hover:opacity-60 hover:!opacity-100',
          'active:cursor-grabbing'
        )}
        {...attributes}
        {...listeners}
      >
        <GripVertical className='text-muted-foreground h-3.5 w-3.5' />
      </button>

      {/* Label */}
      <div className='flex w-[140px] shrink-0 items-center gap-1.5 pt-1.5'>
        <span className='text-muted-foreground'>
          {getFieldTypeIcon(field.fieldType)}
        </span>
        <span className='text-foreground text-sm leading-tight font-medium'>
          {field.fieldName}
        </span>
      </div>

      {/* Separator */}
      <span className='text-muted-foreground/40 pt-1.5 text-sm'>:</span>

      {/* Input area */}
      <div className='min-w-0 flex-1 pt-0.5'>
        <InlineInput field={field} />

        {/* Values badges row for select types */}
        {hasValues && (
          <div className='mt-1 flex flex-wrap gap-1'>
            {field.fieldValues!.slice(0, 5).map((val, i) => (
              <span
                key={i}
                className='text-muted-foreground bg-muted/60 rounded px-1.5 py-0 text-[10px]'
              >
                {val}
              </span>
            ))}
            {field.fieldValues!.length > 5 && (
              <span className='text-muted-foreground/50 text-[10px]'>
                +{field.fieldValues!.length - 5}
              </span>
            )}
          </div>
        )}

        {/* Template link info */}
        {field.templateId &&
          (field.fieldType === 'SELECT_TEMPLATE_EXTRA_FIELD' ||
            field.fieldType === 'SELECT_TEMPLATE_VALUE' ||
            field.fieldType === 'SELECT_TEMPLATE') && (
            <div className='mt-1 flex items-center gap-2 text-[10px]'>
              {field.template ? (
                <span className='text-muted-foreground/60'>
                  ↳ {field.template.name}
                </span>
              ) : (
                <span className='text-muted-foreground/40 font-mono'>
                  ↳ {field.templateId.slice(0, 8)}…
                </span>
              )}
              {field.extra && (
                <span className='text-muted-foreground/60'>
                  → {field.extra.label}
                </span>
              )}
              {field.row && (
                <span className='text-muted-foreground/60'>
                  → {field.row.label}
                </span>
              )}
              {field.column && (
                <span className='text-muted-foreground/60'>
                  → {field.column.label}
                </span>
              )}
            </div>
          )}
      </div>

      {/* Field type badge */}
      <Badge
        variant='outline'
        className='mt-1.5 shrink-0 px-1.5 py-0 text-[9px] opacity-0 transition-opacity group-hover:opacity-100'
      >
        {getFieldTypeLabel(field.fieldType)}
      </Badge>
    </div>
  );
}

// =============================================================================
// SORTABLE MEDIA CARD (right-side file/image fields)
// =============================================================================

function SortableMediaCard({ field }: { field: OrderFormMaster }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  const isImage =
    field.fieldType === 'FILE' ||
    (field.fieldType === 'SELECT_TEMPLATE_EXTRA_FIELD' &&
      field.extra?.valueType === 'IMAGE');

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative rounded-lg border-2 border-dashed transition-all',
        'border-muted-foreground/20 hover:border-muted-foreground/40',
        isDragging && 'z-50 opacity-30'
      )}
    >
      {/* Drag handle */}
      <button
        type='button'
        className={cn(
          'absolute -top-1 -left-1 z-10 cursor-grab touch-none rounded-full p-1 transition-opacity',
          'bg-background border shadow-sm',
          'opacity-0 group-hover:opacity-100',
          'active:cursor-grabbing'
        )}
        {...attributes}
        {...listeners}
      >
        <GripVertical className='text-muted-foreground h-3 w-3' />
      </button>

      {/* Image / File placeholder */}
      <div className='flex flex-col items-center justify-center px-3 pt-4 pb-3'>
        <div className='bg-muted/30 mb-2 flex h-20 w-full items-center justify-center rounded-md'>
          {isImage ? (
            <ImageIcon className='text-muted-foreground/25 h-10 w-10' />
          ) : (
            <Upload className='text-muted-foreground/25 h-10 w-10' />
          )}
        </div>

        {/* Label */}
        <p className='text-foreground text-center text-xs font-semibold'>
          {field.fieldName}
        </p>

        {/* Subtitle */}
        {field.template && (
          <p className='text-muted-foreground/50 mt-0.5 text-center text-[10px]'>
            {field.template.name}
          </p>
        )}

        {/* Type badge */}
        <Badge variant='outline' className='mt-1.5 px-1.5 py-0 text-[9px]'>
          {getFieldTypeLabel(field.fieldType)}
        </Badge>
      </div>
    </div>
  );
}

// =============================================================================
// DRAG OVERLAY ITEMS
// =============================================================================

function DragOverlayFormRow({ field }: { field: OrderFormMaster }) {
  return (
    <div className='bg-background ring-primary/20 flex items-start gap-2 rounded border px-2 py-2 shadow-xl ring-2'>
      <div className='mt-1 rounded p-0.5'>
        <GripVertical className='text-muted-foreground h-3.5 w-3.5' />
      </div>
      <div className='flex w-[140px] shrink-0 items-center gap-1.5 pt-1.5'>
        <span className='text-muted-foreground'>
          {getFieldTypeIcon(field.fieldType)}
        </span>
        <span className='text-foreground text-sm font-medium'>
          {field.fieldName}
        </span>
      </div>
      <span className='text-muted-foreground/40 pt-1.5 text-sm'>:</span>
      <div className='min-w-0 flex-1 pt-0.5'>
        <InlineInput field={field} />
      </div>
    </div>
  );
}

function DragOverlayMediaCard({ field }: { field: OrderFormMaster }) {
  return (
    <div className='bg-background ring-primary/20 w-[180px] rounded-lg border-2 border-dashed shadow-xl ring-2'>
      <div className='flex flex-col items-center justify-center px-3 pt-4 pb-3'>
        <div className='bg-muted/30 mb-2 flex h-20 w-full items-center justify-center rounded-md'>
          <ImageIcon className='text-muted-foreground/25 h-10 w-10' />
        </div>
        <p className='text-foreground text-center text-xs font-semibold'>
          {field.fieldName}
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// PROPS
// =============================================================================

interface OrderFormMasterPreviewProps {
  companyId: string;
  productId: string;
  fields: OrderFormMaster[];
  onFieldsChange?: (reorderedFields: OrderFormMaster[]) => void;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function OrderFormMasterPreview({
  companyId,
  productId,
  fields: initialFields,
  onFieldsChange
}: OrderFormMasterPreviewProps) {
  const [fields, setFields] = useState<OrderFormMaster[]>(() =>
    [...initialFields].sort((a, b) => getSortIndex(a) - getSortIndex(b))
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);

  // Sync when parent data changes
  useEffect(() => {
    setFields(
      [...initialFields].sort((a, b) => getSortIndex(a) - getSortIndex(b))
    );
  }, [initialFields]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  // Split into left (form) and right (media) fields
  const leftFields = useMemo(
    () => fields.filter((f) => !isMediaField(f)),
    [fields]
  );
  const rightFields = useMemo(
    () => fields.filter((f) => isMediaField(f)),
    [fields]
  );

  // Active drag item
  const activeField = useMemo(
    () => fields.find((f) => f.id === activeId) || null,
    [fields, activeId]
  );

  // ─── Drag Handlers ───────────────────────────────────────────────────────

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over || active.id === over.id) return;

      // Determine which list the active item belongs to
      const activeIsMedia = isMediaField(
        fields.find((f) => f.id === active.id)!
      );
      const overIsMedia = isMediaField(fields.find((f) => f.id === over.id)!);

      // Only allow reordering within the same column
      if (activeIsMedia !== overIsMedia) return;

      // Reorder within the sub-list
      const subList = activeIsMedia ? [...rightFields] : [...leftFields];
      const oldIndex = subList.findIndex((f) => f.id === active.id);
      const newIndex = subList.findIndex((f) => f.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reorderedSub = arrayMove(subList, oldIndex, newIndex);

      // Rebuild full list: left fields first, then right fields
      const newFullList = activeIsMedia
        ? [...leftFields, ...reorderedSub]
        : [...reorderedSub, ...rightFields];

      // Optimistic update
      setFields(newFullList);
      onFieldsChange?.(newFullList);

      // API call
      setIsReordering(true);
      try {
        await reorderOrderFormMasters(companyId, productId, {
          ids: newFullList.map((f) => f.id)
        });

        const updated = newFullList.map((f, i) => ({ ...f, orderNo: i + 1 }));
        setFields(updated);
        onFieldsChange?.(updated);
        toast.success('Field order updated');
      } catch (err) {
        setFields(fields);
        onFieldsChange?.(fields);
        toast.error(getError(err));
      } finally {
        setIsReordering(false);
      }
    },
    [fields, leftFields, rightFields, companyId, productId, onFieldsChange]
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  // ─── Empty State ──────────────────────────────────────────────────────────

  if (fields.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className='flex items-center gap-2'>
            <Eye className='text-muted-foreground h-5 w-5' />
            <div>
              <CardTitle className='text-lg'>Order Form Preview</CardTitle>
              <CardDescription>
                Preview of how your order form will look
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className='bg-muted/30 flex flex-col items-center justify-center rounded-lg border py-12 text-center'>
            <AlertCircle className='text-muted-foreground mb-3 h-10 w-10' />
            <h3 className='text-lg font-medium'>No Fields Yet</h3>
            <p className='text-muted-foreground mt-1 max-w-sm text-sm'>
              Add order form fields to see the preview.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const hasMediaFields = rightFields.length > 0;
  const hasLeftFields = leftFields.length > 0;

  return (
    <Card>
      <CardHeader className='pb-3'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <Eye className='text-muted-foreground h-5 w-5' />
            <div>
              <CardTitle className='text-lg'>Order Form Preview</CardTitle>
              <CardDescription>
                Drag fields to reorder. Left side: form fields · Right side:
                photos & files
              </CardDescription>
            </div>
          </div>
          {isReordering && (
            <div className='text-muted-foreground flex items-center gap-2 text-sm'>
              <Loader2 className='h-4 w-4 animate-spin' />
              <span>Saving…</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className='pt-0'>
        {/* ═══════════════════ THE FORM ═══════════════════ */}
        <div className='bg-background overflow-hidden rounded-lg border shadow-sm'>
          {/* ── Form Header ── */}
          <div className='bg-muted/40 border-b px-5 py-3'>
            <div className='flex items-center justify-between'>
              {/* Left: Form title */}
              <div className='flex items-center gap-2.5'>
                <div className='bg-primary/10 flex h-7 w-7 items-center justify-center rounded'>
                  <ClipboardList className='text-primary h-3.5 w-3.5' />
                </div>
                <div>
                  <h3 className='text-sm font-bold tracking-tight'>
                    Order Form
                  </h3>
                  <p className='text-muted-foreground/60 text-[10px]'>
                    {fields.length} field{fields.length !== 1 ? 's' : ''} · Drag
                    to reorder
                  </p>
                </div>
              </div>

              {/* Right: Date & Order No */}
              <div className='flex items-center gap-5 text-[11px]'>
                <div className='flex items-center gap-1.5'>
                  <span className='text-muted-foreground font-medium'>
                    Date/Time:
                  </span>
                  <span className='border-muted-foreground/30 w-24 border-b border-dashed text-center font-mono text-[10px]'>
                    DD/MM/YYYY
                  </span>
                </div>
                <div className='flex items-center gap-1.5'>
                  <span className='text-muted-foreground font-medium'>
                    Order No:
                  </span>
                  <span className='border-muted-foreground/30 w-16 border-b border-dashed text-center font-mono text-[10px]'>
                    ____
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Form Body ── */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <div
              className={cn(
                'flex min-h-[300px] gap-0',
                !hasMediaFields && 'flex-col'
              )}
            >
              {/* ──── LEFT COLUMN: Form Fields ──── */}
              {hasLeftFields && (
                <div
                  className={cn(
                    'flex-1 px-3 py-3',
                    hasMediaFields && 'border-r'
                  )}
                >
                  <SortableContext
                    items={leftFields.map((f) => f.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className='divide-muted/60 divide-y'>
                      {leftFields.map((field) => (
                        <SortableFormRow key={field.id} field={field} />
                      ))}
                    </div>
                  </SortableContext>
                </div>
              )}

              {/* ──── RIGHT COLUMN: Media / Image Fields ──── */}
              {hasMediaFields && (
                <div className='w-[200px] shrink-0 px-3 py-3'>
                  <SortableContext
                    items={rightFields.map((f) => f.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className='space-y-3'>
                      {rightFields.map((field) => (
                        <SortableMediaCard key={field.id} field={field} />
                      ))}
                    </div>
                  </SortableContext>
                </div>
              )}
            </div>

            {/* Drag Overlay */}
            <DragOverlay dropAnimation={null}>
              {activeField ? (
                isMediaField(activeField) ? (
                  <DragOverlayMediaCard field={activeField} />
                ) : (
                  <DragOverlayFormRow field={activeField} />
                )
              ) : null}
            </DragOverlay>
          </DndContext>

          {/* ── Form Footer ── */}
          <div className='bg-muted/20 border-t px-5 py-2'>
            <div className='flex items-center justify-between'>
              <div className='text-muted-foreground/50 flex items-center gap-3 text-[10px]'>
                <div className='flex items-center gap-1'>
                  <div className='bg-muted-foreground/20 h-2.5 w-2.5 rounded-sm' />
                  <span>Form fields: {leftFields.length}</span>
                </div>
                {hasMediaFields && (
                  <div className='flex items-center gap-1'>
                    <div className='border-muted-foreground/20 h-2.5 w-2.5 rounded-sm border border-dashed' />
                    <span>Media: {rightFields.length}</span>
                  </div>
                )}
              </div>
              <div className='text-muted-foreground/40 text-[10px]'>
                <GripVertical className='mr-1 inline h-3 w-3' />
                Hover over a field to drag
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
