import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../shared/database.types.ts';
let supabaseClient: SupabaseClient<Database>;

export function getSupabaseClient(): SupabaseClient<Database> {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SECRET_KEY');

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Variáveis de ambiente SUPABASE_URL e SUPABASE_SECRET_KEY são obrigatórias',
    );
  }

  if (!supabaseKey.startsWith('sb_secret_')) {
    throw new Error('SUPABASE_SECRET_KEY deve ser uma chave sb_secret_...');
  }

  supabaseClient = createClient<Database>(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return supabaseClient;
}
