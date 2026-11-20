import type { SearchRow } from '../../../shared/search.ts';
import { matchesProfile } from '../../src/property/domain/matches-profile.ts';
import { fromSearchRow } from '../../../shared/search.ts';
import assert from 'node:assert/strict';
import type { ScrapedListing } from '../../../shared/property.ts';
import { executeRun } from '../../src/property/application/execute-run.ts';
import { pollWorker } from '../../src/runtime/poll-worker.ts';
import { listing } from '../support/property-fixtures.ts';
// Boundary regressions use the production persistence adapter, not callback counts.
const local = await import('../support/local.ts');
const { propertyStore } = await import(
  '../../src/property/persistence/supabase-property-store.ts'
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
function realDeps(properties: ScrapedListing[] = [listing]) {
  return {
    store: propertyStore(local.admin),
    providers: () => ({
      collect: () =>
        Promise.resolve({ properties, outcome: 'succeeded', error: null }),
      verify: () => Promise.resolve({ last_check_result: 'active' }),
    }),
    sendEmail: () => Promise.resolve({ success: true }),
    sleep: () => Promise.resolve(),
  };
}
boundary(
  'AC31 current observations match searches without persisted memberships',
  async () => {
    await local
      .sql`update saved_searches set sources=array['wimoveis'], bedrooms=array[3], neighborhoods=array['asa-norte'],min_suites=1,has_parking=true`;
    const deps = realDeps();
    await executeRun('collect', deps);
    assert.equal(await matchingListings(), 1);
    await executeRun('collect', realDeps([{ ...listing, area_m2: 80 }]));
    assert.equal(await matchingListings(), 0);
    for (
      const key of [
        'price_cents',
        'area_m2',
        'bedrooms',
        'neighborhood',
        'suites',
        'has_parking',
        'has_elevator',
      ]
    ) {
      const search = fromSearchRow(
        (await local.sql`select * from saved_searches`)[0] as SearchRow,
      );
      assert.equal(
        matchesProfile({ ...listing, [key]: null }, search.params),
        false,
        key,
      );
    }
    for (
      const invalid of [
        { area_m2: 151 },
        { bedrooms: 4 },
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
        await matchingListings(),
        0,
        JSON.stringify(invalid),
      );
    }
  },
);
boundary(
  'AC63 new identity matching a later profile still receives one notification',
  async () => {
    await local.sql`update saved_searches set sources=array['wimoveis']`;
    await local
      .sql`update saved_searches set bedrooms=array[4]`;
    await local
      .sql`insert into saved_searches select (jsonb_populate_record(null::saved_searches,to_jsonb(s)||jsonb_build_object('id','44444444-4444-4444-8444-444444444444','name','Later','bedrooms',jsonb_build_array(3)))).* from saved_searches s`;
    let n = 0;
    const payloads: ScrapedListing[][] = [];
    const deps = {
      ...realDeps(),
      sendEmail: (items: ScrapedListing[]) => {
        n++;
        payloads.push(items);
        return Promise.resolve({ success: true });
      },
    };
    await executeRun('collect', deps);
    assert.equal((await local.sql`select * from listings`).length, 1);
    assert.equal(await matchingListings(), 1);
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
        verify: () => Promise.resolve({ last_check_result: 'active' }),
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
        verify: () => Promise.resolve({ last_check_result: 'active' }),
      }),
    });
    assert.equal(r.state, 'partial');
    assert.equal(
      (await local.sql`select state from crawl_jobs`)[0].state,
      'partial',
    );
    assert.equal(
      (await local.sql`select url from listings`)[0].url,
      listing.url,
    );
    const sources = await local
      .sql`select source,outcome,count from crawl_source_runs order by source`;
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
        '../../src/property/providers/wimoveis.ts'
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
        .sql`select * from crawl_source_runs where job_id=${r.job_id}`;
      assert.equal(rows.length, 2);
      assert.ok(
        rows.every((row) =>
          row.error_category === 'timeout' && row.job_id === r.job_id
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
        verify: () => Promise.resolve({ last_check_result: 'active' }),
      }),
    });
    const runs = await local.sql`select * from crawl_jobs`;
    const sources = await local.sql`select * from crawl_source_runs`;
    assert.equal(runs[0].id, r.job_id);
    assert.equal(sources.length, 2);
    assert.ok(
      sources.every((s) =>
        s.job_id === r.job_id && ['dfimoveis', 'wimoveis'].includes(s.source) &&
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
        title: 'Apartamento Asa Norte',
        url: 'https://www.' +
          (source === 'dfimoveis' ? 'dfimoveis.com.br' : 'wimoveis.com.br') +
          '/imovel/123',
        source,
        source_listing_id: '123',
        price_cents: 120000000,
        area_m2: 100,
        bedrooms: 3,
        suites: 1,
        neighborhood: 'asa-norte',
        photo_url: 'https://example.test/photo.jpg',
        has_elevator: true,
        has_parking: true,
      });
      const empty = await collectedAdapter(source, true);
      assert.equal(empty.price_cents, null);
      assert.equal(empty.photo_url, null);
      assert.equal(empty.price_cents, null);
    }
  },
});
async function withEmailCapture(
  fail: boolean,
  fn: (
    send:
      typeof import('../../src/property/notifications/send-property-email.ts').sendNewPropertiesEmail,
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
      '../../src/property/notifications/send-property-email.ts'
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
    await local.sql`update saved_searches set sources=array['wimoveis']`;
    await local
      .sql`update saved_searches set bedrooms=array[4]`;
    await local
      .sql`insert into saved_searches select (jsonb_populate_record(null::saved_searches,to_jsonb(s)||jsonb_build_object('id','44444444-4444-4444-8444-444444444444','name','Later','bedrooms',jsonb_build_array(3)))).* from saved_searches s`;
    await withEmailCapture(false, async (send, calls) => {
      await executeRun('collect', { ...realDeps(), sendEmail: send });
      assert.equal(calls.length, 1);
      assert.deepEqual(calls[0].to, ['one@example.test', 'two@example.test']);
      assert.equal(calls[0].from, 'radar@example.test');
      assert.ok(String(calls[0].html).includes(listing.url));
      await executeRun('collect', {
        ...realDeps([{ ...listing, price_cents: 110000000 }]),
        sendEmail: send,
      });
      assert.equal(calls.length, 1);
      assert.equal((await local.sql`select * from listings`).length, 1);
      assert.equal(
        Number(
          (await local.sql`select price_cents from listings`)[0].price_cents,
        ),
        110000000,
      );
      assert.equal(
        (await local.sql`select * from listing_price_history`).length,
        2,
      );
    });
  },
);
boundary(
  'AC64 failed real email adapter preserves durable data through a later idle worker poll',
  async () => {
    await local.rpc('enqueue_crawl', {
      request_key: crypto.randomUUID(),
      search_ids: [local.profile],
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
          verify: () => Promise.resolve({ last_check_result: 'active' }),
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
      assert.equal((await local.sql`select * from listings`).length, 1);
      const [run] = await local
        .sql`select * from crawl_jobs where id=${r.job_id}`;
      assert.equal(run.state, 'succeeded');
      assert.equal(run.email_state, 'failed');
      assert.equal(
        (await local.sql`select state from crawl_jobs`)[0].state,
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
            .sql`insert into listings(url,title,source) values('https://www.dfimoveis.com.br/imovel/123','DF','dfimoveis'),('https://www.wimoveis.com.br/imovel/123','WI','wimoveis')`;
        }
        let busyId: string | null = null;
        if (mode === 'busy') busyId = (await local.begin()).job_id;
        const result = await commandEntry(entry, mode);
        assert.equal(result.code, code, result.out + result.err);
        assert.match(result.out, new RegExp(state));
        const runId = busyId ??
          (await local
            .sql`select id from crawl_jobs order by started_at desc limit 1`)[
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

async function matchingListings() {
  const searches = (await local.sql`select * from saved_searches`).map((row) =>
    fromSearchRow(row as SearchRow)
  );
  return (await local.sql`select * from listings`).filter((row) =>
    searches.some((s) => matchesProfile(row as ScrapedListing, s.params))
  ).length;
}

boundary(
  'MODEL11 unexpected persistence failure finalizes the job and releases its lease',
  async () => {
    const deps = realDeps([{ ...listing, price_cents: -1 }]);
    await assert.rejects(() => executeRun('collect', deps), /23514/);
    const [job] = await local.sql`select * from crawl_jobs`;
    assert.equal(job.state, 'failed');
    assert.equal(job.email_state, 'not_needed');
    assert.equal(job.error_category, 'database');
    assert.ok(job.finished_at);
    const [worker] = await local
      .sql`select *, lease_expires_at='-infinity'::timestamptz as released from private.worker_state`;
    assert.equal(worker.job_id, null);
    assert.equal(worker.released, true);
    assert.equal((await local.sql`select * from crawl_source_runs`).length, 0);
    assert.equal((await local.sql`select * from listings`).length, 0);
  },
);
