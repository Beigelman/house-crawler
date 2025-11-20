import { delay } from '@std/async/delay';
import type { CheerioAPI } from 'cheerio';
import { load } from 'cheerio';

export interface Property {
  titulo: string;
  valor: string;
  link: string;
}

export interface ProviderConfig {
  name: string;
  baseUrl: string;
  delayMs?: number;
}

export type SearchParams = {
  neighborhoods: string[];
  numberOfRooms: number[];
  numberOfSuites: number;
  minArea: number;
  maxArea: number;
  minPrice: number;
  maxPrice: number;
  hasElevator: boolean;
  hasParking: boolean;
};

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

  constructor(name: string, searchParams: SearchParams) {
    this.name = name;
    this.searchParams = searchParams;
  }

  /**
   * Método principal para coletar todas as propriedades do provider
   */
  async collect(): Promise<Property[]> {
    try {
      const links = await this.collectListingLinks(
        this.buildListUrl(this.searchParams),
      );
      if (links.length === 0) {
        console.log(
          `[${this.name}] Nenhum link de imóvel encontrado na listagem.`,
        );
        return [];
      }

      const results: Property[] = [];
      for (const link of links) {
        try {
          const property = await this.parseProperty(link);
          results.push(property);
          this.printProperty(property);
        } catch (error) {
          console.error(`[${this.name}] Erro ao processar ${link}:`, error);
        }

        await delay(1200);
      }

      return results;
    } catch (error) {
      this.handleError(error);
      return [];
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
    const response = await fetch(url, { headers: HEADERS });
    if (!response.ok) {
      throw new Error(
        `Falha ao acessar ${url}: ${response.status} ${response.statusText}`,
      );
    }

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
