import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Property } from '../types.ts';
import { Database } from './database.types.ts';

let supabaseClient: SupabaseClient<Database>;

// PostgREST serializes `in` filters into the request URL. Keep each filter well
// below common proxy URL limits, accounting for URL encoding of every link.
const MAX_IN_FILTER_ENCODED_LENGTH = 6_000;

function uniquePropertiesByLink(properties: Property[]): Property[] {
  const byLink = new Map<string, Property>();

  for (const property of properties) {
    if (!byLink.has(property.link)) {
      byLink.set(property.link, property);
    }
  }

  return Array.from(byLink.values());
}

function chunkLinksForFilter(links: string[]): string[][] {
  const chunks: string[][] = [];
  let currentChunk: string[] = [];
  let currentLength = 0;

  for (const link of links) {
    const encodedLength = encodeURIComponent(link).length + 1;

    if (
      currentChunk.length > 0 &&
      currentLength + encodedLength > MAX_IN_FILTER_ENCODED_LENGTH
    ) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentLength = 0;
    }

    currentChunk.push(link);
    currentLength += encodedLength;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
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

  const existingLinks = new Set<string>();
  const linkChunks = chunkLinksForFilter(
    uniqueProperties.map((property) => property.link),
  );

  for (const links of linkChunks) {
    const { data, error } = await client
      .from('real_states')
      .select('link')
      .in('link', links);

    if (error) {
      throw new Error(`Erro ao buscar imóveis: ${error.message}`);
    }

    for (const property of data ?? []) {
      existingLinks.add(property.link);
    }
  }

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
