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

Deno.test('Wimoveis ignores its no-garage translation when reading parking', () => {
  for (
    const [summary, expected] of [
      ['Apartamento · 123m² · 3 quartos · 2 vagas', true],
      ['Apartamento · 123m² · 3 quartos · 10 vagas', true],
      ['Apartamento · 123m² · 3 quartos · 0 vaga', false],
      ['Apartamento · 123m² · 3 quartos', null],
    ] as const
  ) {
    const listing = parsePropertyHtml(
      `<div id="article-container">
         <h2 class="title-type-sup-property">${summary}</h2>
         <script>const labels = { noGarage: 'sem vaga' };</script>
       </div>`,
      url,
      'wimoveis',
    );
    assert.equal(listing.has_parking, expected, summary);
  }
});

Deno.test('Wimoveis prioritizes the parking feature over other page text', () => {
  const listing = parsePropertyHtml(
    `<div id="article-container">
       <ul id="section-icon-features-property">
         <li class="icon-feature"><i class="icon-cochera"></i> 2 vagas</li>
       </ul>
       <p>Ao lado de um bloco sem garagem.</p>
     </div>`,
    url,
    'wimoveis',
  );
  assert.equal(listing.has_parking, true);
});
