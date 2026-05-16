'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  getOrder,
  updateOrderValues,
  recalculateOrder
} from '@/lib/api/services';
import { getError } from '@/lib/api/axios';
import type {
  OrderWithDetails,
  TemplateWithDetails,
  OrderTemplateData,
  UpdateOrderValuesData,
  OrderValue
} from '@/lib/api/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  ArrowLeft,
  AlertCircle,
  Pencil,
  Copy,
  Loader2,
  RotateCw,
  Check,
  X,
  History,
  Trash2,
  Plus,
  LayoutTemplate
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import Link from 'next/link';
import OrderTemplateValues, {
  type TemplateValuesMap
} from './order-template-values';
import type { ExtraValuesMap } from './order-extra-values';
import OrderTemplatePDF, { type FinalCalcData } from './order-template-pdf';
import type { TemplateLayoutItem } from './template-layout-canvas';
import TemplateCanvasContainer from './template-canvas-container';
import { toast } from 'sonner';
import api from '@/lib/api/axios';

// =============================================================================
// HELPERS
// =============================================================================

const getStatusBadgeVariant = (status: string | null) => {
  switch (status) {
    case 'APPROVED':
    case 'COMPLETED':
      return 'default' as const;
    case 'PENDING':
      return 'secondary' as const;
    case 'REJECTED':
    case 'CANCELLED':
      return 'destructive' as const;
    default:
      return 'outline' as const;
  }
};

const getOrderTypeBadgeVariant = (type: string) => {
  switch (type) {
    case 'PRODUCTION':
      return 'default' as const;
    case 'SAMPLE':
      return 'secondary' as const;
    default:
      return 'outline' as const;
  }
};

/** Format a numeric string to 2 decimal places for display */
const formatAmount = (value: string | null | undefined): string => {
  if (!value) return '0';
  const num = parseFloat(value);
  if (isNaN(num)) return '0';
  if (num === 0) return '0';
  return num.toFixed(2);
};

// =============================================================================
// INTERNAL TYPES
// =============================================================================

type OrderTemplateSummary = {
  id: string;
  total: string;
  discount: string | null;
  discountAmount: string;
  discountType: string | null;
  finalPayableAmount: string;
  notes: string | null;
  additionalTemplateCosts: { costName: string; cost: number; notes: string }[];
};

type OrderTemplateEntry = {
  orderTemplateId: string;
  templateId: string;
  template: TemplateWithDetails;
  parentOrderTemplateId: string | null;
  isChild: boolean;
  summary: OrderTemplateSummary | null;
  isNew?: boolean;
};

type DiscountType = 'AMOUNT' | 'PERCENT';

// BlockValuesMap: numeric blockIndex → templateBlockId
type BlockValuesMap = Record<number, string>;

// =============================================================================
// ADDITIONAL COST TYPES
// =============================================================================

type AdditionalCost = {
  /** Local-only key for React rendering — never sent to API */
  _key: string;
  costName: string;
  cost: string; // kept as string while editing, parsed on submit
  notes: string;
};

type AdditionalCostErrors = {
  costName?: string;
  cost?: string;
};

// =============================================================================
// UPDATE FINAL CALCULATION API
// =============================================================================

type UpdateFinalCalculationPayload = {
  notes: { orderTemplateId: string; notes: string }[];
  discount: number;
  discountType: DiscountType;
  marginDiscount: number;
  marginType: DiscountType;
  addonDiscount: number;
  addonType: DiscountType;
  additionalCosts: { notes: string; costName: string; cost: number }[];
};

const updateFinalCalculation = async (
  companyId: string,
  orderId: string,
  data: UpdateFinalCalculationPayload
): Promise<void> => {
  await api.put(
    `/api/v1/web/user/${companyId}/order/update-final-calculation/${orderId}`,
    data
  );
};

// =============================================================================
// PROPS
// =============================================================================

interface OrderDetailProps {
  companyId: string;
  orderId: string;
}

// =============================================================================
// FINAL CALCULATION TABLE — TYPES
// =============================================================================

type FinalCalcTemplateRow = {
  label: string;
  orderTemplateId: string;
  total: string;
  childTotal: string | null;
  notes: string | null;
};

// =============================================================================
// HELPERS — generate a stable local key for new rows
// =============================================================================

let _costKeyCounter = 0;
const nextCostKey = () => `cost_${++_costKeyCounter}_${Date.now()}`;

// =============================================================================
// FINAL CALCULATION TABLE COMPONENT
// =============================================================================

interface FinalCalculationTableProps {
  templateRows: FinalCalcTemplateRow[];
  total: string;
  discount: string;
  discountType: string | null;
  addonDiscount: string;
  addonType: string | null;
  marginDiscount: string;
  marginType: string | null;
  marginTotal: string;
  finalPayableAmount: string;
  hasAnyChildren: boolean;
  companyId: string;
  orderId: string;
  /** Existing additional costs from the API response */
  additionalCosts?: { notes: string; costName: string; cost: number }[];
  onSaved: () => Promise<void>;
}

function FinalCalculationTable({
  templateRows,
  total,
  discount,
  discountType: orderDiscountType,
  addonDiscount,
  addonType: orderAddonType,
  marginDiscount,
  marginType: orderMarginType,
  marginTotal,
  finalPayableAmount,
  hasAnyChildren,
  companyId,
  orderId,
  additionalCosts = [],
  onSaved
}: FinalCalculationTableProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [formDiscount, setFormDiscount] = useState(discount);
  const [formDiscountType, setFormDiscountType] = useState<DiscountType>(
    (orderDiscountType as DiscountType) || 'AMOUNT'
  );
  const [formMarginDiscount, setFormMarginDiscount] = useState(marginDiscount);
  const [formMarginType, setFormMarginType] = useState<DiscountType>(
    (orderMarginType as DiscountType) || 'AMOUNT'
  );
  const [formAddonDiscount, setFormAddonDiscount] = useState(addonDiscount);
  const [formAddonType, setFormAddonType] = useState<DiscountType>(
    (orderAddonType as DiscountType) || 'AMOUNT'
  );

  const [formNotes, setFormNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      templateRows.map((r) => [r.orderTemplateId, r.notes ?? ''])
    )
  );

  // ── Additional costs state ────────────────────────────────────────
  const toFormCosts = (
    src: { notes: string; costName: string; cost: number }[]
  ): AdditionalCost[] =>
    src.map((c) => ({
      _key: nextCostKey(),
      costName: c.costName,
      cost: String(c.cost),
      notes: c.notes
    }));

  const [formCosts, setFormCosts] = useState<AdditionalCost[]>(() =>
    toFormCosts(additionalCosts)
  );
  const [costErrors, setCostErrors] = useState<
    Record<string, AdditionalCostErrors>
  >({});

  // ── Sync props → form when not editing ────────────────────────────
  useEffect(() => {
    if (!isEditing) {
      setFormDiscount(discount);
      setFormMarginDiscount(marginDiscount);
      setFormAddonDiscount(addonDiscount);
      setFormCosts(toFormCosts(additionalCosts));
      setCostErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discount, marginDiscount, addonDiscount, additionalCosts, isEditing]);

  // ── Edit / Cancel ─────────────────────────────────────────────────
  const handleEdit = () => {
    setFormDiscount(discount);
    setFormDiscountType((orderDiscountType as DiscountType) || 'AMOUNT');
    setFormMarginDiscount(marginDiscount);
    setFormMarginType((orderMarginType as DiscountType) || 'AMOUNT');
    setFormAddonDiscount(addonDiscount);
    setFormAddonType((orderAddonType as DiscountType) || 'AMOUNT');
    setFormNotes(
      Object.fromEntries(
        templateRows.map((r) => [r.orderTemplateId, r.notes ?? ''])
      )
    );
    setFormCosts(toFormCosts(additionalCosts));
    setCostErrors({});
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setCostErrors({});
  };

  // ── Additional cost row helpers ───────────────────────────────────
  const addCostRow = () => {
    setFormCosts((prev) => [
      ...prev,
      { _key: nextCostKey(), costName: '', cost: '', notes: '' }
    ]);
  };

  const removeCostRow = (key: string) => {
    setFormCosts((prev) => prev.filter((c) => c._key !== key));
    setCostErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const updateCostRow = (
    key: string,
    field: keyof Omit<AdditionalCost, '_key'>,
    value: string
  ) => {
    setFormCosts((prev) =>
      prev.map((c) => (c._key === key ? { ...c, [field]: value } : c))
    );
    // Clear the specific field error on change
    if (field === 'costName' || field === 'cost') {
      setCostErrors((prev) => {
        const rowErr = { ...prev[key] };
        delete rowErr[field];
        return { ...prev, [key]: rowErr };
      });
    }
  };

  // ── Validation ────────────────────────────────────────────────────
  const validateCosts = (): boolean => {
    const newErrors: Record<string, AdditionalCostErrors> = {};
    let valid = true;

    for (const row of formCosts) {
      const rowErr: AdditionalCostErrors = {};

      if (!row.costName.trim()) {
        rowErr.costName = 'Name is required';
        valid = false;
      }

      const costNum = parseFloat(row.cost);
      if (row.cost.trim() === '') {
        rowErr.cost = 'Value is required';
        valid = false;
      } else if (isNaN(costNum)) {
        rowErr.cost = 'Must be a valid number';
        valid = false;
      } else if (costNum < 0) {
        rowErr.cost = 'Must be 0 or greater';
        valid = false;
      }

      if (Object.keys(rowErr).length > 0) newErrors[row._key] = rowErr;
    }

    // Validate discount / margin / addon fields (they must be valid numbers)
    const discountErrors: string[] = [];
    if (formDiscount.trim() !== '' && isNaN(parseFloat(formDiscount))) {
      discountErrors.push('Discount must be a valid number');
    }
    if (
      formMarginDiscount.trim() !== '' &&
      isNaN(parseFloat(formMarginDiscount))
    ) {
      discountErrors.push('Margin discount must be a valid number');
    }
    if (
      formAddonDiscount.trim() !== '' &&
      isNaN(parseFloat(formAddonDiscount))
    ) {
      discountErrors.push('Addon discount must be a valid number');
    }

    if (discountErrors.length > 0) {
      discountErrors.forEach((msg) => toast.error(msg));
      valid = false;
    }

    setCostErrors(newErrors);
    return valid;
  };

  // ── Submit ────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validateCosts()) return;

    setIsSaving(true);
    try {
      const notes = templateRows
        .map((r) => ({
          orderTemplateId: r.orderTemplateId,
          notes: formNotes[r.orderTemplateId] ?? ''
        }))
        .filter((n) => n.notes.trim() !== '');

      const additionalCostsPayload = formCosts.map((c) => ({
        costName: c.costName.trim(),
        cost: parseFloat(c.cost) || 0,
        notes: c.notes.trim()
      }));

      await updateFinalCalculation(companyId, orderId, {
        notes,
        discount: parseFloat(formDiscount) || 0,
        discountType: formDiscountType,
        addonDiscount: parseFloat(formAddonDiscount) || 0,
        addonType: formAddonType,
        marginDiscount: parseFloat(formMarginDiscount) || 0,
        marginType: formMarginType,
        additionalCosts: additionalCostsPayload
      });

      toast.success('Final calculation updated successfully');
      setIsEditing(false);
      await onSaved();
    } catch (err) {
      toast.error(getError(err) || 'Failed to update final calculation');
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  // ── Data columns span ─────────────────────────────────────────────
  // Table has: Label | Total | [Child Total] | Notes
  // When hasAnyChildren the numeric cells span 2 cols (Total + Child Total)
  const numColSpan = hasAnyChildren ? 2 : 1;

  return (
    <div className='w-full min-w-[520px]'>
      {/* Header */}
      <div className='my-2 flex items-center justify-between px-4'>
        <h3 className='text-sm font-semibold'>Final Calculation</h3>
        {!isEditing ? (
          <Button
            variant='outline'
            size='sm'
            className='gap-1.5'
            onClick={handleEdit}
          >
            <Pencil className='h-3.5 w-3.5' /> Edit
          </Button>
        ) : (
          <div className='flex items-center gap-2'>
            <Button
              variant='outline'
              size='sm'
              className='gap-1.5'
              onClick={handleCancel}
              disabled={isSaving}
            >
              <X className='h-3.5 w-3.5' /> Cancel
            </Button>
            <Button
              size='sm'
              className='gap-1.5'
              onClick={handleSubmit}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className='h-3.5 w-3.5 animate-spin' />
              ) : (
                <Check className='h-3.5 w-3.5' />
              )}{' '}
              Submit
            </Button>
          </div>
        )}
      </div>

      <div className='overflow-hidden rounded-md border'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='bg-muted/50 border-b'>
              <th className='px-4 py-2.5 text-left font-medium' />
              <th className='px-4 py-2.5 text-left font-medium'>Total</th>
              {hasAnyChildren && (
                <th className='px-4 py-2.5 text-left font-medium'>
                  Child Total
                </th>
              )}
              <th className='px-4 py-2.5 text-left font-medium'>Notes</th>
            </tr>
          </thead>
          <tbody>
            {/* ── Template rows ─────────────────────────────────── */}
            {templateRows.map((row) => (
              <tr key={row.orderTemplateId} className='border-b'>
                <td className='px-4 py-2 font-medium'>{row.label}</td>
                <td className='px-4 py-2 font-mono tabular-nums'>
                  {row.total}
                </td>
                {hasAnyChildren && (
                  <td className='text-muted-foreground px-4 py-2 font-mono tabular-nums'>
                    {row.childTotal ?? '—'}
                  </td>
                )}
                <td className='px-4 py-2'>
                  {isEditing ? (
                    <Input
                      className='h-7 min-w-[160px] text-xs'
                      placeholder='Add notes…'
                      value={formNotes[row.orderTemplateId] ?? ''}
                      onChange={(e) =>
                        setFormNotes((prev) => ({
                          ...prev,
                          [row.orderTemplateId]: e.target.value
                        }))
                      }
                      onKeyDown={handleKeyDown}
                    />
                  ) : row.notes ? (
                    <span className='text-foreground text-xs'>{row.notes}</span>
                  ) : (
                    <span className='text-muted-foreground text-xs'>—</span>
                  )}
                </td>
              </tr>
            ))}

            {/* ── Additional cost rows (view mode) ──────────────── */}
            {!isEditing &&
              additionalCosts.map((c, idx) => (
                <tr key={idx} className='bg-muted/20 border-b'>
                  <td className='px-4 py-2 text-xs font-medium'>
                    {c.costName}
                  </td>
                  <td
                    className='px-4 py-2 font-mono tabular-nums'
                    colSpan={numColSpan}
                  >
                    {formatAmount(String(c.cost))}
                  </td>
                  <td className='px-4 py-2'>
                    {c.notes ? (
                      <span className='text-foreground text-xs'>{c.notes}</span>
                    ) : (
                      <span className='text-muted-foreground text-xs'>—</span>
                    )}
                  </td>
                </tr>
              ))}

            {/* ── Additional cost rows (edit mode) ──────────────── */}
            {isEditing && (
              <>
                {formCosts.map((row) => {
                  const errs = costErrors[row._key] ?? {};
                  return (
                    <tr
                      key={row._key}
                      className='bg-muted/20 border-b align-top'
                    >
                      {/* Name */}
                      <td className='px-4 py-2'>
                        <div className='flex flex-col gap-0.5'>
                          <Input
                            className={`h-7 min-w-[130px] text-xs ${errs.costName ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                            placeholder='Name *'
                            value={row.costName}
                            onChange={(e) =>
                              updateCostRow(
                                row._key,
                                'costName',
                                e.target.value
                              )
                            }
                            onKeyDown={handleKeyDown}
                          />
                          {errs.costName && (
                            <span className='text-destructive text-[10px] leading-tight'>
                              {errs.costName}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Value */}
                      <td className='px-4 py-2' colSpan={numColSpan}>
                        <div className='flex flex-col gap-0.5'>
                          <Input
                            className={`h-7 w-32 font-mono text-xs tabular-nums ${errs.cost ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                            type='number'
                            min='0'
                            step='0.01'
                            placeholder='0.00 *'
                            value={row.cost}
                            onChange={(e) =>
                              updateCostRow(row._key, 'cost', e.target.value)
                            }
                            onKeyDown={handleKeyDown}
                          />
                          {errs.cost && (
                            <span className='text-destructive text-[10px] leading-tight'>
                              {errs.cost}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Notes + delete */}
                      <td className='px-4 py-2'>
                        <div className='flex items-start gap-2'>
                          <Input
                            className='h-7 min-w-[130px] text-xs'
                            placeholder='Notes (optional)'
                            value={row.notes}
                            onChange={(e) =>
                              updateCostRow(row._key, 'notes', e.target.value)
                            }
                            onKeyDown={handleKeyDown}
                          />
                          <Button
                            variant='ghost'
                            size='icon'
                            className='text-destructive hover:text-destructive hover:bg-destructive/10 mt-0 h-7 w-7 shrink-0'
                            onClick={() => removeCostRow(row._key)}
                            title='Remove row'
                          >
                            <X className='h-3.5 w-3.5' />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {/* Add row button */}
                <tr className='border-b'>
                  <td colSpan={hasAnyChildren ? 4 : 3} className='px-4 py-2'>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-7 gap-1.5 text-xs'
                      onClick={addCostRow}
                    >
                      <Plus className='h-3.5 w-3.5' />
                      Add Additional Cost
                    </Button>
                  </td>
                </tr>
              </>
            )}

            {/* ── Total ─────────────────────────────────────────── */}
            <tr className='border-t-2 border-b font-semibold'>
              <td className='px-4 py-2'>Total</td>
              <td
                className='px-4 py-2 font-mono tabular-nums'
                colSpan={numColSpan}
              >
                {total}
              </td>
              <td className='px-4 py-2' />
            </tr>

            {/* ── Margin Discount ───────────────────────────────── */}
            <tr className='border-b'>
              <td className='px-4 py-2 font-medium'>Margin Discount</td>
              <td className='px-4 py-2' colSpan={numColSpan}>
                {isEditing ? (
                  <div className='flex items-center gap-2'>
                    <Input
                      className='h-7 w-28 font-mono text-xs tabular-nums'
                      type='number'
                      step='0.01'
                      value={formMarginDiscount}
                      onChange={(e) => setFormMarginDiscount(e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                    {/* +/- sign toggle — mutates the value directly */}
                    <div className='flex h-7 overflow-hidden rounded-md border'>
                      <button
                        type='button'
                        onClick={() =>
                          setFormMarginDiscount((prev) =>
                            String(Math.abs(parseFloat(prev) || 0))
                          )
                        }
                        className={`flex w-8 items-center justify-center text-xs font-semibold transition-colors ${
                          !(parseFloat(formMarginDiscount) < 0)
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-background text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        +
                      </button>
                      <div className='bg-border w-px' />
                      <button
                        type='button'
                        onClick={() =>
                          setFormMarginDiscount((prev) => {
                            const n = Math.abs(parseFloat(prev) || 0);
                            return n === 0 ? '0' : String(-n);
                          })
                        }
                        className={`flex w-8 items-center justify-center text-xs font-semibold transition-colors ${
                          parseFloat(formMarginDiscount) < 0
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-background text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        −
                      </button>
                    </div>
                    <Select
                      value={formMarginType}
                      onValueChange={(v) =>
                        setFormMarginType(v as DiscountType)
                      }
                    >
                      <SelectTrigger className='h-7 w-28 text-xs'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='AMOUNT'>Amount (₹)</SelectItem>
                        <SelectItem value='PERCENT'>Percent (%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <span className='font-mono tabular-nums'>
                    {marginDiscount} {orderMarginType === 'PERCENT' ? '%' : '₹'}
                  </span>
                )}
              </td>
              <td className='px-4 py-2' />
            </tr>

            <tr className='border-b'>
              <td className='px-4 py-2 font-medium'>Margin Total</td>
              <td
                className='px-4 py-2 font-mono tabular-nums'
                colSpan={numColSpan}
              >
                {marginTotal}
              </td>
              <td className='px-4 py-2' />
            </tr>

            {/* ── Discount ──────────────────────────────────────── */}
            <tr className='border-b'>
              <td className='px-4 py-2 font-medium'>Discount</td>
              <td className='px-4 py-2' colSpan={numColSpan}>
                {isEditing ? (
                  <div className='flex items-center gap-2'>
                    <Input
                      className='h-7 w-28 font-mono text-xs tabular-nums'
                      type='number'
                      step='0.01'
                      value={formDiscount}
                      onChange={(e) => setFormDiscount(e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                    {/* +/- sign toggle — mutates the value directly */}
                    <div className='flex h-7 overflow-hidden rounded-md border'>
                      <button
                        type='button'
                        onClick={() =>
                          setFormDiscount((prev) =>
                            String(Math.abs(parseFloat(prev) || 0))
                          )
                        }
                        className={`flex w-8 items-center justify-center text-xs font-semibold transition-colors ${
                          !(parseFloat(formDiscount) < 0)
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-background text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        +
                      </button>
                      <div className='bg-border w-px' />
                      <button
                        type='button'
                        onClick={() =>
                          setFormDiscount((prev) => {
                            const n = Math.abs(parseFloat(prev) || 0);
                            return n === 0 ? '0' : String(-n);
                          })
                        }
                        className={`flex w-8 items-center justify-center text-xs font-semibold transition-colors ${
                          parseFloat(formDiscount) < 0
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-background text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        −
                      </button>
                    </div>
                    <Select
                      value={formDiscountType}
                      onValueChange={(v) =>
                        setFormDiscountType(v as DiscountType)
                      }
                    >
                      <SelectTrigger className='h-7 w-28 text-xs'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='AMOUNT'>Amount (₹)</SelectItem>
                        <SelectItem value='PERCENT'>Percent (%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <span className='font-mono tabular-nums'>
                    {discount} {orderDiscountType === 'PERCENT' ? '%' : '₹'}
                  </span>
                )}
              </td>
              <td className='px-4 py-2' />
            </tr>

            {/* ── Addon Discount ────────────────────────────────── */}
            <tr className='border-b'>
              <td className='px-4 py-2 font-medium'>Addon Discount</td>
              <td className='px-4 py-2' colSpan={numColSpan}>
                {isEditing ? (
                  <div className='flex items-center gap-2'>
                    <Input
                      className='h-7 w-28 font-mono text-xs tabular-nums'
                      type='number'
                      min='0'
                      step='0.01'
                      value={formAddonDiscount}
                      onChange={(e) => setFormAddonDiscount(e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                    <Select
                      value={formAddonType}
                      onValueChange={(v) => setFormAddonType(v as DiscountType)}
                    >
                      <SelectTrigger className='h-7 w-28 text-xs'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='AMOUNT'>Amount (₹)</SelectItem>
                        <SelectItem value='PERCENT'>Percent (%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <span className='font-mono tabular-nums'>
                    {addonDiscount} {orderAddonType === 'PERCENT' ? '%' : '₹'}
                  </span>
                )}
              </td>
              <td className='px-4 py-2' />
            </tr>

            {/* ── Final Payable Amount ──────────────────────────── */}
            <tr className='border-t-2 font-semibold'>
              <td className='px-4 py-2'>Final Payable Amount</td>
              <td
                className='px-4 py-2 font-mono tabular-nums'
                colSpan={numColSpan}
              >
                {finalPayableAmount}
              </td>
              <td className='px-4 py-2' />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function OrderDetail({ companyId, orderId }: OrderDetailProps) {
  const router = useRouter();

  const [order, setOrder] = useState<OrderWithDetails | null>(null);
  const [entries, setEntries] = useState<OrderTemplateEntry[]>([]);
  const [templateValues, setTemplateValues] = useState<
    Record<string, TemplateValuesMap>
  >({});
  const [extraValues, setExtraValues] = useState<
    Record<string, ExtraValuesMap>
  >({});
  const [blockValues, setBlockValues] = useState<
    Record<string, BlockValuesMap>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [duplicatingIds, setDuplicatingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const [isRecalculating, setIsRecalculating] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [pendingDuplicateEntry, setPendingDuplicateEntry] =
    useState<OrderTemplateEntry | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDeleteEntry, setPendingDeleteEntry] =
    useState<OrderTemplateEntry | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  // ── Template selector state (mirrors create/edit behavior) ──────────
  const [selectedDetailTemplateIds, setSelectedDetailTemplateIds] = useState<
    Set<string>
  >(new Set());

  // ── PROCESS TEMPLATE DATA ───────────────────────────────────────────
  const processOrderTemplates = useCallback((orderData: OrderWithDetails) => {
    const productTemplates = (orderData.product?.templates ||
      []) as TemplateWithDetails[];
    if (productTemplates.length === 0) {
      setEntries([]);
      setTemplateValues({});
      setExtraValues({});
      setBlockValues({});
      return;
    }

    const templateCache: Record<string, TemplateWithDetails> = {};
    for (const tmpl of productTemplates) templateCache[tmpl.id] = tmpl;

    const loadedEntries: OrderTemplateEntry[] = [];
    const loadedValues: Record<string, TemplateValuesMap> = {};
    const loadedExtraValues: Record<string, ExtraValuesMap> = {};
    const loadedBlockValues: Record<string, BlockValuesMap> = {};
    const processedTemplateIds = new Set<string>();

    const processTemplate = (
      tmplData: OrderTemplateData,
      parentOrderTemplateId: string | null,
      isChild: boolean
    ) => {
      const orderTemplateId = tmplData.id;
      const fullTemplate = templateCache[tmplData.templateId];
      if (!fullTemplate) return;
      processedTemplateIds.add(tmplData.templateId);

      const rawSummary = (tmplData as any).summary;
      const rawAdditionalCosts = ((tmplData as any).additionalTemplateCosts ||
        []) as {
        costName: string;
        cost: string | number;
        notes: string | null;
        indexNo: number;
      }[];

      const summary: OrderTemplateSummary | null = rawSummary
        ? {
            id: rawSummary.id,
            total: rawSummary.total ?? '0.00',
            discount: rawSummary.discount ?? null,
            discountAmount: rawSummary.discountAmount ?? '0.00',
            discountType: rawSummary.discountType ?? null,
            finalPayableAmount: rawSummary.finalPayableAmount ?? '0.00',
            notes: rawSummary.notes ?? null,
            additionalTemplateCosts: rawAdditionalCosts
              .sort((a, b) => a.indexNo - b.indexNo)
              .map((c) => ({
                costName: c.costName,
                cost:
                  typeof c.cost === 'number' ? c.cost : parseFloat(c.cost) || 0,
                notes: c.notes ?? ''
              }))
          }
        : null;

      loadedEntries.push({
        orderTemplateId,
        templateId: tmplData.templateId,
        template: fullTemplate,
        parentOrderTemplateId,
        isChild,
        summary
      });

      const valuesMap: TemplateValuesMap = {};
      (tmplData.values || []).forEach((v) => {
        if (!valuesMap[v.rowId]) valuesMap[v.rowId] = {};
        valuesMap[v.rowId][v.columnId] = v.calculatedValue ?? v.value ?? '';
      });
      loadedValues[orderTemplateId] = valuesMap;

      const extValMap: ExtraValuesMap = {};
      (tmplData.extraValues || []).forEach((ev) => {
        if (!extValMap[ev.templateExtraFieldId])
          extValMap[ev.templateExtraFieldId] = [];
        extValMap[ev.templateExtraFieldId].push({
          value: ev.value,
          orderExtraValueId: ev.id,
          orderIndex:
            ev.orderIndex ?? extValMap[ev.templateExtraFieldId].length,
          meta: (ev as any).meta ?? null
        });
      });
      Object.values(extValMap).forEach((arr) =>
        arr.sort((a, b) => a.orderIndex - b.orderIndex)
      );
      loadedExtraValues[orderTemplateId] = extValMap;

      const bvMap: BlockValuesMap = {};
      ((tmplData as any).blockValues || []).forEach((bv: any) => {
        const idx = parseInt(
          (bv.blockIndex as string).replace('block_', ''),
          10
        );
        if (!isNaN(idx)) bvMap[idx] = bv.templateBlockId;
      });
      loadedBlockValues[orderTemplateId] = bvMap;

      if (tmplData.children && tmplData.children.length > 0)
        tmplData.children.forEach((child) =>
          processTemplate(child, orderTemplateId, true)
        );
    };

    (orderData.templates || []).forEach((tmplData: OrderTemplateData) =>
      processTemplate(tmplData, null, false)
    );

    for (const tmpl of productTemplates) {
      if (!processedTemplateIds.has(tmpl.id)) {
        const tempKey = `new_${tmpl.id}`;
        loadedEntries.push({
          orderTemplateId: tempKey,
          templateId: tmpl.id,
          template: tmpl,
          parentOrderTemplateId: null,
          isChild: false,
          summary: null,
          isNew: true
        });
        loadedValues[tempKey] = {};
        loadedExtraValues[tempKey] = {};
        loadedBlockValues[tempKey] = {};
      }
    }

    setEntries(loadedEntries);
    setTemplateValues(loadedValues);
    setExtraValues(loadedExtraValues);
    setBlockValues(loadedBlockValues);
    // Reset selector whenever order data is refreshed
    setSelectedDetailTemplateIds(new Set());
  }, []);

  // ── FETCH ORDER ─────────────────────────────────────────────────────
  const fetchOrder = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const orderData = await getOrder(companyId, orderId);
      setOrder(orderData);
      processOrderTemplates(orderData);
    } catch (err) {
      setError(getError(err));
    } finally {
      setIsLoading(false);
    }
  }, [companyId, orderId, processOrderTemplates]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const refreshOrder = useCallback(async () => {
    try {
      const orderData = await getOrder(companyId, orderId);
      setOrder(orderData);
      processOrderTemplates(orderData);
    } catch (err) {
      toast.error(getError(err) || 'Failed to refresh order');
    }
  }, [companyId, orderId, processOrderTemplates]);

  // ── RECALCULATE ORDER ───────────────────────────────────────────────
  const handleRecalculate = useCallback(async () => {
    setIsRecalculating(true);
    try {
      await recalculateOrder(companyId, orderId);
      toast.success('Order recalculated successfully');
      const orderData = await getOrder(companyId, orderId);
      setOrder(orderData);
      processOrderTemplates(orderData);
    } catch (err) {
      toast.error(getError(err) || 'Failed to recalculate order');
    } finally {
      setIsRecalculating(false);
    }
  }, [companyId, orderId, processOrderTemplates]);

  // ── DUPLICATE ───────────────────────────────────────────────────────
  const requestDuplicate = useCallback(
    (entry: OrderTemplateEntry) => {
      const count = entries.filter(
        (e) => e.templateId === entry.templateId
      ).length;
      if (count >= 2) {
        toast.error('Maximum 2 templates allowed. Cannot duplicate further.');
        return;
      }
      setPendingDuplicateEntry(entry);
      setDuplicateDialogOpen(true);
    },
    [entries]
  );

  const executeDuplicate = useCallback(async () => {
    const entry = pendingDuplicateEntry;
    if (!entry || !order) return;
    setDuplicateDialogOpen(false);
    setPendingDuplicateEntry(null);
    setDuplicatingIds((prev) => new Set(prev).add(entry.templateId));

    try {
      const sourceValues = templateValues[entry.orderTemplateId] || {};
      const template = entry.template;
      const nonFormulaCols = (template.columns || []).filter(
        (c) => c.dataType !== 'FORMULA'
      );

      const buildValues = (src: TemplateValuesMap): OrderValue[] => {
        const vals: OrderValue[] = [];
        for (const row of template.rows || [])
          for (const col of nonFormulaCols) {
            const v = src[row.id]?.[col.id];
            if (v !== undefined && v !== '')
              vals.push({ value: v, rowId: row.id, columnId: col.id });
          }
        return vals;
      };

      const buildExtra = (src: ExtraValuesMap) =>
        Object.entries(src).flatMap(([fid, items]) =>
          items.map((ev) => ({
            templateExtraFieldId: fid,
            value: ev.value,
            orderIndex: ev.orderIndex ?? 0
          }))
        );

      const values_payload = buildValues(sourceValues);
      const extValues = buildExtra(extraValues[entry.orderTemplateId] || {});

      let payload: UpdateOrderValuesData;

      if (entry.isNew) {
        payload = {
          templates: [
            {
              templateId: entry.templateId,
              values: values_payload,
              ...(extValues.length > 0 ? { extravalues: extValues } : {}),
              children: [
                {
                  templateId: entry.templateId,
                  values: values_payload,
                  ...(extValues.length > 0 ? { extravalues: extValues } : {})
                }
              ]
            }
          ]
        };
      } else {
        const parentEntry = entries.find(
          (e) => e.templateId === entry.templateId && !e.isChild
        );
        if (!parentEntry) return;
        payload = {
          templates: [
            {
              templateId: entry.templateId,
              parentOrderTemplateId: parentEntry.orderTemplateId,
              values: values_payload,
              ...(extValues.length > 0 ? { extravalues: extValues } : {})
            }
          ]
        };
      }

      await updateOrderValues(companyId, orderId, payload);
      toast.success('Template duplicated successfully');
      const orderData = await getOrder(companyId, orderId);
      setOrder(orderData);
      processOrderTemplates(orderData);
    } catch (err) {
      toast.error(getError(err) || 'Failed to duplicate template');
    } finally {
      setDuplicatingIds((prev) => {
        const next = new Set(prev);
        next.delete(entry.templateId);
        return next;
      });
    }
  }, [
    pendingDuplicateEntry,
    order,
    entries,
    templateValues,
    extraValues,
    companyId,
    orderId,
    processOrderTemplates
  ]);

  const cancelDuplicate = useCallback(() => {
    setDuplicateDialogOpen(false);
    setPendingDuplicateEntry(null);
  }, []);

  // ── DELETE ──────────────────────────────────────────────────────────
  const requestDelete = useCallback((entry: OrderTemplateEntry) => {
    if (entry.isNew) {
      toast.error('Cannot delete a template that has not been saved yet.');
      return;
    }
    setPendingDeleteEntry(entry);
    setDeleteDialogOpen(true);
  }, []);

  const executeDelete = useCallback(async () => {
    const entry = pendingDeleteEntry;
    if (!entry || !order) return;
    setDeleteDialogOpen(false);
    setPendingDeleteEntry(null);
    setDeletingIds((prev) => new Set(prev).add(entry.orderTemplateId));

    try {
      const payload: UpdateOrderValuesData = {
        templates: [],
        deleteOrderTemplateIds: [entry.orderTemplateId]
      };

      await updateOrderValues(companyId, orderId, payload);
      toast.success('Template deleted successfully');
      const orderData = await getOrder(companyId, orderId);
      setOrder(orderData);
      processOrderTemplates(orderData);
    } catch (err) {
      toast.error(getError(err) || 'Failed to delete template');
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(entry.orderTemplateId);
        return next;
      });
    }
  }, [pendingDeleteEntry, order, companyId, orderId, processOrderTemplates]);

  const cancelDelete = useCallback(() => {
    setDeleteDialogOpen(false);
    setPendingDeleteEntry(null);
  }, []);

  // ── HELPERS ─────────────────────────────────────────────────────────
  const canDuplicate = useCallback(
    (templateId: string) =>
      entries.filter((e) => e.templateId === templateId).length < 2,
    [entries]
  );

  const groupedByTemplate = useMemo(() => {
    const grouped: Record<string, OrderTemplateEntry[]> = {};
    entries.forEach((entry) => {
      if (!grouped[entry.templateId]) grouped[entry.templateId] = [];
      grouped[entry.templateId].push(entry);
    });
    return grouped;
  }, [entries]);

  const sortedGroupedEntries = useMemo(() => {
    const productTemplates = (order?.product?.templates ||
      []) as TemplateWithDetails[];
    const templateOrder = new Map(productTemplates.map((t, i) => [t.id, i]));

    return Object.entries(groupedByTemplate).sort(
      ([a], [b]) =>
        (templateOrder.get(a) ?? 999) - (templateOrder.get(b) ?? 999)
    );
  }, [groupedByTemplate, order]);

  // ── GROUP VISIBILITY — mirrors create/edit templateHasValues ────────
  // A group has values when any non-FORMULA cell in any of its entries
  // (parent or children) is non-empty.
  const groupHasValues = useCallback(
    (templateEntries: OrderTemplateEntry[]): boolean => {
      return templateEntries.some((entry) => {
        const tmpl = entry.template;
        if ((tmpl.rows?.length ?? 0) === 0 || (tmpl.columns?.length ?? 0) === 0)
          return false;
        const vals = templateValues[entry.orderTemplateId] ?? {};
        return (tmpl.rows ?? []).some((row) =>
          (tmpl.columns ?? []).some((col) => {
            if (col.dataType === 'FORMULA') return false;
            return (vals[row.id]?.[col.id] ?? '').trim() !== '';
          })
        );
      });
    },
    [templateValues]
  );

  // Groups split into always-shown (have values) vs hidden (empty, opt-in)
  const contentGroups = useMemo(
    () =>
      sortedGroupedEntries.filter(([, templateEntries]) =>
        groupHasValues(templateEntries)
      ),
    [sortedGroupedEntries, groupHasValues]
  );

  const emptyGroups = useMemo(
    () =>
      sortedGroupedEntries.filter(
        ([, templateEntries]) => !groupHasValues(templateEntries)
      ),
    [sortedGroupedEntries, groupHasValues]
  );

  const unselectedEmptyGroups = useMemo(
    () =>
      emptyGroups.filter(
        ([templateId]) => !selectedDetailTemplateIds.has(templateId)
      ),
    [emptyGroups, selectedDetailTemplateIds]
  );

  const selectedEmptyGroups = useMemo(
    () =>
      emptyGroups.filter(([templateId]) =>
        selectedDetailTemplateIds.has(templateId)
      ),
    [emptyGroups, selectedDetailTemplateIds]
  );

  const visibleGroups = useMemo(
    () => [...contentGroups, ...selectedEmptyGroups],
    [contentGroups, selectedEmptyGroups]
  );

  const hasEmptyGroups = emptyGroups.length > 0;

  const handleSelectDetailTemplate = useCallback((templateId: string) => {
    setSelectedDetailTemplateIds((prev) => new Set(prev).add(templateId));
  }, []);

  const handleRemoveDetailTemplate = useCallback((templateId: string) => {
    setSelectedDetailTemplateIds((prev) => {
      const next = new Set(prev);
      next.delete(templateId);
      return next;
    });
  }, []);

  // ── FINAL CALC DATA ─────────────────────────────────────────────────
  const finalCalcData: FinalCalcData | undefined = useMemo(() => {
    if (!order || entries.length === 0) return undefined;
    const hasAnyChildren = Object.values(groupedByTemplate).some((te) =>
      te.some((e) => e.isChild)
    );
    const templateRows = Object.entries(groupedByTemplate).map(
      ([templateId, templateEntries]) => {
        const parentEntry = templateEntries.find((e) => !e.isChild);
        const childEntries = templateEntries.filter((e) => e.isChild);
        const templateName =
          parentEntry?.template?.name ||
          childEntries[0]?.template?.name ||
          templateId;
        const parentTotal =
          parentEntry?.summary?.finalPayableAmount ?? '0.0000';
        let childTotal: string | null = null;
        if (childEntries.length > 0) {
          const sum = childEntries.reduce(
            (acc, child) =>
              acc + parseFloat(child.summary?.finalPayableAmount || '0'),
            0
          );
          childTotal = formatAmount(String(sum));
        }
        return {
          label: templateName,
          orderTemplateId:
            parentEntry && !parentEntry.isNew
              ? parentEntry.orderTemplateId
              : (childEntries[0]?.orderTemplateId ?? templateId),
          total: formatAmount(parentTotal),
          childTotal,
          notes: parentEntry?.summary?.notes ?? null
        };
      }
    );
    return {
      templateRows,
      total: formatAmount((order as any).total),
      discount: formatAmount(order.discount),
      discountType: (order as any).discountType ?? null,
      addonDiscount: formatAmount((order as any).addonDiscount),
      addonType: (order as any).addonType ?? null,
      marginDiscount: formatAmount(order.marginDiscount),
      marginType: (order as any).marginType ?? null,
      marginTotal: formatAmount((order as any).marginTotal),
      finalPayableAmount: formatAmount(order.finalPayableAmount),
      hasAnyChildren
    };
  }, [order, entries, groupedByTemplate]);

  // ── TEMPLATE LAYOUT ITEMS ───────────────────────────────────────────
  const templateLayoutItems: TemplateLayoutItem[] = useMemo(
    () =>
      visibleGroups.map(([templateId, templateEntries]) => {
        const parentEntry = templateEntries.find((e) => !e.isChild);
        const childEntries = templateEntries.filter((e) => e.isChild);
        const duplicateAllowed = canDuplicate(templateId);
        const templateName =
          parentEntry?.template?.name ||
          childEntries[0]?.template?.name ||
          templateId;
        const hasChildren = childEntries.length > 0;

        // Show remove button only for user-selected empty groups
        const isUserSelected = selectedDetailTemplateIds.has(templateId);

        return {
          id: templateId,
          label: templateName,
          children: (
            <div className={hasChildren ? 'flex items-start gap-4' : ''}>
              {parentEntry && (
                <div className={hasChildren ? 'min-w-0 flex-1' : 'relative'}>
                  <div className='mb-2 flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                      <Badge variant='outline' className='text-xs font-normal'>
                        Parent Template
                      </Badge>
                      {parentEntry.isNew && (
                        <Badge
                          variant='secondary'
                          className='text-xs font-normal'
                        >
                          No values yet
                        </Badge>
                      )}
                    </div>
                    <div className='flex items-center gap-2'>
                      {isUserSelected && (
                        <button
                          type='button'
                          onClick={() => handleRemoveDetailTemplate(templateId)}
                          className='text-muted-foreground hover:text-destructive hover:bg-destructive/10 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors'
                          title={`Remove ${templateName}`}
                        >
                          <X className='h-3.5 w-3.5' />
                          Remove
                        </button>
                      )}
                      {!parentEntry.isNew && (
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant='outline'
                                size='sm'
                                disabled={deletingIds.has(
                                  parentEntry.orderTemplateId
                                )}
                                onClick={() => requestDelete(parentEntry)}
                                className='text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5'
                              >
                                {deletingIds.has(
                                  parentEntry.orderTemplateId
                                ) ? (
                                  <Loader2 className='h-3.5 w-3.5 animate-spin' />
                                ) : (
                                  <Trash2 className='h-3.5 w-3.5' />
                                )}{' '}
                                Delete
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side='left'>
                              Delete this template from the order
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant='outline'
                              size='sm'
                              disabled={
                                !duplicateAllowed ||
                                duplicatingIds.has(templateId)
                              }
                              onClick={() => requestDuplicate(parentEntry)}
                              className='gap-1.5'
                            >
                              {duplicatingIds.has(templateId) ? (
                                <Loader2 className='h-3.5 w-3.5 animate-spin' />
                              ) : (
                                <Copy className='h-3.5 w-3.5' />
                              )}{' '}
                              Duplicate
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side='left'>
                            {duplicateAllowed
                              ? 'Duplicate this template with copied values'
                              : 'Maximum 2 templates reached'}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                  <OrderTemplateValues
                    template={parentEntry.template}
                    values={templateValues[parentEntry.orderTemplateId] || {}}
                    onChange={() => {}}
                    readOnly
                    extraValues={extraValues[parentEntry.orderTemplateId] || {}}
                    onExtraValuesChange={() => {}}
                    summary={parentEntry.summary ?? {}}
                    apiBlocks={parentEntry.template.blocks || []}
                    blockValues={blockValues[parentEntry.orderTemplateId] || {}}
                    onBlockValuesChange={() => {}}
                  />
                </div>
              )}
              {childEntries.map((childEntry, idx) => (
                <div
                  key={childEntry.orderTemplateId}
                  className={hasChildren ? 'min-w-0 flex-1' : ''}
                >
                  <div className='mb-2 flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                      <Badge
                        variant='secondary'
                        className='text-xs font-normal'
                      >
                        Duplicate #{idx + 1}
                      </Badge>
                    </div>
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant='outline'
                            size='sm'
                            disabled={deletingIds.has(
                              childEntry.orderTemplateId
                            )}
                            onClick={() => requestDelete(childEntry)}
                            className='text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5'
                          >
                            {deletingIds.has(childEntry.orderTemplateId) ? (
                              <Loader2 className='h-3.5 w-3.5 animate-spin' />
                            ) : (
                              <Trash2 className='h-3.5 w-3.5' />
                            )}{' '}
                            Delete
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side='left'>
                          Delete this duplicate template
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <OrderTemplateValues
                    template={childEntry.template}
                    values={templateValues[childEntry.orderTemplateId] || {}}
                    onChange={() => {}}
                    readOnly
                    extraValues={extraValues[childEntry.orderTemplateId] || {}}
                    onExtraValuesChange={() => {}}
                    summary={childEntry.summary ?? {}}
                    apiBlocks={childEntry.template.blocks || []}
                    blockValues={blockValues[childEntry.orderTemplateId] || {}}
                    onBlockValuesChange={() => {}}
                  />
                </div>
              ))}
            </div>
          )
        };
      }),
    [
      visibleGroups,
      selectedDetailTemplateIds,
      canDuplicate,
      duplicatingIds,
      deletingIds,
      templateValues,
      extraValues,
      blockValues,
      requestDuplicate,
      requestDelete,
      handleRemoveDetailTemplate
    ]
  );

  // ── FINAL CALCULATION LAYOUT ITEM ───────────────────────────────────
  const finalCalcLayoutItem: TemplateLayoutItem | null = useMemo(() => {
    if (!order || entries.length === 0) return null;
    const hasAnyChildren = Object.values(groupedByTemplate).some((te) =>
      te.some((e) => e.isChild)
    );

    const templateRows: FinalCalcTemplateRow[] = Object.entries(
      groupedByTemplate
    ).map(([templateId, templateEntries]) => {
      const parentEntry = templateEntries.find((e) => !e.isChild);
      const childEntries = templateEntries.filter((e) => e.isChild);
      const templateName =
        parentEntry?.template?.name ||
        childEntries[0]?.template?.name ||
        templateId;
      const parentTotal = parentEntry?.summary?.finalPayableAmount ?? '0.0000';
      let childTotal: string | null = null;
      if (childEntries.length > 0) {
        const sum = childEntries.reduce(
          (acc, child) =>
            acc + parseFloat(child.summary?.finalPayableAmount || '0'),
          0
        );
        childTotal = formatAmount(String(sum));
      }
      return {
        label: templateName,
        orderTemplateId:
          parentEntry && !parentEntry.isNew
            ? parentEntry.orderTemplateId
            : (childEntries[0]?.orderTemplateId ?? templateId),
        total: formatAmount(parentTotal),
        childTotal,
        notes: parentEntry?.summary?.notes ?? null
      };
    });

    // Pull existing additional costs from the order response
    const existingAdditionalCosts: {
      notes: string;
      costName: string;
      cost: number;
    }[] = ((order as any).additionalCosts || []).map((c: any) => ({
      costName: c.costName ?? '',
      cost: typeof c.cost === 'number' ? c.cost : parseFloat(c.cost) || 0,
      notes: c.notes ?? ''
    }));

    return {
      id: '__final_calculation__',
      label: 'Final Calculation',
      children: (
        <FinalCalculationTable
          templateRows={templateRows}
          total={formatAmount((order as any).total)}
          discount={formatAmount(order.discount)}
          discountType={(order as any).discountType ?? null}
          addonDiscount={formatAmount((order as any).addonDiscount)}
          addonType={(order as any).addonType ?? null}
          marginDiscount={formatAmount(order.marginDiscount)}
          marginType={(order as any).marginType ?? null}
          marginTotal={formatAmount((order as any).marginTotal)}
          finalPayableAmount={formatAmount(order.finalPayableAmount)}
          hasAnyChildren={hasAnyChildren}
          companyId={companyId}
          orderId={orderId}
          additionalCosts={existingAdditionalCosts}
          onSaved={refreshOrder}
        />
      )
    };
  }, [order, entries, groupedByTemplate, companyId, orderId, refreshOrder]);

  // ── TEMPLATE SELECTOR UI (passed as beforeCanvas) ───────────────────
  const templateSelectorUI = useMemo(() => {
    if (!hasEmptyGroups) return undefined;
    return (
      <div className='rounded-lg border bg-slate-50/50 p-4 dark:bg-slate-900/30'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <div className='flex items-center gap-2'>
            <LayoutTemplate className='text-muted-foreground h-4 w-4' />
            <span className='text-sm font-semibold text-slate-700 dark:text-slate-300'>
              Select Template
            </span>
            <Badge variant='secondary' className='text-[10px]'>
              {unselectedEmptyGroups.length} available
            </Badge>
          </div>
          {unselectedEmptyGroups.length > 0 && (
            <Select value='' onValueChange={handleSelectDetailTemplate}>
              <SelectTrigger className='h-9 w-full sm:w-[280px]'>
                <SelectValue placeholder='Select a template to view…' />
              </SelectTrigger>
              <SelectContent>
                {unselectedEmptyGroups.map(([templateId, templateEntries]) => {
                  const name = templateEntries[0]?.template?.name || templateId;
                  return (
                    <SelectItem key={templateId} value={templateId}>
                      <span className='flex items-center gap-2'>
                        <LayoutTemplate className='h-3.5 w-3.5' />
                        {name}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}
        </div>

        {selectedEmptyGroups.length > 0 && (
          <div className='mt-3 flex flex-wrap items-center gap-2'>
            <span className='text-muted-foreground text-xs'>Viewing:</span>
            {selectedEmptyGroups.map(([templateId, templateEntries]) => {
              const name = templateEntries[0]?.template?.name || templateId;
              return (
                <Badge
                  key={templateId}
                  variant='outline'
                  className='gap-1 py-1 pr-1 text-xs'
                >
                  {name}
                  <button
                    type='button'
                    onClick={() => handleRemoveDetailTemplate(templateId)}
                    className='text-muted-foreground hover:text-destructive ml-0.5 rounded-sm p-0.5 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700'
                    title={`Remove ${name}`}
                  >
                    <X className='h-3 w-3' />
                  </button>
                </Badge>
              );
            })}
          </div>
        )}
      </div>
    );
  }, [
    hasEmptyGroups,
    unselectedEmptyGroups,
    selectedEmptyGroups,
    handleSelectDetailTemplate,
    handleRemoveDetailTemplate
  ]);

  const layoutItems: TemplateLayoutItem[] = useMemo(() => {
    const items = [...templateLayoutItems];
    if (finalCalcLayoutItem) items.push(finalCalcLayoutItem);
    return items;
  }, [templateLayoutItems, finalCalcLayoutItem]);

  const backUrl = `/dashboard/${companyId}/orders`;
  const editUrl = `/dashboard/${companyId}/orders/${orderId}/edit`;

  // ── LOADING ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className='space-y-6'>
        <Skeleton className='h-5 w-32' />
        <Card>
          <CardHeader>
            <Skeleton className='h-6 w-40' />
            <Skeleton className='h-4 w-64' />
          </CardHeader>
          <CardContent className='space-y-3'>
            <Skeleton className='h-5 w-full' />
            <Skeleton className='h-5 w-3/4' />
            <Skeleton className='h-48 w-full' />
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── ERROR ───────────────────────────────────────────────────────────
  if (error || !order) {
    return (
      <div className='space-y-6'>
        <Link
          href={backUrl}
          className='text-muted-foreground hover:text-foreground inline-flex items-center text-sm'
        >
          <ArrowLeft className='mr-2 h-4 w-4' />
          Back to Designs
        </Link>
        <div className='flex flex-col items-center justify-center space-y-4 py-10'>
          <div className='bg-destructive/15 rounded-full p-3'>
            <AlertCircle className='text-destructive h-6 w-6' />
          </div>
          <div className='space-y-2 text-center'>
            <h3 className='font-semibold'>Failed to load design</h3>
            <p className='text-muted-foreground text-sm'>
              {error || 'Design not found'}
            </p>
          </div>
          <Button variant='outline' onClick={() => router.push(backUrl)}>
            Back to Designs
          </Button>
        </div>
      </div>
    );
  }

  // ── RENDER ──────────────────────────────────────────────────────────
  return (
    <div className='space-y-6'>
      {/* Duplicate Confirmation Dialog */}
      <AlertDialog
        open={duplicateDialogOpen}
        onOpenChange={setDuplicateDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Duplicate Template?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to duplicate the template
              {pendingDuplicateEntry?.template?.name
                ? ` "${pendingDuplicateEntry.template.name}"`
                : ''}
              ? This will create a copy with the same values.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDuplicate}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={executeDuplicate}>
              <Copy className='mr-2 h-4 w-4' />
              Yes, Duplicate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the template
              {pendingDeleteEntry?.template?.name
                ? ` "${pendingDeleteEntry.template.name}"`
                : ''}
              {pendingDeleteEntry?.isChild ? ' (duplicate)' : ''}? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDelete}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeDelete}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
              <Trash2 className='mr-2 h-4 w-4' />
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Link
        href={backUrl}
        className='text-muted-foreground hover:text-foreground inline-flex items-center text-sm'
      >
        <ArrowLeft className='mr-2 h-4 w-4' />
        Back to Designs
      </Link>

      <Card>
        <CardHeader>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
            <div className='space-y-1'>
              <CardTitle className='flex items-center gap-3 text-2xl'>
                Design #{order.orderNo}
                <Badge variant={getOrderTypeBadgeVariant(order.orderType)}>
                  {order.orderType}
                </Badge>
                <Badge variant={getStatusBadgeVariant(order.status)}>
                  {order.status || 'DRAFT'}
                </Badge>
              </CardTitle>
              {order.description && (
                <CardDescription>{order.description}</CardDescription>
              )}
            </div>
            <div className='flex flex-wrap items-center gap-2'>
              <Button
                variant='outline'
                size='sm'
                onClick={handleRecalculate}
                disabled={isRecalculating}
                className='gap-1.5'
              >
                {isRecalculating ? (
                  <Loader2 className='h-4 w-4 animate-spin' />
                ) : (
                  <RotateCw className='h-4 w-4' />
                )}{' '}
                Recalculate
              </Button>
              <OrderTemplatePDF
                order={order}
                entries={entries}
                templateValues={templateValues}
                extraValues={extraValues}
                blockValues={blockValues}
                finalCalc={finalCalcData}
              />
              <Button
                variant='outline'
                size='sm'
                onClick={() => router.push(editUrl)}
                className='gap-1.5'
              >
                <Pencil className='h-4 w-4' />
                Edit Design
              </Button>
              <Button
                variant='outline'
                size='sm'
                onClick={() =>
                  router.push(
                    `/dashboard/${companyId}/orders/${orderId}/history`
                  )
                }
                className='gap-1.5'
              >
                <History className='h-4 w-4' />
                History
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-2 gap-4 text-sm md:grid-cols-4'>
            <div>
              <span className='text-muted-foreground'>Product Name</span>
              <p className='font-medium'>{order.product?.name ?? '-'}</p>
            </div>
            <div>
              <span className='text-muted-foreground'>Customer Name</span>
              <p className='font-medium'>{order.customer?.name ?? '-'}</p>
            </div>
            <div>
              <span className='text-muted-foreground'>Design No</span>
              <p className='font-medium'>{order.orderNo}</p>
            </div>
            <div>
              <span className='text-muted-foreground'>Type</span>
              <p className='font-medium'>{order.orderType}</p>
            </div>
            <div>
              <span className='text-muted-foreground'>Status</span>
              <p className='font-medium'>{order.status || 'DRAFT'}</p>
            </div>
            <div>
              <span className='text-muted-foreground'>Created</span>
              <p className='font-medium'>
                {new Date(order.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          {order.referenceNo && (
            <div className='mt-3 text-sm'>
              <span className='text-muted-foreground'>Reference No</span>
              <p className='font-medium'>{order.referenceNo}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {entries.length > 0 && (
        <>
          <Separator />
          <TemplateCanvasContainer
            items={layoutItems}
            persistKey={orderId}
            title='Template Values'
            subtitle="Values entered for this order's templates"
            beforeCanvas={templateSelectorUI}
          />
        </>
      )}
    </div>
  );
}
