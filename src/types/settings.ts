/** Editable business profile — replaces the hard-coded COMPANY constant at runtime. */
export interface CompanyProfile {
  name: string;
  tagline: string;
  addressLine1: string;
  addressLine2: string;
  addressLine3: string;
  addressLine4: string;
  phone: string;
  altPhone: string;
  email: string;
  website: string;
  gstin: string;
  /** Business type / legal form shown on documents (e.g. "Proprietorship"). */
  legalForm: string;
  /** Local file URI of a user-picked logo, or '' to use the bundled brand logo. */
  logoUri: string;
  bankName: string;
  bankAccount: string;
  bankIfsc: string;
  upiId: string;
}

/** Editable quotation / tax-invoice template. */
export interface QuotationTemplate {
  /* --- numbering --- */
  prefix: string;
  separator: string;
  includeYear: boolean;
  padding: number;
  startNumber: number;
  /* --- document titles --- */
  quotationTitle: string;
  invoiceTitle: string;
  /* --- branding --- */
  accentColor: string;
  showLogo: boolean;
  /* --- which columns/elements appear on documents --- */
  showSerialColumn: boolean;
  showAreaColumn: boolean;
  showTypeColumn: boolean;
  showFabricColumn: boolean;
  showHeightColumn: boolean;
  showWidthColumn: boolean;
  showUnitInQty: boolean;
  showGstin: boolean;
  showBankDetails: boolean;
  showUpiQr: boolean;
  showSignature: boolean;
  signatureLabel: string;
  /* --- GST defaults --- */
  gstEnabledByDefault: boolean;
  gstPercent: number;
  gstin: string;
  hsnCode: string;
  taxLabel: string;
  /* --- free text --- */
  terms: string;
  notes: string;
  footerNote: string;
  thankYouNote: string;
  validityDays: number;
  /* --- currency --- */
  currencySymbol: string;
}

export interface AppSettings {
  profile: CompanyProfile;
  template: QuotationTemplate;
}

/** Keys used by the Google Drive backup when serialising AsyncStorage. */
export interface BackupPayload {
  app: 'catchy-decors';
  version: number;
  createdAt: string;
  device: string;
  data: Record<string, string>;
}
