import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Property } from "./types.ts";
import { Database } from "./database.types.ts";

let supabaseClient: SupabaseClient<Database>;

export function getSupabaseClient(): SupabaseClient<Database> {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Variáveis de ambiente SUPABASE_URL e SUPABASE_ANON_KEY são obrigatórias",
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

  const { data, error } = await client
    .from("real_states")
    .select("link")
    .in("link", properties.map((property) => property.link));

  if (error) {
    throw new Error(`Erro ao buscar imóveis: ${error.message}`);
  }

  const newProperties = properties.filter((property) =>
    !data?.some((p) => p.link === property.link)
  );

  const { error: insertError } = await client
    .from("real_states")
    .insert(newProperties);

  if (insertError) {
    throw new Error(`Erro ao inserir imóveis: ${insertError.message}`);
  }

  return newProperties;
}
