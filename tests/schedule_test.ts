import assert from 'node:assert/strict';
import * as local from './local.ts';

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
      .sql`select private.property_schedule_slot(${now}::timestamptz) as slot`;
    assert.equal(
      new Date(row.slot).toISOString(),
      new Date(expected).toISOString(),
    );
  }
});

Deno.test('SCHED-02/03 concurrent polls persist one enabled-profile job and never replay completed slots', async () => {
  await local.reset();
  await local
    .sql`insert into property_profile(name,enabled,params,providers) select 'Disabled',false,params,providers from property_profile limit 1`;
  const results = await Promise.all(
    Array.from(
      { length: 4 },
      () => local.rpc('enqueue_scheduled_property_crawl', {}),
    ),
  );
  assert.ok(results.every((r) => r.status === 200));
  assert.equal(results.filter((r) => r.body.outcome === 'accepted').length, 1);
  const rows = await local.sql`select * from property_request`;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].owner_id, local.owner);
  assert.equal(rows[0].state, 'queued');
  assert.deepEqual([...rows[0].profile_ids], [local.profile]);
  await local.sql`update property_request set state='succeeded'`;
  const replay = await local.rpc('enqueue_scheduled_property_crawl', {});
  assert.equal(replay.body.outcome, 'replayed');
  assert.equal(replay.body.request_id, rows[0].id);
  assert.equal((await local.sql`select * from property_request`).length, 1);
});

Deno.test('SCHED-04 active manual work defers scheduled work; empty setup enqueues nothing', async () => {
  await local.reset();
  await local.sql`delete from private.property_owner`;
  assert.equal(
    (await local.rpc('enqueue_scheduled_property_crawl', {})).body.outcome,
    'no_owner',
  );
  assert.equal((await local.sql`select * from property_request`).length, 0);
  await local.reset();
  await local.sql`update property_profile set enabled=false`;
  assert.equal(
    (await local.rpc('enqueue_scheduled_property_crawl', {})).body.outcome,
    'no_profiles',
  );
  assert.equal((await local.sql`select * from property_request`).length, 0);
  await local.reset();
  const manual = await local.rpc('enqueue_property_crawl', {
    request_key: crypto.randomUUID(),
    profile_ids: [local.profile],
  }, await local.token());
  assert.equal(manual.body.outcome, 'accepted');
  for (const state of ['queued', 'running']) {
    await local.sql`update property_request set state=${state}`;
    assert.equal(
      (await local.rpc('enqueue_scheduled_property_crawl', {})).body.outcome,
      'busy',
    );
    assert.equal((await local.sql`select * from property_request`).length, 1);
  }
  await local.sql`update property_request set state='succeeded'`;
  assert.equal(
    (await local.rpc('enqueue_scheduled_property_crawl', {})).body.outcome,
    'accepted',
  );
  assert.equal((await local.sql`select * from property_request`).length, 2);
});

Deno.test('SCHED-06 scheduled enqueue denies anonymous and authenticated callers', async () => {
  await local.reset();
  for (const jwt of [local.config.ANON_KEY, await local.token()]) {
    const r = await local.rpc('enqueue_scheduled_property_crawl', {}, jwt);
    assert.equal(r.status, jwt === local.config.ANON_KEY ? 401 : 403);
  }
  assert.equal((await local.sql`select * from property_request`).length, 0);
});

globalThis.addEventListener('unload', () => void local.sql.end());
