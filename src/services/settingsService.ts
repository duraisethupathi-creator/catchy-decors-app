import AsyncStorage from '@react-native-async-storage/async-storage';
import { COMPANY } from '../constants/company';
import type { CompanyProfile, QuotationTemplate, AppSettings } from '../types/settings';

const KEY_SETTINGS = 'cd_app_settings';
const KEY_PROFILE = 'cd_company_profile';
const KEY_TEMPLATE = 'cd_quotation_template';

/** Default business profile, seeded from the shipped company constants. */
export function defaultProfile(): CompanyProfile {
  return {
    name: COMPANY.name,
    tagline: COMPANY.tagline,
    addressLine1: COMPANY.addressLine1,
    addressLine2: COMPANY.addressLine2,
    addressLine3: COMPANY.addressLine3,
    addressLine4: COMPANY.addressLine4,
    phone: COMPANY.phone,
    altPhone: '',
    email: '',
    website: COMPANY.website,
    gstin: '',
    legalForm: 'Proprietorship',
    logoUri: '',
    bankName: '',
    bankAccount: '',
    bankIfsc: '',
    upiId: '',
  };
}

export function defaultTemplate(): QuotationTemplate {
  return {
    prefix: 'CD',
    separator: '-',
    includeYear: true,
    padding: 4,
    startNumber: 1,

    quotationTitle: 'QUOTATION',
    invoiceTitle: 'TAX INVOICE',

    accentColor: '#FF7A00',
    showLogo: true,

    showSerialColumn: true,
    showAreaColumn: true,
    showTypeColumn: true,
    showHeightColumn: true,
    showWidthColumn: true,
    showFabricColumn: true,
    showUnitInQty: true,
    showGstin: true,
    showBankDetails: false,
    showUpiQr: false,
    showSignature: true,
    signatureLabel: 'Authorised Signatory',

    gstEnabledByDefault: false,
    gstPercent: 18,
    gstin: '',
    hsnCode: '6303',
    taxLabel: 'CGST + SGST / IGST',

    terms:
      '1. 50% advance along with order confirmation.\n2. Delivery within 7–10 working days after final measurement.\n3. Quotation valid for 15 days from the date of issue.',
    notes: 'Prices are inclusive of mentioned charges only. Site readiness required before installation.',
    footerNote: 'Thank you for your business!',
    thankYouNote: 'Thank you for choosing {COMPANY}!',
    validityDays: 15,

    currencySymbol: '\u20B9',
  };
}

export function defaultSettings(): AppSettings {
  return { profile: defaultProfile(), template: defaultTemplate() };
}

/** Merge stored values over defaults so new fields never come back undefined. */
function mergeSettings(raw: unknown): AppSettings {
  const d = defaultSettings();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<AppSettings>;
  return {
    profile: { ...d.profile, ...(r.profile ?? {}) },
    template: { ...d.template, ...(r.template ?? {}) },
  };
}

export async function getSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY_SETTINGS);
    if (raw) return mergeSettings(JSON.parse(raw));
    // migrate a legacy standalone company profile if present
    const legacy = await AsyncStorage.getItem(KEY_PROFILE);
    const d = defaultSettings();
    if (legacy) {
      try {
        const p = JSON.parse(legacy) as Partial<CompanyProfile>;
        d.profile = { ...d.profile, ...p };
      } catch {
        /* ignore malformed legacy value */
      }
    }
    return d;
  } catch {
    return defaultSettings();
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(KEY_SETTINGS, JSON.stringify(settings));
  // keep the legacy key in sync for older screens
  await AsyncStorage.setItem(KEY_PROFILE, JSON.stringify(settings.profile));
}

export async function getProfile(): Promise<CompanyProfile> {
  return (await getSettings()).profile;
}

export async function saveProfile(profile: CompanyProfile): Promise<void> {
  const s = await getSettings();
  await saveSettings({ ...s, profile });
}

export async function getTemplate(): Promise<QuotationTemplate> {
  return (await getSettings()).template;
}

export async function saveTemplate(template: QuotationTemplate): Promise<void> {
  const s = await getSettings();
  await saveSettings({ ...s, template });
  await AsyncStorage.setItem(KEY_TEMPLATE, JSON.stringify(template));
}

export async function resetSettings(): Promise<AppSettings> {
  const d = defaultSettings();
  await saveSettings(d);
  return d;
}
