import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import postgres from 'postgres';
const c = JSON.parse(
  execFileSync('rtk', ['supabase', 'status', '-o', 'json'], {
    cwd: new URL('../..', import.meta.url),
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
const admin = createClient(c.API_URL, c.SERVICE_ROLE_KEY, {
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

  await sql`truncate property_run,property_request,property_profile,real_states,property_heartbeat restart identity cascade`;
  await sql`insert into private.property_owner(singleton,user_id) values(true,${id}) on conflict(singleton) do update set user_id=excluded.user_id`;
  await sql`insert into property_profile(id,name,params,providers) values(${pid},'Minha busca',${
    sql.json(params)
  }::jsonb,array['dfimoveis','wimoveis'])`;
  for (let i = 0; i < 35; i++) {
    await sql`insert into real_states(link,titulo,valor,created_at,price_cents,area,rooms,neighborhood,source,availability,last_seen_at,median_m2,peer_count,discount_pct,cohort,comparison_at) values(${
      'https://portal.test/' + i
    },${
      'Apartamento ' + String(i).padStart(2, '0')
    },'R$ 1.200.000,00',${new Date(Date.now() - i * 1000)},${
      i === 34 ? null : 120000000 + i * 1000000
    },100,3,'asa-norte',${
      i % 2 ? 'dfimoveis' : 'wimoveis'
    },'active',now(),13000,5,${10 - i},'asa-norte · 3 quartos',now())`;
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
    expect(text).not.toContain(c.SERVICE_ROLE_KEY);
    expect(text).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
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
  await sql`insert into property_mark(user_id,listing_link,status) values(${id},'https://portal.test/2','favorite')`;
  await page.goto(
    list +
      '?q=Apartamento&source=wimoveis&minPrice=1000000&maxPrice=1400000&minArea=90&maxArea=110&rooms=3&neighborhood=asa-norte&since=2020-01-01&availability=active&mark=favorite',
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
test('AC13 missing and failed images preserve source link', async ({ page }) => {
  await sql`update real_states set photo='http://127.0.0.1:1/broken' where link='https://portal.test/0'`;
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
    if (r.request().url().includes('is_property_owner')) return r.continue();
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
  await sql`truncate real_states,property_profile cascade`;
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
      r.request().url().includes('is_property_owner')
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
test('AC18 missing listing has return link', async ({ page }) => {
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
    '**/rest/v1/property_mark*',
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
  await sql`insert into property_mark(user_id,listing_link,status,note) values(${id},'https://portal.test/0','favorite','Manter')`;
  await page.goto(detail);
  await page.getByLabel('Status do imóvel').selectOption('');
  await page.getByRole('button', { name: 'Salvar anotação' }).click();
  await expect(page.getByText('Anotação salva')).toBeVisible();
  expect((await sql`select status,note from property_mark`)[0]).toMatchObject({
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
    await sql`insert into property_run(kind,state,profiles,email_state,finished_at) values('collect','partial','[]','failed',now()) returning id`;
  await sql`insert into property_source_run(run_id,source,count,outcome,error_category) values(${r.id},'dfimoveis',3,'failed','blocked')`;
  await page.goto('/execucoes');
  await expect(page.getByText('partial', { exact: true })).toBeVisible();
  await expect(page.getByText('Email: failed')).toBeVisible();
  await expect(page.getByText(/blocked/)).toBeVisible();
});
test('AC43 offline heartbeat displays last-seen or never connected', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Nunca conectado')).toBeVisible();
  await sql`insert into property_heartbeat(singleton,seen_at) values(true,now()-interval '121 seconds')`;
  await page.reload();
  await expect(page.getByText('Offline')).toBeVisible();
  await expect(page.getByText(/Visto em/)).toBeVisible();
});
test('AC57 history ordered and legacy observations labeled', async ({ page }) => {
  await sql`insert into property_price(listing_link,price_cents,seen_at,legacy) values('https://portal.test/0',130000000,'2020-01-01',true),('https://portal.test/0',120000000,'2021-01-01',false)`;
  await page.goto(detail);
  await expect(page.locator('[data-price-observation]')).toHaveCount(2);
  await expect(page.locator('[data-price-observation]').first()).toContainText(
    'Importação legada',
  );
});
test('AC60 comparison labels collected asking prices and timestamp', async ({ page }) => {
  await page.goto(detail);
  await expect(page.getByText('Preços pedidos dos anúncios coletados'))
    .toBeVisible();
  await expect(page.getByText(/Comparação calculada em/)).toBeVisible();
});
test('AC61 opportunity sorting puts discounts first nulls last', async ({ page }) => {
  await sql`update real_states set discount_pct=null where link='https://portal.test/0'`;
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
