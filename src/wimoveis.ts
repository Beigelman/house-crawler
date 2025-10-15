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

const BASE = "https://www.wimoveis.com.br";
const LIST_URL =
  "https://www.wimoveis.com.br/venda/apartamentos/brasil/desde-3-ate-4-quartos/areac-elevador?areaUnit=1&bathroom=2&coveredArea=95,&loc=Z:42705,42704&price=,1200000";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
};

function isPropertyUrl(href: string): boolean {
  const normalized = href.toLowerCase();
  return normalized.includes("/propriedades") ||
    normalized.includes("/apartamento") ||
    normalized.includes("/imovel") ||
    (normalized.includes("/imoveis") && normalized.includes("-venda"));
}

async function getDocument(url: string): Promise<CheerioAPI> {
  return await fetchDocument(url, HEADERS);
}

async function collectListingLinks(listUrl: string): Promise<string[]> {
  const $ = await getDocument(listUrl);
  const links = new Set<string>();

  $("div.postingCardLayout-module__posting-card-layout").each((_, element) => {
    const href = $(element).attr("data-to-posting");
    if (!href || !isPropertyUrl(href)) {
      return;
    }

    const absolute = buildAbsoluteUrl(BASE, href);
    if (isSameDomain(absolute, "wimoveis.com.br")) {
      links.add(absolute);
    }
  });

  return Array.from(links);
}

function extractPrice($: CheerioAPI): string {
  const spans = $("div.price-value span");
  for (const span of spans.toArray()) {
    const text = normalizeWhitespace($(span).text());
    if (text.includes("R$")) {
      return text.replace(/venda/i, "").trim();
    }
  }
  return "";
}

function extractTitle($: CheerioAPI): string {
  return normalizeWhitespace($("h1.title-property").first().text());
}

async function parseProperty(url: string): Promise<Property> {
  const $ = await getDocument(url);
  const title = extractTitle($);
  const price = extractPrice($);

  return {
    titulo: title,
    valor: price,
    link: url,
  };
}

export async function collectWimoveisProperties(): Promise<Property[]> {
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
}
