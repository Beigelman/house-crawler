export function providerIdForUrl(url: string): string | null {
  return url.includes('dfimoveis.com.br')
    ? 'dfimoveis'
    : url.includes('wimoveis.com.br')
    ? 'wimoveis'
    : null;
}
