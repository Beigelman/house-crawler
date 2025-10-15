import time
import re
from urllib.parse import urljoin, urlparse
import requests
from bs4 import BeautifulSoup

BASE = "https://www.wimoveis.com.br"
LIST_URL = ("https://www.wimoveis.com.br/venda/apartamentos/brasil/desde-3-ate-4-quartos/areac-elevador?areaUnit=1&bathroom=2&coveredArea=95,&loc=Z:42705,42704&price=,1200000")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
}

# R$ 1.234.567,89
PRICE_RX = re.compile(r"R\$\s*[\d\.]{1,3}(?:\.\d{3})*(?:,\d{2})?", re.I)

def get_soup(url: str) -> BeautifulSoup:
    r = requests.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    return BeautifulSoup(r.text, "html.parser")

def is_property_url(href: str) -> bool:
    """Heurística para URLs de imóvel no WImoveis."""
    if not href:
        return False
    # normaliza
    u = href.lower()
    # caminhos comuns: .../propriedades-..., .../apartamento-..., .../imovel/...
    return (
        "/propriedades" in u
        or "/apartamento" in u
        or "/imovel" in u
        or "/imoveis" in u and "-venda" in u
    )

def collect_listing_links(list_url: str) -> list[str]:
    """
    Captura links de imóveis na página de listagem.
    Também tenta seguir paginação básica (próxima página) se encontrada.
    """
    all_links = set()

    soup = get_soup(list_url)

    # coleta âncoras candidatas
    for div in soup.find_all("div", class_="postingCardLayout-module__posting-card-layout"):
        href = div.get("data-to-posting")
        if is_property_url(href):
            full = urljoin(BASE, href)
            # garante domínio correto
            if urlparse(full).netloc.endswith("wimoveis.com.br"):
                all_links.add(full)

    return all_links

def extract_meta_description(soup: BeautifulSoup) -> str | None:
    meta = soup.find("meta", attrs={"name": "description"})
    if meta and meta.get("content"):
        return meta["content"].strip()
    og = soup.find("meta", attrs={"property": "og:description"})
    if og and og.get("content"):
        return og["content"].strip()
    return None

def extract_price(soup: BeautifulSoup) -> str | None:
    # 1) Procura rótulos próximos
   div_preco = soup.find("div", class_="price-value")
   if div_preco:
       span_preco = div_preco.find_all("span")
       for span in span_preco:
            if "R$" in span.get_text(strip=True):
                text = span.get_text(strip=True)
                # Remove "venda" from the text
                text = text.replace("venda", "").strip()
                return text
   return None

def extract_title(soup: BeautifulSoup) -> str:
    # tenta seção "Descrição"
    h1_title = soup.find("h1", class_="title-property")
    if h1_title:
        return h1_title.get_text(strip=True)
    return None

def parse_property(url: str) -> dict:
    soup = get_soup(url)
    title = extract_title(soup)
    price = extract_price(soup)

    return {
        "titulo": title,
        "valor": price or "",
        "link": url,
    }

def collect_wimoveis_properties():
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
