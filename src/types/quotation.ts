import type { Measurement, Accessory, OtherCharge } from './measurement';
import type { QuotationStatus } from '../constants/products';

export interface QuotationTotals {
  subtotal: number;
  accessories_total: number;
  fitting: number;
  stitching: number;
  transport: number;
  additional: number;
  discount: number;
  grand_total: number;
}

export interface Quotation {
  id: string;
  quotation_number: string;
  customer_id: string;
  customer_name?: string;
  customer_phone?: string;
  quotation_date: string;
  subtotal: number;
  accessories_total: number;
  other_charges: number;
  discount: number;
  grand_total: number;
  status: QuotationStatus;
  created_at?: string;
  items?: Measurement[];
  accessories?: Accessory[];
  charges?: OtherCharge[];
  /** Site/location carried for convenience (also stored in customer record). */
  site_location?: string;
  /** Editable label printed for the summed "Other Charges" line. */
  charges_label?: string;
  /** Editable label printed for the discount line. */
  discount_label?: string;
  /** Optional editable override for GST bill — persisted on the quotation. */
  gst?: {
    enabled: boolean;
    percent: number;
    invoice_number?: string;
    company?: {
      name: string;
      tagline: string;
      addressLine1: string;
      addressLine2: string;
      addressLine3: string;
      addressLine4: string;
      phone: string;
      website: string;
      gstin?: string;
    };
    customer?: {
      name: string;
      phone: string;
      address: string;
      site: string;
      gstin?: string;
    };
  };
}
