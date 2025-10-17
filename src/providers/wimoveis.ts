import type { CheerioAPI } from "cheerio";

import { Property, PropertyProvider, SearchParams } from "../types.ts";
import {
  buildAbsoluteUrl,
  isSameDomain,
  normalizeWhitespace,
} from "./utils.ts";

export class WimoveisProvider extends PropertyProvider {
  protected baseUrl: string;

  constructor(searchParams: SearchParams) {
    super("Wimoveis", searchParams);
    this.baseUrl = "https://www.wimoveis.com.br";
  }

  private isPropertyUrl(href: string): boolean {
    const normalized = href.toLowerCase();
    return normalized.includes("/propriedades") ||
      normalized.includes("/apartamento") ||
      normalized.includes("/imovel") ||
      (normalized.includes("/imoveis") && normalized.includes("-venda"));
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
      "asa-sul": "42705",
      "asa-norte": "42704",
      "octogonal": "42703",
    };
    const loc = neighborhoods.map((neighborhood) =>
      mapLocationToZ[neighborhood]
    ).join(",");

    return `${this.baseUrl}/venda/apartamentos/brasil/desde-${minRoom}-ate-${maxRoom}-quartos/${
      hasElevator ? "areac-elevador" : ""
    }?areaUnit=1&bathroom=${numberOfSuites}&coveredArea=${minArea},${maxArea}&garage=${
      hasParking ? "1" : "0"
    }&loc=Z:${loc}&price=${minPrice},${maxPrice}`;
  }

  protected async collectListingLinks(listUrl: string): Promise<string[]> {
    const $ = await this.getDocument(listUrl);
    const links = new Set<string>();

    $("div.postingCardLayout-module__posting-card-layout").each(
      (_, element) => {
        const href = $(element).attr("data-to-posting");
        if (!href || !this.isPropertyUrl(href)) {
          return;
        }

        const absolute = buildAbsoluteUrl(this.baseUrl, href);
        if (isSameDomain(absolute, "wimoveis.com.br")) {
          links.add(absolute);
        }
      },
    );

    return Array.from(links);
  }

  private extractPrice($: CheerioAPI): string {
    const spans = $("div.price-value span");
    for (const span of spans.toArray()) {
      const text = normalizeWhitespace($(span).text());
      if (text.includes("R$")) {
        return text.replace(/venda/i, "").trim();
      }
    }
    return "";
  }

  private extractTitle($: CheerioAPI): string {
    return normalizeWhitespace($("h1.title-property").first().text());
  }

  protected async parseProperty(url: string): Promise<Property> {
    const $ = await this.getDocument(url);
    const title = this.extractTitle($);
    const price = this.extractPrice($);

    return {
      titulo: title,
      valor: price,
      link: url,
    };
  }
}
