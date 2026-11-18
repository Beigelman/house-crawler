import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';
const status = await new Deno.Command('rtk', {
  args: ['supabase', 'status', '-o', 'json'],
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
export const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
export const owner = '11111111-1111-4111-8111-111111111111';
export const other = '22222222-2222-4222-8222-222222222222';
export const profile = '33333333-3333-4333-8333-333333333333';
export async function token(id = owner) {
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
  return data.session!.access_token;
}
export async function reset() {
  await sql`truncate public.property_run, public.property_request, public.property_profile, public.real_states, public.property_heartbeat restart identity cascade`;
  await sql`update private.property_lease set expires_at = '-infinity', run_id=null`;
  await sql`insert into private.property_owner(singleton,user_id) values(true,${owner}) on conflict(singleton) do update set user_id=excluded.user_id`;
  await sql`insert into property_profile(id,name,params,providers) values(${profile},'Minha busca',${
    sql.json({
      neighborhoods: ['asa-norte', 'asa-sul', 'octogonal'],
      numberOfRooms: [3, 4],
      numberOfSuites: 0,
      hasElevator: true,
      hasParking: false,
      minArea: 90,
      maxArea: 150,
      minPrice: 1000000,
      maxPrice: 1400000,
    })
  }::jsonb,array['dfimoveis','wimoveis'])`;
}
export async function rpc(
  name: string,
  body: unknown,
  jwt = config.SERVICE_ROLE_KEY,
) {
  const res = await fetch(config.API_URL + '/rest/v1/rpc/' + name, {
    method: 'POST',
    headers: {
      apikey: config.ANON_KEY,
      Authorization: 'Bearer ' + jwt,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}
export async function begin(kind = 'collect') {
  const r = await rpc('claim_property_run', { p_kind: kind });
  if (r.status !== 200) throw new Error(JSON.stringify(r));
  return r.body;
}
export const item = (
  link = 'https://www.wimoveis.com.br/imovel/test',
  price = 120000000,
) => ({
  link,
  titulo: 'Apartamento Asa Norte',
  valor: 'R$ 1.200.000,00',
  price_cents: price,
  source: 'wimoveis',
  area: 100,
  rooms: 3,
  neighborhood: 'asa-norte',
  suites: 1,
  has_elevator: true,
  has_parking: true,
  photo: null,
});
export async function save(
  run: { run_id: string; token: number },
  items: unknown[],
  pid: string | null = profile,
) {
  return await rpc('save_property_batch', {
    p_run: run.run_id,
    p_token: run.token,
    p_items: items,
    p_profile: pid,
  });
}
