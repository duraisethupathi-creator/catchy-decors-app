import { toNum } from './calculations';

export function isValidIndianMobile(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  const local = digits.length > 10 ? digits.slice(-10) : digits;
  return /^[6-9]\d{9}$/.test(local);
}

export function validateCustomer(name: string, phone: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!name || !name.trim()) errors.name = 'Customer name is required';
  if (!phone || !phone.trim()) errors.phone = 'Phone number is required';
  else if (!isValidIndianMobile(phone)) errors.phone = 'Enter a valid Indian mobile number';
  return errors;
}

export function validateLogin(username: string, password: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!username.trim()) errors.username = 'Username is required';
  if (!password || password.length < 4) errors.password = 'Password must be at least 4 characters';
  return errors;
}

/** Numeric input guard: keeps only digits and one decimal point, prevents negatives */
export function numericInput(text: string, allowDecimal = true): string {
  let t = text.replace(/[^0-9.]/g, '');
  if (!allowDecimal) return t;
  const parts = t.split('.');
  if (parts.length > 2) t = parts[0] + '.' + parts.slice(1).join('');
  return t;
}

export function requireNumber(v: string): number {
  return Math.max(0, toNum(v));
}
