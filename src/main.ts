import { collectDfImoveisProperties } from "./df_imoveis.ts";
import { collectWimoveisProperties } from "./wimoveis.ts";

async function main(): Promise<void> {
  console.log("Coletando imóveis do DF Imóveis...");
  const dfProperties = await collectDfImoveisProperties();

  console.log("Coletando imóveis do Wimoveis...");
  const wimoveisProperties = await collectWimoveisProperties();

  const allProperties = [...dfProperties, ...wimoveisProperties];
  console.log(`Total de imóveis coletados: ${allProperties.length}`);

  const payload = JSON.stringify(allProperties, null, 2);
  await Deno.writeTextFile("imoveis.json", payload, { create: true });
}

if (import.meta.main) {
  await main();
}
