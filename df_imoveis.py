import time
import json
import csv
import re
from urllib.parse import urljoin, urlparse
import requests
from bs4 import BeautifulSoup

BASE = "https://www.dfimoveis.com.br"
LIST_URL = ("https://www.dfimoveis.com.br/venda/df/brasilia/asa-norte,asa-sul/imoveis/"
            "3,4-quartos?suites=1&vagasdegaragem=1&valorfinal=1200000&areainicial=95")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
}

PRICE_RX = re.compile(r"R\$\s*[\d\.]{1,3}(?:\.\d{3})*(?:,\d{2})?", re.I)

def get_soup(url: str) -> BeautifulSoup:
    r = requests.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    return BeautifulSoup(r.text, "html.parser")

def collect_listing_links(list_url: str) -> list[str]:
    """
    Pega todos os links que parecem ser de imóveis (rota /imovel/).
    Evita duplicados e links externos.
    """
    soup = get_soup(list_url)
    links = set()
    for a in soup.select("a[href]"):
        href = a.get("href", "")
        if "/imovel/" in href:
            full = urljoin(BASE, href)
            # garante domínio correto
            if urlparse(full).netloc.endswith("dfimoveis.com.br"):
                links.add(full)
    return sorted(links)

def extract_text_block(soup: BeautifulSoup) -> str:
    """
    Extrai a descrição do imóvel procurando por uma div com classe 'imovel-title'
    e dentro dela um h2 que contém a descrição.
    """
    # Procura a div com a classe imovel-title
    imovel_title_div = soup.find("div", class_="imovel-title")
    if imovel_title_div:
        # Dentro dessa div, procura por um h2
        h2_desc = imovel_title_div.find("h2")
        if h2_desc:
            desc_text = h2_desc.get_text(" ", strip=True)
            if desc_text:
                return desc_text
    
    # Fallback: tenta a seção 'Descrição'
    desc_header = soup.find(lambda t: t.name in ("h2", "h3", "h4") and "descri" in t.get_text(strip=True).lower())
    if desc_header:
        # texto do(s) próximo(s) irmãos até um limite
        texts = []
        for sib in desc_header.next_siblings:
            if getattr(sib, "name", None) in ("h2", "h3", "h4"):
                break
            txt = getattr(sib, "get_text", lambda **k: "")(strip=True)
            if txt:
                texts.append(txt)
            if len(" ".join(texts)) > 1200:
                break
        if texts:
            return " ".join(texts)

    # Fallback 2: tenta metadados/resumo no topo (ex.: título + subtítulo)
    pieces = []
    title = soup.find(["h1", "h2"])
    if title:
        pieces.append(title.get_text(" ", strip=True))
    sub = soup.find(["h3", "p"])
    if sub:
        pieces.append(sub.get_text(" ", strip=True))
    body = soup.find("main") or soup
    if body:
        chunk = body.get_text(" ", strip=True)
        if chunk:
            pieces.append(chunk)
    # limpa e reduz
    flat = " ".join(pieces)
    flat = re.sub(r"\s+", " ", flat)
    return flat[:2000]

def extract_price(soup: BeautifulSoup) -> str | None:
    """
    Extrai o preço do imóvel procurando por uma div com classe 'imovel-price'
    e dentro dela elementos h4 que contenham valores parseáveis como números.
    """
    # Procura a div com a classe imovel-price
    imovel_price_element = soup.find("h4", class_="precoAntigoSalao")
    if imovel_price_element:
        return imovel_price_element.get_text(" ", strip=True)
            
          

def parse_property(url: str) -> dict:
    soup = get_soup(url)
    price = extract_price(soup)
    desc = extract_text_block(soup)

    return {
        "titulo": desc,
        "valor": price or "",
        "link": url,
    }

def collect_df_imoveis_properties():
    links = collect_listing_links(LIST_URL)
    if not links:
        print("Nenhum link de imóvel encontrado na listagem.")
        return

    resultados = []
    for i, link in enumerate(links, 1):
        try:
            item = parse_property(link)
            resultados.append(item)
            print(f"[{i:02d}] {item['titulo']}\n    {item['valor']} | {item['link']}\n")
        except Exception as e:
            print(f"Erro ao processar {link}: {e}")
        time.sleep(1.2)  # educação com o site
    return resultados
