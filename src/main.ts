import { load } from "@std/dotenv";
import { collectDfImoveisProperties } from "./df_imoveis.ts";
import { collectWimoveisProperties } from "./wimoveis.ts";
import { insertNewProperties } from "./supabase.ts";
import { sendNewPropertiesEmail } from "./email.ts";
import { Property } from "./types.ts";

// Carrega variáveis de ambiente do arquivo .env
await load({ export: true });

async function main(): Promise<void> {
  console.log("🏠 Iniciando coleta de imóveis...\n");

  console.log("📍 Coletando imóveis do DF Imóveis...");
  const dfProperties = await collectDfImoveisProperties();
  console.log(`✓ ${dfProperties.length} imóveis encontrados\n`);

  console.log("📍 Coletando imóveis do Wimoveis...\n");
  const wimoveisProperties = await collectWimoveisProperties();
  console.log(`✓ ${wimoveisProperties.length} imóveis encontrados\n`);

  const allProperties = [...dfProperties, ...wimoveisProperties];
  console.log(`📊 Total de imóveis coletados: ${allProperties.length}\n`);

  if (allProperties.length === 0) {
    console.log("⚠️  Nenhum imóvel foi coletado. Encerrando...\n");
    console.log("   Possíveis causas:");
    console.log("   • Sites bloquearam o acesso (403 Forbidden)");
    console.log("   • Estrutura HTML dos sites mudou");
    console.log("   • Problemas de rede\n");
    Deno.exit(0);
  }

  let newProperties: Property[] = [];
  console.log("☁️  Sincronizando com Supabase...\n");
  try {
    newProperties = await insertNewProperties(allProperties);
    console.log(`✅ Sincronização concluída:`);
    console.log(`   • ${newProperties.length} novos imóveis inseridos\n`);
  } catch (error) {
    console.error("\n❌ Erro ao sincronizar com Supabase:", error);
    Deno.exit(1);
  }

  if (newProperties.length > 0) {
    console.log("📧 Enviando notificação por email...\n");
    const result = await sendNewPropertiesEmail(newProperties);
    if (result.success) {
      console.log("✅ Email enviado com sucesso!\n");
    } else {
      console.error("\n❌ Erro ao enviar email:", result.error);
      Deno.exit(1);
    }
  } else {
    console.log("ℹ️  Nenhum imóvel novo encontrado. Email não será enviado.\n");
  }
}

if (import.meta.main) {
  await main();
}
