/**
 * Excel (.xlsx) export for quotations and GST billing.
 *
 * Uses SheetJS to turn the pure sheet specs from `utils/quoteSheet` into a real
 * workbook returned as base64 — the base64 is written to disk by `excelShare`,
 * so this module stays free of expo imports and can be unit-tested in Node.
 */
import * as XLSX from 'xlsx';
import { defaultProfile, defaultTemplate } from './settingsService';
import { buildGstSheet, buildQuotationSheet, type SheetSpec } from '../utils/quoteSheet';
import { sanitizeFileToken, type DocContext } from './pdfService';
import { stampImagesIntoXlsx, type XlsxImage } from './excelChart';
import type { Quotation } from '../types/quotation';
import type { BillCompany, BillCustomer } from './pdfService';

/** GST values for the billing sheet (from the preview editor or a stored quotation). */
export interface ExcelGstInput {
  enabled: boolean;
  percent: number;
  invoiceNumber?: string;
  company?: Partial<BillCompany>;
  customer?: Partial<BillCustomer>;
}

export type ExcelKind = 'quotation' | 'gst' | 'both';

const MONEY_FORMAT = '#,##0.00';

function resolve(ctx?: Partial<DocContext>) {
  return {
    profile: { ...defaultProfile(), ...(ctx?.profile ?? {}) },
    template: { ...defaultTemplate(), ...(ctx?.template ?? {}) },
  };
}

/** Read the GST block persisted on a quotation into the sheet input shape. */
export function gstInputFromQuotation(q: Quotation): ExcelGstInput | null {
  const g = q.gst;
  if (!g) return null;
  return {
    enabled: !!g.enabled,
    percent: Number(g.percent ?? 0),
    invoiceNumber: g.invoice_number ?? '',
    company: (g.company ?? undefined) as Partial<BillCompany> | undefined,
    customer: (g.customer ?? undefined) as Partial<BillCustomer> | undefined,
  };
}

function sheetToWorksheet(spec: SheetSpec): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(spec.aoa);
  ws['!cols'] = spec.widths.map((wch) => ({ wch }));
  for (const m of spec.money) {
    const addr = XLSX.utils.encode_cell({ r: m.r, c: m.c });
    const cell = ws[addr] as XLSX.CellObject | undefined;
    if (cell && typeof cell.v === 'number') {
      cell.t = 'n';
      cell.z = MONEY_FORMAT;
    }
  }
  return ws;
}

/**
 * Build the workbook and return it as a base64 xlsx payload.
 * - kind 'quotation' → Quotation sheet only
 * - kind 'gst'       → GST Invoice sheet only (fallback: Quotation)
 * - kind 'both'      → Quotation, plus GST Invoice when GST is enabled
 */
export function buildQuotationWorkbookBase64(
  q: Quotation,
  ctx?: Partial<DocContext>,
  gst?: ExcelGstInput | null,
  kind: ExcelKind = 'both'
): string {
  const { profile, template } = resolve(ctx);
  const logoDataUri = ctx?.logoDataUri ?? '';
  const wb = XLSX.utils.book_new();

  const wantQuotation = kind === 'quotation' || kind === 'both';
  const wantGst = (kind === 'gst' || kind === 'both') && !!gst?.enabled;

  if (wantQuotation) {
    XLSX.utils.book_append_sheet(
      wb,
      sheetToWorksheet(buildQuotationSheet(q, profile, template, gst, logoDataUri)),
      'Quotation'
    );
  }
  if (wantGst && gst) {
    XLSX.utils.book_append_sheet(
      wb,
      sheetToWorksheet(buildGstSheet(q, gst, profile, template, logoDataUri)),
      'GST Invoice'
    );
  }
  // Never emit an empty workbook.
  if (wb.SheetNames.length === 0) {
    XLSX.utils.book_append_sheet(
      wb,
      sheetToWorksheet(buildQuotationSheet(q, profile, template, gst, logoDataUri)),
      'Quotation'
    );
  }

  const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) as string;
  if (!logoDataUri) return base64;
  // Logo sits in the top-left cell of every sheet (A1), mirroring the PDF header.
  const images: XlsxImage[] = wb.SheetNames.map(() => ({
    dataUri: logoDataUri,
    from: { col: 0, row: 0 },
    width: 116,
    height: 116,
  }));
  try {
    return stampImagesIntoXlsx(base64, images);
  } catch {
    return base64; // never lose the workbook because the logo could not be embedded
  }
}

/** Spreadsheet filename, sanitized the same way as the PDF names. */
export function excelFileName(q: Quotation, kind: ExcelKind = 'quotation'): string {
  const token = sanitizeFileToken(q.customer_name);
  const num = String(q.quotation_number ?? '').replace(/[^a-zA-Z0-9_\-]/g, '_') || 'Quotation';
  const tag = kind === 'gst' ? 'GSTBilling' : kind === 'both' ? 'Quotation_GST' : 'Quotation';
  return `CatchyDecors_${num}_${tag}_${token}.xlsx`;
}
