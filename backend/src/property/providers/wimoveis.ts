import { logger } from '../../platform/logger.ts';
import { parsePropertyHtml } from './parse-property-html.ts';
import type { CheerioAPI } from 'cheerio';

import { ScrapedListing, SearchParams } from '../../../../shared/property.ts';
import { PropertyProvider } from './base-property-provider.ts';
import { buildAbsoluteUrl, buildPageUrl, isSameDomain } from './html-utils.ts';

export class WimoveisProvider extends PropertyProvider {
  private static readonly maxListingPages = 5;
  protected baseUrl: string;

  constructor(searchParams: SearchParams, signal?: AbortSignal) {
    super('Wimoveis', searchParams, signal);
    this.baseUrl = 'https://www.wimoveis.com.br';
  }

  private isPropertyUrl(href: string): boolean {
    const normalized = href.toLowerCase();
    return normalized.includes('/propriedades') ||
      normalized.includes('/apartamento') ||
      normalized.includes('/imovel') ||
      (normalized.includes('/imoveis') && normalized.includes('-venda'));
  }

  protected buildListUrl(
    {
      neighborhoods,
      numberOfRooms,
      numberOfSuites,
      minArea,
      maxArea,
      minPrice,
      maxPrice,
      hasElevator,
      hasParking,
    }: SearchParams,
  ): string {
    const minRoom = Math.min(...numberOfRooms);
    const maxRoom = Math.max(...numberOfRooms);

    const mapLocationToZ: Record<string, string> = {
      'asa-sul': '42705',
      'asa-norte': '42704',
      'octogonal': '42703',
    };
    const loc = neighborhoods.map((neighborhood) =>
      mapLocationToZ[neighborhood]
    ).join(',');

    return `${this.baseUrl}/venda/apartamentos/brasil/desde-${minRoom}-ate-${maxRoom}-quartos/${
      hasElevator ? 'areac-elevador' : ''
    }?areaUnit1&bathroom=${numberOfSuites}&coveredArea=${minArea},${maxArea}${
      hasParking ? '&garagem=1' : ''
    }&loc=Z:${loc}&price=${minPrice},${maxPrice}`;
  }

  protected async collectListingLinks(listUrl: string): Promise<string[]> {
    const links = new Set<string>();

    const $ = await this.getDocument(listUrl);
    const numberOfPages = $('a.paging-module__page-item').length || 1;

    for (let page = 1; page <= numberOfPages; page++) {
      const pageUrl = page === 1 ? listUrl : buildPageUrl(listUrl, page);

      logger.info('page.started', { page_url: pageUrl, page });

      const $ = await this.getDocument(pageUrl);
      const pageLinks = this.extractListingLinks($);
      const previousTotal = links.size;
      pageLinks.forEach((url) => links.add(url));

      if (pageLinks.length === 0 || links.size === previousTotal) {
        break;
      }
    }

    return Array.from(links);
  }

  private extractListingLinks($: CheerioAPI): string[] {
    const links = new Set<string>();

    $('div.postingCardLayout-module__posting-card-layout').each(
      (_, element) => {
        const href = $(element).attr('data-to-posting');
        if (!href || !this.isPropertyUrl(href)) {
          return;
        }

        const absolute = buildAbsoluteUrl(this.baseUrl, href);
        if (isSameDomain(absolute, 'wimoveis.com.br')) {
          links.add(absolute);
        }
      },
    );

    return Array.from(links);
  }

  protected async parseProperty(url: string): Promise<ScrapedListing> {
    const $ = await this.getDocument(url);
    return parsePropertyHtml($.html(), url, 'wimoveis');
  }

  async isValid(url: string): Promise<boolean> {
    return (await this.verify(url)).last_check_result === 'active';
  }
}
