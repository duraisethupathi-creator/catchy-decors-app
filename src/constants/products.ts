export type ProductKey =
  | 'curtains'
  | 'blinds'
  | 'wallpaper'
  | 'headboard'
  | 'cushion'
  | 'flooring'
  | 'mosquito_net'
  | 'accessories';

export interface ProductDef {
  key: ProductKey;
  name: string;
  icon: keyof typeof MAP_ICONS;
  description: string;
  typeLabel: string;
  typeOptions: string[];
  formula: 'curtain' | 'square_feet' | 'accessories' | 'wallpaper' | 'linear_meter';
  usesHeight: boolean;
  /** Unit shown next to "Qty" in quotation tables — e.g. mtr, R.ft, sq.ft, rolls. */
  qtyUnit: string;
}

const MAP_ICONS: Record<string, string> = {};

export const PRODUCTS: ProductDef[] = [
  {
    key: 'curtains',
    name: 'Curtains',
    icon: 'window-shade-outline',
    description: 'All curtain types & stitching',
    typeLabel: 'Curtain Type',
    typeOptions: ['Eyelet', 'Rod Pocket', 'Grommet', 'Pleated', 'Sheer', 'Blackout', 'Layered'],
    formula: 'curtain',
    usesHeight: true,
    qtyUnit: 'mtr',
  },
  {
    key: 'blinds',
    name: 'Blinds',
    icon: 'blinds-horizontal',
    description: 'Roller, wooden & vertical blinds',
    typeLabel: 'Blind Type',
    typeOptions: ['Roller', 'Wooden', 'Vertical', 'Zebra', 'Roman', 'Venetian'],
    formula: 'square_feet',
    usesHeight: true,
    qtyUnit: 'sq.ft',
  },
  {
    key: 'wallpaper',
    name: 'Wallpaper',
    icon: 'wall-sconce-flat-outline',
    description: 'Wallpapers & wall covering',
    typeLabel: 'Wallpaper Type',
    typeOptions: ['Customize', 'Normal Wallpaper'],
    formula: 'wallpaper',
    usesHeight: true,
    qtyUnit: 'sq.ft',
  },
  {
    key: 'headboard',
    name: 'Headboard',
    icon: 'bed-outline',
    description: 'Bed headboards & panels',
    typeLabel: 'Type',
    typeOptions: ['Panel', 'Tufted', 'Slatted', 'Upholstered'],
    formula: 'square_feet',
    usesHeight: true,
    qtyUnit: 'sq.ft',
  },
  {
    key: 'cushion',
    name: 'Cushion',
    icon: 'sofa-outline',
    description: 'Wooden sofa, dining & seat cushions',
    typeLabel: 'Cushion Type',
    typeOptions: ['Wooden Sofa Cushion', 'Dining Cushion', 'Seat Cushion'],
    formula: 'linear_meter',
    usesHeight: false,
    qtyUnit: 'mtr',
  },
  {
    key: 'flooring',
    name: 'Flooring',
    icon: 'grid-large',
    description: 'Vinyl, wooden & turf flooring',
    typeLabel: 'Material',
    typeOptions: ['Vinyl', 'Wooden', 'Laminate', 'Turf', 'Carpet Tiles'],
    formula: 'square_feet',
    usesHeight: true,
    qtyUnit: 'sq.ft',
  },
  {
    key: 'mosquito_net',
    name: 'Mosquito Net',
    icon: 'shield-mosquito-outline',
    description: 'Mosquito nets & screens',
    typeLabel: 'Type',
    typeOptions: ['DOOR NET', 'Fleated Net', 'Sliding Door Net', 'Fixed Frame', 'Velcro Net'],
    formula: 'square_feet',
    usesHeight: true,
    qtyUnit: 'sq.ft',
  },
  {
    key: 'accessories',
    name: 'Accessories',
    icon: 'cable-data',
    description: 'Tracks, rods & fittings',
    typeLabel: 'Track Type',
    typeOptions: ['Aluminium Track', 'Wooden Rod', 'Motorized Track', 'Steel Rod', 'Curtain Rod'],
    formula: 'accessories',
    usesHeight: false,
    qtyUnit: 'R.ft',
  },
];

export function getProduct(key: ProductKey): ProductDef {
  return PRODUCTS.find((p) => p.key === key) ?? PRODUCTS[0];
}

/**
 * Quantity CELL LABEL for quotation tables & exports.
 *  - curtain → "Qty / mtr"
 *  - accessories → "Qty / R.ft"
 *  - everything else → "Qty"
 */
export function quantityColumnLabel(product: ProductKey | string): string {
  if (product === 'curtains') return 'Qty / mtr';
  if (product === 'accessories') return 'Qty / R.ft';
  return 'Qty';
}

export const QUOTATION_STATUSES = ['draft', 'sent', 'approved', 'completed'] as const;
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];

export const STATUS_LABELS: Record<QuotationStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  approved: 'Approved',
  completed: 'Completed',
};
