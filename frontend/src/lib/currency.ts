export const CURRENCY_OPTIONS = [
  { code: 'AED', label: 'AED - UAE Dirham' },
  { code: 'USD', label: 'USD - US Dollar' },
  { code: 'SAR', label: 'SAR - Saudi Riyal' },
  { code: 'JOD', label: 'JOD - Jordanian Dinar' },
  { code: 'KWD', label: 'KWD - Kuwaiti Dinar' },
  { code: 'QAR', label: 'QAR - Qatari Riyal' },
  { code: 'BHD', label: 'BHD - Bahraini Dinar' },
  { code: 'OMR', label: 'OMR - Omani Rial' },
  { code: 'EUR', label: 'EUR - Euro' },
  { code: 'GBP', label: 'GBP - British Pound' },
] as const;

export type CurrencyCode = typeof CURRENCY_OPTIONS[number]['code'];

const DEFAULT_CURRENCY: CurrencyCode = 'AED';

export function isCurrencyCode(value: string): value is CurrencyCode {
  return CURRENCY_OPTIONS.some(option => option.code === value);
}

export function getCurrencyPreference(): CurrencyCode {
  return DEFAULT_CURRENCY;
}

export function formatCurrency(value: unknown, currency = getCurrencyPreference()): string {
  const numeric = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim()
      ? Number(value)
      : 0;
  const safeNumber = Number.isFinite(numeric) ? numeric : 0;
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(safeNumber);
}
