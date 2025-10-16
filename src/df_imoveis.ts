import { delay } from "@std/async/delay";
import type { CheerioAPI } from "cheerio";

import { Property } from "./types.ts";
import {
  buildAbsoluteUrl,
  fetchDocument,
  isSameDomain,
  normalizeWhitespace,
  printProperty,
} from "./utils.ts";

const BASE = "https://www.dfimoveis.com.br";
const LIST_URL =
  "https://www.dfimoveis.com.br/venda/df/brasilia/asa-norte,asa-sul/imoveis/3,4-quartos?suites=1&vagasdegaragem=1&valorfinal=1200000&areainicial=90";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  "Accept-Encoding": "gzip, deflate, br",
  "Referer": "https://www.dfimoveis.com.br/",
  "Connection": "keep-alive",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
  "Cache-Control": "max-age=0",
};

async function getDocument(url: string): Promise<CheerioAPI> {
  return await fetchDocument(url, HEADERS);
}

async function collectListingLinks(listUrl: string): Promise<string[]> {
  const $ = await getDocument(listUrl);
  const links = new Set<string>();

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href") ?? "";
    if (!href.includes("/imovel/")) {
      return;
    }

    const absolute = buildAbsoluteUrl(BASE, href);
    if (isSameDomain(absolute, "dfimoveis.com.br")) {
      links.add(absolute);
    }
  });

  return Array.from(links).sort();
}

function extractTextBlock($: CheerioAPI): string {
  const headline = normalizeWhitespace($("div.imovel-title h2").first().text());
  if (headline) {
    return headline;
  }

  const descHeader = $("h2, h3, h4")
    .filter((_, element) =>
      normalizeWhitespace($(element).text()).toLowerCase().includes("descri")
    )
    .first();

  if (descHeader.length) {
    const texts: string[] = [];
    $(descHeader)
      .nextAll()
      .each((_, element) => {
        const tag = element.tagName?.toLowerCase();
        if (tag && ["h2", "h3", "h4"].includes(tag)) {
          return false;
        }

        const text = normalizeWhitespace($(element).text());
        if (text) {
          texts.push(text);
        }

        if (texts.join(" ").length > 1200) {
          return false;
        }

        return undefined;
      });

    if (texts.length > 0) {
      return normalizeWhitespace(texts.join(" "));
    }
  }

  const pieces: string[] = [];
  const title = normalizeWhitespace($("h1, h2").first().text());
  if (title) {
    pieces.push(title);
  }

  const subtitle = normalizeWhitespace($("h3, p").first().text());
  if (subtitle) {
    pieces.push(subtitle);
  }

  const body = normalizeWhitespace($("main").text() || $.root().text());
  if (body) {
    pieces.push(body);
  }

  return normalizeWhitespace(pieces.join(" ")).slice(0, 2000);
}

function extractPrice($: CheerioAPI): string {
  const price = normalizeWhitespace($("h4.precoAntigoSalao").first().text());
  return price;
}

async function parseProperty(url: string): Promise<Property> {
  const $ = await getDocument(url);
  const price = extractPrice($);
  const description = extractTextBlock($);

  return {
    titulo: description,
    valor: price,
    link: url,
  };
}

export async function collectDfImoveisProperties(): Promise<Property[]> {
  try {
    const links = await collectListingLinks(LIST_URL);
    if (links.length === 0) {
      console.log("Nenhum link de imóvel encontrado na listagem.");
      return [];
    }

    const results: Property[] = [];
    for (const link of links) {
      try {
        const property = await parseProperty(link);
        results.push(property);
        printProperty(property);
      } catch (error) {
        console.error(`Erro ao processar ${link}:`, error);
      }

      await delay(1200);
    }

    return results;
  } catch (error) {
    if (error instanceof Error && error.message.includes("403")) {
      console.error(
        "⚠️  AVISO: DF Imóveis bloqueou o acesso (403 Forbidden).",
      );
      console.error(
        "   Isso é comum em ambientes de CI/CD como GitHub Actions.",
      );
      console.error("   O crawler continuará apenas com os outros sites.\n");
    } else {
      console.error("❌ Erro ao coletar imóveis do DF Imóveis:", error);
    }
    return [];
  }
}
