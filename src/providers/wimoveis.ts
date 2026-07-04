import type { CheerioAPI } from 'cheerio';

import { Property, PropertyProvider, SearchParams } from '../types.ts';
import {
  buildAbsoluteUrl,
  buildPageUrl,
  isSameDomain,
  normalizeWhitespace,
  priceParser,
  sanitizeUrl,
} from './utils.ts';

export class WimoveisProvider extends PropertyProvider {
  private static readonly maxListingPages = 5;
  protected baseUrl: string;

  constructor(searchParams: SearchParams) {
    super('Wimoveis', searchParams);
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

    return `${this.baseUrl}/venda/apartamentos/brasil/desde-${minRoom}-ate-${maxRoom}-quartos/${hasElevator ? 'areac-elevador' : ''
      }?areaUnit1&bathroom=${numberOfSuites}&coveredArea=${minArea},${maxArea}${hasParking ? '&garagem=1' : ''
      }&loc=Z:${loc}&price=${minPrice},${maxPrice}`;
  }

  protected async collectListingLinks(listUrl: string): Promise<string[]> {
    const links = new Set<string>();

    const $ = await this.getDocument(listUrl);
    const numberOfPages = $('a.paging-module__page-item').length || 1;

    for (let page = 1; page <= numberOfPages; page++) {
      const pageUrl = page === 1 ? listUrl : buildPageUrl(listUrl, page);

      console.log(`Collecting links from list page: ${pageUrl}\n`);

      const $ = await this.getDocument(pageUrl);
      const pageLinks = this.extractListingLinks($);
      const previousTotal = links.size;
      pageLinks.forEach((link) => links.add(link));

      if (pageLinks.length === 0 || links.size === previousTotal) {
        break;
      }
    }

    return Array.from(links);
  }

  private extractListingLinks($: CheerioAPI): string[] {
    const links = new Set<string>();

    $('div.postingCardLayout-module__posting-card-layout').each(
      (_: any, element: any) => {
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

  private extractPrice($: CheerioAPI): string {
    const spans = $('div.price-value span');
    for (const span of spans.toArray()) {
      const text = normalizeWhitespace($(span).text());
      if (text.includes('R$')) {
        return priceParser(text.replace(/venda/i, ''));
      }
    }
    return '';
  }

  private extractTitle($: CheerioAPI): string {
    return normalizeWhitespace($('h1.title-property').first().text());
  }

  protected async parseProperty(url: string): Promise<Property> {
    const $ = await this.getDocument(url);
    const title = this.extractTitle($);
    const price = this.extractPrice($);

    return {
      titulo: title,
      valor: price,
      link: sanitizeUrl(url),
    };
  }

  async isValid(url: string): Promise<boolean> {
    try {
      const $ = await this.getDocument(url);
      const title = this.extractTitle($);
      const price = this.extractPrice($);

      // Link é válido se conseguir extrair título E preço
      return !!(title && price);
    } catch (_error) {
      // Se houver erro ao acessar a página (404, rede, etc), link é inválido
      return false;
    }
  }
}
