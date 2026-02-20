'use client';

/**
 * OrderTemplatePDF — reusable multi-select PDF download component.
 *
 * Install peer deps (once, in your project):
 *   npm install jspdf jspdf-autotable
 *
 * Usage:
 *   <OrderTemplatePDF
 *     order={order}
 *     entries={entries}
 *     templateValues={templateValues}
 *     extraValues={extraValues}
 *   />
 */

import { useState, useCallback, useMemo } from 'react';
import {
  Download,
  FileText,
  Loader2,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
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
import type { TemplateValuesMap } from './order-template-values';
import type { ExtraValuesMap } from './order-extra-values';

// =============================================================================
// TYPES
// =============================================================================

type OrderTemplateSummary = {
  id: string;
  total: string;
  discount: string | null;
  discountAmount: string;
  discountType: string | null;
  finalPayableAmount: string;
  notes: string | null;
};

export type PDFTemplateEntry = {
  orderTemplateId: string;
  templateId: string;
  template: TemplateWithDetails;
  parentOrderTemplateId: string | null;
  isChild: boolean;
  summary: OrderTemplateSummary | null;
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
  discount: string;
  marginDiscount: string;
  finalPayableAmount: string;
  hasAnyChildren: boolean;
};

/** Sentinel ID used to represent the Final Calculation page in selectedIds */
const FINAL_CALC_ID = '__final_calculation__';

interface OrderTemplatePDFProps {
  order: OrderWithDetails;
  entries: PDFTemplateEntry[];
  templateValues: Record<string, TemplateValuesMap>;
  extraValues: Record<string, ExtraValuesMap>;
  /** Pass this to include Final Calculation as a selectable page */
  finalCalc?: FinalCalcData;
  className?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

const fmt = (v: string | null | undefined): string => {
  if (!v) return '0.00';
  const n = parseFloat(v);
  return isNaN(n) ? '0.00' : n.toFixed(2);
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

// =============================================================================
// PREVIEW TABLE — mirrors the on-screen table exactly
// =============================================================================

interface PreviewTableProps {
  entry: PDFTemplateEntry;
  values: TemplateValuesMap;
  extras: ExtraValuesMap;
}

function PreviewTable({ entry, values, extras }: PreviewTableProps) {
  const { template, summary } = entry;
  const columns = template.columns ?? [];
  const rows = template.rows ?? [];
  const extraFields = template.extra ?? [];
  const headerExtras = extraFields.filter((f) => f.sectionType === 'HEADER');
  const footerExtras = extraFields.filter((f) => f.sectionType === 'FOOTER');

  return (
    <div className='space-y-2.5 text-xs'>
      {/* Header extra values */}
      {headerExtras.length > 0 && (
        <div className='bg-muted/30 grid grid-cols-2 gap-x-6 gap-y-1 rounded-md border px-3 py-2'>
          {headerExtras.map((f) => (
            <div key={f.id} className='flex gap-1'>
              <span className='text-muted-foreground font-medium'>
                {f.label}:
              </span>
              <span>{extras[f.id]?.value ?? '—'}</span>
            </div>
          ))}
        </div>
      )}

      {/* Main values table */}
      {columns.length > 0 && rows.length > 0 && (
        <div className='overflow-x-auto rounded-md border'>
          <table className='w-full text-xs'>
            <thead>
              <tr className='bg-muted/60 border-b'>
                <th className='px-3 py-2 text-left font-semibold'>
                  Description
                </th>
                {columns.map((col) => (
                  <th
                    key={col.id}
                    className='px-3 py-2 text-right font-semibold'
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => {
                const isTotal = row.rowType === 'TOTAL';
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      'border-b',
                      isTotal && 'bg-muted/40 font-semibold',
                      ri % 2 === 0 && !isTotal && 'bg-background',
                      ri % 2 !== 0 && !isTotal && 'bg-muted/10'
                    )}
                  >
                    <td className='px-3 py-1.5'>{row.label}</td>
                    {columns.map((col) => (
                      <td
                        key={col.id}
                        className='px-3 py-1.5 text-right font-mono tabular-nums'
                      >
                        {values[row.id]?.[col.id] ?? ''}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div className='flex justify-end'>
          <div className='w-60 overflow-hidden rounded-md border text-xs'>
            <div className='bg-muted/20 flex justify-between border-b px-3 py-1.5'>
              <span className='text-muted-foreground'>Subtotal</span>
              <span className='font-mono font-medium tabular-nums'>
                {fmt(summary.total)}
              </span>
            </div>
            {summary.discountAmount &&
              parseFloat(summary.discountAmount) > 0 && (
                <div className='flex justify-between border-b px-3 py-1.5'>
                  <span className='text-muted-foreground'>
                    Discount
                    {summary.discountType
                      ? ` (${summary.discountType === 'PERCENT' ? '%' : '₹'})`
                      : ''}
                  </span>
                  <span className='font-mono tabular-nums'>
                    -{fmt(summary.discountAmount)}
                  </span>
                </div>
              )}
            <div className='flex justify-between bg-indigo-50 px-3 py-2 font-semibold text-indigo-700'>
              <span>Total Payable</span>
              <span className='font-mono tabular-nums'>
                {fmt(summary.finalPayableAmount)}
              </span>
            </div>
            {summary.notes && (
              <div className='text-muted-foreground border-t px-3 py-1.5 italic'>
                {summary.notes}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer extra values */}
      {footerExtras.length > 0 && (
        <div className='bg-muted/30 grid grid-cols-2 gap-x-6 gap-y-1 rounded-md border px-3 py-2'>
          {footerExtras.map((f) => (
            <div key={f.id} className='flex gap-1'>
              <span className='text-muted-foreground font-medium'>
                {f.label}:
              </span>
              <span>{extras[f.id]?.value ?? '—'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// FINAL CALC PREVIEW — shown in dialog when Final Calculation is expanded
// =============================================================================

function FinalCalcPreview({ data }: { data: FinalCalcData }) {
  const {
    templateRows,
    discount,
    marginDiscount,
    finalPayableAmount,
    hasAnyChildren
  } = data;
  return (
    <div className='space-y-2.5 text-xs'>
      <div className='overflow-x-auto rounded-md border'>
        <table className='w-full text-xs'>
          <thead>
            <tr className='bg-muted/60 border-b'>
              <th className='px-3 py-2 text-left font-semibold'>Template</th>
              <th className='px-3 py-2 text-right font-semibold'>Total (₹)</th>
              {hasAnyChildren && (
                <th className='px-3 py-2 text-right font-semibold'>
                  Child Total (₹)
                </th>
              )}
              <th className='px-3 py-2 text-left font-semibold'>Notes</th>
            </tr>
          </thead>
          <tbody>
            {templateRows.map((row, ri) => (
              <tr
                key={row.orderTemplateId}
                className={cn(
                  'border-b',
                  ri % 2 === 0 ? 'bg-background' : 'bg-muted/10'
                )}
              >
                <td className='px-3 py-1.5 font-medium'>{row.label}</td>
                <td className='px-3 py-1.5 text-right font-mono tabular-nums'>
                  {row.total}
                </td>
                {hasAnyChildren && (
                  <td className='text-muted-foreground px-3 py-1.5 text-right font-mono tabular-nums'>
                    {row.childTotal ?? '—'}
                  </td>
                )}
                <td className='text-muted-foreground px-3 py-1.5 italic'>
                  {row.notes ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary rows */}
      <div className='flex justify-end'>
        <div className='w-64 overflow-hidden rounded-md border text-xs'>
          <div className='flex justify-between border-b px-3 py-1.5'>
            <span className='text-muted-foreground'>Discount</span>
            <span className='font-mono tabular-nums'>{discount}</span>
          </div>
          <div className='flex justify-between border-b px-3 py-1.5'>
            <span className='text-muted-foreground'>Margin Discount</span>
            <span className='font-mono tabular-nums'>{marginDiscount}</span>
          </div>
          <div className='flex justify-between bg-indigo-50 px-3 py-2 font-semibold text-indigo-700'>
            <span>Final Payable Amount</span>
            <span className='font-mono tabular-nums'>{finalPayableAmount}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Each selected entry occupies its own page (page break between them).
// =============================================================================

async function generateMultiPDF(
  order: OrderWithDetails,
  selectedEntries: PDFTemplateEntry[],
  templateValues: Record<string, TemplateValuesMap>,
  extraValues: Record<string, ExtraValuesMap>,
  finalCalc: FinalCalcData | null,
  includeFinalCalc: boolean
): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const PAGE_W = doc.internal.pageSize.getWidth();
  const PAGE_H = doc.internal.pageSize.getHeight();
  const MARGIN = 36;

  // ── Colour palette ──────────────────────────────────────────────────
  const C = {
    primary: [30, 41, 59] as [number, number, number],
    primaryLight: [248, 250, 252] as [number, number, number],
    accent: [99, 102, 241] as [number, number, number],
    accentSoft: [238, 242, 255] as [number, number, number],
    border: [226, 232, 240] as [number, number, number],
    muted: [100, 116, 139] as [number, number, number],
    white: [255, 255, 255] as [number, number, number],
    rowAlt: [248, 250, 252] as [number, number, number],
    totalRow: [241, 245, 249] as [number, number, number]
  } as const;

  // ── Draw top banner ─────────────────────────────────────────────────
  function drawBanner(
    templateName: string,
    isChild: boolean,
    pageIndex: number
  ) {
    doc.setFillColor(...C.primary);
    doc.rect(0, 0, PAGE_W, 72, 'F');
    doc.setFillColor(...C.accent);
    doc.rect(0, 0, 6, 72, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(...C.white);
    doc.text(templateName, 24, 28);

    if (isChild) {
      doc.setFillColor(...C.accent);
      doc.roundedRect(24, 34, 54, 14, 3, 3, 'F');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text('DUPLICATE', 51, 43.5, { align: 'center' });
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 210, 230);
    doc.text(`Order #${order.orderNo}`, PAGE_W - MARGIN, 22, {
      align: 'right'
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...C.white);
    doc.text(order.product?.name ?? '', PAGE_W - MARGIN, 38, {
      align: 'right'
    });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(160, 175, 200);
    doc.text(
      `Template ${pageIndex} of ${selectedEntries.length}  ·  Generated ${new Date().toLocaleString('en-IN')}`,
      PAGE_W - MARGIN,
      62,
      { align: 'right' }
    );
  }

  // ── Draw order-details info card ────────────────────────────────────
  function drawInfoCard(y: number, templateName: string): number {
    const H = 60;
    doc.setFillColor(...C.primaryLight);
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.5);
    doc.roundedRect(MARGIN, y, PAGE_W - MARGIN * 2, H, 4, 4, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text('ORDER DETAILS', MARGIN + 12, y + 14);

    const fields: [string, string][] = [
      ['Product', order.product?.name ?? '—'],
      ['Customer', order.customer?.name ?? '—'],
      ['Order No', order.orderNo ?? '—'],
      ['Type', order.orderType ?? '—'],
      ['Status', order.status ?? 'DRAFT'],
      ['Reference', order.referenceNo ?? '—'],
      ['Created', fmtDate(order.createdAt)],
      ['Template', templateName]
    ];

    const colW = (PAGE_W - MARGIN * 2 - 24) / 4;
    fields.forEach(([label, value], idx) => {
      const col = idx % 4;
      const row = Math.floor(idx / 4);
      const fx = MARGIN + 12 + col * colW;
      const fy = y + 24 + row * 18;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...C.muted);
      doc.text(label, fx, fy);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...C.primary);
      const truncated = doc.splitTextToSize(value, colW - 8)[0] ?? value;
      doc.text(truncated, fx, fy + 9);
    });

    return y + H + 16;
  }

  // ── Helper: render the Final Calculation page ────────────────────────
  function renderFinalCalcPage(
    fc: FinalCalcData,
    pageIndex: number,
    total: number
  ) {
    const {
      templateRows,
      discount,
      marginDiscount,
      finalPayableAmount,
      hasAnyChildren
    } = fc;

    // Banner
    doc.setFillColor(...C.primary);
    doc.rect(0, 0, PAGE_W, 72, 'F');
    doc.setFillColor(...C.accent);
    doc.rect(0, 0, 6, 72, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(...C.white);
    doc.text('Final Calculation', 24, 28);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 210, 230);
    doc.text(`Order #${order.orderNo}`, PAGE_W - MARGIN, 22, {
      align: 'right'
    });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...C.white);
    doc.text(order.product?.name ?? '', PAGE_W - MARGIN, 38, {
      align: 'right'
    });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(160, 175, 200);
    doc.text(
      `Page ${pageIndex} of ${total}  ·  Generated ${new Date().toLocaleString('en-IN')}`,
      PAGE_W - MARGIN,
      62,
      { align: 'right' }
    );

    let y = 90;
    y = drawInfoCard(y, 'Final Calculation');

    // Section label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...C.accent);
    doc.text('TEMPLATE SUMMARY', MARGIN, y + 4);
    doc.setDrawColor(...C.accent);
    doc.setLineWidth(1.5);
    doc.line(MARGIN, y + 7, MARGIN + 100, y + 7);
    doc.setLineWidth(0.5);
    y += 16;

    // Build column list
    const headCols = ['Template', 'Total (₹)'];
    if (hasAnyChildren) headCols.push('Child Total (₹)');
    headCols.push('Notes');

    const usableW = PAGE_W - MARGIN * 2;
    const noteW = 160;
    const totalColW = 90;
    const childColW = hasAnyChildren ? 90 : 0;
    const labelW = usableW - totalColW - childColW - noteW;

    const colStyles: Record<number, object> = {
      0: { cellWidth: labelW, fontStyle: 'bold', halign: 'left' as const },
      1: { cellWidth: totalColW, halign: 'right' as const, font: 'courier' }
    };
    if (hasAnyChildren) {
      colStyles[2] = {
        cellWidth: childColW,
        halign: 'right' as const,
        font: 'courier',
        textColor: C.muted
      };
      colStyles[3] = {
        cellWidth: noteW,
        halign: 'left' as const,
        textColor: C.muted
      };
    } else {
      colStyles[2] = {
        cellWidth: noteW,
        halign: 'left' as const,
        textColor: C.muted
      };
    }

    const bodyRows = templateRows.map((row) => {
      const cells: object[] = [
        { content: row.label },
        { content: row.total, styles: { halign: 'right' as const } }
      ];
      if (hasAnyChildren) {
        cells.push({
          content: row.childTotal ?? '—',
          styles: { halign: 'right' as const, textColor: C.muted }
        });
      }
      cells.push({ content: row.notes ?? '—', styles: { textColor: C.muted } });
      return cells;
    });

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [headCols],
      body: bodyRows,
      theme: 'plain',
      headStyles: {
        fillColor: C.primary,
        textColor: C.white,
        fontStyle: 'bold',
        fontSize: 8,
        cellPadding: { top: 6, bottom: 6, left: 8, right: 8 }
      },
      bodyStyles: {
        fontSize: 8,
        textColor: C.primary,
        cellPadding: { top: 5, bottom: 5, left: 8, right: 8 },
        lineColor: C.border,
        lineWidth: 0.4
      },
      alternateRowStyles: { fillColor: C.rowAlt },
      tableLineColor: C.border,
      tableLineWidth: 0.5,
      columnStyles: colStyles
    });

    y = (doc as any).lastAutoTable.finalY + 20;

    // Summary card (right-aligned)
    const summaryW = 260;
    const summaryX = PAGE_W - MARGIN - summaryW;

    const sRows: [string, string, boolean][] = [
      ['Discount', discount, false],
      ['Margin Discount', marginDiscount, false],
      ['Final Payable Amount', finalPayableAmount, true]
    ];

    autoTable(doc, {
      startY: y,
      margin: { left: summaryX, right: MARGIN },
      tableWidth: summaryW,
      head: [['', '']],
      body: sRows.map(([label, value, bold]) => [
        {
          content: label,
          styles: { fontStyle: bold ? 'bold' : ('normal' as any) }
        },
        {
          content: value,
          styles: {
            fontStyle: bold ? 'bold' : ('normal' as any),
            halign: 'right' as const
          }
        }
      ]),
      theme: 'plain',
      showHead: false,
      bodyStyles: {
        fontSize: 8.5,
        cellPadding: { top: 6, bottom: 6, left: 10, right: 10 },
        textColor: C.primary,
        lineColor: C.border,
        lineWidth: 0.4
      },
      tableLineColor: C.border,
      tableLineWidth: 0.5,
      columnStyles: {
        0: { textColor: C.muted, cellWidth: 140 },
        1: { halign: 'right', font: 'courier', cellWidth: 120 }
      },
      didParseCell(data) {
        if (sRows[data.row.index]?.[2]) {
          data.cell.styles.fillColor = C.accentSoft;
          data.cell.styles.textColor = C.accent;
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 10;
        }
      }
    });
  }

  // ── Determine total page count (entries + optional final calc) ──────
  const totalPageCount =
    selectedEntries.length + (includeFinalCalc && finalCalc ? 1 : 0);

  // ── Render every selected entry ─────────────────────────────────────
  selectedEntries.forEach((entry, entryIdx) => {
    if (entryIdx > 0) doc.addPage();

    const { template, summary } = entry;
    const columns = template.columns ?? [];
    const rows = template.rows ?? [];
    const extra = template.extra ?? [];
    const vals = templateValues[entry.orderTemplateId] ?? {};
    const extVals = extraValues[entry.orderTemplateId] ?? {};

    drawBanner(template.name ?? 'Template', entry.isChild, entryIdx + 1);
    let y = 90;

    // Info card
    y = drawInfoCard(y, template.name ?? '—');

    // Header extras
    const headerExtras = extra.filter((f) => f.sectionType === 'HEADER');
    if (headerExtras.length > 0) {
      autoTable(doc, {
        startY: y,
        margin: { left: MARGIN, right: MARGIN },
        head: [['Field', 'Value']],
        body: headerExtras.map((f) => [f.label, extVals[f.id]?.value ?? '—']),
        theme: 'plain',
        headStyles: {
          fillColor: C.accentSoft,
          textColor: C.accent,
          fontStyle: 'bold',
          fontSize: 7,
          cellPadding: { top: 4, bottom: 4, left: 8, right: 8 }
        },
        bodyStyles: {
          fontSize: 8,
          textColor: C.primary,
          cellPadding: { top: 4, bottom: 4, left: 8, right: 8 }
        },
        alternateRowStyles: { fillColor: C.rowAlt },
        tableLineColor: C.border,
        tableLineWidth: 0.5,
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 120, textColor: C.muted }
        }
      });
      y = (doc as any).lastAutoTable.finalY + 12;
    }

    // Section label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...C.accent);
    doc.text('TEMPLATE VALUES', MARGIN, y + 4);
    doc.setDrawColor(...C.accent);
    doc.setLineWidth(1.5);
    doc.line(MARGIN, y + 7, MARGIN + 90, y + 7);
    doc.setLineWidth(0.5);
    y += 16;

    // Main values table
    if (columns.length > 0 && rows.length > 0) {
      const usableW = PAGE_W - MARGIN * 2;
      const descW = Math.min(180, usableW * 0.28);
      const colW = (usableW - descW) / columns.length;

      const head = [['Description', ...columns.map((c) => c.label)]];
      const body = rows.map((row) => {
        const isTotal = row.rowType === 'TOTAL';
        return [
          row.label,
          ...columns.map((col) => vals[row.id]?.[col.id] ?? '')
        ].map((cell, ci) => ({
          content: cell,
          styles: {
            fontStyle: (isTotal ? 'bold' : 'normal') as 'bold' | 'normal',
            fillColor: isTotal ? C.totalRow : undefined,
            textColor: C.primary,
            halign: (ci > 0 ? 'right' : 'left') as 'right' | 'left'
          }
        }));
      });

      autoTable(doc, {
        startY: y,
        margin: { left: MARGIN, right: MARGIN },
        head,
        body,
        theme: 'plain',
        headStyles: {
          fillColor: C.primary,
          textColor: C.white,
          fontStyle: 'bold',
          fontSize: 8,
          cellPadding: { top: 6, bottom: 6, left: 8, right: 8 }
        },
        bodyStyles: {
          fontSize: 8,
          cellPadding: { top: 5, bottom: 5, left: 8, right: 8 },
          lineColor: C.border,
          lineWidth: 0.4
        },
        alternateRowStyles: { fillColor: C.rowAlt },
        tableLineColor: C.border,
        tableLineWidth: 0.5,
        columnStyles: {
          0: { cellWidth: descW, fontStyle: 'bold', halign: 'left' },
          ...Object.fromEntries(
            columns.map((_, i) => [
              i + 1,
              { cellWidth: colW, halign: 'right' as const, font: 'courier' }
            ])
          )
        }
      });
      y = (doc as any).lastAutoTable.finalY + 16;
    }

    // Summary card (right-aligned)
    if (summary) {
      const summaryW = 220;
      const summaryX = PAGE_W - MARGIN - summaryW;

      const sRows: [string, string, boolean][] = [
        ['Subtotal', fmt(summary.total), false]
      ];
      if (summary.discountAmount && parseFloat(summary.discountAmount) > 0) {
        const dl =
          summary.discountType === 'PERCENT' ? 'Discount (%)' : 'Discount (₹)';
        sRows.push([dl, `- ${fmt(summary.discountAmount)}`, false]);
      }
      sRows.push(['Total Payable', fmt(summary.finalPayableAmount), true]);
      if (summary.notes) sRows.push(['Notes', summary.notes, false]);

      autoTable(doc, {
        startY: y,
        margin: { left: summaryX, right: MARGIN },
        tableWidth: summaryW,
        head: [['', '']],
        body: sRows.map(([label, value, bold]) => [
          {
            content: label,
            styles: { fontStyle: bold ? 'bold' : ('normal' as any) }
          },
          {
            content: value,
            styles: {
              fontStyle: bold ? 'bold' : ('normal' as any),
              halign: 'right' as const
            }
          }
        ]),
        theme: 'plain',
        showHead: false,
        bodyStyles: {
          fontSize: 8.5,
          cellPadding: { top: 5, bottom: 5, left: 10, right: 10 },
          textColor: C.primary,
          lineColor: C.border,
          lineWidth: 0.4
        },
        tableLineColor: C.border,
        tableLineWidth: 0.5,
        columnStyles: {
          0: { textColor: C.muted, cellWidth: 110 },
          1: { halign: 'right', font: 'courier', cellWidth: 110 }
        },
        didParseCell(data) {
          if (sRows[data.row.index]?.[2]) {
            data.cell.styles.fillColor = C.accentSoft;
            data.cell.styles.textColor = C.accent;
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fontSize = 9.5;
          }
        }
      });
      y = (doc as any).lastAutoTable.finalY + 14;
    }

    // Footer extras
    const footerExtras = extra.filter((f) => f.sectionType === 'FOOTER');
    if (footerExtras.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...C.muted);
      doc.text('ADDITIONAL INFORMATION', MARGIN, y + 4);
      y += 12;

      autoTable(doc, {
        startY: y,
        margin: { left: MARGIN, right: MARGIN },
        head: [['Field', 'Value']],
        body: footerExtras.map((f) => [f.label, extVals[f.id]?.value ?? '—']),
        theme: 'plain',
        headStyles: {
          fillColor: C.primaryLight,
          textColor: C.muted,
          fontStyle: 'bold',
          fontSize: 7,
          cellPadding: { top: 4, bottom: 4, left: 8, right: 8 }
        },
        bodyStyles: {
          fontSize: 8,
          cellPadding: { top: 4, bottom: 4, left: 8, right: 8 }
        },
        alternateRowStyles: { fillColor: C.rowAlt },
        tableLineColor: C.border,
        tableLineWidth: 0.5,
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 120, textColor: C.muted }
        }
      });
    }
  });

  // ── Render Final Calculation page (if selected) ─────────────────────
  if (includeFinalCalc && finalCalc) {
    doc.addPage();
    renderFinalCalcPage(finalCalc, totalPageCount, totalPageCount);
  }

  // ── Per-page footer (page number + section name) ────────────────────
  const totalPages: number =
    (doc.internal as any).getNumberOfPages?.() ?? totalPageCount;

  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const fy = PAGE_H - 20;
    // Last page is Final Calc if included; otherwise use template name
    const isFinalCalcPage = includeFinalCalc && finalCalc && p === totalPages;
    const tName = isFinalCalcPage
      ? 'Final Calculation'
      : (selectedEntries[p - 1]?.template?.name ?? '');

    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, fy - 6, PAGE_W - MARGIN, fy - 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(`Order #${order.orderNo} — ${tName}`, MARGIN, fy + 2);
    doc.text(`Page ${p} of ${totalPages}`, PAGE_W - MARGIN, fy + 2, {
      align: 'right'
    });
  }

  // ── Save ─────────────────────────────────────────────────────────────
  doc.save(`order_${order.orderNo}_templates.pdf`);
}

// =============================================================================
// LABELLING HELPER
// =============================================================================

type LabelledEntry = { entry: PDFTemplateEntry; label: string };

function buildLabelledEntries(entries: PDFTemplateEntry[]): LabelledEntry[] {
  const counters = new Map<string, number>();
  return entries
    .filter((e) => !e.isNew)
    .map((entry) => {
      if (entry.isChild) {
        const n = (counters.get(entry.templateId) ?? 0) + 1;
        counters.set(entry.templateId, n);
        return {
          entry,
          label: `${entry.template?.name ?? 'Template'} — Duplicate #${n}`
        };
      }
      return { entry, label: entry.template?.name ?? 'Template' };
    });
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function OrderTemplatePDF({
  order,
  entries,
  templateValues,
  extraValues,
  finalCalc,
  className
}: OrderTemplatePDFProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const labelledEntries = useMemo(
    () => buildLabelledEntries(entries),
    [entries]
  );

  const allIds = useMemo(() => {
    const ids = new Set(labelledEntries.map((le) => le.entry.orderTemplateId));
    if (finalCalc) ids.add(FINAL_CALC_ID);
    return ids;
  }, [labelledEntries, finalCalc]);

  const allSelected = selectedIds.size === allIds.size && allIds.size > 0;
  const noneSelected = selectedIds.size === 0;
  const someSelected = !noneSelected && !allSelected;

  // Total item count (templates + optional final calc)
  const totalItemCount = labelledEntries.length + (finalCalc ? 1 : 0);

  // Open dialog and pre-select all templates
  const openDialog = useCallback(() => {
    setSelectedIds(new Set(allIds));
    setExpandedId(null);
    setDialogOpen(true);
  }, [allIds]);

  const toggleEntry = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds(allSelected ? new Set() : new Set(allIds));
  }, [allSelected, allIds]);

  const handleDownload = useCallback(async () => {
    const toExport = labelledEntries
      .filter((le) => selectedIds.has(le.entry.orderTemplateId))
      .map((le) => le.entry);

    const includeFinalCalc = selectedIds.has(FINAL_CALC_ID);

    if (toExport.length === 0 && !includeFinalCalc) return;

    setIsGenerating(true);
    try {
      await generateMultiPDF(
        order,
        toExport,
        templateValues,
        extraValues,
        finalCalc ?? null,
        includeFinalCalc
      );
      setDialogOpen(false);
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [
    labelledEntries,
    selectedIds,
    order,
    templateValues,
    extraValues,
    finalCalc
  ]);

  if (labelledEntries.length === 0) return null;

  const selectedCount = selectedIds.size;

  return (
    <div className={className}>
      {/* Trigger */}
      <Button
        variant='outline'
        size='sm'
        onClick={openDialog}
        className='gap-1.5'
      >
        <FileText className='h-3.5 w-3.5' />
        Download PDF
      </Button>

      {/* Multi-select dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='max-w-3xl'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <FileText className='h-4 w-4 text-indigo-500' />
              Select Templates for PDF
            </DialogTitle>
            <DialogDescription>
              Choose one or more templates — they will all be combined into a
              single PDF file, one template per page.
            </DialogDescription>
          </DialogHeader>

          {/* Order info strip */}
          <div className='bg-muted/40 flex flex-wrap gap-x-5 gap-y-1 rounded-md border px-4 py-2 text-xs'>
            <span>
              <span className='text-muted-foreground'>Order: </span>
              <span className='font-semibold'>#{order.orderNo}</span>
            </span>
            <span>
              <span className='text-muted-foreground'>Product: </span>
              <span className='font-semibold'>
                {order.product?.name ?? '—'}
              </span>
            </span>
            <span>
              <span className='text-muted-foreground'>Customer: </span>
              <span className='font-semibold'>
                {order.customer?.name ?? '—'}
              </span>
            </span>
            <span>
              <span className='text-muted-foreground'>Status: </span>
              <span className='font-semibold'>{order.status ?? 'DRAFT'}</span>
            </span>
          </div>

          {/* Select-all bar */}
          <div className='bg-muted/20 flex items-center justify-between rounded-md border px-4 py-2.5'>
            <button
              type='button'
              onClick={toggleAll}
              className='hover:text-foreground text-muted-foreground flex items-center gap-2.5 text-sm font-medium transition-colors'
            >
              {allSelected ? (
                <CheckSquare className='h-4 w-4 text-indigo-600' />
              ) : someSelected ? (
                <CheckSquare className='h-4 w-4 text-indigo-400 opacity-60' />
              ) : (
                <Square className='h-4 w-4' />
              )}
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
            <span className='text-muted-foreground text-xs'>
              {selectedCount} of {totalItemCount} selected
            </span>
          </div>

          {/* Template list */}
          <ScrollArea className='max-h-[46vh] pr-1'>
            <div className='space-y-2'>
              {labelledEntries.map(({ entry, label }) => {
                const id = entry.orderTemplateId;
                const checked = selectedIds.has(id);
                const expanded = expandedId === id;

                return (
                  <div
                    key={id}
                    className={cn(
                      'rounded-lg border transition-colors',
                      checked
                        ? 'border-indigo-200 bg-indigo-50/60'
                        : 'border-border bg-muted/20'
                    )}
                  >
                    {/* Row header */}
                    <div className='flex items-center gap-3 px-4 py-3'>
                      <Checkbox
                        id={`chk-${id}`}
                        checked={checked}
                        onCheckedChange={() => toggleEntry(id)}
                        className='shrink-0 data-[state=checked]:border-indigo-600 data-[state=checked]:bg-indigo-600'
                      />
                      <label
                        htmlFor={`chk-${id}`}
                        className='flex flex-1 cursor-pointer items-center gap-2 text-sm font-medium'
                      >
                        <FileText className='text-muted-foreground h-3.5 w-3.5 shrink-0' />
                        <span className='truncate'>{label}</span>
                        {entry.isChild && (
                          <Badge
                            variant='secondary'
                            className='shrink-0 px-1.5 py-0 text-[10px]'
                          >
                            copy
                          </Badge>
                        )}
                      </label>

                      {/* Preview expand toggle */}
                      <button
                        type='button'
                        onClick={() => setExpandedId(expanded ? null : id)}
                        className='text-muted-foreground hover:text-foreground flex shrink-0 items-center gap-1 text-xs transition-colors'
                      >
                        <Eye className='h-3.5 w-3.5' />
                        {expanded ? (
                          <ChevronUp className='h-3 w-3' />
                        ) : (
                          <ChevronDown className='h-3 w-3' />
                        )}
                      </button>
                    </div>

                    {/* Expandable data preview */}
                    {expanded && (
                      <>
                        <Separator />
                        <div className='px-4 py-3'>
                          <PreviewTable
                            entry={entry}
                            values={templateValues[id] ?? {}}
                            extras={extraValues[id] ?? {}}
                          />
                        </div>
                      </>
                    )}
                  </div>
                );
              })}

              {/* ── Final Calculation row ───────────────────────── */}
              {finalCalc &&
                (() => {
                  const id = FINAL_CALC_ID;
                  const checked = selectedIds.has(id);
                  const expanded = expandedId === id;
                  return (
                    <>
                      <div className='flex items-center gap-2 px-1 pt-1'>
                        <Separator className='flex-1' />
                        <span className='text-muted-foreground shrink-0 text-[10px] font-medium tracking-wider uppercase'>
                          Summary
                        </span>
                        <Separator className='flex-1' />
                      </div>
                      <div
                        className={cn(
                          'rounded-lg border transition-colors',
                          checked
                            ? 'border-indigo-200 bg-indigo-50/60'
                            : 'border-border bg-muted/20'
                        )}
                      >
                        <div className='flex items-center gap-3 px-4 py-3'>
                          <Checkbox
                            id={`chk-${id}`}
                            checked={checked}
                            onCheckedChange={() => toggleEntry(id)}
                            className='shrink-0 data-[state=checked]:border-indigo-600 data-[state=checked]:bg-indigo-600'
                          />
                          <label
                            htmlFor={`chk-${id}`}
                            className='flex flex-1 cursor-pointer items-center gap-2 text-sm font-medium'
                          >
                            <FileText className='h-3.5 w-3.5 shrink-0 text-indigo-500' />
                            <span className='truncate'>Final Calculation</span>
                            <Badge
                              variant='outline'
                              className='shrink-0 border-indigo-200 px-1.5 py-0 text-[10px] text-indigo-600'
                            >
                              summary
                            </Badge>
                          </label>
                          <button
                            type='button'
                            onClick={() => setExpandedId(expanded ? null : id)}
                            className='text-muted-foreground hover:text-foreground flex shrink-0 items-center gap-1 text-xs transition-colors'
                          >
                            <Eye className='h-3.5 w-3.5' />
                            {expanded ? (
                              <ChevronUp className='h-3 w-3' />
                            ) : (
                              <ChevronDown className='h-3 w-3' />
                            )}
                          </button>
                        </div>
                        {expanded && (
                          <>
                            <Separator />
                            <div className='px-4 py-3'>
                              <FinalCalcPreview data={finalCalc} />
                            </div>
                          </>
                        )}
                      </div>
                    </>
                  );
                })()}
            </div>
          </ScrollArea>

          <DialogFooter className='items-center gap-2 sm:gap-2'>
            {/* Left-side info */}
            <p className='text-muted-foreground mr-auto text-xs'>
              {selectedCount > 0
                ? `${selectedCount} template${selectedCount > 1 ? 's' : ''} → 1 PDF (${selectedCount} page${selectedCount > 1 ? 's' : ''})`
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
              disabled={isGenerating || noneSelected}
              className='gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50'
            >
              {isGenerating ? (
                <Loader2 className='h-4 w-4 animate-spin' />
              ) : (
                <Download className='h-4 w-4' />
              )}
              {isGenerating
                ? 'Generating…'
                : `Download PDF${selectedCount > 1 ? ` (${selectedCount} pages)` : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
