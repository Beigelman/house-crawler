import assert from 'node:assert/strict';
import type { Property } from '../../shared/property.ts';
import { executeRun } from '../../backend/src/property/application/execute-run.ts';
import { pollWorker } from '../../backend/src/runtime/poll-worker.ts';
import { listing, params } from '../support/property-fixtures.ts';
// Boundary regressions use the production persistence adapter, not callback counts.
const local = await import('../support/local.ts');
const { propertyStore } = await import(
  '../../backend/src/property/persistence/supabase-property-store.ts'
);
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
      const { WimoveisProvider } = await import(
        '../../backend/src/property/providers/wimoveis.ts'
      );
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
    const { collectedAdapter } = await import(
      '../support/provider_boundary.ts'
    );
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
    send:
      typeof import('../../backend/src/property/notifications/send-property-email.ts').sendNewPropertiesEmail,
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
    const { sendNewPropertiesEmail } = await import(
      '../../backend/src/property/notifications/send-property-email.ts'
    );
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
  const root = new URL('../..', import.meta.url).pathname;
  try {
    const r = await new Deno.Command('rtk', {
      args: [
        'deno',
        'run',
        '-A',
        '--config=' + root + 'deno.json',
        '--preload=' + root + 'tests/support/cli_preload.ts',
        root + 'backend/src/' + entry,
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
    const { browserProof } = await import('../support/browser_proof.ts');
    await browserProof('AC41');
  },
});
