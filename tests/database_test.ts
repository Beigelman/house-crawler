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
