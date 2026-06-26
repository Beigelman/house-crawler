import { load } from '@std/dotenv';
import { insertNewProperties } from './supabase/supabase.ts';
import { sendNewPropertiesEmail } from './email/email.ts';
import { Property, PropertyProvider, SearchParams } from './types.ts';
import { DfImoveisProvider } from './providers/df_imoveis.ts';
import { WimoveisProvider } from './providers/wimoveis.ts';

// Carrega variáveis de ambiente do arquivo .env
await load({ export: true });

async function searchProperties(providers: PropertyProvider[]): Promise<void> {
  console.log('🏠 Iniciando coleta de imóveis...\n');

  const allProperties: Property[] = [];
  for (const provider of providers) {
    console.log(`📍 Coletando imóveis do ${provider.name}...\n`);
    const properties = await provider.collect();
    console.log(`✓ ${properties.length} imóveis encontrados\n`);
    allProperties.push(...properties);
  }

  console.log(`📊 Total de imóveis coletados: ${allProperties.length}\n`);

  if (allProperties.length === 0) {
    console.log('⚠️  Nenhum imóvel foi coletado. Encerrando...\n');
    console.log('   Possíveis causas:');
    console.log('   • Sites bloquearam o acesso (403 Forbidden)');
    console.log('   • Estrutura HTML dos sites mudou');
    console.log('   • Problemas de rede\n');
    Deno.exit(0);
  }

  let newProperties: Property[] = [];
  console.log('☁️  Sincronizando com Supabase...\n');
  try {
    newProperties = await insertNewProperties(allProperties);
    console.log(`✅ Sincronização concluída:`);
    console.log(`   • ${newProperties.length} novos imóveis inseridos\n`);
  } catch (error) {
    console.error('\n❌ Erro ao sincronizar com Supabase:', error);
    Deno.exit(1);
  }

  if (newProperties.length === 0) {
    console.log('ℹ️  Nenhum imóvel novo encontrado. Email não será enviado.\n');
    Deno.exit(0);
  }

  console.log('📧 Enviando notificação por email...\n');
  const result = await sendNewPropertiesEmail(newProperties);
  if (result.error) {
    console.error('\n❌ Erro ao enviar email:', result.error);
    Deno.exit(1);
  }

  console.log('✅ Email enviado com sucesso!\n');
}

if (import.meta.main) {
  const searchParams: SearchParams = {
    neighborhoods: ['asa-norte', 'asa-sul', 'octogonal'],
    numberOfRooms: [3, 4],
    numberOfSuites: 1,
    hasElevator: true,
    hasParking: true,
    minArea: 90,
    maxArea: 160,
    minPrice: 500000,
    maxPrice: 1350000,
  };

  const dfImoveisProvider = new DfImoveisProvider(searchParams);
  const wimoveisProvider = new WimoveisProvider(searchParams);

  await searchProperties([dfImoveisProvider, wimoveisProvider]);
}
