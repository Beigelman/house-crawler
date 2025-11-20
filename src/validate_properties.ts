import { load } from '@std/dotenv';
import { delay } from '@std/async/delay';
import { deleteProperties, getAllProperties } from './supabase/supabase.ts';
import { Property, SearchParams } from './types.ts';
import { DfImoveisProvider } from './providers/df_imoveis.ts';
import { WimoveisProvider } from './providers/wimoveis.ts';

// Carrega variáveis de ambiente do arquivo .env
await load({ export: true });

/**
 * Identifica qual provider deve ser usado baseado na URL
 */
function getProviderForUrl(url: string, searchParams: SearchParams) {
  if (url.includes('dfimoveis.com.br')) {
    return new DfImoveisProvider(searchParams);
  } else if (url.includes('wimoveis.com.br')) {
    return new WimoveisProvider(searchParams);
  }
  return null;
}

async function validateProperties(): Promise<void> {
  console.log('🔍 Iniciando validação de imóveis...\n');

  // Buscar todos os imóveis do banco
  let allProperties: Property[] = [];
  try {
    console.log('☁️  Buscando imóveis do Supabase...\n');
    allProperties = await getAllProperties();
    console.log(`✓ ${allProperties.length} imóveis encontrados no banco\n`);
  } catch (error) {
    console.error('\n❌ Erro ao buscar imóveis do Supabase:', error);
    Deno.exit(1);
  }

  if (allProperties.length === 0) {
    console.log('ℹ️  Nenhum imóvel para validar. Encerrando...\n');
    Deno.exit(0);
  }

  // Parâmetros de busca vazios (não serão usados na validação)
  const searchParams: SearchParams = {
    neighborhoods: [],
    numberOfRooms: [],
    numberOfSuites: 0,
    hasElevator: false,
    hasParking: false,
    minArea: 0,
    maxArea: 0,
    minPrice: 0,
    maxPrice: 0,
  };

  // Validar cada propriedade
  const invalidLinks: string[] = [];
  let validCount = 0;

  for (let i = 0; i < allProperties.length; i++) {
    const property = allProperties[i];
    const progress = `[${i + 1}/${allProperties.length}]`;

    console.log(`${progress} Validando: ${property.link}`);

    try {
      const provider = getProviderForUrl(property.link, searchParams);

      if (!provider) {
        console.log(
          `  ⚠️  Provider desconhecido, marcando como inválido\n`,
        );
        invalidLinks.push(property.link);
        continue;
      }

      const isValid = await provider.isValid(property.link);

      if (isValid) {
        console.log(`  ✓ Válido\n`);
        validCount++;
      } else {
        console.log(
          `  ✗ Inválido (anúncio removido ou elementos não encontrados)\n`,
        );
        invalidLinks.push(property.link);
      }

      // Delay entre requisições para não sobrecarregar os sites
      await delay(1500);
    } catch (error) {
      console.error(`  ❌ Erro ao validar:`, error);
      console.log(`  ✗ Marcando como inválido devido ao erro\n`);
      invalidLinks.push(property.link);
    }
  }

  // Exibir estatísticas
  console.log('📊 Estatísticas da validação:');
  console.log(`   • Total de imóveis validados: ${allProperties.length}`);
  console.log(`   • Imóveis válidos: ${validCount}`);
  console.log(`   • Imóveis inválidos: ${invalidLinks.length}\n`);

  // Deletar imóveis inválidos
  if (invalidLinks.length > 0) {
    try {
      console.log('🗑️  Removendo imóveis inválidos do banco...\n');
      await deleteProperties(invalidLinks);
      console.log(
        `✅ ${invalidLinks.length} imóveis inválidos removidos com sucesso!\n`,
      );
    } catch (error) {
      console.error('\n❌ Erro ao deletar imóveis inválidos:', error);
      Deno.exit(1);
    }
  } else {
    console.log('✅ Todos os imóveis estão válidos!\n');
  }
}

if (import.meta.main) {
  await validateProperties();
}
