import { fromSearchRow, toSearchRow } from '../../../shared/search.ts';
import type { SearchRow } from '../../../shared/search.ts';
import assert from 'node:assert/strict';
import {
  begin,
  config,
  item,
  other,
  owner,
  profile,
  reset,
  rpc,
  save,
  sql,
  token,
} from '../support/local.ts';
const test = (name: string, fn: () => Promise<void>) =>
  Deno.test({
    name,
    sanitizeResources: false,
    sanitizeOps: false,
    fn: async () => {
      await reset();
      await fn();
    },
  });
async function enqueue(key = crypto.randomUUID(), ids = [profile]) {
  return await rpc('enqueue_crawl', {
    request_key: key,
    search_ids: ids,
  }, await token());
}

test('AC03 private tables and enqueue deny non-owner and missing JWT', async () => {
  for (const jwt of [await token(other), config.ANON_KEY]) {
    for (
      const table of [
        'listings',
        'listing_marks',
        'saved_searches',
        'crawl_jobs',
        'crawl_jobs',
        'listing_price_history',
        'crawl_source_runs',
      ]
    ) {
      const r = await fetch(
        config.API_URL + '/rest/v1/' + table + '?select=*',
        {
          headers: { apikey: config.ANON_KEY, Authorization: 'Bearer ' + jwt },
        },
      );
      const data = await r.json();
      assert.ok(
        r.status >= 400 || (Array.isArray(data) && data.length === 0),
        table,
      );
    }
    const r = await rpc('enqueue_crawl', {
      request_key: crypto.randomUUID(),
      search_ids: [profile],
    }, jwt);
    assert.equal(r.status, jwt === config.ANON_KEY ? 401 : 403);
  }
});
test('MODEL01 fresh schema has exactly eight application tables', async () => {
  const rows =
    await sql`select schemaname,tablename from pg_tables where schemaname in ('public','private') order by schemaname,tablename`;
  assert.deepEqual(rows.map((r) => r.schemaname + '.' + r.tablename), [
    'private.app_owner',
    'private.worker_state',
    'public.crawl_jobs',
    'public.crawl_source_runs',
    'public.listing_marks',
    'public.listing_price_history',
    'public.listings',
    'public.saved_searches',
  ]);
});
test('MODEL02 canonical listing fields exclude legacy and derived values', async () => {
  const rows =
    await sql`select column_name from information_schema.columns where table_schema='public' and table_name='listings'`;
  const fields = rows.map((r) => r.column_name);
  for (
    const field of [
      'id',
      'url',
      'title',
      'source_listing_id',
      'first_seen_at',
      'last_checked_at',
      'removed_at',
    ]
  ) assert.ok(fields.includes(field));
  for (
    const field of ['valor', 'titulo', 'legacy', 'median_m2', 'discount_pct']
  ) assert.ok(!fields.includes(field));
});
test('MODEL03 unknown prices remain null on a first observation', async () => {
  const r = await begin();
  await save(r, [{ ...item(), price_cents: null }]);
  assert.equal(
    (await sql`select price_cents from listings`)[0].price_cents,
    null,
  );
  assert.equal((await sql`select * from listing_price_history`).length, 0);
});
test('AC23 long note rejected without changing persisted note', async () => {
  await sql`insert into listings(url,title,source) values('x','x','wimoveis')`;
  await sql`insert into listing_marks(user_id,listing_id,note) select ${owner},id,'before' from listings where url='x'`;
  await assert.rejects(() =>
    sql`update listing_marks set note=${
      'x'.repeat(2001)
    } where listing_id=(select id from listings where url='x')`
  );
  assert.equal((await sql`select note from listing_marks`)[0].note, 'before');
});
test('AC28 invalid typed search writes are atomic', async () => {
  const [original] = await sql`select * from saved_searches`;
  for (
    const patch of [
      { neighborhoods: [] },
      { bedrooms: [] },
      { bedrooms: [0] },
      { bedrooms: [11] },
      { min_suites: 11 },
      { min_price_cents: -1 },
      { min_area_m2: 151 },
      { max_price_cents: 1 },
      { sources: [] },
      { sources: ['unknown'] },
      { name: '' },
      { name: 'x'.repeat(81) },
      { notification_emails: ['valid@example.test', 'invalid'] },
      { notification_emails: ['one@example.test,two@example.test'] },
      { notification_emails: [null] },
    ]
  ) {
    await assert.rejects(() =>
      sql`update saved_searches set ${sql(patch)} where id=${profile}`
    );
    assert.deepEqual((await sql`select * from saved_searches`)[0], original);
  }
});
test('AC29 default profile preserves current search configuration', async () => {
  await sql`delete from saved_searches`;
  await rpc('seed_saved_search', {});
  const [p] = await sql`select * from saved_searches`;
  assert.deepEqual(p.sources, ['dfimoveis', 'wimoveis']);
  assert.deepEqual(fromSearchRow(p as SearchRow).params, {
    neighborhoods: ['asa-norte', 'asa-sul', 'octogonal'],
    numberOfRooms: [3, 4],
    numberOfSuites: 0,
    hasElevator: true,
    hasParking: false,
    minArea: 90,
    maxArea: 150,
    minPrice: 1000000,
    maxPrice: 1400000,
  });
});
test('AC30 running configuration is immutable snapshot', async () => {
  const r = await begin();
  await sql`update saved_searches set name='Changed'`;
  assert.equal(
    (await sql`select search_snapshot from crawl_jobs where id=${r.job_id}`)[0]
      .search_snapshot[0].name,
    'Minha busca',
  );
});
test('AC32 enqueue accepted only after durable request', async () => {
  const r = await enqueue();
  assert.equal(r.status, 200);
  assert.equal(r.body.outcome, 'accepted');
  assert.equal(
    (await sql`select state from crawl_jobs where id=${r.body.job_id}`)[
      0
    ].state,
    'queued',
  );
});
test('AC33 idempotent replay returns same durable request', async () => {
  const k = crypto.randomUUID();
  const a = await enqueue(k);
  const b = await enqueue(k);
  assert.equal(b.body.outcome, 'replayed');
  assert.equal(a.body.job_id, b.body.job_id);
  assert.equal((await sql`select * from crawl_jobs`).length, 1);
});
test('AC34 reused key with changed payload returns 400', async () => {
  const k = crypto.randomUUID();
  await enqueue(k);
  const r = await enqueue(k, []);
  assert.equal(r.status, 400);
  assert.equal((await sql`select * from crawl_jobs`).length, 1);
});
test('AC35 one active manual request returns busy', async () => {
  const a = await enqueue();
  const b = await enqueue();
  assert.equal(b.body.outcome, 'busy');
  assert.equal(b.body.job_id, a.body.job_id);
  assert.equal((await sql`select * from crawl_jobs`).length, 1);
});
test('AC36 new requests limited for 60 seconds', async () => {
  await enqueue();
  await sql`update crawl_jobs set state='succeeded'`;
  const r = await enqueue();
  assert.equal(r.body.outcome, 'rate_limited');
  assert.ok(r.body.retry_after_seconds > 0 && r.body.retry_after_seconds <= 60);
});
test('AC38 manual collection scheduled collection and validation share one lease', async () => {
  await enqueue();
  const results = await Promise.all(
    ['collect', 'validate', 'worker'].map((p_kind) =>
      rpc('claim_crawl_job', { p_kind })
    ),
  );
  assert.equal(results.filter((r) => r.body !== null).length, 1);
  assert.equal(
    (await sql`select * from crawl_jobs where state='running'`).length,
    1,
  );
});
test('AC39 expired fencing token cannot save run data', async () => {
  const r = await begin();
  await sql`update private.worker_state set lease_expires_at=now()-interval '1 second'`;
  assert.equal((await save(r, [item()])).status, 400);
  assert.equal((await sql`select * from listings`).length, 0);
});
test('AC40 takeover interrupts expired run and request', async () => {
  await enqueue();
  const r = await rpc('claim_crawl_job', { p_kind: 'worker' });
  await sql`update private.worker_state set lease_expires_at=now()-interval '1 second'`;
  await begin();
  assert.equal(
    (await sql`select state from crawl_jobs where id=${r.body.job_id}`)[0]
      .state,
    'interrupted',
  );
  assert.equal(
    (await sql`select state from crawl_jobs`)[0].state,
    'interrupted',
  );
});
test('AC51 price change updates current price and appends history', async () => {
  let r = await begin();
  await save(r, [item()]);
  await rpc('finish_crawl_job', {
    p_job: r.job_id,
    p_token: r.token,
    p_state: 'succeeded',
    p_email: 'not_needed',
  });
  r = await begin();
  await save(r, [item(undefined, 110000000)]);
  assert.equal(
    Number((await sql`select price_cents from listings`)[0].price_cents),
    110000000,
  );
  assert.equal((await sql`select * from listing_price_history`).length, 2);
});
test('AC52 same price and retry do not duplicate observations', async () => {
  const r = await begin();
  await save(r, [item()]);
  await save(r, [item()]);
  assert.equal((await sql`select * from listing_price_history`).length, 1);
});
test('AC53 unknown price preserves last known price timestamp', async () => {
  const r = await begin();
  await save(r, [item()]);
  const [before] =
    await sql`select price_cents,price_observed_at from listings`;
  await save(r, [{ ...item(), price_cents: null }]);
  const [after] = await sql`select price_cents,price_observed_at from listings`;
  assert.deepEqual(after, before);
});
test('AC54 confirmed removal retains history and marks', async () => {
  const r = await begin('validate');
  await save(r, [item()]);
  await sql`insert into listing_marks(user_id,listing_id,status) select ${owner},id,'favorite' from listings where url=${item().url}`;
  await save(r, [{ ...item(), last_check_result: 'removed' }]);
  assert.equal(
    (await sql`select availability from listings`)[0].availability,
    'removed',
  );
  assert.equal((await sql`select * from listing_price_history`).length, 1);
  assert.equal((await sql`select * from listing_marks`).length, 1);
});
test('AC55 unknown last_check_result preserves confirmed availability', async () => {
  const r = await begin();
  await save(r, [item()]);
  await save(r, [{ url: item().url, last_check_result: 'unknown' }]);
  const [p] = await sql`select availability,last_check_result from listings`;
  assert.equal(p.availability, 'active');
  assert.equal(p.last_check_result, 'unknown');
});
test('AC56 reappearing listing retains same identity and history', async () => {
  const r = await begin();
  await save(r, [item()]);
  await save(r, [{ ...item(), last_check_result: 'removed' }]);
  await save(r, [item()]);
  assert.equal(
    (await sql`select availability from listings`)[0].availability,
    'active',
  );
  assert.equal((await sql`select * from listings`).length, 1);
  assert.equal((await sql`select * from listing_price_history`).length, 1);
});
async function cohort(n: number) {
  const r = await begin();
  await save(r, [
    item(),
    ...Array.from(
      { length: n },
      (_, i) => ({
        ...item('https://peer.test/' + i, 100000000 + i * 10000000),
      }),
    ),
  ]);
  await rpc('finish_crawl_job', {
    p_job: r.job_id,
    p_token: r.token,
    p_state: 'succeeded',
    p_email: 'not_needed',
  });
  return (await sql`select * from listing_comparisons where url=${item().url}`)[
    0
  ];
}
test('AC58 five and six peers use subject-excluded median', async () => {
  for (const n of [5, 6]) {
    await reset();
    const p = await cohort(n);
    assert.equal(p.peer_count, n);
    assert.equal(Number(p.median_m2), n === 5 ? 12000 : 12500);
    assert.ok(p.comparison_at);
    assert.equal(p.cohort, 'asa-norte · 3 quartos');
  }
});
test('AC59 four peers cannot produce ranking', async () => {
  const p = await cohort(4);
  assert.equal(p.discount_pct, null);
  assert.equal(p.median_m2, null);
});
test('AC62 comparison is derived at read time after completion', async () => {
  await cohort(5);
  const [r] = await sql`select finished_at,state from crawl_jobs`;
  const [p] = await sql`select comparison_at from listing_comparisons limit 1`;
  assert.equal(r.state, 'succeeded');
  assert.ok(p.comparison_at >= r.finished_at);
});
addEventListener('unload', () => {
  sql.end({ timeout: 0 });
});

Deno.test({
  name: 'AC38 separate OS processes share the production store lease',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: async () => {
    await reset();
    await sql`insert into listings(url,title,source) values('https://www.wimoveis.com.br/imovel/p','p','wimoveis')`;
    await enqueue();
    const results = await Promise.all(
      ['collect', 'validate', 'worker'].map((kind) =>
        new Deno.Command('rtk', {
          args: ['deno', 'run', '-A', 'tests/support/contender.ts', kind],
          stdout: 'piped',
          stderr: 'piped',
        }).output()
      ),
    );
    assert.ok(results.every((r) => r.success));
    const output = results.map((r) => new TextDecoder().decode(r.stdout)).join(
      '',
    );
    assert.equal(output.split('PROVIDER_CONTACT').length - 1, 1);
  },
});

test('MODEL04 portal identity survives URL changes and preserves marks', async () => {
  const r = await begin();
  await save(r, [{ ...item(), source_listing_id: '123' }]);
  const [before] = await sql`select * from listings`;
  await sql`insert into listing_marks(user_id,listing_id,status) values(${owner},${before.id},'favorite')`;
  await save(r, [{
    ...item('https://www.wimoveis.com.br/imovel/renamed'),
    source_listing_id: '123',
  }]);
  const rows = await sql`select * from listings`;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, before.id);
  assert.equal(rows[0].url, 'https://www.wimoveis.com.br/imovel/renamed');
  assert.equal(
    (await sql`select * from listing_marks`)[0].listing_id,
    before.id,
  );
});
test('MODEL05 different portals retain separate identities', async () => {
  const r = await begin();
  await save(r, [{ ...item(), source_listing_id: '123' }, {
    ...item('https://www.dfimoveis.com.br/imovel/123'),
    source: 'dfimoveis',
    source_listing_id: '123',
  }]);
  const rows = await sql`select * from listings`;
  assert.equal(rows.length, 2);
  assert.notEqual(rows[0].id, rows[1].id);
});
test('MODEL06 multiple real price changes within a job retain every observation', async () => {
  const r = await begin();
  for (const price of [120000000, 110000000, 110000000, 100000000]) {
    await save(r, [item(undefined, price)]);
  }
  const rows = await sql`select * from listing_price_history order by id`;
  assert.deepEqual(rows.map((x) => Number(x.price_cents)), [
    120000000,
    110000000,
    100000000,
  ]);
  assert.ok(rows.every((x) => x.job_id === r.job_id));
});
test('AC03 populated reads direct writes and worker RPCs reject non-owner', async () => {
  const run = await begin();
  await save(run, [item()]);
  await sql`insert into listing_marks(user_id,listing_id,status) select ${owner},id,'favorite' from listings where url=${item().url}`;
  await sql`update private.worker_state set seen_at=now()`;
  await rpc('record_crawl_source', {
    p_job: run.job_id,
    p_token: run.token,
    p_source: 'wimoveis',
    p_search: profile,
    p_count: 1,
    p_outcome: 'succeeded',
    p_error: null,
  });
  const jwt = await token(other);
  const headers = {
    apikey: config.ANON_KEY,
    Authorization: 'Bearer ' + jwt,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
  const tables = [
    'crawl_jobs',
    'listings',
    'listing_marks',
    'saved_searches',
    'crawl_jobs',
    'listing_price_history',
    'crawl_source_runs',
  ];
  for (const table of tables) {
    assert.ok((await sql.unsafe('select * from ' + table)).length > 0, table);
    const res = await fetch(config.API_URL + '/rest/v1/' + table, { headers });
    assert.deepEqual(await res.json(), [], table);
  }
  const patchFields: Record<string, unknown> = {
    listings: { title: 'intrusion' },
    listing_marks: { note: 'intrusion' },
    saved_searches: { name: 'intrusion' },
    crawl_jobs: { state: 'failed' },
    listing_price_history: { price_cents: 1 },
    crawl_source_runs: { error_category: 'intrusion' },
  };
  for (const table of tables) {
    const beforeRows = await sql.unsafe('select * from ' + table);
    const pk = table === 'listings'
      ? 'url'
      : table === 'listing_marks'
      ? 'listing_id'
      : table === 'private.worker_state'
      ? 'singleton'
      : 'id';
    for (const method of ['PATCH', 'DELETE']) {
      const response = await fetch(
        config.API_URL + '/rest/v1/' + table + '?' + pk + '=eq.' +
          encodeURIComponent(String(beforeRows[0][pk])),
        {
          method,
          headers,
          body: method === 'PATCH'
            ? JSON.stringify(patchFields[table])
            : undefined,
        },
      );
      const payload = await response.json();
      assert.ok(
        response.status === 403 ||
          response.status === 200 && Array.isArray(payload) &&
            payload.length === 0,
        table + ' ' + method + ' ' + response.status + ' ' +
          JSON.stringify(payload),
      );
      assert.deepEqual(await sql.unsafe('select * from ' + table), beforeRows);
    }
  }
  assert.equal((await rpc('seed_saved_search', {}, jwt)).status, 403);
  const before = await sql`select title from listings`;
  for (const method of ['PATCH', 'DELETE']) {
    const res = await fetch(
      config.API_URL + '/rest/v1/listings?url=eq.' +
        encodeURIComponent(item().url),
      {
        method,
        headers,
        body: method === 'PATCH'
          ? JSON.stringify({ title: 'intrusion' })
          : undefined,
      },
    );
    const body = await res.json();
    assert.ok(res.status >= 400 || Array.isArray(body) && body.length === 0);
  }
  const insert = await fetch(config.API_URL + '/rest/v1/saved_searches', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...toSearchRow(
        fromSearchRow(
          (await sql`select * from saved_searches`)[0] as SearchRow,
        ),
      ),
    }),
  });
  assert.ok(insert.status >= 400);
  const mark = await fetch(config.API_URL + '/rest/v1/listing_marks', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      user_id: other,
      listing_id: (await sql`select id from listings`)[0].id,
      status: 'favorite',
    }),
  });
  assert.ok(mark.status >= 400);
  for (
    const [name, args] of [
      ['claim_crawl_job', { p_kind: 'collect' }],
      ['save_listing_batch', {
        p_job: run.job_id,
        p_token: run.token,
        p_items: [],
        p_search: null,
      }],
      ['finish_crawl_job', {
        p_job: run.job_id,
        p_token: run.token,
        p_state: 'succeeded',
        p_email: 'sent',
      }],
      ['renew_worker_lease', { p_job: run.job_id, p_token: run.token }],
      ['record_crawl_source', {
        p_job: run.job_id,
        p_token: run.token,
        p_source: 'x',
        p_search: null,
        p_count: 0,
        p_outcome: 'failed',
        p_error: null,
      }],
    ] as const
  ) assert.equal((await rpc(name, args, jwt)).status, 403);
  assert.deepEqual(await sql`select title from listings`, before);
  assert.equal((await sql`select * from listing_marks`).length, 1);
});
test('AC28 all invalid typed search families preserve every stored field', async () => {
  const [original] = await sql`select * from saved_searches`;
  const invalid = [
    { neighborhoods: ['unknown'] },
    { neighborhoods: [null] },
    { bedrooms: [null] },
    { bedrooms: [-1] },
    { min_suites: -1 },
    { min_suites: 11 },
    ...['min_area_m2', 'max_area_m2', 'min_price_cents', 'max_price_cents']
      .flatMap(
        (
          k,
        ) => [{ [k]: -1 }, { [k]: null }, { [k]: 'Infinity' }, { [k]: 'NaN' }],
      ),
  ];
  for (const patch of invalid) {
    await assert.rejects(() =>
      sql`update saved_searches set ${
        sql({ ...patch, name: 'changed' })
      } where id=${profile}`
    );
    assert.deepEqual((await sql`select * from saved_searches`)[0], original);
  }
});
test('AC35 running request remains the sole busy identity', async () => {
  const a = await enqueue();
  await rpc('claim_crawl_job', { p_kind: 'worker' });
  const b = await enqueue();
  assert.equal(b.body.outcome, 'busy');
  assert.equal(b.body.job_id, a.body.job_id);
  assert.equal((await sql`select * from crawl_jobs`).length, 1);
});
test('AC36 rate boundary preserves identity below sixty and accepts beyond sixty', async () => {
  const a = await enqueue();
  await sql`update crawl_jobs set state='succeeded',created_at=clock_timestamp()-interval '59 seconds'`;
  const denied = await enqueue();
  assert.equal(denied.body.outcome, 'rate_limited');
  assert.equal((await sql`select * from crawl_jobs`).length, 1);
  assert.equal(
    (await sql`select id from crawl_jobs`)[0].id,
    a.body.job_id,
  );
  await sql`update crawl_jobs set created_at=clock_timestamp()-interval '60 seconds'`;
  const accepted = await enqueue();
  assert.equal(accepted.body.outcome, 'accepted');
  assert.equal((await sql`select * from crawl_jobs`).length, 2);
});
test('AC39 every fenced run mutation rejects expired ownership atomically', async () => {
  await enqueue();
  const r = (await rpc('claim_crawl_job', { p_kind: 'worker' })).body;
  await save(r, [item()]);
  await sql`update private.worker_state set lease_expires_at=clock_timestamp()-interval '1 second'`;
  const before = await sql`select * from crawl_jobs`;
  const listingBefore = await sql`select * from listings`;
  const requestBefore = await sql`select * from crawl_jobs`;
  for (
    const [name, args] of [['renew_worker_lease', {
      p_job: r.job_id,
      p_token: r.token,
    }], ['record_crawl_source', {
      p_job: r.job_id,
      p_token: r.token,
      p_source: 'x',
      p_search: null,
      p_count: 99,
      p_outcome: 'failed',
      p_error: 'bad',
    }], ['finish_crawl_job', {
      p_job: r.job_id,
      p_token: r.token,
      p_state: 'succeeded',
      p_email: 'sent',
    }], ['save_listing_batch', {
      p_job: r.job_id,
      p_token: r.token,
      p_items: [item(undefined, 1)],
      p_search: profile,
    }]] as const
  ) assert.equal((await rpc(name, args)).status, 400);
  assert.deepEqual(await sql`select * from crawl_jobs`, before);
  assert.deepEqual(await sql`select * from listings`, listingBefore);
  assert.deepEqual(await sql`select * from crawl_jobs`, requestBefore);
  assert.equal((await sql`select * from crawl_source_runs`).length, 0);
});
test('AC51 changed observation is bound to the second run and exact value', async () => {
  let r = await begin();
  await save(r, [item()]);
  await rpc('finish_crawl_job', {
    p_job: r.job_id,
    p_token: r.token,
    p_state: 'succeeded',
    p_email: 'not_needed',
  });
  r = await begin();
  await save(r, [item(undefined, 110000000)]);
  const rows =
    await sql`select * from listing_price_history where job_id=${r.job_id}`;
  assert.equal(rows.length, 1);
  assert.equal(
    rows[0].listing_id,
    (await sql`select id from listings where url=${item().url}`)[0].id,
  );
  assert.equal(Number(rows[0].price_cents), 110000000);
});
test('AC52 unchanged price in a new run appends no observation', async () => {
  const first = await begin();
  await save(first, [item()]);
  await rpc('finish_crawl_job', {
    p_job: first.job_id,
    p_token: first.token,
    p_state: 'succeeded',
    p_email: 'not_needed',
  });
  const second = await begin();
  await save(second, [item()]);
  await save(second, [item()]);
  assert.equal((await sql`select * from listing_price_history`).length, 1);
  assert.equal(
    (await sql`select * from listing_price_history where job_id=${second.job_id}`)
      .length,
    0,
  );
});
test('AC58 ineligible peers excluded and subject discount is exact', async () => {
  const r = await begin();
  await save(r, [
    item(undefined, 90000000),
    ...Array.from(
      { length: 5 },
      (_, i) => item('https://peer.test/' + i, 100000000 + i * 10000000),
    ),
  ]);
  for (
    const [i, extra] of [
      { availability: 'removed' },
      { area_m2: 0 },
      { price_cents: 0 },
      { bedrooms: 4 },
      { neighborhood: 'asa-sul' },
    ].entries()
  ) {
    await sql`insert into listings ${
      sql({
        url: 'https://excluded.test/' + i,
        title: 'Excluded',
        source: 'wimoveis',
        availability: 'active',
        area_m2: 100,
        price_cents: 1,
        bedrooms: 3,
        neighborhood: 'asa-norte',
        ...extra,
      })
    }`;
  }
  await rpc('finish_crawl_job', {
    p_job: r.job_id,
    p_token: r.token,
    p_state: 'succeeded',
    p_email: 'not_needed',
  });
  const [p] =
    await sql`select * from listing_comparisons where url=${item().url}`;
  assert.equal(p.peer_count, 5);
  assert.equal(Number(p.median_m2), 12000);
  assert.equal(Number(p.discount_pct), 25);
});
test('AC62 committed price change refreshes comparisons before completion', async () => {
  await cohort(5);
  const r = await begin();
  await save(r, [item('https://peer.test/0', 200000000)]);
  await rpc('finish_crawl_job', {
    p_job: r.job_id,
    p_token: r.token,
    p_state: 'succeeded',
    p_email: 'not_needed',
  });
  const [p] =
    await sql`select * from listing_comparisons where url=${item().url}`;
  const [run] = await sql`select * from crawl_jobs where id=${r.job_id}`;
  assert.equal(Number(p.median_m2), 13000);
  assert.ok(Math.abs(Number(p.discount_pct) - 100 / 13) < 1e-8);
  assert.equal(run.state, 'succeeded');
  assert.ok(p.comparison_at >= run.finished_at);
});
for (const code of ['AC58', 'AC59']) {
  Deno.test({
    name: code + ' comparison crosses the rendered detail boundary',
    sanitizeResources: false,
    sanitizeOps: false,
    fn: async () => {
      const { browserProof } = await import('../support/browser_proof.ts');
      await browserProof(code);
    },
  });
}

for (
  const [code, modes] of [['AC54', ['404', '410', 'removed']], ['AC55', [
    '403',
    'timeout',
    'network',
    'parse',
  ]]] as const
) {
  Deno.test({
    name: code +
      ' actual provider last_check_result persists each classified outcome',
    sanitizeResources: false,
    sanitizeOps: false,
    fn: async () => {
      const { validationCase } = await import(
        '../support/provider_boundary.ts'
      );
      for (const mode of modes) await validationCase(mode);
    },
  });
}

test('AC28 padded names obey raw persisted length and retain a valid eighty-character boundary', async () => {
  const [original] =
    await sql`select * from saved_searches where id=${profile}`;
  try {
    for (
      const name of [
        ' ' + 'x'.repeat(80),
        'x'.repeat(80) + ' ',
        ' '.repeat(10) + 'x'.repeat(71),
        ' '.repeat(80),
      ]
    ) {
      await assert.rejects(() =>
        sql`update saved_searches set name=${name} where id=${profile}`
      );
      assert.deepEqual(
        (await sql`select * from saved_searches where id=${profile}`)[0],
        original,
      );
    }
    const valid = ' ' + 'x'.repeat(79);
    await sql`update saved_searches set name=${valid} where id=${profile}`;
    const [row] =
      await sql`select name,char_length(name) as n from saved_searches where id=${profile}`;
    assert.equal(row.name, valid);
    assert.equal(row.n, 80);
  } finally {
    await sql`update saved_searches set name=${original.name} where id=${profile}`;
  }
});

test('MODEL07 owner health RPC hides coordination state from other identities', async () => {
  await rpc('record_worker_heartbeat', {});
  const health = await rpc('worker_health', {}, await token());
  assert.equal(health.status, 200);
  assert.ok(Math.abs(Date.now() - new Date(health.body).getTime()) < 5000);
  assert.equal(
    (await rpc('worker_health', {}, await token(other))).status,
    403,
  );
  assert.equal(
    (await rpc('record_worker_heartbeat', {}, await token())).status,
    403,
  );
  const hidden = await fetch(config.API_URL + '/rest/v1/worker_state', {
    headers: {
      apikey: config.ANON_KEY,
      Authorization: 'Bearer ' + await token(),
    },
  });
  assert.equal(hidden.status, 404);
  const view = await fetch(config.API_URL + '/rest/v1/listing_comparisons', {
    headers: {
      apikey: config.ANON_KEY,
      Authorization: 'Bearer ' + await token(other),
    },
  });
  assert.deepEqual(await view.json(), []);
});
test('MODEL08 active verification preserves observed price timestamp and clears removal', async () => {
  const r = await begin();
  await save(r, [item()]);
  const [before] = await sql`select * from listings`;
  await save(r, [{ ...item(), last_check_result: 'removed' }]);
  assert.ok((await sql`select removed_at from listings`)[0].removed_at);
  await save(r, [{ ...item(), last_check_result: 'active' }]);
  const [after] = await sql`select * from listings`;
  assert.equal(after.availability, 'active');
  assert.equal(after.removed_at, null);
  assert.deepEqual(after.price_observed_at, before.price_observed_at);
  assert.equal((await sql`select * from listing_price_history`).length, 1);
});
test('MODEL09 concurrent initial seeding creates only one default search', async () => {
  await sql`delete from saved_searches`;
  const results = await Promise.all(
    Array.from({ length: 4 }, () => rpc('seed_saved_search', {})),
  );
  assert.deepEqual(results.map((r) => r.status), [204, 204, 204, 204]);
  assert.equal((await sql`select * from saved_searches`).length, 1);
});
test('MODEL10 queued job keeps its identity through claim and blocks direct CLI bypass', async () => {
  const queued = await enqueue();
  assert.equal(await begin('collect'), null);
  assert.equal(await begin('validate'), null);
  const claimed = await begin('worker');
  assert.equal(claimed.job_id, queued.body.job_id);
  assert.equal((await sql`select * from crawl_jobs`).length, 1);
});
