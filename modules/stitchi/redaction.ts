const SECRET_KEY_PATTERN = /(api[_-]?key|access[_-]?token|refresh[_-]?token|secret|password|credential|authorization|bearer)/i;
const SECRET_TEXT_PATTERN = /\b(api[_ -]?key|access[_ -]?token|refresh[_ -]?token|secret|password|authorization|bearer)\b\s*[:=]?\s+[A-Za-z0-9._~+/=-]{8,}/gi;

export function redactText(value: string): string {
  return value.replace(SECRET_TEXT_PATTERN, '$1 [redacted]');
}

export function sanitizeForStorage(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return redactText(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(item => sanitizeForStorage(item));
  if (typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      output[key] = SECRET_KEY_PATTERN.test(key) ? '[redacted]' : sanitizeForStorage(child);
    }
    return output;
  }
  return null;
}

export function toStoredJson(value: unknown): Record<string, unknown> {
  const sanitized = sanitizeForStorage(value);
  if (!sanitized || typeof sanitized !== 'object' || Array.isArray(sanitized)) return {};
  return JSON.parse(JSON.stringify(sanitized)) as Record<string, unknown>;
}
