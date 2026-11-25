import assert from 'node:assert/strict';
import * as local from '../support/local.ts';
import { propertyStore } from '../../src/property/persistence/supabase-property-store.ts';
import { pollWorker } from '../../src/runtime/poll-worker.ts';

Deno.test('SCHED-01 Brasília slots include exact boundaries and midnight catch-up', async () => {
  const cases = [
    ['2026-11-19T08:59:59Z', '2026-11-19T01:00:00Z'],
    ['2026-11-19T09:00:00Z', '2026-11-19T09:00:00Z'],
    ['2026-11-19T16:59:59Z', '2026-11-19T09:00:00Z'],
    ['2026-11-19T17:00:00Z', '2026-11-19T17:00:00Z'],
    ['2026-11-20T00:59:59Z', '2026-11-19T17:00:00Z'],
    ['2026-11-20T01:00:00Z', '2026-11-20T01:00:00Z'],
    ['2026-11-20T03:00:00Z', '2026-11-20T01:00:00Z'],
  ];
  for (const [now, expected] of cases) {
    const [row] = await local
      .sql`select private.schedule_slot(${now}::timestamptz) as slot`;
    assert.equal(
      new Date(row.slot).toISOString(),
      new Date(expected).toISOString(),
    );
  }
});

Deno.test('SCHED-02/03 concurrent polls persist one enabled-profile job and never replay completed slots', async () => {
  await local.reset();
  const secondProfile = '44444444-4444-4444-8444-444444444444';
  await local
    .sql`insert into saved_searches select (jsonb_populate_record(null::saved_searches,to_jsonb(s)||jsonb_build_object('id',${secondProfile}::text,'name','Second search'))).* from saved_searches s limit 1`;
  await local
    .sql`insert into saved_searches select (jsonb_populate_record(null::saved_searches,to_jsonb(s)||jsonb_build_object('id',gen_random_uuid(),'name','Disabled','enabled',false))).* from saved_searches s limit 1`;
  const results = await Promise.all(
    Array.from(
      { length: 4 },
      () => local.rpc('enqueue_scheduled_crawl', {}),
    ),
  );
  assert.ok(results.every((r) => r.status === 200));
  assert.equal(results.filter((r) => r.body.outcome === 'accepted').length, 1);
  const rows = await local.sql`select * from crawl_jobs`;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].trigger, 'scheduled');
  assert.equal(rows[0].requested_by, null);
  assert.equal(rows[0].state, 'queued');
  assert.deepEqual([...rows[0].search_ids], [local.profile, secondProfile]);
  await local.sql`update crawl_jobs set state='succeeded'`;
  const replay = await local.rpc('enqueue_scheduled_crawl', {});
  assert.equal(replay.body.outcome, 'replayed');
  assert.equal(replay.body.job_id, rows[0].id);
  assert.equal((await local.sql`select * from crawl_jobs`).length, 1);
});

Deno.test('SCHED-04 active manual work defers scheduled work; empty setup enqueues nothing', async () => {
  await local.reset();
  await local.sql`update saved_searches set enabled=false`;
  assert.equal(
    (await local.rpc('enqueue_scheduled_crawl', {})).body.outcome,
    'no_profiles',
  );
  assert.equal((await local.sql`select * from crawl_jobs`).length, 0);
  await local.reset();
  const manual = await local.rpc('enqueue_crawl', {
    request_key: crypto.randomUUID(),
    search_ids: [local.profile],
  }, await local.token());
  assert.equal(manual.body.outcome, 'accepted');
  for (const state of ['queued', 'running']) {
    await local.sql`update crawl_jobs set state=${state}`;
    assert.equal(
      (await local.rpc('enqueue_scheduled_crawl', {})).body.outcome,
      'busy',
    );
    assert.equal((await local.sql`select * from crawl_jobs`).length, 1);
  }
  await local.sql`update crawl_jobs set state='succeeded'`;
  assert.equal(
    (await local.rpc('enqueue_scheduled_crawl', {})).body.outcome,
    'accepted',
  );
  assert.equal((await local.sql`select * from crawl_jobs`).length, 2);
});

Deno.test('SCHED-06 scheduled enqueue denies anonymous and authenticated callers', async () => {
  await local.reset();
  for (const jwt of [local.config.ANON_KEY, await local.token()]) {
    const r = await local.rpc('enqueue_scheduled_crawl', {}, jwt);
    assert.equal(r.status, jwt === local.config.ANON_KEY ? 401 : 403);
  }
  assert.equal((await local.sql`select * from crawl_jobs`).length, 0);
});

Deno.test('SCHED-05 real worker adapter schedules, claims and completes a durable job', async () => {
  await local.reset();
  const store = propertyStore(local.admin);
  let stopped = false;
  await pollWorker({
    schedule: store.schedule,
    store: {
      ...store,
      finish: async (run, state, email) => {
        await store.finish(run, state, email);
        stopped = true;
      },
    },
    providers: () => ({
      collect: () =>
        Promise.resolve({ properties: [], outcome: 'succeeded', error: null }),
      verify: () => Promise.resolve({ last_check_result: 'unknown' }),
    }),
    sendEmail: () => Promise.resolve({ success: true }),
    shouldStop: () => stopped,
  });
  const [row] = await local
    .sql`select state, search_snapshot from crawl_jobs`;
  assert.equal(row.state, 'succeeded');
  assert.deepEqual(row.search_snapshot.map((p: { id: string }) => p.id), [
    local.profile,
  ]);
});

globalThis.addEventListener('unload', () => void local.sql.end());

Deno.test('SCHED-05/07 actual worker CLI schedules by default with no manual request', async () => {
  await local.reset();
  const root = new URL('../..', import.meta.url).pathname;
  const cwd = await Deno.makeTempDir({ prefix: 'scheduled-worker-' });
  const worker = new Deno.Command(Deno.execPath(), {
    args: [
      'run',
      '-A',
      '--config=' + root + 'deno.json',
      '--preload=' + root + 'tests/support/cli_preload.ts',
      root + 'src/worker.ts',
    ],
    cwd,
    env: { PROPERTY_TEST_MODE: 'scheduled' },
    stdout: 'piped',
    stderr: 'piped',
  }).spawn();
  const output = worker.output();
  try {
    const deadline = Date.now() + 15000;
    let rows: { state: string }[] = [];
    do {
      rows = await local.sql`select state from crawl_jobs`;
      if (rows[0]?.state === 'succeeded') break;
      await new Promise((r) => setTimeout(r, 100));
    } while (Date.now() < deadline);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].state, 'succeeded');
    const [run] = await local.sql`select state from crawl_jobs`;
    assert.equal(run.state, 'succeeded');
  } finally {
    worker.kill('SIGTERM');
    await output;
    await Deno.remove(cwd, { recursive: true });
  }
});
