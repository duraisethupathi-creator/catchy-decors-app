import type { CompanyProfile } from '../types/settings';

/** Factory defaults. Runtime values come from Settings → Business Profile. */
export const COMPANY = {
  name: 'CATCHY DECORS',
  tagline: 'Transform Your Space Beautifully',
  addressLine1: '18th, 4th Cross,',
  addressLine2: 'Kamarajapuram,',
  addressLine3: 'Karur - 639002,',
  addressLine4: 'Tamil Nadu, India',
  fullAddress:
    '18th, 4th Cross,\nKamarajapuram,\nKarur - 639002,\nTamil Nadu, India',
  phone: '9159194440',
  phoneDial: '+919159194440',
  website: 'www.catchydecors.in',
  whatsapp: '919159194440',
};

/** Flatten an editable profile into the line-based shape documents expect. */
export function profileToCompany(p?: Partial<CompanyProfile> | null) {
  const name = p?.name?.trim() || COMPANY.name;
  const tagline = p?.tagline?.trim() || COMPANY.tagline;
  const a1 = p?.addressLine1 ?? COMPANY.addressLine1;
  const a2 = p?.addressLine2 ?? COMPANY.addressLine2;
  const a3 = p?.addressLine3 ?? COMPANY.addressLine3;
  const a4 = p?.addressLine4 ?? COMPANY.addressLine4;
  return {
    name,
    tagline,
    addressLine1: a1,
    addressLine2: a2,
    addressLine3: a3,
    addressLine4: a4,
    fullAddress: [a1, a2, a3, a4].filter(Boolean).join('\n'),
    phone: p?.phone?.trim() || COMPANY.phone,
    altPhone: p?.altPhone?.trim() || '',
    email: p?.email?.trim() || '',
    website: p?.website?.trim() || COMPANY.website,
    gstin: p?.gstin?.trim() || '',
    legalForm: p?.legalForm?.trim() || '',
    logoUri: p?.logoUri?.trim() || '',
    bankName: p?.bankName?.trim() || '',
    bankAccount: p?.bankAccount?.trim() || '',
    bankIfsc: p?.bankIfsc?.trim() || '',
    upiId: p?.upiId?.trim() || '',
  };
}

/**
 * Bundled brand logo (CD monogram, red→orange→gold gradient on navy).
 * Resolved lazily and guarded so pure-Node scripts that transitively import this
 * module never attempt to load a PNG outside Metro.
 */
let _logoCache: any = undefined;
export function getBrandLogo(): any {
  if (_logoCache !== undefined) return _logoCache;
  try {
    _logoCache = require('../../assets/images/logo.png');
  } catch {
    _logoCache = null;
  }
  return _logoCache;
}
