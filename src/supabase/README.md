make# Configuração do Banco de Dados Supabase

## Problema: Validador não deleta links inválidos

### Causa

O Row Level Security (RLS) do Supabase estava configurado sem uma política de
DELETE, bloqueando silenciosamente todas as operações de deleção.

### Solução

Execute o script SQL abaixo no **SQL Editor** do seu projeto Supabase:

```sql
-- Adicionar política de DELETE
CREATE POLICY IF NOT EXISTS "Permitir deleção"
  ON real_states
  FOR DELETE
  USING (true);
```

Ou execute o arquivo completo:

- `enable-delete-policy.sql` - Script rápido para adicionar apenas a política de
  DELETE
- `setup-supabase.sql` - Script completo atualizado (caso precise recriar a
  tabela)

## Verificar se funcionou

Após executar o script, rode novamente o validador:

```bash
make validate
```

Agora você deve ver os logs de debug mostrando quantos registros foram
deletados:

```
[DEBUG] Tentando deletar X links...
[DEBUG] Registros deletados: X
✅ X imóveis inválidos removidos com sucesso!
```

## Arquivos

- `setup-supabase.sql` - Script completo de configuração inicial (já atualizado
  com política de DELETE)
- `enable-delete-policy.sql` - Script para adicionar apenas a política de DELETE
  (use este se já tem a tabela criada)
- `database.types.ts` - Tipos TypeScript gerados automaticamente pelo Supabase
