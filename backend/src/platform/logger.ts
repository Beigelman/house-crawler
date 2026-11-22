import { AsyncLocalStorage } from 'node:async_hooks';
import { sanitizeDiagnostic } from './diagnostics.ts';

type Context = Record<string, unknown>;
const context = new AsyncLocalStorage<Context>();
const sensitiveKey = /authorization|cookie|password|secret|token|api[_-]?key/i;

function redact(value: string): string {
  return value
    .replace(/\b(Bearer|Basic)\s+[^\s,;]+/gi, '$1 [REDACTED]')
    .replace(
      /((?:[\w-]*(?:secret|token|password|api[_-]?key)[\w-]*)\s*[=:]\s*)[^\s&;,]+/gi,
      '$1[REDACTED]',
    )
    .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[REDACTED]@');
}

/** Preserve Error's non-enumerable fields and plain-object throws as JSON. */
function serialize(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') return redact(value);
  if (typeof value === 'bigint') return String(value);
  if (value === undefined) return null;
  if (typeof value !== 'object' || value === null) return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  try {
    if (Array.isArray(value)) return value.map((v) => serialize(v, seen));
    const result: Context = {};
    const keys = value instanceof Error
      ? new Set([
        'name',
        'message',
        'stack',
        ...Object.getOwnPropertyNames(value),
      ])
      : Object.keys(value);
    for (const key of keys) {
      if (sensitiveKey.test(key)) {
        result[key] = '[REDACTED]';
        continue;
      }
      try {
        result[key] = serialize((value as Context)[key], seen);
      } catch {
        result[key] = '[Unserializable]';
      }
    }
    return result;
  } finally {
    seen.delete(value);
  }
}

export function withLogContext<T>(fields: Context, action: () => T): T {
  return context.run({ ...context.getStore(), ...fields }, action);
}

function emit(
  level: 'info' | 'warn' | 'error',
  event: string,
  fields: Context,
) {
  const line = JSON.stringify(serialize({
    ...context.getStore(),
    ...fields,
    timestamp: new Date().toISOString(),
    level,
    event,
  }));
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (event: string, fields: Context = {}) => emit('info', event, fields),
  error: (event: string, error: unknown, fields: Context = {}) =>
    emit('error', event, {
      ...fields,
      error_category: sanitizeDiagnostic(error),
      error,
    }),
  warn: (event: string, error: unknown, fields: Context = {}) =>
    emit('warn', event, {
      ...fields,
      error_category: sanitizeDiagnostic(error),
      error,
    }),
};
