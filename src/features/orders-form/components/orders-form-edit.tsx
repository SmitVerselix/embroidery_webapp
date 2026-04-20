'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  getOrders,
  getOrder,
  getCustomers,
  getProduct,
  updateJobcardOrder,
  uploadSingleFile
} from '@/lib/api/services';
import { getError } from '@/lib/api/axios';
import type {
  Customer,
  Order,
  OrderWithDetails,
  TemplateWithDetails,
  OrderTemplateData,
  OrderFormMaster,
  UpdateJobcardOrderData,
  JobcardSelectedRow
} from '@/lib/api/types';
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Loader2,
  ArrowLeft,
  AlertCircle,
  Users,
  Search,
  FileText,
  X,
  Link2,
  Save
} from 'lucide-react';
import Link from 'next/link';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { useDebounce } from '@/hooks/use-debounce';
import type {
  SelectedRowsColumnsMap,
  ManualValue,
  RowBlockSelectionsMap,
  ManualFlagsMap
} from './template-row-column-selector';
import OrderFormFieldsDisplay, {
  resolveOrderFormFields,
  type ResolvedOrderFormField
} from './order-form-fields-display';
import type { TemplateValuesMap } from '../../orders/components/order-template-values';

// =============================================================================
// HELPERS
// =============================================================================

const getChildKey = (parentTmplId: string, idx: number) =>
  `${parentTmplId}__child__${idx}`;

function isNullOrZero(v: string | null | undefined): boolean {
  if (v == null || v === '') return true;
  const n = parseFloat(v);
  return !isNaN(n) && n === 0;
}

function buildAutoSelection(
  template: TemplateWithDetails
): SelectedRowsColumnsMap {
  const finalCalcCols = (template.columns || []).filter(
    (c) => c.isFinalCalculation === true
  );
  const normalRows = (template.rows || []).filter((r) => r.rowType !== 'TOTAL');
  return {
    rows: new Set(normalRows.map((r) => r.id)),
    columns: new Set(finalCalcCols.map((c) => c.id))
  };
}

function buildSelectionWithRows(
  template: TemplateWithDetails,
  selectedRowIds: Set<string>
): SelectedRowsColumnsMap {
  const finalCalcCols = (template.columns || []).filter(
    (c) => c.isFinalCalculation === true
  );
  return {
    rows: selectedRowIds,
    columns: new Set(finalCalcCols.map((c) => c.id))
  };
}

function getBlockGroupsForTemplate(template: TemplateWithDetails) {
  const finalCalcCols = (template.columns || []).filter(
    (c) => c.isFinalCalculation === true
  );
  const map = new Map<number, typeof finalCalcCols>();
  finalCalcCols.forEach((col) => {
    const bi = col.blockIndex ?? 0;
    if (!map.has(bi)) map.set(bi, []);
    map.get(bi)!.push(col);
  });
  return {
    finalCalcCols,
    blockGroups: Array.from(map.entries()).sort(([a], [b]) => a - b),
    hasMultipleBlocks: map.size > 1,
    defaultBlockIndex: map.size > 0 ? Math.min(...Array.from(map.keys())) : 0
  };
}

/**
 * Validate template row/column values (the table checkboxes only).
 * SELECT_TEMPLATE_VALUE order form fields are validated separately.
 */
function validateTemplateValues(
  template: TemplateWithDetails,
  sel: SelectedRowsColumnsMap,
  vals: TemplateValuesMap,
  manuals: ManualValue[],
  rbs: RowBlockSelectionsMap
): boolean {
  const { finalCalcCols, hasMultipleBlocks, defaultBlockIndex } =
    getBlockGroupsForTemplate(template);

  let valid = true;
  sel.rows.forEach((rowId) => {
    let colsForRow = finalCalcCols;
    if (hasMultipleBlocks) {
      const blockIdx = rbs[rowId] ?? defaultBlockIndex;
      colsForRow = finalCalcCols.filter(
        (c) => (c.blockIndex ?? 0) === blockIdx
      );
    }
    colsForRow.forEach((col) => {
      const apiVal = vals[rowId]?.[col.id];
      if (isNullOrZero(apiVal)) {
        const manual = manuals.find(
          (m) => m.rowId === rowId && m.columnId === col.id
        );
        if (!manual || manual.value.trim() === '') {
          valid = false;
        }
      }
    });
  });
  return valid;
}

function isMultiValueFieldType(fieldType: string): boolean {
  return fieldType === 'CHECKBOX' || fieldType === 'MULTI_SELECT';
}

function extractFormValueDisplay(fv: any): string {
  if (fv.jsonValue && Array.isArray(fv.jsonValue) && fv.jsonValue.length > 0) {
    return fv.jsonValue.join(', ');
  }
  return fv.value ?? '';
}

function buildManualFlagsFromValues(
  values: Array<{ rowId: string; columnId: string; isManual?: boolean }>
): ManualFlagsMap {
  const flags: ManualFlagsMap = {};
  values.forEach((v) => {
    if (v.isManual) {
      if (!flags[v.rowId]) flags[v.rowId] = {};
      flags[v.rowId][v.columnId] = true;
    }
  });
  return flags;
}

function hasNonZeroResolvedValue(value: string | null | undefined): boolean {
  if (value == null || value === '') return false;
  const n = parseFloat(value);
  return !isNaN(n) && n !== 0;
}

/**
 * Validate SELECT_TEMPLATE_VALUE fields.
 *
 * Simple rules:
 *   - field.value is EMPTY  → checkbox is UNCHECKED → skip, not required.
 *   - field.value is NON-EMPTY → checkbox is CHECKED → must be a valid
 *     non-zero number. This covers both:
 *       (a) fields with a resolved value shown as "(−)" — their resolvedValue
 *           is already stored in field.value so they pass automatically.
 *       (b) fields where the user typed a value manually.
 */
function validateSelectTemplateValueFields(fields: ResolvedOrderFormField[]): {
  valid: boolean;
  errorField: string | null;
} {
  for (const field of fields.filter(
    (f) => f.fieldType === 'SELECT_TEMPLATE_VALUE' && f.templateId
  )) {
    // Empty → unchecked → not required.
    if (!field.value || field.value.trim() === '') continue;

    // Non-empty → checked → must be a valid non-zero number.
    const n = parseFloat(field.value);
    if (isNaN(n) || n === 0) {
      return { valid: false, errorField: field.fieldName };
    }
  }
  return { valid: true, errorField: null };
}

// =============================================================================
// PROPS
// =============================================================================

interface OrdersFormEditProps {
  companyId: string;
  orderId: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function OrdersFormEdit({
  companyId,
  orderId
}: OrdersFormEditProps) {
  const router = useRouter();

  // ── Initial loading ─────────────────────────────────────────────────
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [initialError, setInitialError] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderWithDetails | null>(null);

  // ── Customers ───────────────────────────────────────────────────────
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  // ── Design picker ───────────────────────────────────────────────────
  const [ordersList, setOrdersList] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [ordersSearch, setOrdersSearch] = useState('');
  const [isOrdersPopoverOpen, setIsOrdersPopoverOpen] = useState(false);
  const debouncedOrdersSearch = useDebounce(ordersSearch, 300);

  const [referencedOrder, setReferencedOrder] =
    useState<OrderWithDetails | null>(null);
  const [isLoadingReference, setIsLoadingReference] = useState(false);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [referenceNoDisplay, setReferenceNoDisplay] = useState('');

  // ── Templates ───────────────────────────────────────────────────────
  const [templates, setTemplates] = useState<TemplateWithDetails[]>([]);
  const [templateValues, setTemplateValues] = useState<
    Record<string, TemplateValuesMap>
  >({});
  const [selections, setSelections] = useState<
    Record<string, SelectedRowsColumnsMap>
  >({});
  const [manualValues, setManualValues] = useState<
    Record<string, ManualValue[]>
  >({});

  // ── Per-row block selections ────────────────────────────────────────
  const [rowBlockSelectionsMap, setRowBlockSelectionsMap] = useState<
    Record<string, RowBlockSelectionsMap>
  >({});
  const [childRowBlockSelectionsMap, setChildRowBlockSelectionsMap] = useState<
    Record<string, RowBlockSelectionsMap>
  >({});

  // ── Child templates ─────────────────────────────────────────────────
  const [refChildrenMeta, setRefChildrenMeta] = useState<
    Record<string, { templateId: string }[]>
  >({});
  const [childTemplateValues, setChildTemplateValues] = useState<
    Record<string, TemplateValuesMap>
  >({});
  const [childSelections, setChildSelections] = useState<
    Record<string, SelectedRowsColumnsMap>
  >({});
  const [childManualValues, setChildManualValues] = useState<
    Record<string, ManualValue[]>
  >({});

  // ── Edit mode initial values ────────────────────────────────────────
  const [editInitialManualValues, setEditInitialManualValues] = useState<
    Record<string, ManualValue[]>
  >({});
  const [childEditInitialManualValues, setChildEditInitialManualValues] =
    useState<Record<string, ManualValue[]>>({});
  const [editInitialRowBlockSelections, setEditInitialRowBlockSelections] =
    useState<Record<string, RowBlockSelectionsMap>>({});
  const [
    childEditInitialRowBlockSelections,
    setChildEditInitialRowBlockSelections
  ] = useState<Record<string, RowBlockSelectionsMap>>({});

  // ── Manual flags ────────────────────────────────────────────────────
  const [manualFlagsMap, setManualFlagsMap] = useState<
    Record<string, ManualFlagsMap>
  >({});
  const [childManualFlagsMap, setChildManualFlagsMap] = useState<
    Record<string, ManualFlagsMap>
  >({});

  // ── Order form fields ───────────────────────────────────────────────
  const [resolvedFields, setResolvedFields] = useState<
    ResolvedOrderFormField[]
  >([]);
  const [uploadingFieldIds, setUploadingFieldIds] = useState<Set<string>>(
    new Set()
  );
  const [templateSummariesMap, setTemplateSummariesMap] = useState<
    Record<string, { finalPayableAmount: string | null }>
  >({});

  // ── Edit-specific ───────────────────────────────────────────────────
  const [orderTemplateIdMap, setOrderTemplateIdMap] = useState<
    Record<string, string>
  >({});
  const [childOrderTemplateIdMap, setChildOrderTemplateIdMap] = useState<
    Record<string, string>
  >({});
  const [originalFormValueIds, setOriginalFormValueIds] = useState<
    Record<string, string>
  >({});

  // ── Submit state ────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isReferenceMode = !!referencedOrder;

  // ══════════════════════════════════════════════════════════════════════
  // COMPUTED TOTAL
  // ══════════════════════════════════════════════════════════════════════

  const totalSelectedValue = useMemo(() => {
    if (!referencedOrder) return 0;
    let total = 0;

    templates.forEach((tmpl) => {
      const sel = selections[tmpl.id];
      if (!sel) return;
      const vals = templateValues[tmpl.id] || {};
      const manuals = manualValues[tmpl.id] || [];
      const rbs = rowBlockSelectionsMap[tmpl.id] || {};
      const { finalCalcCols, hasMultipleBlocks, defaultBlockIndex } =
        getBlockGroupsForTemplate(tmpl);

      sel.rows.forEach((rowId) => {
        let cols = finalCalcCols;
        if (hasMultipleBlocks) {
          const bi = rbs[rowId] ?? defaultBlockIndex;
          cols = finalCalcCols.filter((c) => (c.blockIndex ?? 0) === bi);
        }
        cols.forEach((col) => {
          const apiVal = vals[rowId]?.[col.id];
          if (!isNullOrZero(apiVal)) {
            total += parseFloat(apiVal!) || 0;
          } else {
            const manual = manuals.find(
              (m) => m.rowId === rowId && m.columnId === col.id
            );
            if (manual) total += parseFloat(manual.value) || 0;
          }
        });
      });

      (refChildrenMeta[tmpl.id] || []).forEach((_, idx) => {
        const ck = getChildKey(tmpl.id, idx);
        const cSel = childSelections[ck];
        if (!cSel) return;
        const cVals = childTemplateValues[ck] || {};
        const cManuals = childManualValues[ck] || [];
        const cRbs = childRowBlockSelectionsMap[ck] || {};
        cSel.rows.forEach((rowId) => {
          let cols = finalCalcCols;
          if (hasMultipleBlocks) {
            const bi = cRbs[rowId] ?? defaultBlockIndex;
            cols = finalCalcCols.filter((c) => (c.blockIndex ?? 0) === bi);
          }
          cols.forEach((col) => {
            const apiVal = cVals[rowId]?.[col.id];
            if (!isNullOrZero(apiVal)) {
              total += parseFloat(apiVal!) || 0;
            } else {
              const manual = cManuals.find(
                (m) => m.rowId === rowId && m.columnId === col.id
              );
              if (manual) total += parseFloat(manual.value) || 0;
            }
          });
        });
      });
    });

    return total;
  }, [
    referencedOrder,
    templates,
    selections,
    templateValues,
    manualValues,
    rowBlockSelectionsMap,
    refChildrenMeta,
    childSelections,
    childTemplateValues,
    childManualValues,
    childRowBlockSelectionsMap
  ]);

  // ══════════════════════════════════════════════════════════════════════
  // FETCH CUSTOMERS
  // ══════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      setIsLoadingCustomers(true);
      setCustomerError(null);
      try {
        const res = await getCustomers(companyId, {
          page: 1,
          limit: 1000,
          sortBy: 'createdAt',
          sortOrder: 'DESC'
        });
        setCustomers(res.rows);
      } catch (err) {
        setCustomerError(getError(err));
      } finally {
        setIsLoadingCustomers(false);
      }
    })();
  }, [companyId]);

  // ══════════════════════════════════════════════════════════════════════
  // FETCH ORDERS LIST
  // ══════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      setIsLoadingOrders(true);
      try {
        const res = await getOrders(companyId, {
          page: 1,
          limit: 20,
          search: debouncedOrdersSearch,
          sortBy: 'createdAt',
          sortOrder: 'DESC',
          orderType: 'SAMPLE'
        });
        setOrdersList(res.rows);
      } catch {
        /* silent */
      } finally {
        setIsLoadingOrders(false);
      }
    })();
  }, [companyId, debouncedOrdersSearch]);

  // ══════════════════════════════════════════════════════════════════════
  // LOAD DESIGN ORDER
  // ══════════════════════════════════════════════════════════════════════

  const loadDesignOrder = useCallback(
    async (designOrderId: string, jobcardOrder?: OrderWithDetails) => {
      setIsLoadingReference(true);
      setReferenceError(null);

      try {
        const designOrderData = await getOrder(companyId, designOrderId);
        setReferencedOrder(designOrderData);
        setReferenceNoDisplay(designOrderData.orderNo);

        const product = await getProduct(companyId, designOrderData.productId);
        const tCache: Record<string, TemplateWithDetails> = {};
        const fullTemplates = (product.templates ||
          []) as TemplateWithDetails[];
        fullTemplates.forEach((t) => (tCache[t.id] = t));
        setTemplates(fullTemplates);

        const forms = (product.orderForms || []) as OrderFormMaster[];

        const summaries: Record<string, { finalPayableAmount: string | null }> =
          {};
        (designOrderData.templates || []).forEach((td: OrderTemplateData) => {
          const rawSummary = (td as any).summary;
          summaries[td.templateId] = {
            finalPayableAmount: rawSummary?.finalPayableAmount ?? null
          };
        });
        setTemplateSummariesMap(summaries);

        const loadedVals: Record<string, TemplateValuesMap> = {};
        const loadedSels: Record<string, SelectedRowsColumnsMap> = {};
        const loadedChildMeta: Record<string, { templateId: string }[]> = {};
        const loadedChildVals: Record<string, TemplateValuesMap> = {};
        const loadedChildSels: Record<string, SelectedRowsColumnsMap> = {};
        const loadedEditManuals: Record<string, ManualValue[]> = {};
        const loadedChildEditManuals: Record<string, ManualValue[]> = {};
        const loadedManualFlags: Record<string, ManualFlagsMap> = {};
        const loadedChildManualFlags: Record<string, ManualFlagsMap> = {};
        const otIdMap: Record<string, string> = {};
        const childOtIdMap: Record<string, string> = {};

        (designOrderData.templates || []).forEach((td: OrderTemplateData) => {
          otIdMap[td.templateId] = td.id;
          (td.children || []).forEach((child, idx) => {
            childOtIdMap[getChildKey(td.templateId, idx)] = child.id;
          });
        });
        setOrderTemplateIdMap(otIdMap);
        setChildOrderTemplateIdMap(childOtIdMap);

        fullTemplates.forEach((t) => {
          loadedVals[t.id] = {};
          loadedSels[t.id] = buildAutoSelection(t);
        });

        (designOrderData.templates || []).forEach(
          (tmplData: OrderTemplateData) => {
            const tid = tmplData.templateId;
            const vm: TemplateValuesMap = {};
            (tmplData.values || []).forEach((v) => {
              if (!vm[v.rowId]) vm[v.rowId] = {};
              vm[v.rowId][v.columnId] = v.calculatedValue ?? v.value ?? '';
            });
            loadedVals[tid] = vm;

            if (tmplData.children && tmplData.children.length > 0) {
              loadedChildMeta[tid] = [];
              tmplData.children.forEach((child, idx) => {
                const ck = getChildKey(tid, idx);
                loadedChildMeta[tid].push({ templateId: child.templateId });
                const cvm: TemplateValuesMap = {};
                (child.values || []).forEach((v) => {
                  if (!cvm[v.rowId]) cvm[v.rowId] = {};
                  cvm[v.rowId][v.columnId] = v.calculatedValue ?? v.value ?? '';
                });
                loadedChildVals[ck] = cvm;
                const parentTmpl = tCache[tid];
                loadedChildSels[ck] = parentTmpl
                  ? buildAutoSelection(parentTmpl)
                  : { rows: new Set<string>(), columns: new Set<string>() };
              });
            }
          }
        );

        const loadedRowBlockSels: Record<string, RowBlockSelectionsMap> = {};
        const loadedChildRowBlockSels: Record<string, RowBlockSelectionsMap> =
          {};

        if (jobcardOrder) {
          (jobcardOrder.templates || []).forEach((jtd: OrderTemplateData) => {
            const tid = jtd.templateId;
            const designVals = loadedVals[tid] || {};
            const tmpl = tCache[tid];
            if (!tmpl) return;

            const selectedRowIds = new Set<string>();
            const manualVals: ManualValue[] = [];
            const blockSels: RowBlockSelectionsMap = {};

            (jtd.values || []).forEach((v) => {
              const col = (tmpl.columns || []).find(
                (c) => c.id === v.columnId && c.isFinalCalculation === true
              );
              if (col) {
                selectedRowIds.add(v.rowId);
                blockSels[v.rowId] = col.blockIndex ?? 0;
                const designVal = designVals[v.rowId]?.[v.columnId];
                if (isNullOrZero(designVal)) {
                  const val = v.calculatedValue ?? v.value ?? '';
                  if (val.trim() !== '') {
                    manualVals.push({
                      rowId: v.rowId,
                      columnId: v.columnId,
                      value: val
                    });
                  }
                }
              }
            });

            loadedSels[tid] = buildSelectionWithRows(tmpl, selectedRowIds);
            loadedEditManuals[tid] = manualVals;
            loadedRowBlockSels[tid] = blockSels;
            loadedManualFlags[tid] = buildManualFlagsFromValues(
              jtd.values || []
            );

            (jtd.children || []).forEach((jChild, idx) => {
              const ck = getChildKey(tid, idx);
              const childDesignVals = loadedChildVals[ck] || {};
              const childSelectedRows = new Set<string>();
              const childManualVals: ManualValue[] = [];
              const childBlockSels: RowBlockSelectionsMap = {};

              (jChild.values || []).forEach((v) => {
                const col = (tmpl.columns || []).find(
                  (c) => c.id === v.columnId && c.isFinalCalculation === true
                );
                if (col) {
                  childSelectedRows.add(v.rowId);
                  childBlockSels[v.rowId] = col.blockIndex ?? 0;
                  const designVal = childDesignVals[v.rowId]?.[v.columnId];
                  if (isNullOrZero(designVal)) {
                    const val = v.calculatedValue ?? v.value ?? '';
                    if (val.trim() !== '') {
                      childManualVals.push({
                        rowId: v.rowId,
                        columnId: v.columnId,
                        value: val
                      });
                    }
                  }
                }
              });

              loadedChildSels[ck] = buildSelectionWithRows(
                tmpl,
                childSelectedRows
              );
              loadedChildEditManuals[ck] = childManualVals;
              loadedChildRowBlockSels[ck] = childBlockSels;
              loadedChildManualFlags[ck] = buildManualFlagsFromValues(
                jChild.values || []
              );
            });
          });
        }

        setTemplateValues(loadedVals);
        setSelections(loadedSels);
        setRefChildrenMeta(loadedChildMeta);
        setChildTemplateValues(loadedChildVals);
        setChildSelections(loadedChildSels);
        setEditInitialManualValues(loadedEditManuals);
        setChildEditInitialManualValues(loadedChildEditManuals);
        setManualValues(loadedEditManuals);
        setChildManualValues(loadedChildEditManuals);
        setRowBlockSelectionsMap(loadedRowBlockSels);
        setChildRowBlockSelectionsMap(loadedChildRowBlockSels);
        setEditInitialRowBlockSelections(loadedRowBlockSels);
        setChildEditInitialRowBlockSelections(loadedChildRowBlockSels);
        setManualFlagsMap(loadedManualFlags);
        setChildManualFlagsMap(loadedChildManualFlags);

        const resolved = resolveOrderFormFields(
          forms,
          designOrderData.templates || [],
          tCache
        );

        if (jobcardOrder) {
          const existingFormValues =
            (jobcardOrder as any).orderFormValues || [];
          const formValueMap: Record<string, { id: string; value: string }> =
            {};
          existingFormValues.forEach((fv: any) => {
            formValueMap[fv.orderFormsMasterId] = {
              id: fv.id,
              value: extractFormValueDisplay(fv)
            };
          });
          const origIds: Record<string, string> = {};
          existingFormValues.forEach((fv: any) => {
            origIds[fv.orderFormsMasterId] = fv.id;
          });
          setOriginalFormValueIds(origIds);
          resolved.forEach((field) => {
            const existing = formValueMap[field.id];
            if (existing) field.value = existing.value;
          });
        }

        setResolvedFields(resolved);
        setSubmitError(null);
      } catch (err) {
        setReferenceError(getError(err));
        setReferencedOrder(null);
      } finally {
        setIsLoadingReference(false);
      }
    },
    [companyId]
  );

  // ══════════════════════════════════════════════════════════════════════
  // INITIAL LOAD
  // ══════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!companyId || !orderId) return;
    (async () => {
      setIsLoadingInitial(true);
      setInitialError(null);
      try {
        const orderData = await getOrder(companyId, orderId);
        setOrder(orderData);
        setSelectedCustomerId(orderData.customerId || '');

        const designId =
          (orderData as any).designOrderId || (orderData as any).designId;

        if (designId) {
          await loadDesignOrder(designId, orderData);
        } else if (orderData.referenceNo) {
          try {
            const searchRes = await getOrders(companyId, {
              page: 1,
              limit: 5,
              search: orderData.referenceNo,
              orderType: 'SAMPLE'
            });
            const matchingOrder = searchRes.rows.find(
              (o) => o.orderNo === orderData.referenceNo
            );
            if (matchingOrder) {
              await loadDesignOrder(matchingOrder.id, orderData);
            } else if (searchRes.rows.length > 0) {
              await loadDesignOrder(searchRes.rows[0].id, orderData);
            }
          } catch {
            /* Silent */
          }
        }
      } catch (err) {
        setInitialError(getError(err));
      } finally {
        setIsLoadingInitial(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, orderId]);

  // ══════════════════════════════════════════════════════════════════════
  // SELECT REFERENCE ORDER
  // ══════════════════════════════════════════════════════════════════════

  const handleSelectReferenceOrder = useCallback(
    async (selectedOrder: Order) => {
      setIsOrdersPopoverOpen(false);
      setOrdersSearch('');
      setReferenceNoDisplay(selectedOrder.orderNo);
      setEditInitialManualValues({});
      setChildEditInitialManualValues({});
      setOrderTemplateIdMap({});
      setChildOrderTemplateIdMap({});
      setOriginalFormValueIds({});
      setRowBlockSelectionsMap({});
      setChildRowBlockSelectionsMap({});
      setEditInitialRowBlockSelections({});
      setChildEditInitialRowBlockSelections({});
      setManualFlagsMap({});
      setChildManualFlagsMap({});
      setTemplateSummariesMap({});
      await loadDesignOrder(selectedOrder.id);
    },
    [loadDesignOrder]
  );

  // ══════════════════════════════════════════════════════════════════════
  // CLEAR REFERENCE
  // ══════════════════════════════════════════════════════════════════════

  const handleClearReference = useCallback(() => {
    setReferenceNoDisplay('');
    setReferencedOrder(null);
    setReferenceError(null);
    setResolvedFields([]);
    setTemplates([]);
    setTemplateValues({});
    setSelections({});
    setRefChildrenMeta({});
    setChildTemplateValues({});
    setChildSelections({});
    setManualValues({});
    setChildManualValues({});
    setEditInitialManualValues({});
    setChildEditInitialManualValues({});
    setOrderTemplateIdMap({});
    setChildOrderTemplateIdMap({});
    setOriginalFormValueIds({});
    setRowBlockSelectionsMap({});
    setChildRowBlockSelectionsMap({});
    setEditInitialRowBlockSelections({});
    setChildEditInitialRowBlockSelections({});
    setManualFlagsMap({});
    setChildManualFlagsMap({});
    setUploadingFieldIds(new Set());
    setTemplateSummariesMap({});
    setSubmitError(null);
  }, []);

  // ══════════════════════════════════════════════════════════════════════
  // FIELD CHANGE HANDLERS
  // ══════════════════════════════════════════════════════════════════════

  const handleOrderFormFieldChange = useCallback(
    (fieldId: string, value: string) => {
      setResolvedFields((prev) =>
        prev.map((f) => (f.id === fieldId ? { ...f, value } : f))
      );
    },
    []
  );

  const handleOrderFormFileUpload = useCallback(
    async (fieldId: string, file: File) => {
      setUploadingFieldIds((prev) => new Set(prev).add(fieldId));
      try {
        const result = await uploadSingleFile(file);
        setResolvedFields((prev) =>
          prev.map((f) => (f.id === fieldId ? { ...f, value: result.url } : f))
        );
      } catch (err) {
        setSubmitError(
          `Failed to upload file for form field: ${getError(err)}`
        );
      } finally {
        setUploadingFieldIds((prev) => {
          const next = new Set(prev);
          next.delete(fieldId);
          return next;
        });
      }
    },
    []
  );

  // ══════════════════════════════════════════════════════════════════════
  // SUBMIT (UPDATE)
  // ══════════════════════════════════════════════════════════════════════

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!referencedOrder) {
      setSubmitError('Please select a design number first.');
      return;
    }
    if (!selectedCustomerId) {
      setSubmitError('Please select a customer.');
      return;
    }
    if (uploadingFieldIds.size > 0) {
      setSubmitError('Please wait for file uploads to finish.');
      return;
    }

    // ── Validate SELECT_TEMPLATE fields ─────────────────────────────
    for (const field of resolvedFields.filter(
      (f) => f.fieldType === 'SELECT_TEMPLATE' && f.templateId
    )) {
      if (field.value && field.value.trim() !== '') {
        const n = parseFloat(field.value);
        if (isNaN(n) || n === 0) {
          setSubmitError(
            `Please enter a valid value for "${field.fieldName}".`
          );
          return;
        }
      }
    }

    // ── Validate SELECT_TEMPLATE_VALUE fields ────────────────────────
    const stvValidation = validateSelectTemplateValueFields(resolvedFields);
    if (!stvValidation.valid) {
      setSubmitError(
        `Please enter a valid value for "${stvValidation.errorField}".`
      );
      return;
    }

    // ── Validate template row/column table (checked rows only) ───────
    let hasEmptyValues = false;
    templates.forEach((tmpl) => {
      const sel = selections[tmpl.id] || buildAutoSelection(tmpl);
      if (sel.rows.size === 0) return;
      if (
        !validateTemplateValues(
          tmpl,
          sel,
          templateValues[tmpl.id] || {},
          manualValues[tmpl.id] || [],
          rowBlockSelectionsMap[tmpl.id] || {}
        )
      ) {
        hasEmptyValues = true;
      }

      (refChildrenMeta[tmpl.id] || []).forEach((_, idx) => {
        const ck = getChildKey(tmpl.id, idx);
        const cSel = childSelections[ck] || buildAutoSelection(tmpl);
        if (cSel.rows.size === 0) return;
        if (
          !validateTemplateValues(
            tmpl,
            cSel,
            childTemplateValues[ck] || {},
            childManualValues[ck] || [],
            childRowBlockSelectionsMap[ck] || {}
          )
        ) {
          hasEmptyValues = true;
        }
      });
    });

    if (hasEmptyValues) {
      setSubmitError(
        'Please enter values for all selected rows before saving. Look for fields marked "Required".'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      // ── Build selectedRowIds ───────────────────────────────────────
      const selectedRowIds: JobcardSelectedRow[] = [];

      templates.forEach((tmpl) => {
        const { finalCalcCols, hasMultipleBlocks, defaultBlockIndex } =
          getBlockGroupsForTemplate(tmpl);
        const rbs = rowBlockSelectionsMap[tmpl.id] || {};
        const sel = selections[tmpl.id];
        if (!sel || sel.rows.size === 0) return;

        sel.rows.forEach((rowId) => {
          let cols = finalCalcCols;
          if (hasMultipleBlocks) {
            const bi = rbs[rowId] ?? defaultBlockIndex;
            cols = finalCalcCols.filter((c) => (c.blockIndex ?? 0) === bi);
          }
          cols.forEach((col) =>
            selectedRowIds.push({
              rowId,
              columnId: col.id,
              templateId: tmpl.id
            })
          );
        });

        (refChildrenMeta[tmpl.id] || []).forEach((childMeta, idx) => {
          const ck = getChildKey(tmpl.id, idx);
          const cSel = childSelections[ck];
          if (!cSel || cSel.rows.size === 0) return;
          const cRbs = childRowBlockSelectionsMap[ck] || {};
          cSel.rows.forEach((rowId) => {
            let cols = finalCalcCols;
            if (hasMultipleBlocks) {
              const bi = cRbs[rowId] ?? defaultBlockIndex;
              cols = finalCalcCols.filter((c) => (c.blockIndex ?? 0) === bi);
            }
            cols.forEach((col) =>
              selectedRowIds.push({
                rowId,
                columnId: col.id,
                templateId: childMeta.templateId
              })
            );
          });
        });
      });

      // SELECT_TEMPLATE fields → rowId and columnId as null
      resolvedFields
        .filter(
          (f) =>
            f.fieldType === 'SELECT_TEMPLATE' &&
            f.templateId &&
            f.value &&
            f.value.trim() !== ''
        )
        .forEach((f) => {
          selectedRowIds.push({
            rowId: null,
            columnId: null,
            templateId: f.templateId!
          });
        });

      // SELECT_TEMPLATE_VALUE fields → send rowId and columnId in selectedRowIds
      resolvedFields
        .filter(
          (f) =>
            f.fieldType === 'SELECT_TEMPLATE_VALUE' &&
            f.templateId &&
            f.rowId &&
            f.columnId &&
            f.value &&
            f.value.trim() !== ''
        )
        .forEach((f) => {
          selectedRowIds.push({
            rowId: f.rowId!,
            columnId: f.columnId!,
            templateId: f.templateId!
          });
        });

      // ── Build allManualValues ──────────────────────────────────────
      const allManualValues: any[] = [];

      templates.forEach((tmpl) => {
        const otId = orderTemplateIdMap[tmpl.id];
        (manualValues[tmpl.id] || [])
          .filter((mv) => mv.value.trim() !== '' && !isNullOrZero(mv.value))
          .forEach((mv) =>
            allManualValues.push({
              ...(otId ? { orderTemplateId: otId } : {}),
              templateId: tmpl.id,
              rowId: mv.rowId,
              columnId: mv.columnId,
              value: mv.value
            })
          );
        (refChildrenMeta[tmpl.id] || []).forEach((childMeta, idx) => {
          const ck = getChildKey(tmpl.id, idx);
          const childOtId = childOrderTemplateIdMap[ck];
          (childManualValues[ck] || [])
            .filter((mv) => mv.value.trim() !== '' && !isNullOrZero(mv.value))
            .forEach((mv) =>
              allManualValues.push({
                ...(childOtId ? { orderTemplateId: childOtId } : {}),
                templateId: childMeta.templateId,
                rowId: mv.rowId,
                columnId: mv.columnId,
                value: mv.value
              })
            );
        });
      });

      // SELECT_TEMPLATE_VALUE manual values
      resolvedFields
        .filter(
          (f) =>
            f.fieldType === 'SELECT_TEMPLATE_VALUE' &&
            f.templateId &&
            f.rowId &&
            f.columnId &&
            f.value &&
            f.value.trim() !== ''
        )
        .forEach((f) => {
          if (!hasNonZeroResolvedValue(f.resolvedValue)) {
            const otId = orderTemplateIdMap[f.templateId!];
            allManualValues.push({
              type: 'SELECT_TEMPLATE_VALUE',
              ...(otId ? { orderTemplateId: otId } : {}),
              templateId: f.templateId!,
              rowId: f.rowId!,
              columnId: f.columnId!,
              value: f.value
            });
          }
        });

      // SELECT_TEMPLATE manual values
      resolvedFields
        .filter(
          (f) =>
            f.fieldType === 'SELECT_TEMPLATE' &&
            f.templateId &&
            f.value &&
            f.value.trim() !== ''
        )
        .forEach((f) => {
          const otId = orderTemplateIdMap[f.templateId!];
          allManualValues.push({
            type: 'SELECT_TEMPLATE',
            ...(otId ? { orderTemplateId: otId } : {}),
            templateId: f.templateId!,
            rowId: null,
            columnId: null,
            value: f.value
          });
        });

      // ── orderFormValues (exclude SELECT_TEMPLATE and SELECT_TEMPLATE_VALUE) ──
      const orderFormValues: {
        orderFormsMasterId: string;
        value?: string;
        jsonValue?: string[];
      }[] = resolvedFields
        .filter(
          (f) =>
            f.value &&
            f.value.trim() !== '' &&
            f.fieldType !== 'SELECT_TEMPLATE_VALUE' &&
            f.fieldType !== 'SELECT_TEMPLATE'
        )
        .map((f) => {
          if (isMultiValueFieldType(f.fieldType)) {
            const jsonValue = f.value
              .split(',')
              .map((v) => v.trim())
              .filter(Boolean);
            return jsonValue.length > 0
              ? { orderFormsMasterId: f.id, jsonValue }
              : { orderFormsMasterId: f.id, value: f.value };
          }
          return { orderFormsMasterId: f.id, value: f.value ?? '' };
        });

      // ── deleteOrderFormValueIds ────────────────────────────────────
      const currentFormMasterIds = new Set(
        orderFormValues.map((fv) => fv.orderFormsMasterId)
      );
      const deleteOrderFormValueIds: string[] = [];
      Object.entries(originalFormValueIds).forEach(
        ([masterIdKey, formValueId]) => {
          if (!currentFormMasterIds.has(masterIdKey)) {
            deleteOrderFormValueIds.push(formValueId);
          }
        }
      );

      const payload: UpdateJobcardOrderData = {
        designId: referencedOrder.id,
        customerId: selectedCustomerId,
        selectedRowIds,
        ...(allManualValues.length > 0
          ? { manualValues: allManualValues }
          : {}),
        ...(orderFormValues.length > 0 ? { orderFormValues } : {}),
        ...(deleteOrderFormValueIds.length > 0
          ? { deleteOrderFormValueIds }
          : {})
      };

      await updateJobcardOrder(companyId, orderId, payload);
      router.push(`/dashboard/${companyId}/orders-form`);
      router.refresh();
    } catch (err) {
      setSubmitError(getError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const backUrl = `/dashboard/${companyId}/orders-form`;

  // ══════════════════════════════════════════════════════════════════════
  // LOADING / ERROR STATES
  // ══════════════════════════════════════════════════════════════════════

  if (isLoadingInitial) {
    return (
      <div className='space-y-6'>
        <Skeleton className='h-5 w-32' />
        <Card>
          <CardHeader>
            <Skeleton className='h-6 w-40' />
            <Skeleton className='h-4 w-64' />
          </CardHeader>
          <CardContent className='space-y-3'>
            <Skeleton className='h-10 w-full' />
            <Skeleton className='h-10 w-full' />
            <Skeleton className='h-10 w-full' />
            <Skeleton className='h-48 w-full' />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (initialError) {
    return (
      <div className='space-y-6'>
        <Link
          href={backUrl}
          className='text-muted-foreground hover:text-foreground inline-flex items-center text-sm'
        >
          <ArrowLeft className='mr-2 h-4 w-4' />
          Back to Orders
        </Link>
        <div className='flex flex-col items-center justify-center space-y-4 py-10'>
          <div className='bg-destructive/15 rounded-full p-3'>
            <AlertCircle className='text-destructive h-6 w-6' />
          </div>
          <div className='space-y-2 text-center'>
            <h3 className='font-semibold'>Failed to load order</h3>
            <p className='text-muted-foreground text-sm'>{initialError}</p>
          </div>
          <Button variant='outline' onClick={() => router.push(backUrl)}>
            Back to Orders
          </Button>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════

  return (
    <div className='space-y-6'>
      <Link
        href={backUrl}
        className='text-muted-foreground hover:text-foreground inline-flex items-center text-sm'
      >
        <ArrowLeft className='mr-2 h-4 w-4' />
        Back to Orders
      </Link>

      <form onSubmit={handleFormSubmit} className='space-y-6'>
        <Card>
          <CardHeader>
            <CardTitle>
              Edit Order form{order ? ` — #${order.orderNo}` : ''}
            </CardTitle>
            <CardDescription>
              Update the customer, design reference, and selected rows
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            {/* Customer select */}
            <div className='space-y-2'>
              <Label>Customer</Label>
              {isLoadingCustomers ? (
                <Skeleton className='h-10 w-full' />
              ) : (
                <Select
                  value={selectedCustomerId}
                  onValueChange={setSelectedCustomerId}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder='Select a customer' />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.length === 0 ? (
                      <div className='text-muted-foreground px-2 py-3 text-center text-sm'>
                        No customers available.
                      </div>
                    ) : (
                      customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className='flex items-center gap-2'>
                            <Users className='h-3 w-3' />
                            {c.name}
                            <span className='text-muted-foreground text-xs'>
                              ({c.referenceCode})
                            </span>
                          </span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
              {customerError && (
                <p className='text-destructive text-sm'>{customerError}</p>
              )}
            </div>

            {/* Design number picker */}
            <div className='space-y-2'>
              <Label>Design Number</Label>
              {isReferenceMode && referencedOrder ? (
                <div className='flex items-center gap-2'>
                  <div className='bg-muted flex flex-1 items-center gap-2 rounded-md border px-3 py-2'>
                    <Link2 className='text-primary h-4 w-4 flex-shrink-0' />
                    <span className='text-sm font-medium'>
                      #{referencedOrder.orderNo}
                    </span>
                    <Badge variant='secondary' className='ml-1 text-[10px]'>
                      {referencedOrder.orderType}
                    </Badge>
                    {referencedOrder.product?.name && (
                      <span className='text-muted-foreground ml-auto text-xs'>
                        {referencedOrder.product.name}
                      </span>
                    )}
                  </div>
                  <Button
                    type='button'
                    variant='outline'
                    size='icon'
                    className='h-9 w-9 flex-shrink-0'
                    onClick={handleClearReference}
                    disabled={isSubmitting}
                    title='Clear reference'
                  >
                    <X className='h-4 w-4' />
                  </Button>
                </div>
              ) : (
                <Popover
                  open={isOrdersPopoverOpen}
                  onOpenChange={setIsOrdersPopoverOpen}
                >
                  <PopoverTrigger asChild>
                    <div className='relative'>
                      <Input
                        placeholder='Click to select from existing designs'
                        disabled={isSubmitting || isLoadingReference}
                        value={referenceNoDisplay}
                        readOnly
                        onFocus={() => setIsOrdersPopoverOpen(true)}
                        className='cursor-pointer pr-10'
                      />
                      {isLoadingReference ? (
                        <Loader2 className='text-muted-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin' />
                      ) : (
                        <FileText className='text-muted-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2' />
                      )}
                    </div>
                  </PopoverTrigger>
                  <PopoverContent
                    className='w-[var(--radix-popover-trigger-width)] p-0'
                    align='start'
                    onOpenAutoFocus={(e) => e.preventDefault()}
                  >
                    <div className='border-b p-2'>
                      <div className='relative'>
                        <Search className='text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2' />
                        <Input
                          placeholder='Search designs...'
                          value={ordersSearch}
                          onChange={(e) => setOrdersSearch(e.target.value)}
                          className='h-8 pl-8 text-sm'
                        />
                      </div>
                    </div>
                    <div className='max-h-[220px] overflow-y-auto'>
                      {isLoadingOrders ? (
                        <div className='flex items-center justify-center py-4'>
                          <Loader2 className='text-muted-foreground h-4 w-4 animate-spin' />
                        </div>
                      ) : ordersList.length === 0 ? (
                        <div className='text-muted-foreground py-4 text-center text-sm'>
                          No designs found
                        </div>
                      ) : (
                        ordersList.map((o) => (
                          <button
                            key={o.id}
                            type='button'
                            className='hover:bg-accent flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors'
                            onClick={() => handleSelectReferenceOrder(o)}
                          >
                            <div className='flex items-center gap-2'>
                              <span className='font-medium'>#{o.orderNo}</span>
                              <Badge variant='outline' className='text-[10px]'>
                                {o.orderType}
                              </Badge>
                            </div>
                            <span className='text-muted-foreground text-xs'>
                              {o.status || 'DRAFT'}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              {referenceError && (
                <p className='text-destructive text-sm'>{referenceError}</p>
              )}
            </div>

            {/* Value */}
            {isReferenceMode && !isLoadingReference && (
              <div className='space-y-2'>
                <Label>Value</Label>
                <div className='bg-muted flex items-center rounded-md border px-3 py-2'>
                  <span className='font-mono text-sm font-medium tabular-nums'>
                    {totalSelectedValue === 0
                      ? '0.00'
                      : totalSelectedValue.toFixed(2)}
                  </span>
                  {totalSelectedValue > 0 && (
                    <span className='text-muted-foreground ml-2 text-xs'>
                      (sum of selected rows)
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Order form fields */}
            {isReferenceMode &&
              !isLoadingReference &&
              resolvedFields.length > 0 && (
                <>
                  <Separator />
                  <OrderFormFieldsDisplay
                    fields={resolvedFields}
                    onFieldValueChange={handleOrderFormFieldChange}
                    onFileUpload={handleOrderFormFileUpload}
                    uploadingFieldIds={uploadingFieldIds}
                    templateSummaries={templateSummariesMap}
                    disabled={isSubmitting}
                  />
                </>
              )}
          </CardContent>
        </Card>

        {/* Referenced Design Info Card */}
        {isReferenceMode && referencedOrder && (
          <Card className='border-primary/20 bg-primary/5'>
            <CardHeader className='pb-3'>
              <CardTitle className='flex items-center gap-2 text-base'>
                <Link2 className='h-4 w-4' />
                Referenced Design — #{referencedOrder.orderNo}
              </CardTitle>
              <CardDescription>
                Use the checkboxes above to select which templates to include.
                Where a value is missing, enter it manually.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className='grid grid-cols-2 gap-4 text-sm md:grid-cols-4'>
                <div>
                  <span className='text-muted-foreground'>Product</span>
                  <p className='font-medium'>
                    {referencedOrder.product?.name ?? '—'}
                  </p>
                </div>
                <div>
                  <span className='text-muted-foreground'>Design Type</span>
                  <p className='font-medium'>{referencedOrder.orderType}</p>
                </div>
                <div>
                  <span className='text-muted-foreground'>Status</span>
                  <p className='font-medium'>
                    {referencedOrder.status || 'DRAFT'}
                  </p>
                </div>
                <div>
                  <span className='text-muted-foreground'>Customer</span>
                  <p className='font-medium'>
                    {referencedOrder.customer?.name ?? '—'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoadingReference && (
          <div className='flex items-center justify-center rounded-lg border py-8'>
            <div className='flex flex-col items-center gap-2'>
              <Loader2 className='text-primary h-6 w-6 animate-spin' />
              <p className='text-muted-foreground text-sm'>
                Loading referenced design data...
              </p>
            </div>
          </div>
        )}

        {submitError && (
          <div className='bg-destructive/15 text-destructive flex items-start gap-2 rounded-md p-3 text-sm'>
            <AlertCircle className='mt-0.5 h-4 w-4 flex-shrink-0' />
            <span>{submitError}</span>
          </div>
        )}

        <div className='flex items-center gap-4 pt-2'>
          <Button
            type='submit'
            disabled={
              isSubmitting ||
              isLoadingReference ||
              !isReferenceMode ||
              uploadingFieldIds.size > 0
            }
            size='lg'
          >
            {isSubmitting ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Saving Changes...
              </>
            ) : (
              <>
                <Save className='mr-2 h-4 w-4' />
                Save Changes
              </>
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
    </div>
  );
}
