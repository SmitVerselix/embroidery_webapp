'use client';

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
import type {
  OrderWithDetails,
  TemplateWithDetails,
  TemplateBlock as TemplateBlockApi
} from '@/lib/api/types';
import type { TemplateValuesMap } from './order-template-values';
import type { ExtraValuesMap, ExtraValueItem } from './order-extra-values';

// -- Types --

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

type BlockValuesMap = Record<number, string>;
type RGB = [number, number, number];
type FinalCalcPDFOptions = {
  includeAddonDiscount: boolean;
  includeMarginDiscount: boolean;
  includeMarginTotal: boolean;
};

const FINAL_CALC_ID = '__final_calculation__';

interface OrderTemplatePDFProps {
  order: OrderWithDetails;
  entries: PDFTemplateEntry[];
  templateValues: Record<string, TemplateValuesMap>;
  extraValues: Record<string, ExtraValuesMap>;
  blockValues: Record<string, BlockValuesMap>;
  finalCalc?: FinalCalcData;
  className?: string;
}

// -- Helpers --

const getAllExtraValues = (ev: ExtraValuesMap, fid: string) =>
  (ev[fid] ?? []).map((i) => i.value).filter((v) => v?.trim());

const getAllMediaUrls = (ev: ExtraValuesMap, fid: string) =>
  getAllExtraValues(ev, fid).filter((v) => v.startsWith('http'));

const joinExtra = (ev: ExtraValuesMap, fid: string) =>
  getAllExtraValues(ev, fid).join(', ') || '—';

const getBlockName = (
  blocks: TemplateBlockApi[],
  bv: BlockValuesMap,
  idx: number
) => blocks.find((b) => b.id === bv[idx])?.name ?? null;

const getBlockLabel = (
  blocks: TemplateBlockApi[],
  bv: BlockValuesMap,
  idx: number
) => {
  const n = getBlockName(blocks, bv, idx);
  return n ? `Block ${idx} — ${n}` : `Block ${idx}`;
};

const fmt = (v: string | null | undefined) => {
  if (!v) return '0.00';
  const n = parseFloat(v);
  return isNaN(n) ? '0.00' : n.toFixed(2);
};

/** Format discount value with its type symbol appended */
const fmtDiscount = (
  value: string | null | undefined,
  type: string | null | undefined
) => {
  if (value == null) return '—';
  const formatted = fmt(value);
  if (type === 'PERCENT') return `${formatted}%`;
  if (type === 'AMOUNT') return `${formatted} ₹`;
  return formatted;
};

/** Format discount amount with − prefix when positive */
const fmtDiscountAmount = (value: string | null | undefined) => {
  const formatted = fmt(value);
  const num = parseFloat(value || '0');
  if (!isNaN(num) && num > 0) return `− ${formatted}`;
  return formatted;
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

type ColumnBlock = { index: number; columns: any[] };

function deriveBlockColumns(cols: any[]): ColumnBlock[] {
  const sorted = [...cols].sort((a, b) =>
    a.blockIndex !== b.blockIndex
      ? a.blockIndex - b.blockIndex
      : a.orderNo - b.orderNo
  );
  return Array.from(new Set(sorted.map((c) => c.blockIndex)))
    .sort((a, b) => a - b)
    .map((idx) => ({
      index: idx,
      columns: sorted.filter((c) => c.blockIndex === idx)
    }));
}

/** Build rows for extra-fields table (header or footer) */
function buildExtraRows(fields: any[], extVals: ExtraValuesMap): string[][] {
  const rows: string[][] = [];
  fields.forEach((f) => {
    const vals = getAllExtraValues(extVals, f.id);
    if (vals.length <= 1) rows.push([f.label, vals[0] ?? '—']);
    else vals.forEach((v, i) => rows.push([i === 0 ? f.label : '', v]));
  });
  return rows;
}

// =============================================================================
// ROW / COLUMN VISIBILITY — mirrors order-template-values.tsx (read-only mode)
// =============================================================================

function getVisibleRows(
  rows: any[],
  cols: any[],
  vals: TemplateValuesMap
): any[] {
  const nonFormulaCols = cols.filter((c: any) => c.dataType !== 'FORMULA');
  const nonTotalRows = rows.filter((r: any) => r.rowType !== 'TOTAL');
  const totalRows = rows.filter((r: any) => r.rowType === 'TOTAL');

  const visibleNonTotal = nonTotalRows.filter((row: any) =>
    nonFormulaCols.some((col: any) => {
      const v = vals[row.id]?.[col.id];
      return v !== undefined && v !== null && v.trim() !== '';
    })
  );

  if (visibleNonTotal.length > 0 && totalRows.length > 0) {
    return [...visibleNonTotal, ...totalRows];
  }
  return visibleNonTotal;
}

function getVisibleCols(
  cols: any[],
  visibleRows: any[],
  vals: TemplateValuesMap
): any[] {
  return cols.filter((col: any) =>
    visibleRows.some((row: any) => {
      const v = vals[row.id]?.[col.id];
      return v !== undefined && v !== null && v !== '' && v !== '—';
    })
  );
}

// -- Image utilities --

async function blobToJpegDataURL(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth || 200;
        c.height = img.naturalHeight || 200;
        const ctx = c.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(c.toDataURL('image/jpeg', 0.92));
      } catch {
        resolve(null);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

async function fetchBlobAndConvert(url: string): Promise<string | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const blob = await r.blob();
    const canvas = await blobToJpegDataURL(blob);
    if (canvas) return canvas;
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function imgViaElement(
  url: string,
  crossOrigin: boolean
): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth || 200;
        c.height = img.naturalHeight || 200;
        const ctx = c.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(c.toDataURL('image/jpeg', 0.92));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function fetchImageAsDataURL(url: string): Promise<string | null> {
  try {
    const r = await fetchBlobAndConvert(
      `/api/proxy-image?url=${encodeURIComponent(url)}`
    );
    if (r) return r;
  } catch {}
  try {
    const r = await fetchBlobAndConvert(url);
    if (r) return r;
  } catch {}
  return (await imgViaElement(url, true)) ?? (await imgViaElement(url, false));
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

// -- Preview table (dialog) --

function PreviewTable({
  entry,
  values,
  extras,
  blockValues: bv
}: {
  entry: PDFTemplateEntry;
  values: TemplateValuesMap;
  extras: ExtraValuesMap;
  blockValues: BlockValuesMap;
}) {
  const { template: t, summary: s } = entry;
  const cols = t.columns ?? [],
    rows = t.rows ?? [],
    extra = t.extra ?? [],
    blocks = t.blocks ?? [];
  const headerExtras = extra.filter((f) => f.sectionType === 'HEADER');
  const footerExtras = extra.filter((f) => f.sectionType === 'FOOTER');

  const visibleRows = getVisibleRows(rows, cols, values);
  const visibleCols = getVisibleCols(cols, visibleRows, values);

  const bg = deriveBlockColumns(visibleCols),
    flat = bg.flatMap((b) => b.columns),
    multi = bg.length > 1;
  const bcc = [
    'bg-blue-100 text-blue-800',
    'bg-green-100 text-green-800',
    'bg-purple-100 text-purple-800',
    'bg-amber-100 text-amber-800',
    'bg-pink-100 text-pink-800',
    'bg-teal-100 text-teal-800'
  ];

  const ExtraGrid = ({ fields }: { fields: any[] }) =>
    fields.length > 0 ? (
      <div className='bg-muted/30 grid grid-cols-2 gap-x-6 gap-y-1 rounded-md border px-3 py-2'>
        {fields.map((f) => (
          <div key={f.id} className='flex gap-1'>
            <span className='text-muted-foreground font-medium'>
              {f.label}:
            </span>
            <span>{joinExtra(extras, f.id)}</span>
          </div>
        ))}
      </div>
    ) : null;

  const additionalCosts = s?.additionalTemplateCosts ?? [];

  return (
    <div className='space-y-2.5 text-xs'>
      {blocks.length > 0 && (
        <div className='flex flex-wrap gap-2'>
          {bg.map((b, i) => {
            const n = getBlockName(blocks, bv, b.index);
            return n ? (
              <div
                key={b.index}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium',
                  bcc[i % bcc.length]
                )}
              >
                Block {b.index}: {n}
              </div>
            ) : null;
          })}
        </div>
      )}
      <ExtraGrid fields={headerExtras} />
      {flat.length > 0 && visibleRows.length > 0 && (
        <div className='overflow-x-auto rounded-md border'>
          <table className='w-full text-xs'>
            <thead>
              {multi && (
                <tr className='bg-muted/30 border-b-2'>
                  <th className='px-3 py-2 text-left font-semibold' rowSpan={2}>
                    Description
                  </th>
                  {bg.map((b, i) => (
                    <th
                      key={b.index}
                      colSpan={b.columns.length}
                      className={cn(
                        'px-3 py-1.5 text-center font-bold',
                        bcc[i % bcc.length]
                      )}
                    >
                      {getBlockLabel(blocks, bv, b.index)}
                    </th>
                  ))}
                </tr>
              )}
              <tr className='bg-muted/60 border-b'>
                {!multi && (
                  <th className='px-3 py-2 text-left font-semibold'>
                    Description
                  </th>
                )}
                {flat.map((c: any) => (
                  <th key={c.id} className='px-3 py-2 text-right font-semibold'>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, ri) => {
                const tot = row.rowType === 'TOTAL';
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      'border-b',
                      tot && 'bg-muted/40 font-semibold',
                      !tot && (ri % 2 === 0 ? 'bg-background' : 'bg-muted/10')
                    )}
                  >
                    <td className='px-3 py-1.5'>{row.label}</td>
                    {flat.map((c: any) => (
                      <td
                        key={c.id}
                        className='px-3 py-1.5 text-right font-mono tabular-nums'
                      >
                        {values[row.id]?.[c.id] ?? ''}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {s && (
        <div className='flex justify-end'>
          <div className='w-60 overflow-hidden rounded-md border text-xs'>
            <div className='bg-muted/20 flex justify-between border-b px-3 py-1.5'>
              <span className='text-muted-foreground'>Total</span>
              <span className='font-mono font-medium tabular-nums'>
                {fmt(s.total)}
              </span>
            </div>
            <div className='flex justify-between border-b px-3 py-1.5'>
              <span className='text-muted-foreground'>Discount</span>
              <span className='font-mono tabular-nums'>
                {fmtDiscount(s.discount, s.discountType)}
              </span>
            </div>
            {s.discountAmount && parseFloat(s.discountAmount) > 0 && (
              <div className='flex justify-between border-b px-3 py-1.5'>
                <span className='text-muted-foreground'>Discount Amount</span>
                <span className='text-destructive font-mono tabular-nums'>
                  {fmtDiscountAmount(s.discountAmount)}
                </span>
              </div>
            )}
            {additionalCosts.length > 0 && (
              <>
                {additionalCosts.map((c, idx) => (
                  <div
                    key={idx}
                    className='flex items-start justify-between border-b px-3 py-1.5'
                  >
                    <div className='min-w-0'>
                      <span className='text-muted-foreground'>
                        {c.costName}
                      </span>
                      {c.notes && (
                        <p className='text-muted-foreground mt-0.5 truncate text-[10px] italic'>
                          {c.notes}
                        </p>
                      )}
                    </div>
                    <span className='shrink-0 font-mono tabular-nums'>
                      ₹{fmt(String(c.cost))}
                    </span>
                  </div>
                ))}
              </>
            )}
            <div className='flex justify-between bg-indigo-50 px-3 py-2 font-semibold text-indigo-700'>
              <span>Final Payable Amount</span>
              <span className='font-mono tabular-nums'>
                {fmt(s.finalPayableAmount)}
              </span>
            </div>
            {s.notes && (
              <div className='text-muted-foreground border-t px-3 py-1.5 italic'>
                {s.notes}
              </div>
            )}
          </div>
        </div>
      )}
      <ExtraGrid fields={footerExtras} />
    </div>
  );
}

// -- Final calc preview (dialog) --

function FinalCalcPreview({
  data: d,
  options: o
}: {
  data: FinalCalcData;
  options: FinalCalcPDFOptions;
}) {
  const typeSuffix = (t: string | null) =>
    t ? ` (${t === 'PERCENT' ? '%' : '₹'})` : '';
  return (
    <div className='space-y-2.5 text-xs'>
      <div className='overflow-x-auto rounded-md border'>
        <table className='w-full text-xs'>
          <thead>
            <tr className='bg-muted/60 border-b'>
              <th className='px-3 py-2 text-left font-semibold'>Template</th>
              <th className='px-3 py-2 text-right font-semibold'>Total (₹)</th>
              {d.hasAnyChildren && (
                <th className='px-3 py-2 text-right font-semibold'>
                  Child Total (₹)
                </th>
              )}
              <th className='px-3 py-2 text-left font-semibold'>Notes</th>
            </tr>
          </thead>
          <tbody>
            {d.templateRows.map((r, i) => (
              <tr
                key={r.orderTemplateId}
                className={cn(
                  'border-b',
                  i % 2 === 0 ? 'bg-background' : 'bg-muted/10'
                )}
              >
                <td className='px-3 py-1.5 font-medium'>{r.label}</td>
                <td className='px-3 py-1.5 text-right font-mono tabular-nums'>
                  {r.total}
                </td>
                {d.hasAnyChildren && (
                  <td className='text-muted-foreground px-3 py-1.5 text-right font-mono tabular-nums'>
                    {r.childTotal ?? '—'}
                  </td>
                )}
                <td className='text-muted-foreground px-3 py-1.5 italic'>
                  {r.notes ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className='flex justify-end'>
        <div className='w-64 overflow-hidden rounded-md border text-xs'>
          <div className='flex justify-between border-b px-3 py-1.5 font-semibold'>
            <span>Total</span>
            <span className='font-mono tabular-nums'>{d.total}</span>
          </div>
          {o.includeMarginDiscount && (
            <div className='flex justify-between border-b px-3 py-1.5'>
              <span className='text-muted-foreground'>
                Margin Discount{typeSuffix(d.marginType)}
              </span>
              <span className='font-mono tabular-nums'>{d.marginDiscount}</span>
            </div>
          )}
          {o.includeMarginTotal && (
            <div className='flex justify-between border-b px-3 py-1.5'>
              <span className='text-muted-foreground'>Margin Total</span>
              <span className='font-mono tabular-nums'>{d.marginTotal}</span>
            </div>
          )}
          <div className='flex justify-between border-b px-3 py-1.5'>
            <span className='text-muted-foreground'>
              Discount{typeSuffix(d.discountType)}
            </span>
            <span className='font-mono tabular-nums'>{d.discount}</span>
          </div>
          {o.includeAddonDiscount && (
            <div className='flex justify-between border-b px-3 py-1.5'>
              <span className='text-muted-foreground'>
                Addon Discount{typeSuffix(d.addonType)}
              </span>
              <span className='font-mono tabular-nums'>{d.addonDiscount}</span>
            </div>
          )}
          <div className='flex justify-between bg-indigo-50 px-3 py-2 font-semibold text-indigo-700'>
            <span>Final Payable Amount</span>
            <span className='font-mono tabular-nums'>
              {d.finalPayableAmount}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// -- PDF generation --

async function generateMultiPDF(
  order: OrderWithDetails,
  selectedEntries: PDFTemplateEntry[],
  templateValues: Record<string, TemplateValuesMap>,
  extraValues: Record<string, ExtraValuesMap>,
  allBlockValues: Record<string, BlockValuesMap>,
  finalCalc: FinalCalcData | null,
  includeFinalCalc: boolean,
  fcOpts: FinalCalcPDFOptions
): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const PW = doc.internal.pageSize.getWidth(),
    PH = doc.internal.pageSize.getHeight(),
    M = 36;

  const C = {
    primary: [30, 41, 59] as RGB,
    primaryLight: [248, 250, 252] as RGB,
    accent: [99, 102, 241] as RGB,
    accentSoft: [238, 242, 255] as RGB,
    border: [226, 232, 240] as RGB,
    muted: [100, 116, 139] as RGB,
    white: [255, 255, 255] as RGB,
    rowAlt: [248, 250, 252] as RGB,
    totalRow: [241, 245, 249] as RGB
  };
  const BCOL: RGB[] = [
    [37, 99, 235],
    [22, 163, 74],
    [147, 51, 234],
    [217, 119, 6],
    [219, 39, 119],
    [13, 148, 136]
  ];
  const SEC = {
    header: {
      bg: [220, 252, 231] as RGB,
      fg: [22, 101, 52] as RGB,
      badge: [34, 197, 94] as RGB
    },
    media: {
      bg: [243, 232, 255] as RGB,
      fg: [107, 33, 168] as RGB,
      badge: [168, 85, 247] as RGB
    },
    footer: {
      bg: [220, 252, 231] as RGB,
      fg: [22, 101, 52] as RGB,
      badge: [34, 197, 94] as RGB
    }
  };

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
  const extraHeadStyle = (sec: typeof SEC.header) => ({
    fillColor: sec.bg,
    textColor: sec.fg,
    fontStyle: 'bold' as const,
    fontSize: 7,
    cellPadding: { top: 4, bottom: 4, left: 8, right: 8 }
  });

  // Pre-fetch images
  const imgCache: Record<string, { dataUrl: string; w: number; h: number }> =
    {};
  for (const e of selectedEntries) {
    const ev = extraValues[e.orderTemplateId] ?? {};
    for (const mf of (e.template.extra ?? []).filter(
      (f) => f.sectionType === 'MEDIA' && f.valueType === 'IMAGE'
    )) {
      const urls = getAllMediaUrls(ev, mf.id);
      for (let i = 0; i < urls.length; i++) {
        const k = `${e.orderTemplateId}_${mf.id}_${i}`;
        try {
          const d = await fetchImageAsDataURL(urls[i]);
          if (d) {
            const dims = await getImageDims(d);
            imgCache[k] = { dataUrl: d, ...dims };
          }
        } catch {}
      }
    }
  }

  // Drawing helpers
  const ensureSpace = (y: number, need: number) =>
    y + need > PH - 40 ? (doc.addPage(), 30) : y;

  function drawSectionLabel(
    label: string,
    count: number,
    color: typeof SEC.header,
    y: number
  ) {
    const lw = doc.getTextWidth(label) * 1.15 + 12,
      bw = 38,
      pw = lw + bw + 16;
    doc.setFillColor(...color.bg);
    doc.roundedRect(M, y, pw, 18, 4, 4, 'F');
    doc.setFillColor(...color.badge);
    doc.roundedRect(M + 6, y + 4, 10, 10, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(...C.white);
    doc.text('⊞', M + 8.5, y + 11.5);
    doc.setFontSize(8);
    doc.setTextColor(...color.fg);
    doc.text(label, M + 20, y + 12);
    const bx = M + lw + 4;
    doc.setFillColor(...color.badge);
    doc.roundedRect(bx, y + 3, bw, 12, 3, 3, 'F');
    doc.setFontSize(6.5);
    doc.setTextColor(...C.white);
    doc.text(`${count} field${count !== 1 ? 's' : ''}`, bx + bw / 2, y + 11, {
      align: 'center'
    });
    return y + 26;
  }

  function drawBanner(title: string, isChild: boolean, pageLabel: string) {
    doc.setFillColor(...C.primary);
    doc.rect(0, 0, PW, 72, 'F');
    doc.setFillColor(...C.accent);
    doc.rect(0, 0, 6, 72, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(...C.white);
    doc.text(title, 24, 28);
    if (isChild) {
      doc.setFillColor(...C.accent);
      doc.roundedRect(24, 34, 54, 14, 3, 3, 'F');
      doc.setFontSize(7);
      doc.text('DUPLICATE', 51, 43.5, { align: 'center' });
    }
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 210, 230);
    doc.text(`Order #${order.orderNo}`, PW - M, 22, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...C.white);
    doc.text(order.product?.name ?? '', PW - M, 38, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(160, 175, 200);
    doc.text(
      `${pageLabel}  ·  Generated ${new Date().toLocaleString('en-IN')}`,
      PW - M,
      62,
      { align: 'right' }
    );
  }

  function drawInfoCard(y: number, tpl: string) {
    const H = 60;
    doc.setFillColor(...C.primaryLight);
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.5);
    doc.roundedRect(M, y, PW - M * 2, H, 4, 4, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text('ORDER DETAILS', M + 12, y + 14);
    const fields: [string, string][] = [
      ['Product', order.product?.name ?? '—'],
      ['Customer', order.customer?.name ?? '—'],
      ['Order No', order.orderNo ?? '—'],
      ['Type', order.orderType ?? '—'],
      ['Status', order.status ?? 'DRAFT'],
      ['Reference', order.referenceNo ?? '—'],
      ['Created', fmtDate(order.createdAt)],
      ['Template', tpl]
    ];
    const cw = (PW - M * 2 - 24) / 4;
    fields.forEach(([l, v], i) => {
      const fx = M + 12 + (i % 4) * cw,
        fy = y + 24 + Math.floor(i / 4) * 18;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...C.muted);
      doc.text(l, fx, fy);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...C.primary);
      doc.text(doc.splitTextToSize(v, cw - 8)[0] ?? v, fx, fy + 9);
    });
    return y + H + 16;
  }

  function drawSectionTitle(label: string, y: number) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...C.accent);
    doc.text(label, M, y + 4);
    doc.setDrawColor(...C.accent);
    doc.setLineWidth(1.5);
    doc.line(M, y + 7, M + 100, y + 7);
    doc.setLineWidth(0.5);
    return y + 16;
  }

  function drawSummaryAutoTable(
    y: number,
    rows: [string, string, boolean][],
    width = 240
  ) {
    const sx = PW - M - width;
    autoTable(doc, {
      startY: y,
      margin: { left: sx, right: M },
      tableWidth: width,
      head: [['', '']],
      showHead: false,
      theme: 'plain',
      body: rows.map(([l, v, b]) => [
        { content: l, styles: { fontStyle: b ? 'bold' : ('normal' as any) } },
        {
          content: v,
          styles: {
            fontStyle: b ? 'bold' : ('normal' as any),
            halign: 'right' as const
          }
        }
      ]),
      bodyStyles: {
        fontSize: 8.5,
        cellPadding: { top: 5, bottom: 5, left: 10, right: 10 },
        textColor: C.primary,
        lineColor: C.border,
        lineWidth: 0.4
      },
      ...tblLine,
      columnStyles: {
        0: { textColor: C.muted, cellWidth: width * 0.5 },
        1: { halign: 'right' as const, font: 'courier', cellWidth: width * 0.5 }
      },
      didParseCell(data) {
        if (rows[data.row.index]?.[2]) {
          data.cell.styles.fillColor = C.accentSoft;
          data.cell.styles.textColor = C.accent;
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fontSize = 9.5;
        }
      }
    });
    return (doc as any).lastAutoTable.finalY + 14;
  }

  function drawExtraFieldsTable(
    y: number,
    fields: any[],
    extVals: ExtraValuesMap,
    sec: typeof SEC.header
  ) {
    if (fields.length === 0) return y;
    y = drawSectionLabel(
      fields[0].sectionType === 'HEADER' ? 'Header Fields' : 'Footer Fields',
      fields.length,
      sec,
      y
    );
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [['Field', 'Value']],
      body: buildExtraRows(fields, extVals),
      theme: 'plain',
      headStyles: extraHeadStyle(sec),
      bodyStyles: {
        fontSize: 8,
        textColor: C.primary,
        cellPadding: { top: 5, bottom: 5, left: 8, right: 8 }
      },
      ...tblLine,
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 120, textColor: C.muted }
      }
    });
    return (doc as any).lastAutoTable.finalY + 12;
  }

  // -- Final calc page --
  function renderFinalCalcPage(
    fc: FinalCalcData,
    pageIdx: number,
    total: number
  ) {
    drawBanner('Final Calculation', false, `Page ${pageIdx} of ${total}`);
    let y = drawInfoCard(90, 'Final Calculation');
    y = drawSectionTitle('TEMPLATE SUMMARY', y);

    const { hasAnyChildren: hc, templateRows: tr } = fc;
    const head = [
      'Template',
      'Total (₹)',
      ...(hc ? ['Child Total (₹)'] : []),
      'Notes'
    ];
    const uw = PW - M * 2,
      nw = 160,
      tw = 90,
      cw = hc ? 90 : 0,
      lw = uw - tw - cw - nw;
    const cs: Record<number, any> = {
      0: { cellWidth: lw, fontStyle: 'bold', halign: 'left' },
      1: { cellWidth: tw, halign: 'right', font: 'courier' }
    };
    if (hc) {
      cs[2] = {
        cellWidth: cw,
        halign: 'right',
        font: 'courier',
        textColor: C.muted
      };
      cs[3] = { cellWidth: nw, halign: 'left', textColor: C.muted };
    } else cs[2] = { cellWidth: nw, halign: 'left', textColor: C.muted };

    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [head],
      body: tr.map((r) => {
        const cells: any[] = [
          { content: r.label },
          { content: r.total, styles: { halign: 'right' } }
        ];
        if (hc)
          cells.push({
            content: r.childTotal ?? '—',
            styles: { halign: 'right', textColor: C.muted }
          });
        cells.push({ content: r.notes ?? '—', styles: { textColor: C.muted } });
        return cells;
      }),
      theme: 'plain',
      headStyles: headStyle,
      bodyStyles: bodyStyle,
      ...tblLine,
      columnStyles: cs
    });
    y = (doc as any).lastAutoTable.finalY + 20;

    const sRows: [string, string, boolean][] = [['Total', fc.total, false]];
    if (fcOpts.includeMarginDiscount)
      sRows.push([
        'Margin Discount',
        fmtDiscount(fc.marginDiscount, fc.marginType),
        false
      ]);
    if (fcOpts.includeMarginTotal)
      sRows.push(['Margin Total', fc.marginTotal, false]);
    sRows.push(['Discount', fmtDiscount(fc.discount, fc.discountType), false]);
    if (fcOpts.includeAddonDiscount)
      sRows.push([
        'Addon Discount',
        fmtDiscount(fc.addonDiscount, fc.addonType),
        false
      ]);
    sRows.push(['Final Payable Amount', fc.finalPayableAmount, true]);
    drawSummaryAutoTable(y, sRows, 260);
  }

  // ── DYNAMIC SCALING ─────────────────────────────────────────────────

  const SUMMARY_FIXED_H = 118;

  function computeScaledTableStyles(
    availableHeight: number,
    rowCount: number,
    headerRowCount: number
  ) {
    const HEAD_ROW_H = 22;
    const BODY_ROW_H = 20;
    const OVERHEAD = 8;

    const naturalH =
      headerRowCount * HEAD_ROW_H + rowCount * BODY_ROW_H + OVERHEAD;

    if (naturalH <= availableHeight || availableHeight < 40) {
      return {
        scaledHeadStyle: headStyle,
        scaledBodyStyle: bodyStyle,
        scale: 1
      };
    }

    const scale = availableHeight / naturalH;
    const fs = Math.max(4.5, parseFloat((8 * scale).toFixed(2)));
    const hPadV = Math.max(1, parseFloat((6 * scale).toFixed(2)));
    const bPadV = Math.max(1, parseFloat((5 * scale).toFixed(2)));
    const padH = Math.max(2, parseFloat((8 * scale).toFixed(2)));

    return {
      scale,
      scaledHeadStyle: {
        ...headStyle,
        fontSize: fs,
        cellPadding: { top: hPadV, bottom: hPadV, left: padH, right: padH }
      },
      scaledBodyStyle: {
        ...bodyStyle,
        fontSize: fs,
        cellPadding: { top: bPadV, bottom: bPadV, left: padH, right: padH }
      }
    };
  }

  // -- Render entries --
  const totalPages =
    selectedEntries.length + (includeFinalCalc && finalCalc ? 1 : 0);

  for (let ei = 0; ei < selectedEntries.length; ei++) {
    const entry = selectedEntries[ei];
    if (ei > 0) doc.addPage();
    const { template: t, summary: s } = entry;
    const cols = t.columns ?? [],
      rows = t.rows ?? [],
      extra = t.extra ?? [],
      apiBlocks = t.blocks ?? [];
    const vals = templateValues[entry.orderTemplateId] ?? {};
    const extVals = extraValues[entry.orderTemplateId] ?? {};
    const bvMap = allBlockValues[entry.orderTemplateId] ?? {};
    const headerExtras = extra.filter((f) => f.sectionType === 'HEADER');
    const footerExtras = extra.filter((f) => f.sectionType === 'FOOTER');
    const mediaExtras = extra.filter((f) => f.sectionType === 'MEDIA');

    const visibleRows = getVisibleRows(rows, cols, vals);
    const visibleCols = getVisibleCols(cols, visibleRows, vals);

    drawBanner(
      t.name ?? 'Template',
      entry.isChild,
      `Template ${ei + 1} of ${selectedEntries.length}`
    );
    let y = drawInfoCard(90, t.name ?? '—');

    // Header fields
    y = drawExtraFieldsTable(y, headerExtras, extVals, SEC.header);

    // Template values
    y = drawSectionTitle('TEMPLATE VALUES', y);

    const bg = deriveBlockColumns(visibleCols);
    if (visibleCols.length > 0 && visibleRows.length > 0) {
      const flat = bg.flatMap((b) => b.columns),
        multi = bg.length > 1;

      const summaryReserve = s ? SUMMARY_FIXED_H + 14 : 0;
      const availableForTable = PH - 40 - y - summaryReserve;

      const headerRowCount = multi ? 2 : 1;
      const { scaledHeadStyle, scaledBodyStyle, scale } =
        computeScaledTableStyles(
          availableForTable,
          visibleRows.length,
          headerRowCount
        );
      const blockLabelFs = Math.max(
        4.5,
        parseFloat(((9 / 8) * scaledHeadStyle.fontSize).toFixed(2))
      );

      const uw = PW - M * 2,
        dw = Math.min(180, uw * 0.28),
        cw = (uw - dw) / flat.length;
      let head: any[][];
      if (multi) {
        const r1: any[] = [
          {
            content: 'Description',
            rowSpan: 2,
            styles: { valign: 'middle', halign: 'left' }
          }
        ];
        bg.forEach((b, i) =>
          r1.push({
            content: getBlockLabel(apiBlocks, bvMap, b.index),
            colSpan: b.columns.length,
            styles: {
              halign: 'center',
              fillColor: BCOL[i % BCOL.length],
              textColor: C.white,
              fontStyle: 'bold',
              fontSize: blockLabelFs
            }
          })
        );
        head = [
          r1,
          bg.flatMap((b) =>
            b.columns.map((c: any) => ({
              content: c.label,
              styles: { halign: 'center' }
            }))
          )
        ];
      } else {
        const bn =
          apiBlocks.length > 0
            ? getBlockName(apiBlocks, bvMap, bg[0]?.index ?? 0)
            : null;
        head = [
          [
            bn ? `Description (${bn})` : 'Description',
            ...flat.map((c: any) => c.label)
          ]
        ];
      }
      autoTable(doc, {
        startY: y,
        margin: { left: M, right: M },
        pageBreak: 'avoid' as any,
        head,
        body: visibleRows.map((row) => {
          const tot = row.rowType === 'TOTAL';
          return [
            row.label,
            ...flat.map((c: any) => vals[row.id]?.[c.id] ?? '')
          ].map((cell, ci) => ({
            content: cell,
            styles: {
              fontStyle: (tot ? 'bold' : 'normal') as any,
              fillColor: tot ? C.totalRow : undefined,
              textColor: C.primary,
              halign: ci > 0 ? ('right' as const) : ('left' as const)
            }
          }));
        }),
        theme: 'plain',
        headStyles: scaledHeadStyle,
        bodyStyles: scaledBodyStyle,
        ...tblLine,
        columnStyles: {
          0: { cellWidth: dw, fontStyle: 'bold', halign: 'left' },
          ...Object.fromEntries(
            flat.map((_: any, i: number) => [
              i + 1,
              { cellWidth: cw, halign: 'right' as const, font: 'courier' }
            ])
          )
        }
      });
      y = (doc as any).lastAutoTable.finalY + 16;
    }

    // Summary — matches template preview layout exactly
    if (s) {
      const summaryRows: [string, string, boolean][] = [
        ['Total', fmt(s.total), false],
        ['Discount', fmtDiscount(s.discount, s.discountType), false],
        ['Discount Amount', fmtDiscountAmount(s.discountAmount), false]
      ];
      // Additional template costs
      const additionalCosts = s.additionalTemplateCosts ?? [];
      additionalCosts.forEach((c) => {
        const label = c.notes ? `${c.costName} (${c.notes})` : c.costName;
        summaryRows.push([label, `₹${fmt(String(c.cost))}`, false]);
      });
      // Final payable (highlighted)
      summaryRows.push([
        'Final Payable Amount',
        fmt(s.finalPayableAmount),
        true
      ]);
      y = drawSummaryAutoTable(y, summaryRows);
    }

    // Media
    if (mediaExtras.length > 0) {
      y = ensureSpace(y, 100);
      y = drawSectionLabel('Media Fields', mediaExtras.length, SEC.media, y);
      for (const mf of mediaExtras) {
        if (mf.valueType === 'IMAGE') {
          const urls = getAllMediaUrls(extVals, mf.id);
          if (urls.length === 0) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(...C.muted);
            doc.text(`${mf.label}:`, M, y + 4);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.text('—', M + 60, y + 4);
            y += 14;
            continue;
          }
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor(...C.muted);
          doc.text(
            `${mf.label}${urls.length > 1 ? ` (${urls.length} images)` : ''}`,
            M,
            y + 4
          );
          y += 10;
          for (let ui = 0; ui < urls.length; ui++) {
            const cached = imgCache[`${entry.orderTemplateId}_${mf.id}_${ui}`];
            if (cached) {
              const fit = fitImage(cached.w, cached.h, 320, 240);
              y = ensureSpace(y, fit.h + 16);
              doc.setDrawColor(...SEC.media.badge);
              doc.setLineWidth(1);
              doc.roundedRect(M, y, fit.w + 8, fit.h + 8, 3, 3, 'D');
              doc.setLineWidth(0.5);
              try {
                doc.addImage(
                  cached.dataUrl,
                  detectFmt(cached.dataUrl),
                  M + 4,
                  y + 4,
                  fit.w,
                  fit.h
                );
              } catch {
                doc.setFillColor(...C.rowAlt);
                doc.rect(M + 4, y + 4, fit.w, fit.h, 'F');
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7);
                doc.setTextColor(...C.muted);
                doc.text(
                  'Image could not be embedded',
                  M + 8,
                  y + fit.h / 2 + 4
                );
              }
              y += fit.h + 16;
            } else {
              y = ensureSpace(y, 40);
              doc.setFillColor(...C.rowAlt);
              doc.setDrawColor(...C.border);
              doc.setLineWidth(0.5);
              doc.roundedRect(M, y, 120, 32, 3, 3, 'FD');
              doc.setFont('helvetica', 'italic');
              doc.setFontSize(7);
              doc.setTextColor(...C.muted);
              doc.text('Image unavailable', M + 60, y + 18, {
                align: 'center'
              });
              y += 42;
            }
          }
        } else {
          const va = getAllExtraValues(extVals, mf.id);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor(...C.muted);
          doc.text(`${mf.label}:`, M, y + 4);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(...C.primary);
          doc.text(va.join(', ') || '—', M + 60, y + 4);
          y += 14;
        }
      }
      y += 4;
    }

    // Footer fields
    if (footerExtras.length > 0) {
      y = ensureSpace(y, 60);
      drawExtraFieldsTable(y, footerExtras, extVals, SEC.footer);
    }
  }

  // Final calc page
  if (includeFinalCalc && finalCalc) {
    if (selectedEntries.length > 0) doc.addPage();
    renderFinalCalcPage(finalCalc, totalPages, totalPages);
  }

  // Page footers
  const tp = (doc.internal as any).getNumberOfPages?.() ?? totalPages;
  for (let p = 1; p <= tp; p++) {
    doc.setPage(p);
    const fy = PH - 20;
    const nm =
      includeFinalCalc && finalCalc && p === tp
        ? 'Final Calculation'
        : (selectedEntries[p - 1]?.template?.name ?? '');
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.5);
    doc.line(M, fy - 6, PW - M, fy - 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(`Order #${order.orderNo} — ${nm}`, M, fy + 2);
    doc.text(`Page ${p} of ${tp}`, PW - M, fy + 2, { align: 'right' });
  }

  doc.save(`order_${order.orderNo}_templates.pdf`);
}

// -- Label helper --

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

// -- Main component --

export default function OrderTemplatePDF({
  order,
  entries,
  templateValues,
  extraValues,
  blockValues: allBlockValues,
  finalCalc,
  className
}: OrderTemplatePDFProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [includeAddonDiscount, setIncludeAddonDiscount] = useState(true);
  const [includeMarginDiscount, setIncludeMarginDiscount] = useState(true);
  const [includeMarginTotal, setIncludeMarginTotal] = useState(true);

  const labelled = useMemo(() => buildLabelledEntries(entries), [entries]);
  const allIds = useMemo(() => {
    const s = new Set(labelled.map((l) => l.entry.orderTemplateId));
    if (finalCalc) s.add(FINAL_CALC_ID);
    return s;
  }, [labelled, finalCalc]);
  const allSel = selectedIds.size === allIds.size && allIds.size > 0,
    noneSel = selectedIds.size === 0;

  const openDialog = useCallback(() => {
    const def = new Set<string>();
    for (const { entry: e } of labelled) {
      if (e.isNew || e.isChild) continue;
      const t = parseFloat(e.summary?.finalPayableAmount ?? '0');
      if (!e.summary || isNaN(t) || t === 0) continue;
      def.add(e.orderTemplateId);
    }
    if (finalCalc && def.size > 0) def.add(FINAL_CALC_ID);
    setSelectedIds(def);
    setExpandedId(null);
    setDialogOpen(true);
  }, [labelled, finalCalc]);

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
    const incFC = selectedIds.has(FINAL_CALC_ID);
    if (toExport.length === 0 && !incFC) return;
    setIsGenerating(true);
    try {
      await generateMultiPDF(
        order,
        toExport,
        templateValues,
        extraValues,
        allBlockValues,
        finalCalc ?? null,
        incFC,
        { includeAddonDiscount, includeMarginDiscount, includeMarginTotal }
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
    extraValues,
    allBlockValues,
    finalCalc,
    includeAddonDiscount,
    includeMarginDiscount,
    includeMarginTotal
  ]);

  if (labelled.length === 0) return null;
  const selCount = selectedIds.size,
    totalItems = labelled.length + (finalCalc ? 1 : 0);
  const chkCls =
    'shrink-0 data-[state=checked]:border-indigo-600 data-[state=checked]:bg-indigo-600';

  const SelectRow = ({
    id,
    checked,
    label,
    badge,
    badgeVariant = 'secondary' as const,
    iconCls = 'text-muted-foreground'
  }: {
    id: string;
    checked: boolean;
    label: string;
    badge?: string;
    badgeVariant?: 'secondary' | 'outline';
    iconCls?: string;
  }) => {
    const expanded = expandedId === id;
    return (
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
            onCheckedChange={() => toggle(id)}
            className={chkCls}
          />
          <label
            htmlFor={`chk-${id}`}
            className='flex flex-1 cursor-pointer items-center gap-2 text-sm font-medium'
          >
            <FileText className={cn('h-3.5 w-3.5 shrink-0', iconCls)} />
            <span className='truncate'>{label}</span>
            {badge && (
              <Badge
                variant={badgeVariant}
                className='shrink-0 px-1.5 py-0 text-[10px]'
              >
                {badge}
              </Badge>
            )}
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
              {id === FINAL_CALC_ID ? (
                <FinalCalcPreview
                  data={finalCalc!}
                  options={{
                    includeAddonDiscount,
                    includeMarginDiscount,
                    includeMarginTotal
                  }}
                />
              ) : (
                <PreviewTable
                  entry={
                    labelled.find((l) => l.entry.orderTemplateId === id)!.entry
                  }
                  values={templateValues[id] ?? {}}
                  extras={extraValues[id] ?? {}}
                  blockValues={allBlockValues[id] ?? {}}
                />
              )}
            </div>
          </>
        )}
      </div>
    );
  };

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

          <div className='bg-muted/40 flex flex-wrap gap-x-5 gap-y-1 rounded-md border px-4 py-2 text-xs'>
            {[
              ['Design', `#${order.orderNo}`],
              ['Product', order.product?.name ?? '—'],
              ['Customer', order.customer?.name ?? '—'],
              ['Status', order.status ?? 'DRAFT']
            ].map(([l, v]) => (
              <span key={l}>
                <span className='text-muted-foreground'>{l}: </span>
                <span className='font-semibold'>{v}</span>
              </span>
            ))}
          </div>

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

          <ScrollArea className='max-h-[46vh] pr-1'>
            <div className='space-y-2'>
              {labelled.map(({ entry, label }) => (
                <SelectRow
                  key={entry.orderTemplateId}
                  id={entry.orderTemplateId}
                  checked={selectedIds.has(entry.orderTemplateId)}
                  label={label}
                  badge={entry.isChild ? 'copy' : undefined}
                />
              ))}

              {finalCalc && selectedIds.has(FINAL_CALC_ID) && (
                <div className='rounded-lg border border-indigo-200 bg-indigo-50/40 p-3'>
                  <p className='mb-2.5 text-xs font-semibold text-indigo-700'>
                    Final Calculation — PDF Options
                  </p>
                  <div className='flex flex-wrap gap-x-6 gap-y-2'>
                    {(
                      [
                        [
                          'Include Margin Discount',
                          includeMarginDiscount,
                          setIncludeMarginDiscount
                        ],
                        [
                          'Include Margin Total',
                          includeMarginTotal,
                          setIncludeMarginTotal
                        ],
                        [
                          'Include Addon Discount',
                          includeAddonDiscount,
                          setIncludeAddonDiscount
                        ]
                      ] as [string, boolean, (v: boolean) => void][]
                    ).map(([l, v, set]) => (
                      <label
                        key={l}
                        className='flex cursor-pointer items-center gap-2 text-xs'
                      >
                        <Checkbox
                          checked={v}
                          onCheckedChange={(val) => set(val === true)}
                          className={cn('h-3.5 w-3.5', chkCls)}
                        />
                        <span>{l}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {finalCalc && (
                <>
                  <div className='flex items-center gap-2 px-1 pt-1'>
                    <Separator className='flex-1' />
                    <span className='text-muted-foreground shrink-0 text-[10px] font-medium tracking-wider uppercase'>
                      Summary
                    </span>
                    <Separator className='flex-1' />
                  </div>
                  <SelectRow
                    id={FINAL_CALC_ID}
                    checked={selectedIds.has(FINAL_CALC_ID)}
                    label='Final Calculation'
                    badge='summary'
                    badgeVariant='outline'
                    iconCls='text-indigo-500'
                  />
                </>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className='items-center gap-2 sm:gap-2'>
            <p className='text-muted-foreground mr-auto text-xs'>
              {selCount > 0
                ? `${selCount} template${selCount > 1 ? 's' : ''} → 1 PDF (${selCount} page${selCount > 1 ? 's' : ''})`
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
              {isGenerating
                ? 'Generating…'
                : `Download PDF${selCount > 1 ? ` (${selCount} pages)` : ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
