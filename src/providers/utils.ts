import { type CheerioAPI, load } from "cheerio";
import { Property } from "../types.ts";

export async function fetchDocument(
  url: string,
  headers: Record<string, string>,
): Promise<CheerioAPI> {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(
      `Falha ao acessar ${url}: ${response.status} ${response.statusText}`,
    );
  }

  const html = await response.text();
  return load(html);
}

export function printProperty(property: Property): void {
  console.log(
    `Titulo: ${property.titulo}\nValor: ${property.valor}\nLink: ${property.link}\n`,
  );
}

export function normalizeWhitespace(value: string | undefined | null): string {
  if (!value) {
    return "";
  }
  return value.replace(/\s+/g, " ").trim();
}

export function buildAbsoluteUrl(base: string, href: string): string {
  return new URL(href, base).toString();
}

export function isSameDomain(url: string, domain: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return hostname === domain || hostname.endsWith(`.${domain}`);
  } catch (_) {
    return false;
  }
}
