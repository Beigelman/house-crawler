import { supabase } from '../../lib/supabase';
import { check } from '../../lib/query-result';
import { toCentavos } from '../../../../shared/money.ts';
import type { Listing } from '../../../../shared/property.ts';

export async function browse(params: URLSearchParams) {
  const page = Math.max(1, Number(params.get('page')) || 1);
  const marked = params.get('mark');
  let q = supabase.from('listing_comparisons').select(
    marked ? '*,listing_marks!inner(status,user_id)' : '*',
    { count: 'exact' },
  );
  for (
    const [param, col] of [['source', 'source'], ['bedrooms', 'bedrooms'], [
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
      ['minArea', 'area_m2', 'gte', 1],
      ['maxArea', 'area_m2', 'lte', 1],
    ] as const
  ) {
    const v = params.get(param);
    if (v !== null && v !== '' && Number.isFinite(Number(v))) {
      q = q[op](col, factor === 100 ? toCentavos(Number(v)) : Number(v));
    }
  }
  if (params.get('q')) {
    q = q.ilike('title', '%' + params.get('q')!.replace(/[%_]/g, '') + '%');
  }
  if (params.get('since')) q = q.gte('first_seen_at', params.get('since')!);
  if (marked) {
    const u = await supabase.auth.getUser();
    q = q.eq('listing_marks.status', marked).eq(
      'listing_marks.user_id',
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
    : q.order('first_seen_at', { ascending: false });
  const r = await q.order('url', { ascending: true }).range(
    (page - 1) * 30,
    page * 30 - 1,
  );
  check(r);
  return { rows: r.data as unknown as Listing[], count: r.count ?? 0, page };
}

export async function getListingDetail(url: string) {
  const user = (await supabase.auth.getUser()).data.user!;
  const listing = check(
    await supabase.from('listing_comparisons').select('*').eq('url', url)
      .maybeSingle(),
  );
  const [history, marks] = listing
    ? await Promise.all([
      supabase.from('listing_price_history').select('*').eq(
        'listing_id',
        listing.id,
      )
        .order('seen_at').order('id').then(check),
      supabase.from('listing_marks').select('*').eq('listing_id', listing.id)
        .eq('user_id', user.id).maybeSingle().then(check),
    ])
    : [[], null];
  return { listing: listing as Listing | null, history, mark: marks };
}

export async function savePropertyMark(
  listingId: string,
  status: string,
  note: string,
) {
  const user = (await supabase.auth.getUser()).data.user!;
  check(
    await supabase.from('listing_marks').upsert({
      user_id: user.id,
      listing_id: listingId,
      status: status || null,
      note: note || null,
    }),
  );
}
