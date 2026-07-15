import { useEffect, useState } from 'react';

export const CURRENCY_STORAGE_KEY = 'tanaghum-display-currency';

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
  if (typeof window === 'undefined') return DEFAULT_CURRENCY;
  const stored = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
  return stored && isCurrencyCode(stored) ? stored : DEFAULT_CURRENCY;
}

export function setCurrencyPreference(currency: CurrencyCode) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CURRENCY_STORAGE_KEY, currency);
  window.dispatchEvent(new CustomEvent('tanaghum-currency-change', { detail: { currency } }));
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

export function useCurrencyPreference() {
  const [currency, setCurrency] = useState<CurrencyCode>(() => getCurrencyPreference());

  useEffect(() => {
    const handleChange = () => setCurrency(getCurrencyPreference());
    window.addEventListener('storage', handleChange);
    window.addEventListener('tanaghum-currency-change', handleChange as EventListener);
    return () => {
      window.removeEventListener('storage', handleChange);
      window.removeEventListener('tanaghum-currency-change', handleChange as EventListener);
    };
  }, []);

  function updateCurrency(nextCurrency: CurrencyCode) {
    setCurrencyPreference(nextCurrency);
    setCurrency(nextCurrency);
  }

  return { currency, updateCurrency };
}
