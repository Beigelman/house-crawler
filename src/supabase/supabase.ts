import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Property } from '../types.ts';
import { Database } from './database.types.ts';

let supabaseClient: SupabaseClient<Database>;

function uniquePropertiesByLink(properties: Property[]): Property[] {
  const byLink = new Map<string, Property>();

  for (const property of properties) {
    if (!byLink.has(property.link)) {
      byLink.set(property.link, property);
    }
  }

  return Array.from(byLink.values());
}

export function getSupabaseClient(): SupabaseClient<Database> {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Variáveis de ambiente SUPABASE_URL e SUPABASE_ANON_KEY são obrigatórias',
    );
  }

  supabaseClient = createClient<Database>(supabaseUrl, supabaseKey);
  return supabaseClient;
}

/**
 * Insere novos imóveis no Supabase, ignorando duplicatas (mesmo link)
 */
export async function insertNewProperties(
  properties: Property[],
): Promise<Property[]> {
  const client = getSupabaseClient();
  const uniqueProperties = uniquePropertiesByLink(properties);

  if (uniqueProperties.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from('real_states')
    .select('link')
    .in('link', uniqueProperties.map((property) => property.link));

  if (error) {
    throw new Error(`Erro ao buscar imóveis: ${error.message}`);
  }

  const existingLinks = new Set(data?.map((property) => property.link) ?? []);
  const newProperties = uniqueProperties.filter((property) =>
    !existingLinks.has(property.link)
  );

  if (newProperties.length === 0) {
    return [];
  }

  const { error: insertError } = await client
    .from('real_states')
    .insert(newProperties);

  if (insertError) {
    throw new Error(`Erro ao inserir imóveis: ${insertError.message}`);
  }

  return newProperties;
}

/**
 * Busca todos os imóveis salvos no Supabase
 */
export async function getAllProperties(): Promise<Property[]> {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from('real_states')
    .select('titulo, valor, link');

  if (error) {
    throw new Error(`Erro ao buscar imóveis: ${error.message}`);
  }

  return data || [];
}

/**
 * Deleta imóveis do Supabase pelos links fornecidos
 */
export async function deleteProperties(
  links: string[],
): Promise<void> {
  if (links.length === 0) {
    return;
  }

  const client = getSupabaseClient();

  const { error } = await client
    .from('real_states')
    .delete()
    .in('link', links);

  if (error) {
    throw new Error(`Erro ao deletar imóveis: ${error.message}`);
  }
}
