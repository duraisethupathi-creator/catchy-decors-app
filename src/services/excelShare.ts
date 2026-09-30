/**
 * Writes the generated xlsx to the device and opens the share sheet
 * (WhatsApp / Email / Drive / Save to Files).
 */
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
  buildQuotationWorkbookBase64,
  excelFileName,
  type ExcelGstInput,
  type ExcelKind,
} from './excelService';
import type { DocContext } from './pdfService';
import type { Quotation } from '../types/quotation';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export interface ExcelExportResult {
  uri: string;
  name: string;
  sheets: number;
}

/** Build the workbook, save it to the cache dir and share it. */
export async function shareQuotationExcel(
  q: Quotation,
  ctx: Partial<DocContext>,
  gst?: ExcelGstInput | null,
  kind: ExcelKind = 'both'
): Promise<ExcelExportResult> {
  const base64 = buildQuotationWorkbookBase64(q, ctx, gst, kind);
  const name = excelFileName(q, kind);
  const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? '';
  const uri = `${dir}${name}`;

  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: 'base64',
  } as unknown as Parameters<typeof FileSystem.writeAsStringAsync>[2]);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: XLSX_MIME,
      dialogTitle: `${name} — share to Excel, Drive or WhatsApp`,
    });
  }

  const sheets = (base64.length > 0 ? 1 : 0) + 0;
  return { uri, name, sheets };
}
