import type { Quotation } from './quotation';
export type { Quotation } from './quotation';

export interface SalesStats {
  totalQuotations: number;
  totalSales: number;
  pending: number;
  approved: number;
}
