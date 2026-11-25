import { fromSearchRow, toSearchRow } from '../../shared/search';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import postgres from 'postgres';
const c = JSON.parse(
  execFileSync('rtk', ['supabase', 'status', '-o', 'json'], {
    cwd: new URL('../../backend/', import.meta.url),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }),
);
const sql = postgres(c.DB_URL, { onnotice: () => {} });
const id = '11111111-1111-4111-8111-111111111111';
const pid = '33333333-3333-4333-8333-333333333333';
const api = createClient(c.API_URL, c.ANON_KEY, {
  auth: { persistSession: false },
});
const admin = createClient(c.API_URL, c.SECRET_KEY, {
  auth: { persistSession: false },
});
const params = {
  neighborhoods: ['asa-norte', 'asa-sul', 'octogonal'],
  numberOfRooms: [3, 4],
  numberOfSuites: 0,
  hasElevator: true,
  hasParking: false,
  minArea: 90,
  maxArea: 150,
  minPrice: 1000000,
  maxPrice: 1400000,
};
let session: unknown;
test.beforeAll(async () => {
  await admin.auth.admin.createUser({
    id,
    email: 'owner@example.test',
    password: 'local-test-password-123',
    email_confirm: true,
  });
  const { data, error } = await api.auth.signInWithPassword({
    email: 'owner@example.test',
    password: 'local-test-password-123',
  });
  if (error) throw error;
  session = data.session;
});
test.afterAll(async () => {
  await sql.end();
});
test.beforeEach(async ({ page }) => {
  // Logout proofs revoke real local Auth sessions. Renew a revoked fixture session.
  const verified = await admin.auth.getUser(
    (session as { access_token: string }).access_token,
  );
  if (verified.error) {
    const signed = await api.auth.signInWithPassword({
      email: 'owner@example.test',
      password: 'local-test-password-123',
    });
    if (signed.error) throw signed.error;
    session = signed.data.session;
  }

  await sql`truncate crawl_jobs,saved_searches,listings restart identity cascade`;
  await sql`insert into private.worker_state(singleton) values(true) on conflict do nothing`;
  await sql`update private.worker_state set lease_expires_at='-infinity',job_id=null,seen_at=null`;
  await sql`insert into private.app_owner(singleton,user_id) values(true,${id}) on conflict(singleton) do update set user_id=excluded.user_id`;
  await sql`insert into saved_searches ${
    sql(
      toSearchRow({
        id: pid,
        name: 'Minha busca',
        enabled: true,
        params,
        providers: ['dfimoveis', 'wimoveis'],
      }),
    )
  }`;
  for (let i = 0; i < 35; i++) {
    await sql`insert into listings(url,title,first_seen_at,price_cents,area_m2,bedrooms,neighborhood,source,availability,last_seen_at) values(${
      'https://portal.test/' + i
    },${'Apartamento ' + String(i).padStart(2, '0')},${new Date(
      Date.now() - i * 1000,
    )},${i === 34 ? null : 120000000 + i * 1000000},100,3,'asa-norte',${
      i % 2 ? 'dfimoveis' : 'wimoveis'
    },'active',now())`;
  }
  await page.addInitScript(
    (s) => {
      if (!sessionStorage.getItem('fixture-seeded')) {
        localStorage.setItem('house-crawler-auth', JSON.stringify(s));
        sessionStorage.setItem('fixture-seeded', 'true');
      }
    },
    session,
  );
});
const list = '/imoveis';
const detail = '/imoveis/' + encodeURIComponent('https://portal.test/0');
const routes = ['/', '/imoveis', detail, '/buscas', '/execucoes'];

test('AC01 login lifecycle and owner route restoration', async ({ page }) => {
  await page.goto('/login?next=%2Fimoveis');
  await expect(page).toHaveURL(/imoveis$/);
  await page.getByRole('button', { name: 'Sair' }).click();
  await page.route('**/auth/v1/otp', async (r) => {
    expect(r.request().postDataJSON().create_user).toBe(false);
    await new Promise((x) => setTimeout(x, 100));
    await r.fulfill({ json: {} });
  });
  await page.getByLabel('Email').fill('owner@example.test');
  await page.getByRole('button', { name: 'Enviar link de acesso' }).click();
  await expect(page.getByText('Enviando link…')).toBeVisible();
  await expect(page.getByText('Confira seu email')).toBeVisible();
});
test('AC01 password login retries invalid credentials and restores the requested route', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('/imoveis?page=2');
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.getByRole('button', { name: 'Entrar com senha' }).click();
  await page.getByLabel('Email').fill('owner@example.test');
  const password = page.getByLabel('Senha', { exact: true });
  const submit = page.getByRole('button', { name: 'Entrar', exact: true });
  await password.fill('incorrect-password');
  await submit.click();
  await expect(page.getByRole('alert')).toContainText(
    'Confira seu email e senha',
  );

  await password.fill('local-test-password-123');
  await submit.click();
  await expect(page).toHaveURL(/\/imoveis\?page=2$/);
  await expect(page.getByRole('button', { name: 'Sair' })).toBeVisible();
});
test('AC02 every private route redirects signed-out without cached records', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/login/);
  for (const route of routes) {
    await page.goto(route);
    await expect(page).toHaveURL(/login/);
    await expect(page.getByText('Apartamento 00')).toHaveCount(0);
  }
});
test('AC04 build bundle contains zero worker secrets', () => {
  const files = readdirSync(new URL('../dist/assets', import.meta.url)).filter(
    (x) => x.endsWith('.js'),
  );
  expect(files.length).toBeGreaterThan(0);
  for (const f of files) {
    const text = readFileSync(
      new URL('../dist/assets/' + f, import.meta.url),
      'utf8',
    );
    expect(text).not.toContain(c.SECRET_KEY);
    expect(text).not.toContain('SUPABASE_SECRET_KEY');
    expect(text).not.toContain('RESEND_API_KEY');
  }
});
test('AC08 default list has 30 newest rows and stable ordering', async ({ page }) => {
  await page.goto(list);
  await expect(page.locator('[data-listing]')).toHaveCount(30);
  await expect(page.locator('[data-listing]').first()).toContainText(
    'Apartamento 00',
  );
  await expect(page.locator('[data-listing]').last()).toContainText(
    'Apartamento 29',
  );
});
test('AC09 all browse filters applied before pagination', async ({ page }) => {
  await sql`insert into listing_marks(user_id,listing_id,status) select ${id},id,'favorite' from listings where url='https://portal.test/2'`;
  await page.goto(
    list +
      '?q=Apartamento&source=wimoveis&minPrice=1000000&maxPrice=1400000&minArea=90&maxArea=110&bedrooms=3&neighborhood=asa-norte&since=2020-01-01&availability=active&mark=favorite',
  );
  await expect(page.locator('[data-listing]')).toHaveCount(1);
  await expect(page.locator('[data-listing]')).toContainText('Apartamento 02');
});
test('AC10 numeric sort puts unknown prices last', async ({ page }) => {
  await page.goto(list + '?sort=price_desc&page=2');
  await expect(page.locator('[data-listing]').last()).toContainText(
    'Apartamento 34',
  );
  await page.goto(list + '?sort=price_asc');
  await expect(page.locator('[data-listing]').first()).toContainText(
    'Apartamento 00',
  );
});
test('AC11 filter order and page survive reload', async ({ page }) => {
  await page.goto(list + '?source=wimoveis&sort=price_asc&page=1');
  await page.reload();
  await expect(page.getByLabel('Fonte')).toHaveValue('wimoveis');
  await expect(page.getByLabel('Ordenar')).toHaveValue('price_asc');
  await expect(page.locator('[data-listing]')).toHaveCount(18);
});
test('AC12 details contain source attributes and observation times', async ({ page }) => {
  await page.goto(detail);
  await expect(page.getByRole('heading', { name: 'Apartamento 00' }))
    .toBeVisible();
  await expect(page.getByRole('link', { name: 'Abrir anúncio original' }))
    .toHaveAttribute('href', 'https://portal.test/0');
  await expect(page.getByText('Não informado').first()).toBeVisible();
  await expect(page.getByText('Primeira coleta')).toBeVisible();
  await expect(page.getByText('Última coleta')).toBeVisible();
});
test('AC13 missing and failed images preserve source url', async ({ page }) => {
  await sql`update listings set photo_url='http://127.0.0.1:1/broken' where url='https://portal.test/0'`;
  await page.goto(list);
  await expect(page.locator('[data-listing]').first().getByText('Sem foto'))
    .toBeVisible();
  await expect(page.locator('[data-listing]').first().getByRole('link'))
    .toBeVisible();
});
test('AC14 dashboard counts source totals and latest outcome', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('35', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Sem execuções')).toBeVisible();
  await expect(page.getByText('DF Imóveis')).toBeVisible();
  await expect(page.getByText('Wimoveis')).toBeVisible();
});
test('AC15 all private screens show labeled initial loading', async ({ page }) => {
  await page.route('**/rest/v1/**', async (r) => {
    if (r.request().url().includes('is_app_owner')) return r.continue();
    await new Promise((x) => setTimeout(x, 350));
    await r.continue();
  });
  for (const route of routes) {
    await page.goto(route);
    await expect(
      page.getByRole('status').filter({ hasText: 'Carregando' }).first(),
    ).toBeVisible();
  }
});
test('AC16 collection screens expose empty states and next actions', async ({ page }) => {
  await sql`truncate listings,saved_searches cascade`;
  for (
    const [route, text] of [
      ['/', 'Nenhum imóvel coletado'],
      [list, 'Nenhum imóvel encontrado'],
      ['/buscas', 'Nenhuma busca salva'],
      ['/execucoes', 'Sem execuções'],
    ]
  ) {
    await page.goto(route);
    await expect(page.getByText(text, { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /busca/i }).first())
      .toBeVisible();
  }
});
test('AC17 all private query failures show retry and not empty', async ({ page }) => {
  await page.route(
    '**/rest/v1/**',
    (r) =>
      r.request().url().includes('is_app_owner')
        ? r.continue()
        : r.fulfill({ status: 500, json: { message: 'database unavailable' } }),
  );
  for (const route of routes) {
    await page.goto(route);
    await expect(
      page.getByRole('alert').filter({ hasText: 'Não foi possível carregar' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tentar novamente' }))
      .toBeVisible();
  }
});
test('AC18 missing listing has return url', async ({ page }) => {
  await page.goto('/imoveis/' + encodeURIComponent('https://missing.test'));
  await expect(page.getByText('Imóvel não encontrado')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Voltar aos imóveis' }))
    .toBeVisible();
});
test('AC19 all screens fit mobile and desktop widths', async ({ page }) => {
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [...routes, '/login']) {
      await page.goto(route);
      await expect(page.locator('main')).toBeVisible();
      expect(
        await page.evaluate(() =>
          document.documentElement.scrollWidth <= innerWidth
        ),
      ).toBe(true);
    }
  }
});
test('AC20 controls have names and visible keyboard focus', async ({ page }) => {
  for (const route of routes) {
    await page.goto(route);
    await page.waitForTimeout(100);
    for (
      const control of await page.locator('button,input,select,textarea').all()
    ) {
      if (!await control.isVisible()) continue;
      const name = await control.evaluate((el) =>
        el.getAttribute('aria-label') ||
        el.getAttribute('id') &&
          document.querySelector('label[for="' + el.id + '"]')?.textContent ||
        el.closest('label')?.textContent || el.textContent
      );
      expect(name?.trim()).toBeTruthy();
    }
    await page.keyboard.press('Tab');
    expect(
      await page.evaluate(() =>
        getComputedStyle(document.activeElement!).outlineStyle
      ),
    ).not.toBe('none');
  }
});
test('AC21 all mark statuses persist reload', async ({ page }) => {
  for (
    const [value, _label] of [['favorite', 'Favorito'], [
      'contacted',
      'Contatado',
    ], ['discarded', 'Descartado']]
  ) {
    await page.goto(detail);
    await page.getByLabel('Status do imóvel').selectOption(value);
    await page.getByRole('button', { name: 'Salvar anotação' }).click();
    await expect(page.getByText('Anotação salva')).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Status do imóvel')).toHaveValue(value);
  }
});
test('AC22 note at 2000 characters persists as plain text', async ({ page }) => {
  const note = '<img src=x onerror=alert(1)>'.padEnd(2000, 'x');
  await page.goto(detail);
  await page.getByLabel('Anotações').fill(note);
  await page.getByRole('button', { name: 'Salvar anotação' }).click();
  await expect(page.getByText('Anotação salva')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Anotações')).toHaveValue(note);
  expect(await page.locator('img[onerror]').count()).toBe(0);
});
test('AC24 failed mark save restores persisted mark', async ({ page }) => {
  await page.goto(detail);
  await page.route(
    '**/rest/v1/listing_marks*',
    (r) =>
      r.request().method() === 'POST'
        ? r.fulfill({ status: 500, json: { message: 'failure' } })
        : r.continue(),
  );
  await page.getByLabel('Status do imóvel').selectOption('favorite');
  await page.getByRole('button', { name: 'Salvar anotação' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Não foi possível salvar' }),
  ).toBeVisible();
  await expect(page.getByLabel('Status do imóvel')).toHaveValue('');
});
test('AC25 clearing mark status preserves note', async ({ page }) => {
  await sql`insert into listing_marks(user_id,listing_id,status,note) select ${id},id,'favorite','Manter' from listings where url='https://portal.test/0'`;
  await page.goto(detail);
  await page.getByLabel('Status do imóvel').selectOption('');
  await page.getByRole('button', { name: 'Salvar anotação' }).click();
  await expect(page.getByText('Anotação salva')).toBeVisible();
  expect((await sql`select status,note from listing_marks`)[0]).toMatchObject({
    status: null,
    note: 'Manter',
  });
});
test('AC26 discard is reversible and no listing delete exists', async ({ page }) => {
  await page.goto(detail);
  await expect(page.getByRole('button', { name: /excluir|deletar/i }))
    .toHaveCount(0);
  await expect(page.getByLabel('Status do imóvel').locator('option[value=""]'))
    .toHaveCount(1);
});
test('AC27 profile saves all editable criteria and reloads', async ({ page }) => {
  await page.goto('/buscas');
  await page.getByLabel('Nome da busca').first().fill('Minha busca atualizada');
  await page.getByRole('button', { name: 'Salvar busca' }).first().click();
  await expect(page.getByText('Busca salva')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Nome da busca').first()).toHaveValue(
    'Minha busca atualizada',
  );
  for (
    const label of [
      'Bairros',
      'Quartos',
      'Suítes mínimas',
      'Área mínima',
      'Área máxima',
      'Preço mínimo',
      'Preço máximo',
      'Exigir elevador',
      'Exigir vaga',
      'DF Imóveis',
      'Wimoveis',
      'Busca ativa',
    ]
  ) await expect(page.getByLabel(label, { exact: true }).first()).toBeVisible();
});
test('AC42 runs list newest and displays source and email outcomes', async ({ page }) => {
  const [r] =
    await sql`insert into crawl_jobs(kind,state,search_snapshot,email_state,started_at,finished_at) values('collect','partial','[]','failed',now(),now()) returning id`;
  await sql`insert into crawl_source_runs(job_id,source,count,outcome,error_category) values(${r.id},'dfimoveis',3,'failed','blocked')`;
  await page.goto('/execucoes');
  await expect(page.getByText('partial', { exact: true })).toBeVisible();
  await expect(page.getByText('Email: failed')).toBeVisible();
  await expect(page.getByText(/blocked/)).toBeVisible();
});
test('validation history summarizes large runs by portal', async ({ page }) => {
  const [run] =
    await sql`insert into crawl_jobs(kind,state,started_at,finished_at)
      values('validate','partial',now(),now()) returning id`;
  await sql`insert into crawl_source_runs(job_id,source,count,outcome)
    select ${run.id}, 'dfimoveis', 1, 'succeeded' from generate_series(1, 1000)`;
  await sql`insert into crawl_source_runs(job_id,source,count,outcome,error_category)
    values (${run.id}, 'dfimoveis', 1, 'failed', 'verification_unknown'),
      (${run.id}, 'wimoveis', 1, 'succeeded', null)`;

  await page.goto('/execucoes');
  const card = page.locator('.runs > article').filter({
    has: page.getByRole('button', { name: /Validação/ }),
  });
  const sources = card.locator('.source-row');
  await expect(sources).toHaveCount(2);
  await expect(sources.filter({ hasText: 'DF Imóveis' }))
    .toContainText('1.001 anúncios · 1 inconclusivo');
  await expect(sources.filter({ hasText: 'Wimoveis' }))
    .toContainText('1 anúncio · 0 inconclusivos');
});
test('AC43 offline heartbeat displays last-seen or never connected', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Nunca conectado')).toBeVisible();
  await sql`update private.worker_state set seen_at=now()-interval '121 seconds'`;
  await page.reload();
  await expect(page.getByText('Offline')).toBeVisible();
  await expect(page.getByText(/Visto em/)).toBeVisible();
});
test('AC57 price changes render in chronological order', async ({ page }) => {
  const [job] =
    await sql`insert into crawl_jobs(state) values('succeeded') returning id`;
  const [listing] =
    await sql`select id from listings where url='https://portal.test/0'`;
  await sql`insert into listing_price_history(listing_id,job_id,price_cents,seen_at) values(${listing.id},${job.id},130000000,'2020-01-01'),(${listing.id},${job.id},120000000,'2021-01-01')`;
  await page.goto(detail);
  await expect(page.locator('[data-price-observation]')).toHaveCount(2);
  await expect(page.locator('[data-price-observation]').first()).toContainText(
    '1.300.000,00',
  );
  await expect(page.locator('[data-price-observation]').last()).toContainText(
    '1.200.000,00',
  );
});
test('AC60 comparison labels collected asking prices and timestamp', async ({ page }) => {
  await page.goto(detail);
  await expect(page.getByText('Preços pedidos dos anúncios coletados'))
    .toBeVisible();
  await expect(page.getByText(/Comparação calculada em/)).toBeVisible();
});
test('AC61 opportunity sorting puts discounts first nulls last', async ({ page }) => {
  await sql`update listings set price_cents=154000000 where url='https://portal.test/34'`;
  await sql`update listings set price_cents=null where url='https://portal.test/0'`;
  await page.goto(list + '?sort=opportunity');
  await expect(page.locator('[data-listing]').first()).toContainText(
    'Apartamento 01',
  );
  await page.goto(list + '?sort=opportunity&page=2');
  await expect(page.locator('[data-listing]').last()).toContainText(
    'Apartamento 00',
  );
});

test('AC19 fully loaded layouts have no overflow and capture review images', async ({ page }) => {
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [i, route] of routes.entries()) {
      await page.goto(route);
      await expect(page.getByRole('heading').first()).toBeVisible();
      await expect(page.getByRole('status').filter({ hasText: 'Carregando' }))
        .toHaveCount(0);
      if (route === list) {
        await expect(page.locator('[data-listing]')).toHaveCount(30);
      }
      expect(
        await page.evaluate(() =>
          document.documentElement.scrollWidth <= innerWidth
        ),
      ).toBe(true);
      if (i === 0 || i === 1) {
        await page.screenshot({
          path: `frontend/test-results/preview-${width}-${i}.png`,
          fullPage: false,
        });
      }
    }
  }
});

// Full-claim boundary proofs supplement the original narrow regression tests.
const stamp = (v: string) =>
  new Date(v).toLocaleString('pt-BR', { timeZone: 'UTC' });
const titles = (page: import('@playwright/test').Page) =>
  page.locator('[data-listing] h3').allTextContents();
const titleFor = (i: number) => 'Apartamento ' + String(i).padStart(2, '0');
test('AC01 actual local magic links complete requested and default callbacks', async ({ browser }) => {
  for (const target of ['/imoveis', '/']) {
    const context = await browser.newContext();
    const p = await context.newPage();
    const generated = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: 'owner@example.test',
      options: {
        redirectTo: 'http://127.0.0.1:5174/login' +
          (target === '/' ? '' : '?next=' + encodeURIComponent(target)),
      },
    });
    if (generated.error) throw generated.error;
    await p.goto(generated.data.properties.action_link);
    await expect(p).toHaveURL('http://127.0.0.1:5174' + target);
    await expect(p.getByRole('button', { name: 'Sair' })).toBeVisible();
    await context.close();
  }
});
test('AC04 harmless server-secret build sentinels stay out of every emitted asset', () => {
  const secrets = {
    SUPABASE_SECRET_KEY: 'server-secret-sentinel-never-public',
    RESEND_API_KEY: 'resend-secret-sentinel-never-public',
  };
  execFileSync('rtk', ['npm', '--prefix', 'frontend', 'run', 'build'], {
    cwd: new URL('../..', import.meta.url),
    env: {
      ...process.env,
      ...secrets,
      VITE_SUPABASE_URL: c.API_URL,
      VITE_SUPABASE_PUBLISHABLE_KEY: c.ANON_KEY,
    },
    stdio: 'pipe',
  });
  const walk = (dir: URL): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory()
        ? walk(new URL(e.name + '/', dir))
        : [readFileSync(new URL(e.name, dir), 'utf8')]
    );
  const emitted = walk(new URL('../dist/', import.meta.url));
  expect(emitted.length).toBeGreaterThan(2);
  for (const content of emitted) {
    for (const secret of Object.values(secrets)) {
      expect(content).not.toContain(secret);
    }
  }
});
test('AC08 equal first-seen timestamps use URL order across pagination', async ({ page }) => {
  await sql`update listings set first_seen_at='2020-01-01'`;
  const expected = Array.from({ length: 35 }, (_, i) => i).sort((a, b) =>
    ('https://portal.test/' + a).localeCompare('https://portal.test/' + b)
  ).map(titleFor);
  await page.goto(list);
  await expect(page.locator('[data-listing]')).toHaveCount(30);
  expect(await titles(page)).toEqual(expected.slice(0, 30));
  await page.goto(list + '?page=2');
  await expect(page.locator('[data-listing]')).toHaveCount(5);
  expect(await titles(page)).toEqual(expected.slice(30));
});
test('AC09 independent filter exclusions and inclusive bounds precede pagination', async ({ page }) => {
  await sql`truncate listings cascade`;
  const base = {
    title: 'Apartamento alvo',
    source: 'wimoveis',
    price_cents: 100000000,
    area_m2: 90,
    bedrooms: 3,
    neighborhood: 'asa-norte',
    first_seen_at: '2024-01-02T00:00:00Z',
    availability: 'active',
  };
  const cases = [
    {},
    { title: 'Apartamento máximo', price_cents: 140000000, area_m2: 150 },
    { title: 'Casa fora' },
    { source: 'dfimoveis' },
    { price_cents: 99999999 },
    { price_cents: 140000001 },
    { area_m2: 89.99 },
    { area_m2: 150.01 },
    { bedrooms: 4 },
    { neighborhood: 'asa-sul' },
    { first_seen_at: '2023-12-31T00:00:00Z' },
    { availability: 'removed' },
    { mark: 'contacted' },
    { mark: null },
    ...Array.from(
      { length: 31 },
      () => ({ title: 'Casa filler', first_seen_at: '2025-01-01T00:00:00Z' }),
    ),
  ];
  for (const [i, extra] of cases.entries()) {
    const { mark = 'favorite', ...fields } = extra as Record<string, unknown>;
    const url = 'https://filter.test/' + i;
    await sql`insert into listings ${sql({ ...base, ...fields, url })}`;
    if (mark) {
      await sql`insert into listing_marks(user_id,listing_id,status) select ${id},id,${
        String(mark)
      } from listings where url=${url}`;
    }
  }
  await page.goto(
    list +
      '?q=Apartamento&source=wimoveis&minPrice=1000000&maxPrice=1400000&minArea=90&maxArea=150&bedrooms=3&neighborhood=asa-norte&since=2024-01-01&availability=active&mark=favorite',
  );
  await expect(page.locator('[data-listing]')).toHaveCount(2);
  expect((await titles(page)).sort()).toEqual(
    ['Apartamento alvo', 'Apartamento máximo'].sort(),
  );
});
test('AC10 both numeric sequences include ties and unknown-last ordering', async ({ page }) => {
  await sql`update listings set availability='removed'`;
  await sql`update listings set availability='active',price_cents=case url when 'https://portal.test/0' then 100000000 when 'https://portal.test/3' then null else 50000000 end where url in ('https://portal.test/0','https://portal.test/1','https://portal.test/2','https://portal.test/3')`;
  for (
    const [sort, order] of [['price_asc', [1, 2, 0, 3]], ['price_desc', [
      0,
      1,
      2,
      3,
    ]]] as const
  ) {
    await page.goto(list + '?availability=active&sort=' + sort);
    await expect(page.locator('[data-listing]')).toHaveCount(4);
    expect(await titles(page)).toEqual(order.map(titleFor));
  }
});
test('AC11 every filter plus nondefault page survives reload and shared URL navigation', async ({ page }) => {
  await sql`update listings set source='wimoveis'`;
  await sql`insert into listing_marks(user_id,listing_id,status) select ${id},id,'favorite' from listings`;
  const path = list +
    '?q=Apartamento&source=wimoveis&minPrice=1000000&maxPrice=2000000&minArea=90&maxArea=150&bedrooms=3&neighborhood=asa-norte&since=2020-01-01&availability=active&mark=favorite&sort=price_desc&page=2';
  await page.goto(path);
  await page.reload();
  for (
    const [label, value] of [
      ['Buscar por título', 'Apartamento'],
      ['Fonte', 'wimoveis'],
      ['Preço mínimo', '1000000'],
      ['Preço máximo', '2000000'],
      ['Área mínima', '90'],
      ['Área máxima', '150'],
      ['Quartos', '3'],
      ['Bairro', 'asa-norte'],
      ['A partir de', '2020-01-01'],
      ['Disponibilidade', 'active'],
      ['Minha seleção', 'favorite'],
      ['Ordenar', 'price_desc'],
    ]
  ) await expect(page.getByLabel(label, { exact: true })).toHaveValue(value);
  await expect(page.getByText('Página 2')).toBeVisible();
  await expect(page.locator('[data-listing]')).toHaveCount(4);
  expect(await titles(page)).toEqual([3, 2, 1, 0].map(titleFor));
  await page.goto('/');
  await page.goto(path);
  await expect(page.getByText('Página 2')).toBeVisible();
  expect(await titles(page)).toEqual([3, 2, 1, 0].map(titleFor));
});
test('AC12 exact detail values include original price and observation times', async ({ page }) => {
  await sql`update listings set price_cents=123456789,area_m2=120,bedrooms=4,suites=2,has_elevator=true,has_parking=false,first_seen_at='2020-01-02T03:04:05Z',last_seen_at='2021-02-03T04:05:06Z',price_observed_at='2021-02-03T04:05:06Z' where url='https://portal.test/0'`;
  await page.goto(detail);
  await expect(page.getByRole('heading', { name: 'R$ 1.234.567,89' }))
    .toBeVisible();
  for (
    const [label, value] of [
      ['Área', '120 m²'],
      ['Quartos', '4'],
      ['Suítes', '2'],
      ['Elevador', 'Sim'],
      ['Vaga', 'Não'],
      ['Primeira coleta', stamp('2020-01-02T03:04:05Z')],
      ['Última coleta', stamp('2021-02-03T04:05:06Z')],
      ['Preço observado em', stamp('2021-02-03T04:05:06Z')],
    ]
  ) {
    await expect(
      page.locator('dt').filter({ hasText: new RegExp('^' + label + '$') })
        .locator('..').locator('dd'),
    ).toHaveText(value);
  }
});
test('AC13 missing and failed photos retain fixed placeholder dimensions', async ({ page }) => {
  let width: number | undefined;
  for (const photo_url of [null, 'http://127.0.0.1:1/broken']) {
    await sql`update listings set photo_url=${photo_url} where url='https://portal.test/0'`;
    await page.goto(list);
    const card = page.locator('[data-listing]').first();
    await expect(card.getByText('Sem foto')).toBeVisible();
    const box = await card.locator('.photo').boundingBox();
    expect(box?.height).toBe(175);
    expect(box!.width).toBeGreaterThan(0);
    if (width) expect(box!.width).toBe(width);
    width = box!.width;
    await expect(card.getByRole('link')).toBeVisible();
  }
});
test('AC14 dashboard scopes exact counts latest outcome and zero defaults', async ({ page }) => {
  await sql`truncate listings cascade`;
  const now = '2026-01-08T12:00:00Z';
  await page.clock.setFixedTime(new Date(now));
  for (
    const [i, state, source, created] of [
      [0, 'active', 'wimoveis', '2026-01-01T12:00:00Z'],
      [1, 'active', 'dfimoveis', '2026-01-01T12:00:00.001Z'],
      [2, 'removed', 'dfimoveis', '2026-01-01T11:59:59.999Z'],
      [3, 'active', 'wimoveis', '2020-01-01'],
    ] as const
  ) {
    await sql`insert into listings(url,title,availability,source,first_seen_at) values(${
      'https://dashboard.test/' + i
    },'Test',${state},${source},${created})`;
  }
  await sql`insert into crawl_jobs(kind,state,search_snapshot,started_at) values('collect','succeeded','[]','2020-01-01'),('collect','partial','[]','2021-01-01')`;
  await page.goto('/');
  await expect(page.locator('.stats article').nth(0).locator('strong'))
    .toHaveText('3');
  await expect(page.locator('.stats article').nth(1).locator('strong'))
    .toHaveText('2');
  for (const name of ['DF Imóveis', 'Wimoveis']) {
    await expect(
      page.locator('.source-row').filter({ hasText: name }).locator('b'),
    ).toHaveText('2');
  }
  await expect(page.getByText('partial', { exact: true })).toBeVisible();
  await sql`truncate listings,crawl_jobs cascade`;
  await page.reload();
  for (const n of [0, 1]) {
    await expect(page.locator('.stats article').nth(n).locator('strong'))
      .toHaveText('0');
  }
  for (const name of ['DF Imóveis', 'Wimoveis']) {
    await expect(
      page.locator('.source-row').filter({ hasText: name }).locator('b'),
    ).toHaveText('0');
  }
  await expect(page.getByText('Sem execuções')).toBeVisible();
});
test('AC19 actual signed-out login fits both viewports', async ({ browser }) => {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  for (const width of [375, 1440]) {
    await p.setViewportSize({ width, height: 900 });
    await p.goto('/login');
    await expect(p.getByLabel('Email')).toBeVisible();
    expect(
      await p.evaluate(() =>
        document.documentElement.scrollWidth <= innerWidth
      ),
    ).toBe(true);
  }
  await ctx.close();
});
test('AC20 keyboard visits every rendered control with accessible name and visible focus', async ({ page, browser }) => {
  async function traverse(p: import('@playwright/test').Page) {
    await expect(p.getByRole('heading').first()).toBeVisible();
    await expect(p.getByRole('status').filter({ hasText: 'Carregando' }))
      .toHaveCount(0);
    const controls = p.locator(
      'a[href]:visible,button:enabled:visible,input:enabled:visible,select:enabled:visible,textarea:enabled:visible',
    );
    const n = await controls.count();
    await controls.evaluateAll((els) =>
      els.forEach((el, i) => el.setAttribute('data-keyboard-id', String(i)))
    );
    await p.locator('body').click({ position: { x: 1, y: 1 } });
    const seen = new Set<string>();
    for (let i = 0; i < n * 4 && seen.size < n; i++) {
      await p.keyboard.press('Tab');
      const focused = p.locator(':focus');
      // Native date-picker parts can temporarily own focus outside the document.
      // Keep traversing; every page control still owes a named, visible-focus visit.
      if (!await focused.count()) continue;
      await expect(focused).toHaveAccessibleName(/\S/);
      const css = await focused.evaluate((el) => ({
        outline: getComputedStyle(el).outlineStyle,
        width: parseFloat(getComputedStyle(el).outlineWidth),
      }));
      expect(css.outline).not.toBe('none');
      expect(css.width).toBeGreaterThan(0);
      const key = await focused.getAttribute('data-keyboard-id');
      expect(key).not.toBeNull();
      seen.add(key!);
    }
    expect(seen.size).toBe(n);
  }
  for (const route of routes) {
    await page.goto(route);
    await traverse(page);
  }
  const ctx = await browser.newContext();
  const login = await ctx.newPage();
  await login.goto('/login');
  await traverse(login);
  await ctx.close();
});
test('AC27 create and edit persist every search field', async ({ page }) => {
  await page.goto('/buscas');
  await page.getByRole('button', { name: 'Nova busca', exact: false }).click();
  const form = page.locator('form.profile').first();
  async function setForm(
    name: string,
    values: {
      bedrooms: string;
      suites: string;
      minArea: string;
      maxArea: string;
      minPrice: string;
      maxPrice: string;
      neighborhoods: string;
      elevator: boolean;
      parking: boolean;
      df: boolean;
      wi: boolean;
      enabled: boolean;
    },
  ) {
    await form.getByLabel('Nome da busca').fill(name);
    for (
      const [label, value] of [
        ['Bairros', values.neighborhoods],
        ['Quartos', values.bedrooms],
        ['Suítes mínimas', values.suites],
        ['Área mínima', values.minArea],
        ['Área máxima', values.maxArea],
        ['Preço mínimo', values.minPrice],
        ['Preço máximo', values.maxPrice],
      ]
    ) await form.getByLabel(label, { exact: true }).fill(value);
    for (
      const [label, value] of [
        ['Exigir elevador', values.elevator],
        ['Exigir vaga', values.parking],
        ['DF Imóveis', values.df],
        ['Wimoveis', values.wi],
        ['Busca ativa', values.enabled],
      ] as const
    ) await form.getByLabel(label, { exact: true }).setChecked(value);
    await form.getByRole('button', { name: 'Salvar busca' }).click();
    await expect.poll(async () =>
      Number(
        (await sql`select count(*) from saved_searches where name=${name}`)[0]
          .count,
      )
    ).toBe(1);
  }
  const first = {
    bedrooms: '2,3',
    suites: '1',
    minArea: '80',
    maxArea: '160',
    minPrice: '800000',
    maxPrice: '1600000',
    neighborhoods: 'asa-norte,asa-sul',
    elevator: true,
    parking: true,
    df: true,
    wi: false,
    enabled: false,
  };
  await setForm('A nova busca', first);
  await page.reload();
  let [stored] =
    await sql`select * from saved_searches where name='A nova busca'`;
  expect(fromSearchRow(stored as Parameters<typeof fromSearchRow>[0]))
    .toMatchObject({
      enabled: false,
      providers: ['dfimoveis'],
      params: {
        neighborhoods: ['asa-norte', 'asa-sul'],
        numberOfRooms: [2, 3],
        numberOfSuites: 1,
        minArea: 80,
        maxArea: 160,
        minPrice: 800000,
        maxPrice: 1600000,
        hasElevator: true,
        hasParking: true,
      },
    });
  const second = {
    bedrooms: '4',
    suites: '2',
    minArea: '100',
    maxArea: '200',
    minPrice: '1000000',
    maxPrice: '2000000',
    neighborhoods: 'octogonal',
    elevator: false,
    parking: false,
    df: false,
    wi: true,
    enabled: true,
  };
  await setForm('A busca editada', second);
  await page.reload();
  [stored] =
    await sql`select * from saved_searches where name='A busca editada'`;
  expect(fromSearchRow(stored as Parameters<typeof fromSearchRow>[0]))
    .toMatchObject({
      enabled: true,
      providers: ['wimoveis'],
      params: {
        neighborhoods: ['octogonal'],
        numberOfRooms: [4],
        numberOfSuites: 2,
        minArea: 100,
        maxArea: 200,
        minPrice: 1000000,
        maxPrice: 2000000,
        hasElevator: false,
        hasParking: false,
      },
    });
  await expect(page.getByLabel('Nome da busca').first()).toHaveValue(
    'A busca editada',
  );
});
test('AC42 exact run order counts timestamps and email state are rendered separately', async ({ page }) => {
  await sql`insert into crawl_jobs(kind,state,search_snapshot,started_at,finished_at,email_state) values('collect','succeeded','[]','2020-01-01','2020-01-02','sent')`;
  const [latest] =
    await sql`insert into crawl_jobs(kind,state,search_snapshot,started_at,finished_at,email_state) values('collect','partial','[]','2021-02-03T04:05:06Z','2021-02-03T05:06:07Z','failed') returning id`;
  await sql`insert into crawl_source_runs(job_id,source,count,outcome,error_category) values(${latest.id},'dfimoveis',7,'failed','blocked')`;
  await page.goto('/execucoes');
  const cards = page.locator('.runs>article');
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toContainText(latest.id);
  await expect(cards.first()).toContainText(stamp('2021-02-03T04:05:06Z'));
  await expect(cards.first()).toContainText(stamp('2021-02-03T05:06:07Z'));
  await expect(cards.first()).toContainText('7 anúncios');
  await expect(cards.first()).toContainText('blocked');
  await expect(cards.first()).toContainText('Email: failed');
  await expect(cards.last()).toContainText('Email: sent');
});
test('AC43 exact heartbeat threshold and displayed timestamp', async ({ page }) => {
  const now = new Date('2026-01-08T12:00:00Z');
  await page.clock.setFixedTime(now);
  await sql`update private.worker_state set seen_at=${new Date(
    now.getTime() - 120000,
  )}`;
  await page.goto('/');
  await expect(page.getByText('Online', { exact: true })).toBeVisible();
  await expect(page.getByText('Visto em ' + stamp('2026-01-08T11:58:00Z')))
    .toBeVisible();
  await sql`update private.worker_state set seen_at=${new Date(
    now.getTime() - 120001,
  )}`;
  await page.reload();
  await expect(page.getByText('Offline', { exact: true })).toBeVisible();
  await expect(page.getByText('Visto em ' + stamp('2026-01-08T11:57:59.999Z')))
    .toBeVisible();
});
async function comparisonFixture(n: number) {
  await sql`truncate listings cascade`;
  await sql`insert into listings(url,title,source,price_cents,area_m2,bedrooms,neighborhood,availability) values('https://portal.test/0','Apartamento 00','wimoveis',90000000,100,3,'asa-norte','active')`;
  for (let i = 0; i < n; i++) {
    await sql`insert into listings(url,title,source,price_cents,area_m2,bedrooms,neighborhood,availability) values(${
      'https://peer.test/' + i
    },'Peer','wimoveis',${
      100000000 + i * 10000000
    },100,3,'asa-norte','active')`;
  }
  const claim = await admin.rpc('claim_crawl_job', { p_kind: 'collect' });
  if (claim.error) throw claim.error;
  const done = await admin.rpc('finish_crawl_job', {
    p_job: claim.data.job_id,
    p_token: claim.data.token,
    p_state: 'succeeded',
    p_email: 'not_needed',
  });
  if (done.error) throw done.error;
}
test('AC58 computed median count cohort and subject percentage render from real cohort', async ({ page }) => {
  await comparisonFixture(5);
  await page.goto(detail);
  await expect(page.getByText('25.0% abaixo da mediana', { exact: true }))
    .toBeVisible();
  await expect(page.getByText(/12\.000,00\/m² · 5 anúncios/)).toBeVisible();
  await expect(page.getByText('asa-norte · 3 quartos', { exact: true }))
    .toBeVisible();
});
test('AC59 insufficient real cohort renders no discount or rank', async ({ page }) => {
  await comparisonFixture(4);
  await page.goto(detail);
  await expect(page.getByText('Dados insuficientes')).toBeVisible();
  await expect(page.locator('.price')).toHaveCount(0);
  await page.goto(list);
  await expect(page.locator('[data-listing]')).toHaveCount(5);
  await expect(page.locator('.deal')).toHaveCount(0);
});
test('AC60 comparison timestamp reflects the current query', async ({ page }) => {
  await page.goto(detail);
  await expect(page.getByText(/Comparação calculada em/)).toBeVisible();
  const [row] =
    await sql`select comparison_at from listing_comparisons limit 1`;
  expect(Math.abs(Date.now() - new Date(row.comparison_at).getTime()))
    .toBeLessThan(5000);
});
test('AC61 opportunity ties stay canonically ordered across pages with null last', async ({ page }) => {
  await sql`update listings set price_cents=120000000`;
  await sql`update listings set price_cents=null where url='https://portal.test/0'`;
  const expected = Array.from({ length: 34 }, (_, i) => i + 1).sort((a, b) =>
    ('https://portal.test/' + a).localeCompare('https://portal.test/' + b)
  ).map(titleFor).concat(titleFor(0));
  await page.goto(list + '?sort=opportunity');
  await expect(page.locator('[data-listing]')).toHaveCount(30);
  expect(await titles(page)).toEqual(expected.slice(0, 30));
  await page.goto(list + '?sort=opportunity&page=2');
  await expect(page.locator('[data-listing]')).toHaveCount(5);
  expect(await titles(page)).toEqual(expected.slice(30));
});
async function localWorker() {
  const root = new URL('../..', import.meta.url).pathname;
  const cwd = mkdtempSync(join(tmpdir(), 'property-browser-worker-'));
  const child = spawn('rtk', [
    'deno',
    'run',
    '-A',
    '--config=' + root + 'backend/deno.json',
    '--preload=' + root + 'backend/tests/support/cli_preload.ts',
    root + 'backend/src/worker.ts',
  ], { cwd, env: { ...process.env, PROPERTY_TEST_MODE: 'success' } });
  let output = '';
  child.stdout.on('data', (d) => output += String(d));
  child.stderr.on('data', (d) => output += String(d));
  await expect.poll(() => output.match(/TEST_WORKER_PID=(\d+)/)?.[1], {
    timeout: 15000,
  }).toBeTruthy();
  const pid = Number(output.match(/TEST_WORKER_PID=(\d+)/)![1]);
  return {
    stop: async () => {
      const done = new Promise<void>((resolve) =>
        child.once('exit', () => resolve())
      );
      process.kill(pid, 'SIGTERM');
      await done;
      rmSync(cwd, { recursive: true, force: true });
    },
  };
}
test('AC41 stopped worker queue and browser closure do not cancel durable work', async ({ page }) => {
  let worker = await localWorker();
  await expect.poll(async () =>
    Number((await sql`select count(*) from private.worker_state`)[0].count)
  ).toBe(1);
  await worker.stop();
  await page.goto('/');
  await page.getByRole('button', { name: 'Coletar agora', exact: false })
    .click();
  await expect.poll(async () =>
    Number(
      (await sql`select count(*) from crawl_jobs where state='queued'`)[0]
        .count,
    )
  ).toBe(1);
  await page.close();
  expect((await sql`select state from crawl_jobs`)[0].state).toBe(
    'queued',
  );
  worker = await localWorker();
  try {
    await expect.poll(
      async () =>
        Number(
          (await sql`select count(*) from crawl_jobs where state='running'`)[
            0
          ].count,
        ),
      { timeout: 15000 },
    ).toBe(1);
    await expect.poll(
      async () => (await sql`select state from crawl_jobs`)[0].state,
      { timeout: 20000 },
    ).toBe('succeeded');
    expect(
      Number(
        (await sql`select count(*) from listings where source in ('dfimoveis','wimoveis') and url not like 'https://portal.test/%'`)[
          0
        ].count,
      ),
    ).toBe(2);
    expect(Number((await sql`select count(*) from crawl_jobs`)[0].count))
      .toBe(1);
  } finally {
    await worker.stop();
  }
});

test('AC09 inclusive centavo price bounds query integer storage', async ({ page }) => {
  await sql`update listings set price_cents=29 where url='https://portal.test/0'`;
  await page.goto(list + '?minPrice=0.29&maxPrice=0.29');
  await expect(page.locator('[data-listing]')).toHaveCount(1);
  await expect(page.locator('[data-listing]')).toContainText('Apartamento 00');
});
