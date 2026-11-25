import { load } from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import { parseBRL } from './parse-brl.ts';
import { type ScrapedListing } from '../../../../shared/property.ts';
import { normalizeWhitespace, sanitizeUrl } from './html-utils.ts';

function parseWimoveisPrice($: CheerioAPI): number | null {
  const priceBlocks = $('div.price-value');
  for (const block of priceBlocks) {
    const price = $(block).text().match(/\bvenda\s*R\$\s*([\d.]+(?:,\d+)?)/i);
    const cents = parseBRL(price?.[1] ?? '');
    if (cents != null) return cents;
  }

  const title = normalizeWhitespace($('title').first().text());
  const titlePrice = title.match(
    /(?:^|\s)à venda\b.* - R\$\s*([\d.]+(?:,\d+)?)(?:, \d+(?:[.,]\d+)?\s*m[²2])? - ID:\s*\d+ - Wimoveis$/i,
  );
  return parseBRL(priceBlocks.first().text()) ??
    parseBRL(titlePrice?.[1] ?? '');
}

function parseParking($: CheerioAPI, source: string): boolean | null {
  const article = source === 'wimoveis' ? $('#article-container') : $('body');
  const content = (article.length ? article : $('body')).clone();
  content.find('script, style, template, noscript').remove();

  const fromText = (text: string) => {
    if (/\b(?:sem\s+(?:vagas?|garagem)|0\s+vagas?)\b/i.test(text)) return false;
    if (/\b(?:[1-9]\d*\s+vagas?|garagem)\b/i.test(text)) return true;
    return null;
  };

  if (source === 'wimoveis') {
    const feature = content.find(
      '#section-icon-features-property .icon-feature:has(.icon-cochera)',
    ).first();
    const summary = content.find('.title-type-sup-property').first();
    const parking = fromText(feature.text()) ?? fromText(summary.text());
    if (parking != null) return parking;
  }

  return fromText(content.text());
}

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
  const numeric =
    amount != null && Number.isFinite(Number(amount)) && Number(amount) > 0
      ? Math.round(Number(amount) * 100)
      : source === 'wimoveis'
      ? parseWimoveisPrice($)
      : parseBRL(
        normalizeWhitespace(
          $(source === 'dfimoveis' ? 'p.precoAntigoSalao' : 'div.price-value')
            .first().text(),
        ),
      );
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
    has_parking: parseParking($, source),
  };
}
