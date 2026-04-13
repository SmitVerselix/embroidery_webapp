'use client';

import { useState, useCallback, useMemo } from 'react';
import { Download, FileText, Loader2, CheckSquare, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { OrderWithDetails, TemplateWithDetails } from '@/lib/api/types';
import type { ResolvedOrderFormField } from '@/features/orders-form/components/order-form-fields-display';

// ---------------------------------------------------------------------------
// Local type — replaces the missing order-template-values import
// rowId → columnId → cell value
// ---------------------------------------------------------------------------
type TemplateValuesMap = Record<string, Record<string, string>>;

// =============================================================================
// EXPORTED TYPES
// =============================================================================

export type PDFTemplateEntry = {
  orderTemplateId: string;
  templateId: string;
  template: TemplateWithDetails;
  parentOrderTemplateId: string | null;
  isChild: boolean;
  summary: {
    id: string;
    total: string;
    discount: string | null;
    discountAmount: string;
    discountType: string | null;
    finalPayableAmount: string;
    notes: string | null;
  } | null;
  isNew?: boolean;
};

export type FinalCalcRow = {
  label: string;
  orderTemplateId: string;
  total: string;
  childTotal: string | null;
  notes: string | null;
};

export type FinalCalcData = {
  templateRows: FinalCalcRow[];
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
};

type SelectedRowIdEntry = { rowId: string; columnId: string };
type RGB = [number, number, number];

// =============================================================================
// PROPS
// =============================================================================

interface OrderTemplatePDFProps {
  order: OrderWithDetails;
  entries: PDFTemplateEntry[];
  templateValues: Record<string, TemplateValuesMap>;
  resolvedFields?: ResolvedOrderFormField[];
  orderSelectedRowIds?: SelectedRowIdEntry[];
  totalSelectedValue?: number;
  finalCalc?: FinalCalcData; // kept for backward-compat; not rendered
  className?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

/** Returns rowId → blockIndex for every row found in orderSelectedRowIds */
function getSelectedRowBlockMap(
  template: TemplateWithDetails,
  orderSelectedRowIds: SelectedRowIdEntry[]
): Map<string, number> {
  const templateRowIds = new Set((template.rows || []).map((r) => r.id));
  const colBlockMap = new Map<string, number>();
  (template.columns || []).forEach((c) => {
    if (c.isFinalCalculation) colBlockMap.set(c.id, c.blockIndex ?? 0);
  });
  const result = new Map<string, number>();
  for (const entry of orderSelectedRowIds) {
    if (templateRowIds.has(entry.rowId) && colBlockMap.has(entry.columnId)) {
      result.set(entry.rowId, colBlockMap.get(entry.columnId)!);
    }
  }
  return result;
}

function deriveFinalCalcBlockColumns(template: TemplateWithDetails) {
  const finalCols = (template.columns || [])
    .filter((c) => c.isFinalCalculation === true)
    .sort((a, b) => a.orderNo - b.orderNo);

  const blockMap = new Map<number, typeof finalCols>();
  finalCols.forEach((col) => {
    const bi = col.blockIndex ?? 0;
    if (!blockMap.has(bi)) blockMap.set(bi, []);
    blockMap.get(bi)!.push(col);
  });

  const blockNameMap = new Map<number, string>();
  ((template as any).blocks || []).forEach((b: any) => {
    blockNameMap.set(b.orderNo, b.name);
  });

  const groups = Array.from(blockMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([blockIndex, columns]) => ({
      blockIndex,
      label: blockNameMap.get(blockIndex) || '',
      columns
    }));

  return { finalCols, groups, hasMultipleBlocks: groups.length > 1 };
}

// -- image helpers --

async function fetchImageAsDataURL(url: string): Promise<string | null> {
  const tryFetch = async (u: string): Promise<string | null> => {
    try {
      const r = await fetch(u);
      if (!r.ok) return null;
      const blob = await r.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };
  return (
    (await tryFetch(`/api/proxy-image?url=${encodeURIComponent(url)}`)) ??
    (await tryFetch(url))
  );
}

const getImageDims = (dataUrl: string): Promise<{ w: number; h: number }> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 200, h: 200 });
    img.src = dataUrl;
  });

const fitImage = (sw: number, sh: number, mw: number, mh: number) => {
  const r = Math.min(mw / sw, mh / sh, 1);
  return { w: sw * r, h: sh * r };
};

const detectFmt = (d: string) =>
  d.startsWith('data:image/png') ? 'PNG' : 'JPEG';

// =============================================================================
// PDF GENERATION
// =============================================================================

async function generatePDF(
  order: OrderWithDetails,
  selectedEntries: PDFTemplateEntry[],
  templateValues: Record<string, TemplateValuesMap>,
  resolvedFields: ResolvedOrderFormField[],
  orderSelectedRowIds: SelectedRowIdEntry[],
  totalSelectedValue: number
): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M = 36;

  const C = {
    primary: [30, 41, 59] as RGB,
    primaryLight: [248, 250, 252] as RGB,
    accent: [99, 102, 241] as RGB,
    border: [226, 232, 240] as RGB,
    muted: [100, 116, 139] as RGB,
    white: [255, 255, 255] as RGB,
    rowAlt: [248, 250, 252] as RGB,
    totalRow: [241, 245, 249] as RGB,
    refBg: [239, 246, 255] as RGB,
    refBorder: [191, 219, 254] as RGB,
    refText: [30, 64, 175] as RGB,
    formBg: [219, 234, 254] as RGB,
    formFg: [30, 64, 175] as RGB,
    formBadge: [59, 130, 246] as RGB,
    amber: [180, 83, 9] as RGB,
    amberBg: [255, 251, 235] as RGB,
    amberBorder: [253, 230, 138] as RGB
  };

  const BCOL: RGB[] = [
    [37, 99, 235],
    [22, 163, 74],
    [147, 51, 234],
    [217, 119, 6],
    [219, 39, 119],
    [13, 148, 136]
  ];

  const headStyle = {
    fillColor: C.primary,
    textColor: C.white,
    fontStyle: 'bold' as const,
    fontSize: 8,
    cellPadding: { top: 6, bottom: 6, left: 8, right: 8 }
  };
  const bodyStyle = {
    fontSize: 8,
    textColor: C.primary,
    cellPadding: { top: 5, bottom: 5, left: 8, right: 8 },
    lineColor: C.border,
    lineWidth: 0.4
  };
  const tblLine = {
    tableLineColor: C.border,
    tableLineWidth: 0.5,
    alternateRowStyles: { fillColor: C.rowAlt }
  };

  // ── Pre-fetch order-form images ─────────────────────────────────────
  const formImgCache: Record<
    string,
    { dataUrl: string; w: number; h: number }
  > = {};
  for (const field of resolvedFields) {
    const isImg =
      field.fieldType === 'IMAGE' ||
      (field.fieldType === 'SELECT_TEMPLATE_EXTRA_FIELD' &&
        field.extraValueType === 'IMAGE');
    if (isImg && field.value?.startsWith('http')) {
      try {
        const d = await fetchImageAsDataURL(field.value);
        if (d) {
          const dims = await getImageDims(d);
          formImgCache[field.id] = { dataUrl: d, ...dims };
        }
      } catch {}
    }
  }

  // ── Cursor ──────────────────────────────────────────────────────────
  let curY = 0;
  const ensureSpace = (need: number) => {
    if (curY + need > PH - 40) {
      doc.addPage();
      curY = 30;
    }
  };

  // ══════════════════════════════════════════════════════════════════════
  // 1. BANNER
  // ══════════════════════════════════════════════════════════════════════
  doc.setFillColor(...C.primary);
  doc.rect(0, 0, PW, 64, 'F');
  doc.setFillColor(...C.accent);
  doc.rect(0, 0, 6, 64, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...C.white);
  doc.text(`Order Form #${order.orderNo}`, 24, 26);

  let bx = 28;
  const by = 34;
  [
    { text: order.orderType ?? '', bg: C.accent },
    { text: order.status ?? 'DRAFT', bg: C.muted }
  ].forEach(({ text, bg }) => {
    if (!text) return;
    const w = doc.getTextWidth(text) + 14;
    doc.setFillColor(...bg);
    doc.roundedRect(bx, by, w, 14, 3, 3, 'F');
    doc.setFontSize(8);
    doc.setTextColor(...C.white);
    doc.text(text, bx + 7, by + 10);
    bx += w + 6;
  });

  if (order.product?.name) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...C.white);
    doc.text(order.product.name, PW - M, 26, { align: 'right' });
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(160, 175, 200);
  doc.text(`Generated ${new Date().toLocaleString('en-IN')}`, PW - M, 50, {
    align: 'right'
  });

  curY = 80;

  // ══════════════════════════════════════════════════════════════════════
  // 2. METADATA GRID
  // ══════════════════════════════════════════════════════════════════════
  {
    const fields: [string, string][] = [
      ['Product', order.product?.name ?? '—'],
      ['Customer', order.customer?.name ?? '—'],
      ['Order No', order.orderNo ?? '—'],
      ['Type', order.orderType ?? '—'],
      ['Status', order.status ?? 'DRAFT'],
      ['Created', fmtDate(order.createdAt)]
    ];
    const H = 50;
    doc.setFillColor(...C.primaryLight);
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.5);
    doc.roundedRect(M, curY, PW - M * 2, H, 4, 4, 'FD');
    const cw = (PW - M * 2 - 24) / fields.length;
    fields.forEach(([l, v], i) => {
      const fx = M + 12 + i * cw;
      const fy = curY + 16;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...C.muted);
      doc.text(l, fx, fy);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...C.primary);
      doc.text(doc.splitTextToSize(v, cw - 8)[0] ?? v, fx, fy + 12);
    });
    curY += H + 12;
  }

  // ══════════════════════════════════════════════════════════════════════
  // 3. DESIGN REFERENCE BANNER
  // ══════════════════════════════════════════════════════════════════════
  if (order.referenceNo) {
    const H = 22;
    doc.setFillColor(...C.refBg);
    doc.setDrawColor(...C.refBorder);
    doc.setLineWidth(0.5);
    doc.roundedRect(M, curY, PW - M * 2, H, 3, 3, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    doc.text('Design No:', M + 10, curY + 14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.refText);
    doc.text(`#${order.referenceNo}`, M + 62, curY + 14);
    curY += H + 10;
  }

  // ══════════════════════════════════════════════════════════════════════
  // 4. TOTAL SELECTED VALUE
  // ══════════════════════════════════════════════════════════════════════
  if (totalSelectedValue > 0) {
    const H = 22;
    doc.setFillColor(...C.primaryLight);
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.5);
    doc.roundedRect(M, curY, PW - M * 2, H, 3, 3, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    doc.text('Value:', M + 10, curY + 14);
    doc.setFont('courier', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...C.primary);
    const valStr = totalSelectedValue.toFixed(2);
    doc.text(valStr, M + 45, curY + 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(
      '(sum of selected rows)',
      M + 45 + doc.getTextWidth(valStr) + 8,
      curY + 14
    );
    curY += H + 10;
  }

  // ══════════════════════════════════════════════════════════════════════
  // 5. ORDER FORM FIELDS
  // ══════════════════════════════════════════════════════════════════════
  {
    const fieldsWithValues = resolvedFields.filter(
      (f) => f.value && f.value.trim() !== ''
    );

    if (fieldsWithValues.length > 0) {
      const textFields: ResolvedOrderFormField[] = [];
      const imageFields: ResolvedOrderFormField[] = [];

      fieldsWithValues.forEach((f) => {
        const isImg =
          f.fieldType === 'IMAGE' ||
          (f.fieldType === 'SELECT_TEMPLATE_EXTRA_FIELD' &&
            f.extraValueType === 'IMAGE');
        if (isImg && f.value?.startsWith('http')) imageFields.push(f);
        else textFields.push(f);
      });

      ensureSpace(40);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...C.formFg);
      doc.text('Order Form Fields', M, curY + 4);
      doc.setDrawColor(...C.formBadge);
      doc.setLineWidth(1.5);
      doc.line(M, curY + 7, M + 110, curY + 7);
      doc.setLineWidth(0.5);
      curY += 16;

      if (textFields.length > 0) {
        autoTable(doc, {
          startY: curY,
          margin: { left: M, right: M },
          head: [['Field', 'Value']],
          body: textFields.map((f) => [f.fieldName, f.value || '—']),
          theme: 'plain',
          headStyles: {
            fillColor: C.formBg,
            textColor: C.formFg,
            fontStyle: 'bold' as const,
            fontSize: 7,
            cellPadding: { top: 4, bottom: 4, left: 8, right: 8 }
          },
          bodyStyles: {
            fontSize: 8,
            textColor: C.primary,
            cellPadding: { top: 5, bottom: 5, left: 8, right: 8 }
          },
          ...tblLine,
          columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 160, textColor: C.muted }
          }
        });
        curY = (doc as any).lastAutoTable.finalY + 10;
      }

      for (const imgField of imageFields) {
        const cached = formImgCache[imgField.id];
        ensureSpace(20);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...C.muted);
        doc.text(`${imgField.fieldName}:`, M, curY + 4);
        curY += 10;

        if (cached) {
          const fit = fitImage(cached.w, cached.h, 300, 200);
          ensureSpace(fit.h + 16);
          doc.setDrawColor(...C.formBadge);
          doc.setLineWidth(1);
          doc.roundedRect(M, curY, fit.w + 8, fit.h + 8, 3, 3, 'D');
          doc.setLineWidth(0.5);
          try {
            doc.addImage(
              cached.dataUrl,
              detectFmt(cached.dataUrl),
              M + 4,
              curY + 4,
              fit.w,
              fit.h
            );
          } catch {
            doc.setFillColor(...C.rowAlt);
            doc.rect(M + 4, curY + 4, fit.w, fit.h, 'F');
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(...C.muted);
            doc.text(
              'Image could not be embedded',
              M + 8,
              curY + fit.h / 2 + 4
            );
          }
          curY += fit.h + 16;
        } else {
          ensureSpace(36);
          doc.setFillColor(...C.rowAlt);
          doc.setDrawColor(...C.border);
          doc.roundedRect(M, curY, 120, 28, 3, 3, 'FD');
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(7);
          doc.setTextColor(...C.muted);
          doc.text('Image unavailable', M + 60, curY + 16, { align: 'center' });
          curY += 38;
        }
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // 6. TEMPLATE TABLES
  //    Every selected entry is always drawn — no early exits for missing
  //    values, missing final-calc columns, or zero selected rows.
  // ══════════════════════════════════════════════════════════════════════
  if (selectedEntries.length > 0) {
    ensureSpace(30);
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.5);
    doc.line(M, curY, PW - M, curY);
    curY += 12;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...C.primary);
    doc.text('Selected Rows', M, curY + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(
      'Rows selected for this order form, with their final calculation values',
      M,
      curY + 16
    );
    curY += 28;
  }

  // Group by templateId so parent + children sit together
  const entryGroups: {
    templateId: string;
    parent: PDFTemplateEntry | null;
    children: PDFTemplateEntry[];
  }[] = [];
  {
    const seen = new Map<
      string,
      { parent: PDFTemplateEntry | null; children: PDFTemplateEntry[] }
    >();
    for (const entry of selectedEntries) {
      if (!seen.has(entry.templateId))
        seen.set(entry.templateId, { parent: null, children: [] });
      const g = seen.get(entry.templateId)!;
      if (entry.isChild) g.children.push(entry);
      else g.parent = entry;
    }
    seen.forEach((v, templateId) => entryGroups.push({ templateId, ...v }));
  }

  // ── Draw a single template entry ────────────────────────────────────
  // Never bails out due to empty values / missing columns.
  function drawTemplateTable(entry: PDFTemplateEntry, label: string) {
    const { template: t } = entry;
    const vals = templateValues[entry.orderTemplateId] ?? {};
    const allRows = [...(t.rows || [])].sort((a, b) => a.orderNo - b.orderNo);

    // Which rows to show:
    // • If the order has explicit row selections for this template → those rows only
    // • Otherwise → all rows (so the table is never blank)
    const rowBlockMap = getSelectedRowBlockMap(t, orderSelectedRowIds);
    const rowsToShow =
      rowBlockMap.size > 0
        ? allRows.filter((r) => rowBlockMap.has(r.id))
        : allRows;

    // Which columns to use:
    // • If the template has final-calc columns → block-aware final-calc layout
    // • Otherwise → all columns (so the table is never blank)
    const {
      finalCols,
      groups: colGroups,
      hasMultipleBlocks
    } = deriveFinalCalcBlockColumns(t);
    const useFinalCalcCols = finalCols.length > 0;
    const allCols = [...(t.columns || [])].sort(
      (a, b) => a.orderNo - b.orderNo
    );

    // ── Section title + row-count badge ────────────────────────────
    ensureSpace(60);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...C.primary);
    doc.text(label, M, curY + 4);

    let badgeX = M + doc.getTextWidth(label) + 10;

    const rcText = `${rowsToShow.length}/${allRows.length} rows`;
    const rcW = doc.getTextWidth(rcText) + 14;
    doc.setDrawColor(...C.border);
    doc.setFillColor(...C.white);
    doc.roundedRect(badgeX, curY - 4, rcW, 14, 3, 3, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...C.muted);
    doc.text(rcText, badgeX + 7, curY + 5);
    badgeX += rcW + 6;

    if (useFinalCalcCols) {
      const fcText = `${finalCols.length} final-calc ${finalCols.length === 1 ? 'col' : 'cols'}`;
      const fcW = doc.getTextWidth(fcText) + 14;
      doc.setFillColor(...C.amberBg);
      doc.setDrawColor(...C.amberBorder);
      doc.roundedRect(badgeX, curY - 4, fcW, 14, 3, 3, 'FD');
      doc.setTextColor(...C.amber);
      doc.text(fcText, badgeX + 7, curY + 5);
    }

    curY += 18;

    // ── No rows at all → placeholder ───────────────────────────────
    if (rowsToShow.length === 0) {
      ensureSpace(28);
      doc.setFillColor(...C.rowAlt);
      doc.setDrawColor(...C.border);
      doc.roundedRect(M, curY, PW - M * 2, 22, 3, 3, 'FD');
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(...C.muted);
      doc.text('No rows defined for this template.', M + 12, curY + 14);
      curY += 32;
      return;
    }

    // ── CASE A: final-calc columns available ────────────────────────
    if (useFinalCalcCols) {
      const flat = colGroups.flatMap((g) => g.columns);
      const uw = PW - M * 2;
      const dw = Math.min(180, uw * 0.25);
      const colW = flat.length > 0 ? (uw - dw) / flat.length : 0;

      let head: any[][];
      if (hasMultipleBlocks) {
        const r1: any[] = [
          {
            content: 'Row',
            rowSpan: 2,
            styles: { valign: 'middle', halign: 'left' }
          }
        ];
        colGroups.forEach((g, i) =>
          r1.push({
            content: g.label
              ? `Block ${g.blockIndex} (${g.label})`
              : `Block ${g.blockIndex}`,
            colSpan: g.columns.length,
            styles: {
              halign: 'center',
              fillColor: BCOL[i % BCOL.length],
              textColor: C.white,
              fontStyle: 'bold',
              fontSize: 7
            }
          })
        );
        const r2 = colGroups.flatMap((g) =>
          g.columns.map((c: any) => ({
            content: c.label,
            styles: { halign: 'center' }
          }))
        );
        head = [r1, r2];
      } else {
        head = [['Row', ...flat.map((c: any) => c.label)]];
      }

      const body = rowsToShow.map((row) => {
        const rowBlockIdx = rowBlockMap.get(row.id) ?? 0;
        const isTotalRow = row.rowType === 'TOTAL';
        const isFinalCalc = (row as any).isFinalCalculation === true;

        let rowLabel = row.label;
        if (isTotalRow) rowLabel += '  [Total]';
        if (isFinalCalc) rowLabel += '  [Final Calc]';

        const cells: any[] = [
          {
            content: rowLabel,
            styles: {
              fontStyle: isTotalRow ? 'bold' : ('normal' as any),
              fillColor: isTotalRow ? C.totalRow : undefined
            }
          }
        ];

        flat.forEach((col: any) => {
          const colBlock = col.blockIndex ?? 0;
          const isActive = !hasMultipleBlocks || colBlock === rowBlockIdx;
          const rawVal = vals[row.id]?.[col.id] ?? '';
          cells.push({
            content: isActive ? rawVal || '—' : '—',
            styles: {
              halign: 'right' as const,
              fontStyle: isTotalRow ? 'bold' : ('normal' as any),
              fillColor: isTotalRow
                ? C.totalRow
                : !isActive
                  ? ([240, 240, 240] as RGB)
                  : undefined,
              textColor: isActive ? C.primary : C.muted
            }
          });
        });
        return cells;
      });

      // Dynamic scaling to fit on remaining page height
      const availH = PH - 40 - curY;
      const headerRows = hasMultipleBlocks ? 2 : 1;
      const naturalH = headerRows * 22 + body.length * 20 + 8;
      let scaledHead = headStyle;
      let scaledBody = bodyStyle;
      if (naturalH > availH && availH > 40) {
        const scale = availH / naturalH;
        const fs = Math.max(4.5, +(8 * scale).toFixed(2));
        const hPad = Math.max(1, +(6 * scale).toFixed(2));
        const bPad = Math.max(1, +(5 * scale).toFixed(2));
        const pH = Math.max(2, +(8 * scale).toFixed(2));
        scaledHead = {
          ...headStyle,
          fontSize: fs,
          cellPadding: { top: hPad, bottom: hPad, left: pH, right: pH }
        };
        scaledBody = {
          ...bodyStyle,
          fontSize: fs,
          cellPadding: { top: bPad, bottom: bPad, left: pH, right: pH }
        };
      }

      autoTable(doc, {
        startY: curY,
        margin: { left: M, right: M },
        pageBreak: 'avoid' as any,
        head,
        body,
        theme: 'plain',
        headStyles: scaledHead,
        bodyStyles: scaledBody,
        ...tblLine,
        columnStyles: {
          0: { cellWidth: dw, fontStyle: 'bold', halign: 'left' },
          ...Object.fromEntries(
            flat.map((_: any, i: number) => [
              i + 1,
              { cellWidth: colW, halign: 'right' as const, font: 'courier' }
            ])
          )
        }
      });
      curY = (doc as any).lastAutoTable.finalY + 16;
      return;
    }

    // ── CASE B: no final-calc columns → show all columns ───────────
    const uw = PW - M * 2;
    const dw = Math.min(180, uw * 0.25);
    const colW = allCols.length > 0 ? (uw - dw) / allCols.length : 0;

    const head = [['Row', ...allCols.map((c) => c.label)]];

    const body = rowsToShow.map((row) => {
      const isTotalRow = row.rowType === 'TOTAL';
      let rowLabel = row.label;
      if (isTotalRow) rowLabel += '  [Total]';

      const cells: any[] = [
        {
          content: rowLabel,
          styles: {
            fontStyle: isTotalRow ? 'bold' : ('normal' as any),
            fillColor: isTotalRow ? C.totalRow : undefined
          }
        }
      ];

      allCols.forEach((col) => {
        const rawVal = vals[row.id]?.[col.id] ?? '';
        cells.push({
          content: rawVal || '—',
          styles: {
            halign: 'right' as const,
            fontStyle: isTotalRow ? 'bold' : ('normal' as any),
            fillColor: isTotalRow ? C.totalRow : undefined,
            font: 'courier'
          }
        });
      });
      return cells;
    });

    autoTable(doc, {
      startY: curY,
      margin: { left: M, right: M },
      pageBreak: 'avoid' as any,
      head,
      body,
      theme: 'plain',
      headStyles: headStyle,
      bodyStyles: bodyStyle,
      ...tblLine,
      columnStyles: {
        0: { cellWidth: dw, fontStyle: 'bold', halign: 'left' },
        ...Object.fromEntries(
          allCols.map((_: any, i: number) => [
            i + 1,
            { cellWidth: colW, halign: 'right' as const }
          ])
        )
      }
    });
    curY = (doc as any).lastAutoTable.finalY + 16;
  }

  for (const group of entryGroups) {
    const tmplName =
      group.parent?.template?.name ??
      group.children[0]?.template?.name ??
      'Template';

    if (group.parent) {
      drawTemplateTable(
        group.parent,
        group.children.length > 0 ? `${tmplName} — Parent Template` : tmplName
      );
    }
    group.children.forEach((child, idx) => {
      drawTemplateTable(child, `${tmplName} — Duplicate #${idx + 1}`);
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // PAGE FOOTERS
  // ══════════════════════════════════════════════════════════════════════
  const totalPageCount = (doc.internal as any).getNumberOfPages?.() ?? 1;
  for (let p = 1; p <= totalPageCount; p++) {
    doc.setPage(p);
    const fy = PH - 20;
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.5);
    doc.line(M, fy - 6, PW - M, fy - 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(`Order Form #${order.orderNo}`, M, fy + 2);
    doc.text(`Page ${p} of ${totalPageCount}`, PW - M, fy + 2, {
      align: 'right'
    });
  }

  doc.save(`order_form_${order.orderNo}.pdf`);
}

// =============================================================================
// LABEL HELPER
// =============================================================================

type LabelledEntry = { entry: PDFTemplateEntry; label: string };

function buildLabelledEntries(entries: PDFTemplateEntry[]): LabelledEntry[] {
  const ctr = new Map<string, number>();
  return entries
    .filter((e) => !e.isNew)
    .map((e) => {
      if (e.isChild) {
        const n = (ctr.get(e.templateId) ?? 0) + 1;
        ctr.set(e.templateId, n);
        return {
          entry: e,
          label: `${e.template?.name ?? 'Template'} — Duplicate #${n}`
        };
      }
      return { entry: e, label: e.template?.name ?? 'Template' };
    });
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function OrdersFormPDF({
  order,
  entries,
  templateValues,
  resolvedFields = [],
  orderSelectedRowIds = [],
  totalSelectedValue = 0,
  className
}: OrderTemplatePDFProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);

  const labelled = useMemo(() => buildLabelledEntries(entries), [entries]);
  const allIds = useMemo(
    () => new Set(labelled.map((l) => l.entry.orderTemplateId)),
    [labelled]
  );
  const allSel = selectedIds.size === allIds.size && allIds.size > 0;
  const noneSel = selectedIds.size === 0;

  const openDialog = useCallback(() => {
    setSelectedIds(new Set(allIds));
    setDialogOpen(true);
  }, [allIds]);

  const toggle = useCallback(
    (id: string) =>
      setSelectedIds((p) => {
        const n = new Set(p);
        n.has(id) ? n.delete(id) : n.add(id);
        return n;
      }),
    []
  );

  const toggleAll = useCallback(
    () => setSelectedIds(allSel ? new Set() : new Set(allIds)),
    [allSel, allIds]
  );

  const handleDownload = useCallback(async () => {
    const toExport = labelled
      .filter((l) => selectedIds.has(l.entry.orderTemplateId))
      .map((l) => l.entry);
    if (toExport.length === 0) return;
    setIsGenerating(true);
    try {
      await generatePDF(
        order,
        toExport,
        templateValues,
        resolvedFields,
        orderSelectedRowIds,
        totalSelectedValue
      );
      setDialogOpen(false);
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [
    labelled,
    selectedIds,
    order,
    templateValues,
    resolvedFields,
    orderSelectedRowIds,
    totalSelectedValue
  ]);

  if (labelled.length === 0) return null;

  const selCount = selectedIds.size;
  const totalItems = labelled.length;
  const chkCls =
    'shrink-0 data-[state=checked]:border-indigo-600 data-[state=checked]:bg-indigo-600';

  return (
    <div className={className}>
      <Button
        variant='outline'
        size='sm'
        onClick={openDialog}
        className='gap-1.5'
      >
        <FileText className='h-3.5 w-3.5' />
        Download PDF
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='max-w-xl'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <FileText className='h-4 w-4 text-indigo-500' />
              Select Templates for PDF
            </DialogTitle>
            <DialogDescription>
              Choose which templates to include in the PDF.
            </DialogDescription>
          </DialogHeader>

          {/* Order summary strip */}
          <div className='bg-muted/40 flex flex-wrap gap-x-5 gap-y-1 rounded-md border px-4 py-2 text-xs'>
            {[
              ['Order', `#${order.orderNo}`],
              ['Product', order.product?.name ?? '—'],
              ['Customer', order.customer?.name ?? '—'],
              ...(order.referenceNo
                ? [['Design No', `#${order.referenceNo}`]]
                : []),
              ...(totalSelectedValue > 0
                ? [['Value', totalSelectedValue.toFixed(2)]]
                : [])
            ].map(([l, v]) => (
              <span key={l}>
                <span className='text-muted-foreground'>{l}: </span>
                <span className='font-semibold'>{v}</span>
              </span>
            ))}
          </div>

          {/* Select-all toggle */}
          <div className='bg-muted/20 flex items-center justify-between rounded-md border px-4 py-2.5'>
            <button
              type='button'
              onClick={toggleAll}
              className='hover:text-foreground text-muted-foreground flex items-center gap-2.5 text-sm font-medium transition-colors'
            >
              {allSel ? (
                <CheckSquare className='h-4 w-4 text-indigo-600' />
              ) : selectedIds.size > 0 ? (
                <CheckSquare className='h-4 w-4 text-indigo-400 opacity-60' />
              ) : (
                <Square className='h-4 w-4' />
              )}
              {allSel ? 'Deselect All' : 'Select All'}
            </button>
            <span className='text-muted-foreground text-xs'>
              {selCount} of {totalItems} selected
            </span>
          </div>

          {/* Template list */}
          <ScrollArea className='max-h-[46vh] pr-1'>
            <div className='space-y-2'>
              {labelled.map(({ entry, label }) => (
                <div
                  key={entry.orderTemplateId}
                  className={cn(
                    'rounded-lg border px-4 py-3 transition-colors',
                    selectedIds.has(entry.orderTemplateId)
                      ? 'border-indigo-200 bg-indigo-50/60'
                      : 'border-border bg-muted/20'
                  )}
                >
                  <div className='flex items-center gap-3'>
                    <Checkbox
                      id={`chk-${entry.orderTemplateId}`}
                      checked={selectedIds.has(entry.orderTemplateId)}
                      onCheckedChange={() => toggle(entry.orderTemplateId)}
                      className={chkCls}
                    />
                    <label
                      htmlFor={`chk-${entry.orderTemplateId}`}
                      className='flex flex-1 cursor-pointer items-center gap-2 text-sm font-medium'
                    >
                      <FileText className='text-muted-foreground h-3.5 w-3.5 shrink-0' />
                      <span className='truncate'>{label}</span>
                      {entry.isChild && (
                        <Badge
                          variant='secondary'
                          className='shrink-0 px-1.5 py-0 text-[10px]'
                        >
                          Duplicate
                        </Badge>
                      )}
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <DialogFooter className='items-center gap-2 sm:gap-2'>
            <p className='text-muted-foreground mr-auto text-xs'>
              {selCount > 0
                ? `${selCount} template${selCount > 1 ? 's' : ''} selected`
                : 'Select at least one template'}
            </p>
            <Button
              variant='outline'
              onClick={() => setDialogOpen(false)}
              disabled={isGenerating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDownload}
              disabled={isGenerating || noneSel}
              className='gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50'
            >
              {isGenerating ? (
                <Loader2 className='h-4 w-4 animate-spin' />
              ) : (
                <Download className='h-4 w-4' />
              )}
              {isGenerating ? 'Generating…' : 'Download PDF'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
