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

export class DfImoveisProvider extends PropertyProvider {
  private static readonly maxListingPages = 20;
  protected baseUrl: string;

  constructor(searchParams: SearchParams) {
    super('DF Imóveis', searchParams);
    this.baseUrl = 'https://www.dfimoveis.com.br';
  }

  protected async collectListingLinks(listUrl: string): Promise<string[]> {
    const links = new Set<string>();

    for (let page = 1; page <= DfImoveisProvider.maxListingPages; page++) {
      const pageUrl = page === 1
        ? listUrl
        : buildPageUrl(listUrl, page, 'pagina');

      console.log(`Collecting links from list page: ${pageUrl}\n`);

      const $ = await this.getDocument(pageUrl);
      const pageLinks = this.extractListingLinks($);
      const previousTotal = links.size;
      pageLinks.forEach((link) => links.add(link));

      if (pageLinks.length === 0 || links.size === previousTotal) {
        break;
      }
    }

    return Array.from(links).sort();
  }

  private extractListingLinks($: CheerioAPI): string[] {
    const links = new Set<string>();

    $('a[href]').each((_: any, element: any) => {
      const href = $(element).attr('href') ?? '';
      if (!href.includes('/imovel/')) {
        return;
      }

      const absolute = buildAbsoluteUrl(this.baseUrl, href);
      if (isSameDomain(absolute, 'dfimoveis.com.br')) {
        links.add(absolute);
      }
    });

    return Array.from(links);
  }

  protected buildListUrl(
    {
      neighborhoods,
      hasParking,
      numberOfRooms,
      numberOfSuites,
      minArea,
      maxArea,
      minPrice,
      maxPrice,
    }: SearchParams,
  ): string {
    return `${this.baseUrl}/venda/df/brasilia/${
      neighborhoods.join(',')
    }/imoveis/${
      numberOfRooms.join(',')
    }-quartos?valorinicial=${minPrice}&valorfinal=${maxPrice}&areainicial=${minArea}&areafinal=${maxArea}${
      numberOfSuites > 0 ? `&suites=${numberOfSuites}` : ''
    }${hasParking ? '&vagasdegaragem=1' : ''}`;
  }

  private extractDescription($: CheerioAPI): string {
    const headline = normalizeWhitespace(
      $('div.imovel-title h1.headline-small ').first().text(),
    );
    if (headline) {
      return headline;
    }

    return '';
  }

  private extractPrice($: CheerioAPI): string {
    const price = priceParser($('p.precoAntigoSalao').first().text());
    return price;
  }

  protected async parseProperty(url: string): Promise<Property> {
    const $ = await this.getDocument(url);
    const price = this.extractPrice($);
    const description = this.extractDescription($);

    return {
      titulo: description,
      valor: price,
      link: sanitizeUrl(url),
    };
  }

  async isValid(url: string): Promise<boolean> {
    try {
      const $ = await this.getDocument(url);
      const price = this.extractPrice($);
      const description = this.extractDescription($);

      // Link é válido se conseguir extrair título E preço
      return !!(description && price);
    } catch (_error) {
      // Se houver erro ao acessar a página (404, rede, etc), link é inválido
      return false;
    }
  }
}
