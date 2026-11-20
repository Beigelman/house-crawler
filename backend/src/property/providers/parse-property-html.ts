import { load } from 'cheerio';
import { parseBRL } from './parse-brl.ts';
import { type ScrapedListing } from '../../../../shared/property.ts';
import { normalizeWhitespace, sanitizeUrl } from './html-utils.ts';

export function parsePropertyHtml(
  html: string,
  url: string,
  source: string,
): ScrapedListing {
  const $ = load(html);
  const text = normalizeWhitespace($('body').text());
  const entries: Record<string, unknown>[] = [];
  function visit(v: unknown) {
    if (Array.isArray(v)) {
      v.forEach(visit);
      return;
    }
    if (v && typeof v === 'object') {
      entries.push(v as Record<string, unknown>);
      const o = v as Record<string, unknown>;
      if (o['@graph']) visit(o['@graph']);
    }
  }
  $('script[type="application/ld+json"]').each((_i, el) => {
    try {
      visit(JSON.parse($(el).text()));
    } catch { /* Invalid publisher JSON does not establish attributes. */ }
  });
  const data =
    entries.find((x) => x.floorSize || x.numberOfBedrooms || x.offers) || {};
  const offers = (Array.isArray(data.offers) ? data.offers[0] : data.offers) as
    | Record<string, unknown>
    | undefined;
  const amount = offers?.price;
  const priceSelector = source === 'dfimoveis'
    ? 'p.precoAntigoSalao'
    : 'div.price-value';
  const raw = normalizeWhitespace($(priceSelector).first().text());
  const numeric =
    amount != null && Number.isFinite(Number(amount)) && Number(amount) > 0
      ? Math.round(Number(amount) * 100)
      : parseBRL(raw);
  const num = (pattern: RegExp) => {
    const m = text.match(pattern);
    return m ? Number(m[1].replace(',', '.')) : null;
  };
  const floor = data.floorSize as Record<string, unknown> | undefined;
  const address = data.address as Record<string, unknown> | undefined;
  const location = normalizeWhitespace(
    [
      address?.addressLocality,
      address?.addressRegion,
      data.name,
      $('h1').text(),
      text,
    ].filter(Boolean).join(' '),
  ).toLowerCase();
  const neighborhood =
    ['asa-norte', 'asa-sul', 'octogonal'].find((n) =>
      location.includes(n.replace('-', ' ')) || location.includes(n)
    ) ?? null;
  const amenity = (positive: RegExp, negative: RegExp) =>
    negative.test(text) ? false : positive.test(text) ? true : null;
  const image = Array.isArray(data.image) ? data.image[0] : data.image;
  let photo_url = typeof image === 'string'
    ? image
    : typeof image === 'object' && image !== null
    ? (image as { url?: string }).url
    : null;
  photo_url = photo_url || $('meta[property="og:image"]').attr('content') ||
    null;
  if (photo_url) {
    try {
      photo_url = new URL(photo_url, url).href;
      if (!/^https?:/.test(photo_url)) photo_url = null;
    } catch {
      photo_url = null;
    }
  }
  return {
    title: normalizeWhitespace(
      String(data.name || $('h1').first().text() || ''),
    ),
    url: sanitizeUrl(url),
    source,
    source_listing_id: url.match(/\/imovel\/(\d+)(?:[/?#-]|$)/)?.[1] ?? null,
    price_cents: numeric,
    area_m2: Number(floor?.value) > 0
      ? Number(floor?.value)
      : num(/([0-9]+(?:[,.][0-9]+)?)\s*m[²2]/i),
    bedrooms: Number(data.numberOfBedrooms) > 0
      ? Number(data.numberOfBedrooms)
      : num(/([0-9]+)\s*(?:quartos?|dormitórios?)/i),
    suites: num(/([0-9]+)\s*su[ií]tes?/i),
    neighborhood,
    photo_url: photo_url ?? null,
    has_elevator: amenity(
      /\belevador(?:es)?\b/i,
      /sem\s+elevador|não\s+(?:possui|tem)\s+elevador/i,
    ),
    has_parking: amenity(
      /\b(?:[1-9][0-9]*\s+vagas?|garagem)\b/i,
      /sem\s+(?:vaga|garagem)|0\s+vagas/i,
    ),
  };
}
