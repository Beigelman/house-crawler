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
} from './local.ts';
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
  return await rpc('enqueue_property_crawl', {
    request_key: key,
    profile_ids: ids,
  }, await token());
}

test('AC03 private tables and enqueue deny non-owner and missing JWT', async () => {
  for (const jwt of [await token(other), config.ANON_KEY]) {
    for (
      const table of [
        'real_states',
        'property_mark',
        'property_profile',
        'property_run',
        'property_request',
        'property_price',
        'property_match',
        'property_source_run',
        'property_heartbeat',
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
    const r = await rpc('enqueue_property_crawl', {
      request_key: crypto.randomUUID(),
      profile_ids: [profile],
    }, jwt);
    assert.equal(r.status, jwt === config.ANON_KEY ? 401 : 403);
  }
});
test('AC05 migration preserves legacy data on repeated application', async () => {
  await sql`insert into real_states(link,titulo,valor,created_at) values('https://legacy.test/1','Original','R$ 1.234.567,89','2024-01-02T00:00:00Z')`;
  const migration = await Deno.readTextFile(
    (await Array.fromAsync(Deno.readDir('supabase/migrations'))).filter((x) =>
        x.name.endsWith('_property_interface.sql')
      )[0]
      ? 'supabase/migrations/' +
        (await Array.fromAsync(Deno.readDir('supabase/migrations'))).find((x) =>
          x.name.endsWith('_property_interface.sql')
        )!.name
      : 'missing',
  );
  await sql.unsafe(migration);
  await sql.unsafe(migration);
  const [r] = await sql`select link,titulo,valor,created_at from real_states`;
  assert.equal(r.link, 'https://legacy.test/1');
  assert.equal(r.titulo, 'Original');
  assert.equal(r.valor, 'R$ 1.234.567,89');
  assert.equal(r.created_at.toISOString(), '2024-01-02T00:00:00.000Z');
  assert.equal(
    (await sql`select * from property_price where legacy`).length,
    1,
  );
});
test('AC06 exact BRL migration parser', async () => {
  assert.equal(
    Number((await sql`select private.parse_brl('R$ 1.234.567,89') as n`)[0].n),
    123456789,
  );
});
test('AC07 missing ranged and malformed prices stay null', async () => {
  for (const v of ['', null, 'R$ 1.000 a 2.000', 'Consultar', '1.234,567']) {
    assert.equal((await sql`select private.parse_brl(${v}) as n`)[0].n, null);
  }
});
test('AC23 long note rejected without changing persisted note', async () => {
  await sql`insert into real_states(link,titulo,valor) values('x','x','x')`;
  await sql`insert into property_mark(user_id,listing_link,note) values(${owner},'x','before')`;
  await assert.rejects(() =>
    sql`update property_mark set note=${
      'x'.repeat(2001)
    } where listing_link='x'`
  );
  assert.equal((await sql`select note from property_mark`)[0].note, 'before');
});
test('AC28 invalid profile writes are atomic', async () => {
  const [p] = await sql`select * from property_profile`;
  const bad = [
    { ...p.params, neighborhoods: [] },
    { ...p.params, numberOfRooms: [] },
    { ...p.params, numberOfRooms: [0] },
    { ...p.params, numberOfRooms: [11] },
    { ...p.params, numberOfSuites: 11 },
    { ...p.params, minPrice: -1 },
    { ...p.params, minArea: 151 },
    { ...p.params, maxPrice: 1 },
  ];
  for (const params of bad) {
    await assert.rejects(() =>
      sql`update property_profile set params=${
        sql.json(params)
      }::jsonb where id=${profile}`
    );
  }
  for (const providers of [[], ['unknown']]) {
    await assert.rejects(() =>
      sql`update property_profile set providers=${providers} where id=${profile}`
    );
  }
  for (const name of ['', 'x'.repeat(81)]) {
    await assert.rejects(() =>
      sql`update property_profile set name=${name} where id=${profile}`
    );
  }
  assert.deepEqual(
    (await sql`select params from property_profile`)[0].params,
    p.params,
  );
});
test('AC29 default profile preserves current search configuration', async () => {
  await sql`delete from property_profile`;
  await rpc('seed_property_profile', {});
  const [p] = await sql`select * from property_profile`;
  assert.deepEqual(p.providers, ['dfimoveis', 'wimoveis']);
  assert.deepEqual(p.params, {
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
  await sql`update property_profile set name='Changed'`;
  assert.equal(
    (await sql`select profiles from property_run where id=${r.run_id}`)[0]
      .profiles[0].name,
    'Minha busca',
  );
});
test('AC32 enqueue accepted only after durable request', async () => {
  const r = await enqueue();
  assert.equal(r.status, 200);
  assert.equal(r.body.outcome, 'accepted');
  assert.equal(
    (await sql`select state from property_request where id=${r.body.request_id}`)[
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
  assert.equal(a.body.request_id, b.body.request_id);
  assert.equal((await sql`select * from property_request`).length, 1);
});
test('AC34 reused key with changed payload returns 400', async () => {
  const k = crypto.randomUUID();
  await enqueue(k);
  const r = await enqueue(k, []);
  assert.equal(r.status, 400);
  assert.equal((await sql`select * from property_request`).length, 1);
});
test('AC35 one active manual request returns busy', async () => {
  const a = await enqueue();
  const b = await enqueue();
  assert.equal(b.body.outcome, 'busy');
  assert.equal(b.body.request_id, a.body.request_id);
  assert.equal((await sql`select * from property_request`).length, 1);
});
test('AC36 new requests limited for 60 seconds', async () => {
  await enqueue();
  await sql`update property_request set state='succeeded'`;
  const r = await enqueue();
  assert.equal(r.body.outcome, 'rate_limited');
  assert.ok(r.body.retry_after_seconds > 0 && r.body.retry_after_seconds <= 60);
});
test('AC38 manual collection scheduled collection and validation share one lease', async () => {
  await enqueue();
  const results = await Promise.all(
    ['collect', 'validate', 'worker'].map((p_kind) =>
      rpc('claim_property_run', { p_kind })
    ),
  );
  assert.equal(results.filter((r) => r.body !== null).length, 1);
  assert.equal(
    (await sql`select * from property_run where state='running'`).length,
    1,
  );
});
test('AC39 expired fencing token cannot save run data', async () => {
  const r = await begin();
  await sql`update private.property_lease set expires_at=now()-interval '1 second'`;
  assert.equal((await save(r, [item()])).status, 400);
  assert.equal((await sql`select * from real_states`).length, 0);
});
test('AC40 takeover interrupts expired run and request', async () => {
  await enqueue();
  const r = await rpc('claim_property_run', { p_kind: 'worker' });
  await sql`update private.property_lease set expires_at=now()-interval '1 second'`;
  await begin();
  assert.equal(
    (await sql`select state from property_run where id=${r.body.run_id}`)[0]
      .state,
    'interrupted',
  );
  assert.equal(
    (await sql`select state from property_request`)[0].state,
    'interrupted',
  );
});
test('AC51 price change updates current price and appends history', async () => {
  let r = await begin();
  await save(r, [item()]);
  await rpc('finish_property_run', {
    p_run: r.run_id,
    p_token: r.token,
    p_state: 'succeeded',
    p_email: 'not_needed',
  });
  r = await begin();
  await save(r, [item(undefined, 110000000)]);
  assert.equal(
    Number((await sql`select price_cents from real_states`)[0].price_cents),
    110000000,
  );
  assert.equal((await sql`select * from property_price`).length, 2);
});
test('AC52 same price and retry do not duplicate observations', async () => {
  const r = await begin();
  await save(r, [item()]);
  await save(r, [item()]);
  assert.equal((await sql`select * from property_price`).length, 1);
});
test('AC53 unknown price preserves last known price timestamp', async () => {
  const r = await begin();
  await save(r, [item()]);
  const [before] =
    await sql`select price_cents,price_observed_at from real_states`;
  await save(r, [{ ...item(), price_cents: null, valor: 'Sob consulta' }]);
  const [after] =
    await sql`select price_cents,price_observed_at from real_states`;
  assert.deepEqual(after, before);
});
test('AC54 confirmed removal retains history and marks', async () => {
  const r = await begin('validate');
  await save(r, [item()]);
  await sql`insert into property_mark(user_id,listing_link,status) values(${owner},${item().link},'favorite')`;
  await save(r, [{ ...item(), verification: 'removed' }]);
  assert.equal(
    (await sql`select availability from real_states`)[0].availability,
    'removed',
  );
  assert.equal((await sql`select * from property_price`).length, 1);
  assert.equal((await sql`select * from property_mark`).length, 1);
});
test('AC55 unknown verification preserves confirmed availability', async () => {
  const r = await begin();
  await save(r, [item()]);
  await save(r, [{ link: item().link, verification: 'unknown' }]);
  const [p] = await sql`select availability,verification from real_states`;
  assert.equal(p.availability, 'active');
  assert.equal(p.verification, 'unknown');
});
test('AC56 reappearing listing retains same identity and history', async () => {
  const r = await begin();
  await save(r, [item()]);
  await save(r, [{ ...item(), verification: 'removed' }]);
  await save(r, [item()]);
  assert.equal(
    (await sql`select availability from real_states`)[0].availability,
    'active',
  );
  assert.equal((await sql`select * from real_states`).length, 1);
  assert.equal((await sql`select * from property_price`).length, 1);
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
  await rpc('finish_property_run', {
    p_run: r.run_id,
    p_token: r.token,
    p_state: 'succeeded',
    p_email: 'not_needed',
  });
  return (await sql`select * from real_states where link=${item().link}`)[0];
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
test('AC62 comparison recomputed before completion', async () => {
  await cohort(5);
  const [r] = await sql`select finished_at,state from property_run`;
  const [p] = await sql`select comparison_at from real_states limit 1`;
  assert.equal(r.state, 'succeeded');
  assert.ok(p.comparison_at <= r.finished_at);
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
    await sql`insert into real_states(link,titulo,valor) values('https://www.wimoveis.com.br/imovel/p','p','R$ 1')`;
    await enqueue();
    const results = await Promise.all(
      ['collect', 'validate', 'worker'].map((kind) =>
        new Deno.Command('rtk', {
          args: ['deno', 'run', '-A', 'tests/contender.ts', kind],
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

const { default: postgres } = await import('postgres');
const migrationText = () =>
  Deno.readTextFile(
    'supabase/migrations/20261117235107_property_interface.sql',
  );
async function legacyDatabase(
  values: { link: string; titulo: string; valor: string; created_at: string }[],
  proof: (db: ReturnType<typeof postgres>) => Promise<void>,
) {
  const name = 'property_legacy_' + crypto.randomUUID().replaceAll('-', '');
  await sql.unsafe('create database ' + name);
  const db = postgres(config.DB_URL.replace(/\/postgres$/, '/' + name), {
    max: 1,
    onnotice: () => {},
  });
  try {
    await db.unsafe(
      "create schema auth; create function auth.uid() returns uuid language sql as 'select null::uuid';create table real_states(link text primary key,titulo text not null,valor text not null,created_at timestamptz default now());",
    );
    for (const row of values) await db`insert into real_states ${db(row)}`;
    const original =
      await db`select link,titulo,valor,created_at from real_states order by link`;
    await db.unsafe(await migrationText());
    await db.unsafe(await migrationText());
    assert.deepEqual(
      await db`select link,titulo,valor,created_at from real_states order by link`,
      original,
    );
    await proof(db);
  } finally {
    await db.end();
    await sql.unsafe('drop database ' + name);
  }
}
const legacyRows = [{
  link: 'https://legacy.test/a',
  titulo: 'Primeiro',
  valor: 'R$ 1.234.567,89',
  created_at: '2020-01-02T03:04:05Z',
}, {
  link: 'https://legacy.test/b',
  titulo: 'Segundo',
  valor: 'Sob consulta',
  created_at: '2021-02-03T04:05:06Z',
}];
Deno.test({
  name: 'AC05 genuine legacy schema retains the complete projection twice',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: () =>
    legacyDatabase(legacyRows, async (db) => {
      assert.equal((await db`select * from real_states`).length, 2);
      assert.equal(
        (await db`select * from property_price where legacy`).length,
        1,
      );
    }),
});
Deno.test({
  name: 'AC06 migrated legacy row stores exact centavos',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: () =>
    legacyDatabase([legacyRows[0]], async (db) => {
      assert.equal(
        Number((await db`select price_cents from real_states`)[0].price_cents),
        123456789,
      );
    }),
});
Deno.test({
  name: 'AC07 migrated absent ranged and malformed prices stay null',
  sanitizeResources: false,
  sanitizeOps: false,
  fn: () =>
    legacyDatabase(
      ['', 'R$ 1.000 a 2.000', 'Consultar', '1.234,567'].map((valor, i) => ({
        ...legacyRows[0],
        link: 'https://legacy.test/' + i,
        valor,
      })),
      async (db) => {
        const rows = await db`select price_cents from real_states`;
        assert.equal(rows.length, 4);
        assert.ok(rows.every((r) => r.price_cents === null));
      },
    ),
});
test('AC03 populated reads direct writes and worker RPCs reject non-owner', async () => {
  const run = await begin();
  await save(run, [item()]);
  await sql`insert into property_mark(user_id,listing_link,status) values(${owner},${item().link},'favorite')`;
  await sql`insert into property_heartbeat(singleton) values(true)`;
  await rpc('record_property_source', {
    p_run: run.run_id,
    p_token: run.token,
    p_source: 'wimoveis',
    p_profile: profile,
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
  await enqueue();
  const tables = [
    'property_request',
    'real_states',
    'property_mark',
    'property_profile',
    'property_run',
    'property_price',
    'property_match',
    'property_source_run',
    'property_heartbeat',
  ];
  for (const table of tables) {
    assert.ok((await sql.unsafe('select * from ' + table)).length > 0, table);
    const res = await fetch(config.API_URL + '/rest/v1/' + table, { headers });
    assert.deepEqual(await res.json(), [], table);
  }
  const patchFields: Record<string, unknown> = {
    property_request: { state: 'interrupted' },
    real_states: { titulo: 'intrusion' },
    property_mark: { note: 'intrusion' },
    property_profile: { name: 'intrusion' },
    property_run: { state: 'failed' },
    property_price: { price_cents: 1 },
    property_match: { profile_id: profile },
    property_source_run: { error_category: 'intrusion' },
    property_heartbeat: { seen_at: '2000-01-01T00:00:00Z' },
  };
  for (const table of tables) {
    const beforeRows = await sql.unsafe('select * from ' + table);
    const pk = table === 'real_states'
      ? 'link'
      : table === 'property_mark' || table === 'property_match'
      ? 'listing_link'
      : table === 'property_heartbeat'
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
  assert.equal((await rpc('seed_property_profile', {}, jwt)).status, 403);
  const before = await sql`select titulo from real_states`;
  for (const method of ['PATCH', 'DELETE']) {
    const res = await fetch(
      config.API_URL + '/rest/v1/real_states?link=eq.' +
        encodeURIComponent(item().link),
      {
        method,
        headers,
        body: method === 'PATCH'
          ? JSON.stringify({ titulo: 'intrusion' })
          : undefined,
      },
    );
    const body = await res.json();
    assert.ok(res.status >= 400 || Array.isArray(body) && body.length === 0);
  }
  const insert = await fetch(config.API_URL + '/rest/v1/property_profile', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'intrusion',
      params: (await sql`select params from property_profile`)[0].params,
      providers: ['wimoveis'],
    }),
  });
  assert.ok(insert.status >= 400);
  const mark = await fetch(config.API_URL + '/rest/v1/property_mark', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      user_id: other,
      listing_link: item().link,
      status: 'favorite',
    }),
  });
  assert.ok(mark.status >= 400);
  for (
    const [name, args] of [
      ['claim_property_run', { p_kind: 'collect' }],
      ['save_property_batch', {
        p_run: run.run_id,
        p_token: run.token,
        p_items: [],
        p_profile: null,
      }],
      ['finish_property_run', {
        p_run: run.run_id,
        p_token: run.token,
        p_state: 'succeeded',
        p_email: 'sent',
      }],
      ['renew_property_lease', { p_run: run.run_id, p_token: run.token }],
      ['record_property_source', {
        p_run: run.run_id,
        p_token: run.token,
        p_source: 'x',
        p_profile: null,
        p_count: 0,
        p_outcome: 'failed',
        p_error: null,
      }],
    ] as const
  ) assert.equal((await rpc(name, args, jwt)).status, 403);
  assert.deepEqual(await sql`select titulo from real_states`, before);
  assert.equal((await sql`select * from property_mark`).length, 1);
});
test('AC28 all invalid profile families preserve every stored field', async () => {
  const [original] = await sql`select * from property_profile`;
  const p = original.params;
  const invalid = [
    { ...p, neighborhoods: ['unknown'] },
    { ...p, neighborhoods: [null] },
    { ...p, numberOfRooms: [1.5] },
    { ...p, numberOfRooms: [-1] },
    { ...p, numberOfSuites: -1 },
    { ...p, numberOfSuites: 0.5 },
    ...['minArea', 'maxArea', 'minPrice', 'maxPrice'].flatMap(
      (k) => [
        { ...p, [k]: -1 },
        { ...p, [k]: null },
        { ...p, [k]: 'Infinity' },
        { ...p, [k]: 'NaN' },
      ],
    ),
  ];
  for (const params of invalid) {
    await assert.rejects(() =>
      sql`update property_profile set params=${
        sql.json(params)
      },name='changed' where id=${profile}`
    );
    assert.deepEqual((await sql`select * from property_profile`)[0], original);
  }
});
test('AC35 running request remains the sole busy identity', async () => {
  const a = await enqueue();
  await rpc('claim_property_run', { p_kind: 'worker' });
  const b = await enqueue();
  assert.equal(b.body.outcome, 'busy');
  assert.equal(b.body.request_id, a.body.request_id);
  assert.equal((await sql`select * from property_request`).length, 1);
});
test('AC36 rate boundary preserves identity below sixty and accepts beyond sixty', async () => {
  const a = await enqueue();
  await sql`update property_request set state='succeeded',created_at=clock_timestamp()-interval '59 seconds'`;
  const denied = await enqueue();
  assert.equal(denied.body.outcome, 'rate_limited');
  assert.equal((await sql`select * from property_request`).length, 1);
  assert.equal(
    (await sql`select id from property_request`)[0].id,
    a.body.request_id,
  );
  await sql`update property_request set created_at=clock_timestamp()-interval '60 seconds'`;
  const accepted = await enqueue();
  assert.equal(accepted.body.outcome, 'accepted');
  assert.equal((await sql`select * from property_request`).length, 2);
});
test('AC39 every fenced run mutation rejects expired ownership atomically', async () => {
  await enqueue();
  const r = (await rpc('claim_property_run', { p_kind: 'worker' })).body;
  await save(r, [item()]);
  await sql`update private.property_lease set expires_at=clock_timestamp()-interval '1 second'`;
  const before = await sql`select * from property_run`;
  const listingBefore = await sql`select * from real_states`;
  const requestBefore = await sql`select * from property_request`;
  for (
    const [name, args] of [['renew_property_lease', {
      p_run: r.run_id,
      p_token: r.token,
    }], ['record_property_source', {
      p_run: r.run_id,
      p_token: r.token,
      p_source: 'x',
      p_profile: null,
      p_count: 99,
      p_outcome: 'failed',
      p_error: 'bad',
    }], ['finish_property_run', {
      p_run: r.run_id,
      p_token: r.token,
      p_state: 'succeeded',
      p_email: 'sent',
    }], ['save_property_batch', {
      p_run: r.run_id,
      p_token: r.token,
      p_items: [item(undefined, 1)],
      p_profile: profile,
    }]] as const
  ) assert.equal((await rpc(name, args)).status, 400);
  assert.deepEqual(await sql`select * from property_run`, before);
  assert.deepEqual(await sql`select * from real_states`, listingBefore);
  assert.deepEqual(await sql`select * from property_request`, requestBefore);
  assert.equal((await sql`select * from property_source_run`).length, 0);
});
test('AC51 changed observation is bound to the second run and exact value', async () => {
  let r = await begin();
  await save(r, [item()]);
  await rpc('finish_property_run', {
    p_run: r.run_id,
    p_token: r.token,
    p_state: 'succeeded',
    p_email: 'not_needed',
  });
  r = await begin();
  await save(r, [item(undefined, 110000000)]);
  const rows = await sql`select * from property_price where run_id=${r.run_id}`;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].listing_link, item().link);
  assert.equal(Number(rows[0].price_cents), 110000000);
});
test('AC52 unchanged price in a new run appends no observation', async () => {
  const first = await begin();
  await save(first, [item()]);
  await rpc('finish_property_run', {
    p_run: first.run_id,
    p_token: first.token,
    p_state: 'succeeded',
    p_email: 'not_needed',
  });
  const second = await begin();
  await save(second, [item()]);
  await save(second, [item()]);
  assert.equal((await sql`select * from property_price`).length, 1);
  assert.equal(
    (await sql`select * from property_price where run_id=${second.run_id}`)
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
      { area: 0 },
      { price_cents: 0 },
      { rooms: 4 },
      { neighborhood: 'asa-sul' },
    ].entries()
  ) {
    await sql`insert into real_states ${
      sql({
        link: 'https://excluded.test/' + i,
        titulo: 'Excluded',
        valor: 'x',
        availability: 'active',
        area: 100,
        price_cents: 1,
        rooms: 3,
        neighborhood: 'asa-norte',
        ...extra,
      })
    }`;
  }
  await rpc('finish_property_run', {
    p_run: r.run_id,
    p_token: r.token,
    p_state: 'succeeded',
    p_email: 'not_needed',
  });
  const [p] = await sql`select * from real_states where link=${item().link}`;
  assert.equal(p.peer_count, 5);
  assert.equal(Number(p.median_m2), 12000);
  assert.equal(Number(p.discount_pct), 25);
});
test('AC62 committed price change refreshes comparisons before completion', async () => {
  await cohort(5);
  const r = await begin();
  await save(r, [item('https://peer.test/0', 200000000)]);
  await rpc('finish_property_run', {
    p_run: r.run_id,
    p_token: r.token,
    p_state: 'succeeded',
    p_email: 'not_needed',
  });
  const [p] = await sql`select * from real_states where link=${item().link}`;
  const [run] = await sql`select * from property_run where id=${r.run_id}`;
  assert.equal(Number(p.median_m2), 13000);
  assert.ok(Math.abs(Number(p.discount_pct) - 100 / 13) < 1e-8);
  assert.equal(run.state, 'succeeded');
  assert.ok(p.comparison_at <= run.finished_at);
});
for (const code of ['AC58', 'AC59']) {
  Deno.test({
    name: code + ' comparison crosses the rendered detail boundary',
    sanitizeResources: false,
    sanitizeOps: false,
    fn: async () => {
      const { browserProof } = await import('./browser_proof.ts');
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
      ' actual provider verification persists each classified outcome',
    sanitizeResources: false,
    sanitizeOps: false,
    fn: async () => {
      const { validationCase } = await import('./provider_boundary.ts');
      for (const mode of modes) await validationCase(mode);
    },
  });
}
