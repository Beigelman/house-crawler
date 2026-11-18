// deno-lint-ignore-file require-await
// Async provider/store doubles implement the production promise boundary.
import assert from 'node:assert/strict';
import type { Property } from '../src/property/model.ts';
import {
  executeRun,
  exitCode,
  pollWorker,
  sanitizeDiagnostic,
} from '../src/property/runner.ts';
import { matchesProfile } from '../src/property/model.ts';
import { fetchWithRetry, REQUEST_TIMEOUT_MS } from '../src/property/http.ts';
import { parsePropertyHtml } from '../src/property/parsing.ts';
const params = {
  neighborhoods: ['asa-norte'],
  numberOfRooms: [3],
  numberOfSuites: 1,
  minArea: 90,
  maxArea: 150,
  minPrice: 1000000,
  maxPrice: 1400000,
  hasElevator: true,
  hasParking: true,
};
const listing = {
  link: 'https://www.wimoveis.com.br/imovel/a',
  titulo: 'Apartamento',
  valor: 'R$ 1.200.000,00',
  source: 'wimoveis',
  price_cents: 120000000,
  area: 100,
  rooms: 3,
  suites: 1,
  neighborhood: 'asa-norte',
  has_elevator: true,
  has_parking: true,
  photo: null,
};
function harness(outcomes: ('succeeded' | 'failed')[] = ['succeeded']) {
  const calls: { name: string; value: unknown }[] = [];
  let fresh = true;
  const store = {
    claim: async () => ({
      run_id: 'run',
      token: 1,
      kind: 'collect',
      profiles: [{
        id: 'profile',
        name: 'Test',
        enabled: true,
        params,
        providers: outcomes.map((_, i) => 'source' + i),
      }],
    }),
    renew: async () => {},
    listings: async () => [],
    save: async (_r: unknown, items: Property[]) => {
      calls.push({ name: 'save', value: items });
      const n = fresh ? items : [];
      fresh = false;
      return n;
    },
    source: async (_r: unknown, value: unknown) => {
      calls.push({ name: 'source', value });
    },
    finish: async (_r: unknown, state: string, email: string) => {
      calls.push({ name: 'finish', value: { state, email } });
    },
    heartbeat: async () => {},
  };
  const providers = (_id: string) => ({
    collect: async () => ({
      properties: [listing],
      outcome: outcomes[Number(_id.slice(-1))],
      error: outcomes[Number(_id.slice(-1))] === 'failed' ? 'blocked' : null,
    }),
    verify: async () => ({ verification: 'unknown' }),
  });
  const sendEmail = async (items: Property[]) => {
    calls.push({ name: 'email', value: items });
    return { success: true };
  };
  return { calls, store, providers, sendEmail };
}
Deno.test('AC31 all profile requirements use observed attributes', () => {
  assert.equal(matchesProfile(listing, params), true);
  for (
    const key of [
      'area',
      'rooms',
      'suites',
      'neighborhood',
      'has_elevator',
      'has_parking',
      'price_cents',
    ]
  ) {
    assert.equal(
      matchesProfile({ ...listing, [key]: null }, params),
      false,
      key,
    );
  }
  assert.equal(matchesProfile({ ...listing, area: 80 }, params), false);
});
Deno.test('AC37 worker polls within 30 seconds', async () => {
  const h = harness();
  let polls = 0;
  const sleeps: number[] = [];
  await pollWorker({
    ...h,
    store: {
      ...h.store,
      claim: async () => {
        polls++;
        return null;
      },
    },
    sleep: async (ms: number) => {
      sleeps.push(ms);
    },
    shouldStop: () => polls === 2,
  });
  assert.equal(polls, 2);
  assert.ok(sleeps.every((x) => x <= 30000));
});
Deno.test('AC41 worker continues without browser connection', async () => {
  const h = harness();
  await executeRun('worker', h);
  assert.ok(h.calls.some((x) => x.name === 'finish'));
  assert.ok(h.calls.some((x) => x.name === 'save'));
});
Deno.test('AC44 partial run retains successful source results', async () => {
  const h = harness(['succeeded', 'failed']);
  const r = await executeRun('collect', h);
  assert.equal(r.state, 'partial');
  assert.equal(
    (h.calls.find((x) => x.name === 'save')!.value as unknown[]).length,
    1,
  );
});
Deno.test('AC45 all sources fail without removal writes', async () => {
  const h = harness(['failed', 'failed']);
  const r = await executeRun('collect', h);
  assert.equal(r.state, 'failed');
  assert.equal(h.calls.filter((x) => x.name === 'save').length, 0);
});
Deno.test('AC46 CLI outcomes map to exit codes and summary IDs', async () => {
  assert.equal(exitCode('succeeded'), 0);
  assert.equal(exitCode('partial'), 1);
  assert.equal(exitCode('failed'), 1);
  assert.equal(exitCode('busy'), 2);
  const r = await executeRun('collect', harness());
  assert.equal(r.run_id, 'run');
  assert.match(r.summary, /run/);
  assert.match(r.summary, /succeeded/);
});
Deno.test('AC47 failed database claim makes zero provider requests', async () => {
  const h = harness();
  let n = 0;
  await assert.rejects(
    () =>
      executeRun('collect', {
        ...h,
        store: {
          ...h.store,
          claim: () => Promise.reject(new Error('database unavailable')),
        },
        providers: () => {
          n++;
          return h.providers('source0');
        },
      }),
    /database/,
  );
  assert.equal(n, 0);
});
Deno.test('AC48 bounded retry timeout and 403 behavior', async () => {
  assert.equal(REQUEST_TIMEOUT_MS, 30000);
  for (const status of [429, 500, 503, 403]) {
    let n = 0;
    const sleeps: number[] = [];
    await assert.rejects(() =>
      fetchWithRetry('https://example.test', {
        fetch: async () => {
          n++;
          return new Response('', { status });
        },
        sleep: async (ms) => {
          sleeps.push(ms);
        },
      })
    );
    assert.equal(n, status === 403 ? 1 : 3);
    assert.deepEqual(sleeps, status === 403 ? [] : [2000, 4000]);
  }
  let n = 0;
  await assert.rejects(() =>
    fetchWithRetry('https://example.test', {
      fetch: async () => {
        n++;
        throw new TypeError('network');
      },
      sleep: async () => {},
    })
  );
  assert.equal(n, 3);
  await assert.rejects(() =>
    fetchWithRetry('https://example.test', {
      timeoutMs: 5,
      fetch: (_u, init) =>
        new Promise((_res, rej) =>
          (init as { signal: AbortSignal }).signal.addEventListener(
            'abort',
            () => rej((init as { signal: AbortSignal }).signal.reason),
          )
        ),
      sleep: async () => {},
    })
  );
});
Deno.test('AC49 diagnostics contain categories without sensitive values', () => {
  for (
    const text of [
      'Bearer secret-token',
      'SUPABASE_SERVICE_ROLE_KEY=abc',
      'https://bad.test/?api_key=secret',
      'unexpected error',
    ]
  ) {
    const d = sanitizeDiagnostic(new Error(text));
    assert.ok(
      ['network', 'blocked', 'timeout', 'parse', 'http', 'internal'].includes(
        d,
      ),
    );
    assert.ok(!d.includes(text));
  }
});
Deno.test('AC50 both provider fixtures emit structured observations and null unknowns', async () => {
  for (const source of ['dfimoveis', 'wimoveis'] as const) {
    const html = await Deno.readTextFile('tests/fixtures/' + source + '.html');
    const p = parsePropertyHtml(
      html,
      'https://www.' +
        (source === 'dfimoveis' ? 'dfimoveis.com.br' : 'wimoveis.com.br') +
        '/imovel/123?tracking=x',
      source,
    );
    assert.equal(p.price_cents, 120000000);
    assert.equal(p.area, 100);
    assert.equal(p.rooms, 3);
    assert.equal(p.neighborhood, 'asa-norte');
    assert.equal(p.suites, 1);
    assert.equal(p.has_elevator, true);
    assert.equal(p.has_parking, true);
    assert.equal(p.source, source);
    assert.ok(!p.link.includes('?'));
    const empty = parsePropertyHtml('<h1>Sem detalhes</h1>', p.link, source);
    for (
      const k of [
        'area',
        'rooms',
        'suites',
        'neighborhood',
        'photo',
        'has_elevator',
        'has_parking',
      ]
    ) assert.equal(empty[k as keyof typeof empty], null);
  }
});
Deno.test('AC63 only new listings sent through existing email boundary', async () => {
  const h = harness();
  await executeRun('collect', h);
  await executeRun('collect', h);
  assert.equal(h.calls.filter((x) => x.name === 'email').length, 1);
  assert.deepEqual(h.calls.find((x) => x.name === 'email')!.value, [listing]);
});
Deno.test('AC64 email failure keeps committed listings and never resends', async () => {
  const h = harness();
  let count = 0;
  await executeRun('collect', {
    ...h,
    sendEmail: async () => {
      count++;
      return { success: false, error: 'delivery' };
    },
  });
  assert.equal(count, 1);
  assert.ok(h.calls.find((x) => x.name === 'save'));
  assert.deepEqual(h.calls.find((x) => x.name === 'finish')!.value, {
    state: 'succeeded',
    email: 'failed',
  });
});
