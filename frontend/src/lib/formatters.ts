export const money = (n: number | null) =>
  n === null
    ? 'Não informado'
    : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
      .format(n / 100);
export const date = (s: string | null) =>
  s ? new Date(s).toLocaleString('pt-BR') : 'Não informado';
export const source = (s: string | null | undefined) =>
  s === 'dfimoveis'
    ? 'DF Imóveis'
    : s === 'wimoveis'
    ? 'Wimoveis'
    : 'Fonte desconhecida';
