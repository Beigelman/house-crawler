-- Script de configuração do banco de dados Supabase para House Crawler
-- Execute este script no SQL Editor do seu projeto Supabase

-- Criar a tabela real_states
CREATE TABLE IF NOT EXISTS real_states (
  link TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  valor TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Criar índice para melhorar a performance de buscas
CREATE INDEX IF NOT EXISTS idx_real_states_created_at ON real_states(created_at DESC);

-- Habilitar Row Level Security (RLS)
ALTER TABLE real_states ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Permitir leitura pública" ON real_states;
DROP POLICY IF EXISTS "Permitir inserção" ON real_states;
DROP POLICY IF EXISTS "Permitir deleção" ON real_states;

-- Política de segurança: permitir leitura pública (para queries)
CREATE POLICY "Permitir leitura pública"
  ON real_states
  FOR SELECT
  USING (true);

-- Política de segurança: permitir inserção apenas via service role
-- (a anon key ainda pode inserir, mas você pode restringir isso mais tarde)
CREATE POLICY "Permitir inserção"
  ON real_states
  FOR INSERT
  WITH CHECK (true);

-- Política de segurança: permitir deleção
CREATE POLICY "Permitir deleção"
  ON real_states
  FOR DELETE
  USING (true);

-- Comentários descritivos
COMMENT ON TABLE real_states IS 'Tabela de armazenamento de imóveis coletados pelos crawlers';
COMMENT ON COLUMN real_states.link IS 'URL do anúncio do imóvel (chave primária única)';
COMMENT ON COLUMN real_states.titulo IS 'Título ou descrição do imóvel';
COMMENT ON COLUMN real_states.valor IS 'Valor do imóvel em formato texto';
COMMENT ON COLUMN real_states.created_at IS 'Data e hora da primeira coleta do imóvel';

-- Verificar criação
SELECT 'Tabela real_states criada com sucesso!' as status;
SELECT COUNT(*) as total_imoveis FROM real_states;

