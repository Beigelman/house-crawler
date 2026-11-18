// Deno --preload test assembly: production entry points remain unchanged.
import { config } from './local.ts';
for (
  const [key, value] of Object.entries({
    SUPABASE_URL: Deno.env.get('PROPERTY_TEST_MODE') === 'unreachable'
      ? 'http://127.0.0.1:1'
      : config.API_URL,
    SUPABASE_SERVICE_ROLE_KEY: config.SERVICE_ROLE_KEY,
    RESEND_API_KEY: 're_local-test',
    FROM_EMAIL: 'radar@example.test',
    TO_EMAILS: 'local@example.test',
  })
) Deno.env.set(key, value);
console.log('TEST_WORKER_PID=' + Deno.pid);
const mode = Deno.env.get('PROPERTY_TEST_MODE') || 'success';
const detail = await Deno.readTextFile(
  new URL('fixtures/wimoveis.html', import.meta.url),
);
const original = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = String(input);
  const df = url.includes('www.dfimoveis.com.br');
  const wi = url.includes('www.wimoveis.com.br');
  if (df || wi) {
    console.log('TEST_PROVIDER_REQUEST');
    if (mode === 'failed' || mode === 'partial' && df) {
      return Promise.resolve(new Response('', { status: 403 }));
    }
    if (url.includes('/imovel/')) return Promise.resolve(new Response(detail));
    if (url.includes('pagina=2')) return Promise.resolve(new Response(''));
    return Promise.resolve(
      new Response(
        df
          ? '<a href="/imovel/123">Ad</a>'
          : '<div class="postingCardLayout-module__posting-card-layout" data-to-posting="/imovel/123"></div>',
      ),
    );
  }
  if (url.startsWith('https://api.resend.com/')) {
    return Promise.resolve(
      new Response('{"id":"local-test"}', {
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }
  return original(input, init);
};
