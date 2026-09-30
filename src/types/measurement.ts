import type { ProductKey } from '../constants/products';

export interface Measurement {
  id: string;
  customer_id: string;
  product_type: ProductKey;
  area_name: string;
  type?: string;
  /** Fabric type the customer picked (e.g. Cotton, Blackout). */
  fabric_type?: string;
  /** Fabric area in square feet, entered per item. */
  fabric_area?: number;
  /** Manual curtain Part value. */
  part?: number;
  /** Measurement unit for blinds/mosquito net. */
  measurement_unit?: 'inch' | 'mm';
  /** Per-line GST percentage; optional for old saved data. */
  gst_percent?: number;
  width: number;
  height: number;
  quantity: number;
  price: number;
  total: number;
  created_at?: string;
}

export interface Accessory {
  id: string;
  customer_id: string;
  area_name: string;
  track_type: string;
  /** Manual curtain Part value. */
  part?: number;
  /** Measurement unit for blinds/mosquito net. */
  measurement_unit?: 'inch' | 'mm';
  /** Per-line GST percentage; optional for old saved data. */
  gst_percent?: number;
  width: number;
  quantity: number;
  price: number;
  total: number;
}

export interface OtherCharge {
  id: string;
  description: string;
  quantity: number;
  price: number;
  total: number;
}
