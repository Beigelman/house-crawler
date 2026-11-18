import { delay } from '@std/async/delay';
import type { CheerioAPI } from 'cheerio';
import { load } from 'cheerio';

import type { Property, SearchParams } from '../../../../shared/property.ts';
import { parsePropertyHtml } from './parse-property-html.ts';
import { fetchWithRetry, HttpError } from '../../platform/http-client.ts';
import { sanitizeDiagnostic } from '../../platform/diagnostics.ts';

export interface ProviderConfig {
  name: string;
  baseUrl: string;
  delayMs?: number;
}

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept':
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Referer': 'https://www.wimoveis.com.br/',
  'Connection': 'keep-alive',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
  'Cache-Control': 'max-age=0',
};

export abstract class PropertyProvider {
  public name: string;
  protected searchParams: SearchParams;

  constructor(
    name: string,
    searchParams: SearchParams,
    protected signal?: AbortSignal,
  ) {
    this.name = name;
    this.searchParams = searchParams;
  }

  /**
   * Método principal para coletar todas as propriedades do provider
   */
  async collect(): Promise<Property[]> {
    return (await this.collectOutcome()).properties;
  }

  async collectOutcome(): Promise<
    { properties: Property[]; outcome: string; error: string | null }
  > {
    const properties: Property[] = [];
    let failed = 0;
    let error: string | null = null;
    try {
      const links = await this.collectListingLinks(
        this.buildListUrl(this.searchParams),
      );
      for (const link of links) {
        this.signal?.throwIfAborted();
        try {
          const p = await this.parseProperty(link);
          if (!p.titulo) throw new Error('parse title missing');
          properties.push(p);
        } catch (e) {
          failed++;
          error = sanitizeDiagnostic(e);
        }
        await delay(1200, { signal: this.signal });
      }
      return {
        properties,
        outcome: failed
          ? (properties.length ? 'partial' : 'failed')
          : 'succeeded',
        error,
      };
    } catch (e) {
      return {
        properties,
        outcome: properties.length ? 'partial' : 'failed',
        error: sanitizeDiagnostic(e),
      };
    }
  }

  async verify(url: string): Promise<{ verification: string }> {
    try {
      const $ = await this.getDocument(url);
      const text = $('body').text();
      if (
        /an[uú]ncio (?:foi )?removido|im[oó]vel (?:foi )?removido/i.test(text)
      ) return { verification: 'removed' };
      const p = parsePropertyHtml(
        $.html(),
        url,
        this.name === 'DF Imóveis' ? 'dfimoveis' : 'wimoveis',
      );
      return {
        verification: p.titulo && p.price_cents != null ? 'active' : 'unknown',
      };
    } catch (e) {
      return {
        verification: e instanceof HttpError && [404, 410].includes(e.status)
          ? 'removed'
          : 'unknown',
      };
    }
  }

  /**
   * Valida se um link de propriedade ainda é válido
   * Verifica se a página existe E se os elementos (título/preço) podem ser extraídos
   */
  abstract isValid(url: string): Promise<boolean>;

  /**
   * Busca o documento HTML usando Cheerio
   */
  protected async getDocument(url: string): Promise<CheerioAPI> {
    const response = await fetchWithRetry(url, {
      headers: HEADERS,
      signal: this.signal,
    });
    const html = await response.text();
    return load(html);
  }

  /**
   * Método abstrato para coletar links de imóveis da página de listagem
   */
  protected abstract collectListingLinks(listUrl: string): Promise<string[]>;

  /**
   * Método abstrato para parsear um imóvel a partir de sua URL
   */
  protected abstract parseProperty(url: string): Promise<Property>;

  /**
   * Método abstrato para construir a URL de listagem a partir dos parâmetros de busca
   */
  protected abstract buildListUrl(searchParams: SearchParams): string;

  /**
   * Imprime informações sobre uma propriedade coletada
   */
  protected printProperty(property: Property): void {
    console.log(`[${this.name}] ${property.titulo} - ${property.valor}`);
    console.log(`[${this.name}] ${property.link}\n`);
  }

  /**
   * Tratamento de erros genérico
   */
  protected handleError(error: unknown): void {
    if (error instanceof Error && error.message.includes('403')) {
      console.error(
        `⚠️  AVISO: ${this.name} bloqueou o acesso (403 Forbidden).`,
      );
      console.error(
        '   Isso é comum em ambientes de CI/CD como GitHub Actions.',
      );
      console.error('   O crawler continuará apenas com os outros sites.\n');
    } else {
      console.error(
        `❌ Erro ao coletar imóveis do ${this.name}:`,
        error,
      );
    }
  }
}
