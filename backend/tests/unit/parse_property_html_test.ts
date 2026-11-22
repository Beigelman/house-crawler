import assert from 'node:assert/strict';
import { parsePropertyHtml } from '../../src/property/providers/parse-property-html.ts';

const url = 'https://www.wimoveis.com.br/propriedades/apartamento.html';

Deno.test('Wimoveis reads the labeled sale price alongside other charges', () => {
  const listing = parsePropertyHtml(
    `<title>Apartamento à venda, Asa Sul - R$ 1.400.000 - ID: 3051187982 - Wimoveis</title>
     <h1>Apartamento Asa Sul</h1>
     <div class="price-value"><span>aluguel R$ 6.000</span></div>
     <div class="price-value">
       <span>venda</span><span>R$&nbsp;1.500.000,50</span>
       <span>Condomínio R$ 1.100 · IPTU R$ 1.600</span>
     </div>`,
    url,
    'wimoveis',
  );
  assert.equal(listing.price_cents, 150_000_050);
});

Deno.test('Wimoveis can recover the sale price from its listing title', () => {
  for (
    const [title, expected] of [
      [
        'Apartamento à venda com 3 Quartos, Asa Sul, Brasília - R$ 1.400.000, 100 m2 - ID: 3051187982 - Wimoveis',
        140_000_000,
      ],
      [
        'Apartamento à venda com 3 Quartos, Asa Norte, Brasília - R$ 1.380.000 - ID: 3050928428 - Wimoveis',
        138_000_000,
      ],
    ] as const
  ) {
    const listing = parsePropertyHtml(
      `<title>${title}</title><h1>Apartamento</h1>`,
      url,
      'wimoveis',
    );
    assert.equal(listing.price_cents, expected);
  }
});

Deno.test('Wimoveis leaves the sale price unknown when it only finds fees', () => {
  const listing = parsePropertyHtml(
    `<h1>Apartamento à venda</h1>
     <div class="price-value">Condomínio R$ 1.100 · IPTU R$ 1.600</div>`,
    url,
    'wimoveis',
  );
  assert.equal(listing.price_cents, null);
});
