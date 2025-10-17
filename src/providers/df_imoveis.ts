import type { CheerioAPI } from "cheerio";

import { Property, PropertyProvider, SearchParams } from "../types.ts";
import {
  buildAbsoluteUrl,
  isSameDomain,
  normalizeWhitespace,
} from "./utils.ts";

export class DfImoveisProvider extends PropertyProvider {
  protected baseUrl: string;

  constructor(searchParams: SearchParams) {
    super("DF Imóveis", searchParams);
    this.baseUrl = "https://www.dfimoveis.com.br";
  }

  protected async collectListingLinks(listUrl: string): Promise<string[]> {
    const $ = await this.getDocument(listUrl);
    const links = new Set<string>();

    $("a[href]").each((_, element) => {
      const href = $(element).attr("href") ?? "";
      if (!href.includes("/imovel/")) {
        return;
      }

      const absolute = buildAbsoluteUrl(this.baseUrl, href);
      if (isSameDomain(absolute, "dfimoveis.com.br")) {
        links.add(absolute);
      }
    });

    return Array.from(links).sort();
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
      neighborhoods.join(",")
    }/imoveis/${
      numberOfRooms.join(",")
    }-quartos?suites=${numberOfSuites}&vagasdegaragem=${
      hasParking ? "1" : "0"
    }&valorinicial=${minPrice}&valorfinal=${maxPrice}&areainicial=${minArea}&areafinal=${maxArea}`;
  }

  private extractDescription($: CheerioAPI): string {
    const headline = normalizeWhitespace(
      $("div.imovel-title h2").first().text(),
    );
    if (headline) {
      return headline;
    }

    return "";
  }

  private extractPrice($: CheerioAPI): string {
    const price = normalizeWhitespace($("h4.precoAntigoSalao").first().text());
    return price;
  }

  protected async parseProperty(url: string): Promise<Property> {
    const $ = await this.getDocument(url);
    const price = this.extractPrice($);
    const description = this.extractDescription($);

    return {
      titulo: description,
      valor: price,
      link: url,
    };
  }
}
