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

// Boundary regressions use the production persistence adapter, not callback counts.
const local = await import('./local.ts');
const { propertyStore } = await import('../src/property/store.ts');
const boundary = (name: string, fn: () => Promise<void>) =>
  Deno.test({
    name,
    sanitizeResources: false,
    sanitizeOps: false,
    fn: async () => {
      await local.reset();
      await fn();
    },
  });
function realDeps(properties: Property[] = [listing]) {
  return {
    store: propertyStore(local.admin),
    providers: () => ({
      collect: () =>
        Promise.resolve({ properties, outcome: 'succeeded', error: null }),
      verify: () => Promise.resolve({ verification: 'active' }),
    }),
    sendEmail: () => Promise.resolve({ success: true }),
    sleep: () => Promise.resolve(),
  };
}
boundary(
  'AC31 observed nonmatching attributes remove persisted profile membership',
  async () => {
    await local.sql`update property_profile set params=${
      local.sql.json(params)
    },providers=array['wimoveis']`;
    const deps = realDeps();
    await executeRun('collect', deps);
    assert.equal((await local.sql`select * from property_match`).length, 1);
    await executeRun('collect', realDeps([{ ...listing, area: 80 }]));
    assert.equal((await local.sql`select * from property_match`).length, 0);
    for (
      const key of [
        'price_cents',
        'area',
        'rooms',
        'neighborhood',
        'suites',
        'has_parking',
        'has_elevator',
      ]
    ) {
      await executeRun('collect', realDeps());
      await executeRun('collect', realDeps([{ ...listing, [key]: null }]));
      assert.equal(
        (await local.sql`select * from property_match`).length,
        0,
        key,
      );
    }
    for (
      const invalid of [
        { area: 151 },
        { rooms: 4 },
        { suites: 0 },
        { has_elevator: false },
        { has_parking: false },
        { neighborhood: 'asa-sul' },
        { price_cents: 99999999 },
        { price_cents: 140000001 },
      ]
    ) {
      await executeRun('collect', realDeps());
      await executeRun('collect', realDeps([{ ...listing, ...invalid }]));
      assert.equal(
        (await local.sql`select * from property_match`).length,
        0,
        JSON.stringify(invalid),
      );
    }
  },
);
boundary(
  'AC63 new identity matching a later profile still receives one notification',
  async () => {
    await local.sql`update property_profile set providers=array['wimoveis']`;
    await local
      .sql`update property_profile set params=jsonb_set(params,'{numberOfRooms}','[4]')`;
    await local
      .sql`insert into property_profile(id,name,params,providers) select '44444444-4444-4444-8444-444444444444','Later',jsonb_set(params,'{numberOfRooms}','[3]'),providers from property_profile`;
    let n = 0;
    const payloads: Property[][] = [];
    const deps = {
      ...realDeps(),
      sendEmail: (items: Property[]) => {
        n++;
        payloads.push(items);
        return Promise.resolve({ success: true });
      },
    };
    await executeRun('collect', deps);
    assert.equal((await local.sql`select * from real_states`).length, 1);
    assert.equal((await local.sql`select * from property_match`).length, 1);
    assert.equal(n, 1);
    assert.deepEqual(payloads[0], [listing]);
    await executeRun('collect', {
      ...deps,
      providers: () => ({
        collect: () =>
          Promise.resolve({
            properties: [{ ...listing, price_cents: 110000000 }],
            outcome: 'succeeded',
            error: null,
          }),
        verify: () => Promise.resolve({ verification: 'active' }),
      }),
    });
    assert.equal(n, 1);
  },
);
addEventListener('unload', () => {
  local.sql.end({ timeout: 0 });
});

boundary(
  'AC44 mixed providers commit retained listings and partial source outcomes',
  async () => {
    const r = await executeRun('collect', {
      ...realDeps(),
      providers: (id) => ({
        collect: () =>
          Promise.resolve(
            id === 'dfimoveis'
              ? { properties: [], outcome: 'failed', error: 'blocked' }
              : { properties: [listing], outcome: 'succeeded', error: null },
          ),
        verify: () => Promise.resolve({ verification: 'active' }),
      }),
    });
    assert.equal(r.state, 'partial');
    assert.equal(
      (await local.sql`select state from property_run`)[0].state,
      'partial',
    );
    assert.equal(
      (await local.sql`select link from real_states`)[0].link,
      listing.link,
    );
    const sources = await local
      .sql`select source,outcome,count from property_source_run order by source`;
    assert.deepEqual([...sources], [{
      source: 'dfimoveis',
      outcome: 'failed',
      count: 0,
    }, { source: 'wimoveis', outcome: 'succeeded', count: 1 }]);
  },
);
boundary(
  'AC48 default timeout reaches persisted source diagnostics',
  async () => {
    const original = globalThis.fetch;
    const originalTimeout = AbortSignal.timeout;
    const deadlines: number[] = [];
    AbortSignal.timeout = (ms: number) => {
      deadlines.push(ms);
      return originalTimeout.call(AbortSignal, ms);
    };
    globalThis.fetch = (input, init) =>
      String(input).includes('www.wimoveis.com.br')
        ? Promise.reject(new DOMException('timed out', 'TimeoutError'))
        : original(input, init);
    try {
      const { WimoveisProvider } = await import('../src/providers/wimoveis.ts');
      const r = await executeRun('collect', {
        ...realDeps(),
        providers: (_id, p) => {
          const v = new WimoveisProvider(p);
          return {
            collect: () => v.collectOutcome(),
            verify: (u) => v.verify(u),
          };
        },
      });
      const rows = await local
        .sql`select * from property_source_run where run_id=${r.run_id}`;
      assert.equal(rows.length, 2);
      assert.ok(
        rows.every((row) =>
          row.error_category === 'timeout' && row.run_id === r.run_id
        ),
      );
      assert.equal(
        deadlines.filter((ms) => ms === 30000).length,
        6,
      );
    } finally {
      globalThis.fetch = original;
      AbortSignal.timeout = originalTimeout;
    }
  },
);
boundary(
  'AC49 persisted diagnostics retain identifiers without sentinel secret values',
  async () => {
    const secrets = [
      'local-token-sentinel',
      'local-key-sentinel',
      'local-resend-sentinel',
    ];
    const r = await executeRun('collect', {
      ...realDeps(),
      providers: () => ({
        collect: () =>
          Promise.reject(new Error('network ' + secrets.join(' '))),
        verify: () => Promise.resolve({ verification: 'active' }),
      }),
    });
    const runs = await local.sql`select * from property_run`;
    const sources = await local.sql`select * from property_source_run`;
    assert.equal(runs[0].id, r.run_id);
    assert.equal(sources.length, 2);
    assert.ok(
      sources.every((s) =>
        s.run_id === r.run_id && ['dfimoveis', 'wimoveis'].includes(s.source) &&
        s.error_category === 'network'
      ),
    );
    for (const secret of secrets) {
      assert.ok(!JSON.stringify({ runs, sources }).includes(secret));
    }
  },
);
Deno.test({
  name: 'AC50 both existing adapters expose complete and missing observations',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { collectedAdapter } = await import('./provider_boundary.ts');
    for (const source of ['dfimoveis', 'wimoveis'] as const) {
      const p = await collectedAdapter(source);
      assert.deepEqual(p, {
        titulo: 'Apartamento Asa Norte',
        valor: 'R$\u00a01.200.000,00',
        link: 'https://www.' +
          (source === 'dfimoveis' ? 'dfimoveis.com.br' : 'wimoveis.com.br') +
          '/imovel/123',
        source,
        price_cents: 120000000,
        area: 100,
        rooms: 3,
        suites: 1,
        neighborhood: 'asa-norte',
        photo: 'https://example.test/photo.jpg',
        has_elevator: true,
        has_parking: true,
      });
      const empty = await collectedAdapter(source, true);
      assert.equal(empty.price_cents, null);
      assert.equal(empty.photo, null);
      assert.equal(empty.valor, 'Sob consulta');
    }
  },
});
async function withEmailCapture(
  fail: boolean,
  fn: (
    send: typeof import('../src/email/email.ts').sendNewPropertiesEmail,
    calls: Record<string, unknown>[],
  ) => Promise<void>,
) {
  const original = globalThis.fetch;
  const names = ['RESEND_API_KEY', 'FROM_EMAIL', 'TO_EMAILS'];
  const values = names.map((n) => Deno.env.get(n));
  Deno.env.set('RESEND_API_KEY', 're_local-test-sentinel');
  Deno.env.set('FROM_EMAIL', 'radar@example.test');
  Deno.env.set('TO_EMAILS', 'one@example.test,two@example.test');
  const calls: Record<string, unknown>[] = [];
  globalThis.fetch = (input, init) => {
    if (String(input).startsWith('https://api.resend.com/')) {
      calls.push(JSON.parse(String((init as { body?: unknown })?.body)));
      return Promise.resolve(
        new Response(
          JSON.stringify(
            fail
              ? { name: 'validation_error', message: 'local delivery failure' }
              : { id: 'local-mail' },
          ),
          {
            status: fail ? 422 : 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );
    }
    return original(input, init);
  };
  try {
    const { sendNewPropertiesEmail } = await import('../src/email/email.ts');
    await fn(sendNewPropertiesEmail, calls);
  } finally {
    globalThis.fetch = original;
    names.forEach((n, i) =>
      values[i] === undefined ? Deno.env.delete(n) : Deno.env.set(n, values[i]!)
    );
  }
}
boundary(
  'AC63 existing email adapter uses run-wide new matches and environment recipients',
  async () => {
    await local.sql`update property_profile set providers=array['wimoveis']`;
    await local
      .sql`update property_profile set params=jsonb_set(params,'{numberOfRooms}','[4]')`;
    await local
      .sql`insert into property_profile(id,name,params,providers) select '44444444-4444-4444-8444-444444444444','Later',jsonb_set(params,'{numberOfRooms}','[3]'),providers from property_profile`;
    await withEmailCapture(false, async (send, calls) => {
      await executeRun('collect', { ...realDeps(), sendEmail: send });
      assert.equal(calls.length, 1);
      assert.deepEqual(calls[0].to, ['one@example.test', 'two@example.test']);
      assert.equal(calls[0].from, 'radar@example.test');
      assert.ok(String(calls[0].html).includes(listing.link));
      await executeRun('collect', {
        ...realDeps([{ ...listing, price_cents: 110000000 }]),
        sendEmail: send,
      });
      assert.equal(calls.length, 1);
      assert.equal((await local.sql`select * from real_states`).length, 1);
      assert.equal(
        Number(
          (await local.sql`select price_cents from real_states`)[0].price_cents,
        ),
        110000000,
      );
      assert.equal((await local.sql`select * from property_price`).length, 2);
    });
  },
);
boundary(
  'AC64 failed real email adapter preserves durable data through a later idle worker poll',
  async () => {
    await local.rpc('enqueue_property_crawl', {
      request_key: crypto.randomUUID(),
      profile_ids: [local.profile],
    }, await local.token());
    await withEmailCapture(true, async (send, calls) => {
      let contacts = 0;
      const deps = {
        ...realDeps(),
        providers: () => ({
          collect: () => {
            contacts++;
            return Promise.resolve({
              properties: [listing],
              outcome: 'succeeded',
              error: null,
            });
          },
          verify: () => Promise.resolve({ verification: 'active' }),
        }),
        sendEmail: send,
      };
      const r = await executeRun('worker', deps);
      assert.equal(calls.length, 1);
      const before = contacts;
      let polled = false;
      await pollWorker({
        ...deps,
        store: {
          ...deps.store,
          heartbeat: async () => {
            polled = true;
            await deps.store.heartbeat();
          },
        },
        shouldStop: () => polled,
        sleep: () => Promise.resolve(),
      });
      assert.equal(contacts, before);
      assert.equal(calls.length, 1);
      assert.equal((await local.sql`select * from real_states`).length, 1);
      const [run] = await local
        .sql`select * from property_run where id=${r.run_id}`;
      assert.equal(run.state, 'succeeded');
      assert.equal(run.email_state, 'failed');
      assert.equal(
        (await local.sql`select state from property_request`)[0].state,
        'succeeded',
      );
    });
  },
);

async function commandEntry(entry: string, mode: string) {
  const cwd = await Deno.makeTempDir({ prefix: 'property-cli-' });
  const root = new URL('..', import.meta.url).pathname;
  try {
    const r = await new Deno.Command('rtk', {
      args: [
        'deno',
        'run',
        '-A',
        '--config=' + root + 'deno.json',
        '--preload=' + root + 'tests/cli_preload.ts',
        root + 'src/' + entry,
      ],
      cwd,
      env: { PROPERTY_TEST_MODE: mode },
      stdout: 'piped',
      stderr: 'piped',
    }).output();
    return {
      code: r.code,
      out: new TextDecoder().decode(r.stdout),
      err: new TextDecoder().decode(r.stderr),
    };
  } finally {
    await Deno.remove(cwd, { recursive: true });
  }
}
boundary(
  'AC46 both actual CLI entry processes report complete partial failed and busy outcomes',
  async () => {
    for (const entry of ['search_properties.ts', 'validate_properties.ts']) {
      for (
        const [mode, code, state] of [
          ['success', 0, 'succeeded'],
          ['partial', 1, 'partial'],
          ['failed', 1, 'failed'],
          ['busy', 2, 'busy'],
        ] as const
      ) {
        await local.reset();
        if (entry === 'validate_properties.ts') {
          await local
            .sql`insert into real_states(link,titulo,valor) values('https://www.dfimoveis.com.br/imovel/123','DF','R$ 1'),('https://www.wimoveis.com.br/imovel/123','WI','R$ 1')`;
        }
        let busyId: string | null = null;
        if (mode === 'busy') busyId = (await local.begin()).run_id;
        const result = await commandEntry(entry, mode);
        assert.equal(result.code, code, result.out + result.err);
        assert.match(result.out, new RegExp(state));
        const runId = busyId ??
          (await local
            .sql`select id from property_run order by started_at desc limit 1`)[
              0
            ].id;
        assert.ok(result.out.includes(runId));
        if (mode === 'busy') {
          assert.ok(!result.out.includes('TEST_PROVIDER_REQUEST'));
        }
      }
    }
  },
);
boundary(
  'AC47 actual CLI with unreachable database reports database category without provider requests',
  async () => {
    for (const entry of ['search_properties.ts', 'validate_properties.ts']) {
      const r = await commandEntry(entry, 'unreachable');
      assert.equal(r.code, 1);
      assert.match(r.err, /database/);
      assert.ok(!r.out.includes('TEST_PROVIDER_REQUEST'));
    }
  },
);
Deno.test({
  name: 'AC41 browser closure and stopped worker preserve durable queued work',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    const { browserProof } = await import('./browser_proof.ts');
    await browserProof('AC41');
  },
});

Deno.test('AC31 inclusive BRL centavo bounds do not lose a matching boundary', () => {
  const p = { ...listing, price_cents: 29 };
  const s = { ...params, minPrice: 0.29, maxPrice: 0.29 };
  assert.equal(matchesProfile(p, s), true);
});
