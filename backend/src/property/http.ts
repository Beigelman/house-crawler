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
      if (options.signal?.aborted) throw e;
      const retry = !(e instanceof HttpError) || e.status === 429 ||
        e.status >= 500;
      if (!retry || attempt >= 2) throw e;
      await sleep(attempt === 0 ? 2000 : 4000);
    }
  }
}
