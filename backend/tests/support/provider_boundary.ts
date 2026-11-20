import assert from 'node:assert/strict';
import { admin, begin, item, owner, reset, rpc, save, sql } from './local.ts';
import { propertyStore } from '../../src/property/persistence/supabase-property-store.ts';
import { executeRun } from '../../src/property/application/execute-run.ts';
import { DfImoveisProvider } from '../../src/property/providers/df-imoveis.ts';
import { WimoveisProvider } from '../../src/property/providers/wimoveis.ts';
export async function validationCase(
  mode: '404' | '410' | 'removed' | '403' | 'timeout' | 'network' | 'parse',
) {
  await reset();
  const initial = await begin();
  await save(initial, [item()]);
  await sql`insert into listing_marks(user_id,listing_id,status) select ${owner},id,'favorite' from listings where url=${item().url}`;
  await rpc('finish_crawl_job', {
    p_job: initial.job_id,
    p_token: initial.token,
    p_state: 'succeeded',
    p_email: 'not_needed',
  });
  const original = globalThis.fetch;
  let count = 0;
  globalThis.fetch = (input, init) => {
    const url = String(input);
    if (url.includes('www.wimoveis.com.br')) {
      count++;
      if (mode === 'timeout') {
        return Promise.reject(new DOMException('timed out', 'TimeoutError'));
      }
      if (mode === 'network') {
        return Promise.reject(new TypeError('network unavailable'));
      }
      return Promise.resolve(
        new Response(
          mode === 'removed'
            ? '<body>Anúncio removido</body>'
            : '<body><h1>Missing fields</h1></body>',
          { status: ['404', '410', '403'].includes(mode) ? Number(mode) : 200 },
        ),
      );
    }
    return original(input, init);
  };
  try {
    const result = await executeRun('validate', {
      store: propertyStore(admin),
      providers: (id, p, signal) => {
        const v = id === 'dfimoveis'
          ? new DfImoveisProvider(p, signal)
          : new WimoveisProvider(p, signal);
        return {
          collect: () => v.collectOutcome(),
          verify: (u) => v.verify(u),
        };
      },
      sendEmail: () => Promise.resolve({ success: true }),
      sleep: () => Promise.resolve(),
    });
    const [row] = await sql`select * from listings`;
    assert.equal(
      row.availability,
      ['404', '410', 'removed'].includes(mode) ? 'removed' : 'active',
    );
    assert.equal(
      row.last_check_result,
      ['404', '410', 'removed'].includes(mode) ? 'removed' : 'unknown',
    );
    assert.equal((await sql`select * from listing_price_history`).length, 1);
    assert.equal((await sql`select * from listing_marks`).length, 1);
    assert.ok(result.job_id);
    assert.equal(count, mode === 'network' || mode === 'timeout' ? 3 : 1);
  } finally {
    globalThis.fetch = original;
  }
}
export async function collectedAdapter(
  source: 'dfimoveis' | 'wimoveis',
  empty = false,
) {
  const original = globalThis.fetch;
  const html = empty
    ? '<h1>Sem detalhes</h1>'
    : await Deno.readTextFile('tests/fixtures/' + source + '.html');
  globalThis.fetch = (input, init) => {
    const url = String(input);
    if (
      url.includes(
        source === 'dfimoveis' ? 'www.dfimoveis.com.br' : 'www.wimoveis.com.br',
      )
    ) {
      if (url.includes('/imovel/123')) {
        return Promise.resolve(new Response(html));
      }
      if (url.includes('pagina=2')) return Promise.resolve(new Response(''));
      return Promise.resolve(
        new Response(
          source === 'dfimoveis'
            ? '<a href="/imovel/123?tracking=x">Ad</a>'
            : '<div class="postingCardLayout-module__posting-card-layout" data-to-posting="/imovel/123?tracking=x"></div>',
        ),
      );
    }
    return original(input, init);
  };
  try {
    const params = {
      neighborhoods: ['asa-norte'],
      numberOfRooms: [3],
      numberOfSuites: 0,
      minArea: 90,
      maxArea: 150,
      minPrice: 1000000,
      maxPrice: 1400000,
      hasElevator: true,
      hasParking: false,
    };
    const v = source === 'dfimoveis'
      ? new DfImoveisProvider(params)
      : new WimoveisProvider(params);
    const r = await v.collectOutcome();
    assert.equal(r.outcome, 'succeeded');
    assert.equal(r.properties.length, 1);
    return r.properties[0];
  } finally {
    globalThis.fetch = original;
  }
}
