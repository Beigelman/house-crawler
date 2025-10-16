/**
 * Script de teste para verificação de robots.txt
 * 
 * Execute: deno run --allow-net src/test-robots.ts
 */

import { checkUrlAgainstRobotsTxt } from "./robots.ts";

const urlsToTest = [
  // DF Imóveis
  "https://www.dfimoveis.com.br/venda/df/brasilia/asa-norte,asa-sul/imoveis/3,4-quartos",
  "https://www.dfimoveis.com.br/imovel/123456",
  "https://www.dfimoveis.com.br/favoritos/", // Deve ser bloqueado
  "https://www.dfimoveis.com.br/conta/", // Deve ser bloqueado

  // Wimoveis
  "https://www.wimoveis.com.br/venda/apartamentos/brasil/desde-3-ate-4-quartos/areac-elevador?areaUnit=1&bathroom=2&coveredArea=90,&loc=Z:42705,42704&price=,1200000",
  "https://www.wimoveis.com.br/venda/apartamentos/brasil?sort=price", // Pode ser bloqueado
  "https://www.wimoveis.com.br/venda/apartamentos/brasil?page=10", // Deve ser bloqueado (>5)
  "https://www.wimoveis.com.br/venda/apartamentos/brasil?page=3", // Deve ser permitido
];

console.log("🤖 Testando robots.txt dos sites\n");
console.log("=".repeat(70));

for (const url of urlsToTest) {
  console.log(`\n📍 URL: ${url}`);

  try {
    const result = await checkUrlAgainstRobotsTxt(url);

    if (result.allowed) {
      console.log(`   ✅ ${result.reason}`);
    } else {
      console.log(`   ❌ ${result.reason}`);
    }
  } catch (error) {
    console.log(`   ⚠️  Erro: ${error}`);
  }
}

console.log("\n" + "=".repeat(70));
console.log("\n💡 Nota: robots.txt é uma convenção ética, não uma restrição técnica.");
console.log("   O erro 403 que você está recebendo vem de um firewall/WAF,");
console.log("   não do robots.txt.\n");

