import { parsePropertyHtml } from './parse-property-html.ts';
import type { CheerioAPI } from 'cheerio';

import { Property, SearchParams } from '../../../../shared/property.ts';
import { PropertyProvider } from './base-property-provider.ts';
import { buildAbsoluteUrl, buildPageUrl, isSameDomain } from './html-utils.ts';

export class DfImoveisProvider extends PropertyProvider {
  private static readonly maxListingPages = 20;
  protected baseUrl: string;

  constructor(searchParams: SearchParams, signal?: AbortSignal) {
    super('DF Imóveis', searchParams, signal);
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

    $('a[href]').each((_, element) => {
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

  protected async parseProperty(url: string): Promise<Property> {
    const $ = await this.getDocument(url);
    return parsePropertyHtml($.html(), url, 'dfimoveis');
  }

  async isValid(url: string): Promise<boolean> {
    return (await this.verify(url)).verification === 'active';
  }
}
