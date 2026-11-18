import { toCentavos } from '../../src/property/model.ts';
import { createClient } from '@supabase/supabase-js';
import type { Listing, Profile } from '../../src/property/model.ts';
export const configured = Boolean(
  import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321',
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'unconfigured',
  { auth: { storageKey: 'house-crawler-auth' } },
);
export function check<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}
export const money = (n: number | null) =>
  n === null
    ? 'Não informado'
    : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
      .format(n / 100);
export const date = (s: string | null) =>
  s ? new Date(s).toLocaleString('pt-BR') : 'Não informado';
export async function browse(params: URLSearchParams) {
  const page = Math.max(1, Number(params.get('page')) || 1);
  const marked = params.get('mark');
  let q = supabase.from('real_states').select(
    marked ? '*,property_mark!inner(status,user_id)' : '*',
    { count: 'exact' },
  );
  for (
    const [param, col] of [['source', 'source'], ['rooms', 'rooms'], [
      'neighborhood',
      'neighborhood',
    ], ['availability', 'availability']]
  ) {
    const v = params.get(param);
    if (v) q = q.eq(col, v);
  }
  for (
    const [param, col, op, factor] of [
      ['minPrice', 'price_cents', 'gte', 100],
      ['maxPrice', 'price_cents', 'lte', 100],
      ['minArea', 'area', 'gte', 1],
      ['maxArea', 'area', 'lte', 1],
    ] as const
  ) {
    const v = params.get(param);
    if (v !== null && v !== '' && Number.isFinite(Number(v))) {
      q = q[op](col, factor === 100 ? toCentavos(Number(v)) : Number(v));
    }
  }
  if (params.get('q')) {
    q = q.ilike('titulo', '%' + params.get('q')!.replace(/[%_]/g, '') + '%');
  }
  if (params.get('since')) q = q.gte('created_at', params.get('since')!);
  if (marked) {
    const u = await supabase.auth.getUser();
    q = q.eq('property_mark.status', marked).eq(
      'property_mark.user_id',
      u.data.user!.id,
    );
  }
  const sort = params.get('sort');
  q = sort === 'price_asc' || sort === 'price_desc'
    ? q.order('price_cents', {
      ascending: sort === 'price_asc',
      nullsFirst: false,
    })
    : sort === 'opportunity'
    ? q.order('discount_pct', { ascending: false, nullsFirst: false })
    : q.order('created_at', { ascending: false });
  const r = await q.order('link', { ascending: true }).range(
    (page - 1) * 30,
    page * 30 - 1,
  );
  check(r);
  return { rows: r.data as unknown as Listing[], count: r.count ?? 0, page };
}
export async function profiles() {
  return check(
    await supabase.from('property_profile').select('*').order('name').order(
      'id',
    ),
  ) as Profile[];
}
export async function dashboard() {
  const count = async (column?: string, value?: string, since?: string) => {
    let q = supabase.from('real_states').select('link', {
      count: 'exact',
      head: true,
    });
    if (column && value) q = q.eq(column, value);
    if (since) q = q.gte('created_at', since);
    const r = await q;
    check(r);
    return r.count ?? 0;
  };
  const [active, recent, df, wi, runs, hb] = await Promise.all([
    count('availability', 'active'),
    count(
      undefined,
      undefined,
      new Date(Date.now() - 7 * 86400000).toISOString(),
    ),
    count('source', 'dfimoveis'),
    count('source', 'wimoveis'),
    supabase.from('property_run').select('*').order('started_at', {
      ascending: false,
    }).limit(1).then(check),
    supabase.from('property_heartbeat').select('*').limit(1).then(check),
  ]);
  return {
    active,
    recent,
    df,
    wi,
    run: runs?.[0],
    heartbeat: hb?.[0]?.seen_at,
  };
}
