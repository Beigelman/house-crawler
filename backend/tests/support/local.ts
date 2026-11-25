import { toSearchRow } from '../../../shared/search.ts';
import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';
const status = await new Deno.Command('rtk', {
  args: ['supabase', 'status', '-o', 'json'],
  cwd: new URL('../../', import.meta.url),
  stdout: 'piped',
  stderr: 'null',
}).output();
if (!status.success) {
  throw new Error('Start the disposable local Supabase stack first');
}
export const config = JSON.parse(new TextDecoder().decode(status.stdout));
if (!config.API_URL.startsWith('http://127.0.0.1:')) {
  throw new Error('Tests refuse remote databases');
}
export const sql = postgres(config.DB_URL, { max: 4, onnotice: () => {} });
export const admin = createClient(config.API_URL, config.SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
export const owner = '11111111-1111-4111-8111-111111111111';
export const other = '22222222-2222-4222-8222-222222222222';
export const profile = '33333333-3333-4333-8333-333333333333';
const tokenCache = new Map<string, string>();
export async function token(id = owner) {
  const cached = tokenCache.get(id);
  if (cached && !(await admin.auth.getUser(cached)).error) return cached;
  const email = id === owner ? 'owner@example.test' : 'other@example.test';
  await admin.auth.admin.createUser({
    id,
    email,
    password: 'local-test-password-123',
    email_confirm: true,
  });
  const c = createClient(config.API_URL, config.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await c.auth.signInWithPassword({
    email,
    password: 'local-test-password-123',
  });
  if (error) throw error;
  tokenCache.set(id, data.session!.access_token);
  return data.session!.access_token;
}
export async function reset() {
  await sql`truncate public.crawl_jobs, public.saved_searches, public.listings restart identity cascade`;
  await sql`insert into private.worker_state(singleton) values(true) on conflict do nothing`;
  await sql`update private.worker_state set lease_expires_at = '-infinity', job_id=null, seen_at=null`;
  await token();
  await sql`insert into private.app_owner(singleton,user_id) values(true,${owner}) on conflict(singleton) do update set user_id=excluded.user_id`;
  await sql`insert into saved_searches ${
    sql(
      toSearchRow({
        id: profile,
        name: 'Minha busca',
        enabled: true,
        notificationEmails: ['local@example.test'],
        providers: ['dfimoveis', 'wimoveis'],
        params: {
          neighborhoods: ['asa-norte', 'asa-sul', 'octogonal'],
          numberOfRooms: [3, 4],
          numberOfSuites: 0,
          hasElevator: true,
          hasParking: false,
          minArea: 90,
          maxArea: 150,
          minPrice: 1000000,
          maxPrice: 1400000,
        },
      }),
    )
  }`;
}
export async function rpc(
  name: string,
  body: unknown,
  jwt?: string,
) {
  const res = await fetch(config.API_URL + '/rest/v1/rpc/' + name, {
    method: 'POST',
    headers: {
      apikey: jwt ? config.ANON_KEY : config.SECRET_KEY,
      ...(jwt ? { Authorization: 'Bearer ' + jwt } : {}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}
export async function begin(kind = 'collect') {
  const r = await rpc('claim_crawl_job', { p_kind: kind });
  if (r.status !== 200) throw new Error(JSON.stringify(r));
  return r.body;
}
export const item = (
  url = 'https://www.wimoveis.com.br/imovel/test',
  price = 120000000,
) => ({
  url,
  title: 'Apartamento Asa Norte',
  price_cents: price,
  source: 'wimoveis',
  area_m2: 100,
  bedrooms: 3,
  neighborhood: 'asa-norte',
  suites: 1,
  has_elevator: true,
  has_parking: true,
  photo_url: null,
});
export async function save(
  run: { job_id: string; token: number },
  items: unknown[],
  pid: string | null = profile,
) {
  return await rpc('save_listing_batch', {
    p_job: run.job_id,
    p_token: run.token,
    p_items: items,
    p_search: pid,
  });
}
