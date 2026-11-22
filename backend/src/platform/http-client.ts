import { logger } from './logger.ts';

export const REQUEST_TIMEOUT_MS = 30000;

export class HttpError extends Error {
  constructor(public status: number) {
    super('HTTP ' + status);
  }
}
type Options = {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  signal?: AbortSignal;
  headers?: HeadersInit;
};

export async function fetchWithRetry(
  url: string,
  options: Options = {},
): Promise<Response> {
  const request = options.fetch ?? fetch;
  const sleep = options.sleep ??
    ((ms) => new Promise((r) => setTimeout(r, ms)));
  for (let attempt = 0;; attempt++) {
    try {
      const timeout = AbortSignal.timeout(
        options.timeoutMs ?? REQUEST_TIMEOUT_MS,
      );
      const signal = options.signal
        ? AbortSignal.any([options.signal, timeout])
        : timeout;
      const response = await request(url, { headers: options.headers, signal });
      if (response.ok) {
        if (response.status === 204 || response.status === 205) return response;
        const body = await response.arrayBuffer();
        return new Response(body, {
          status: response.status,
          headers: response.headers,
        });
      }
      await response.body?.cancel();
      throw new HttpError(response.status);
    } catch (e) {
      if (options.signal?.aborted) {
        logger.error('http.aborted', e, {
          request_url: url,
          attempt: attempt + 1,
        });
        throw e;
      }
      const retry = !(e instanceof HttpError) || e.status === 429 ||
        e.status >= 500;
      const fields = {
        request_url: url,
        attempt: attempt + 1,
        max_attempts: 3,
        timeout_ms: options.timeoutMs ?? REQUEST_TIMEOUT_MS,
      };
      if (!retry || attempt >= 2) {
        logger.error('http.failed', e, fields);
        throw e;
      }
      const retryDelay = attempt === 0 ? 2000 : 4000;
      logger.warn('http.retry', e, { ...fields, retry_delay_ms: retryDelay });
      await sleep(retryDelay);
    }
  }
}
