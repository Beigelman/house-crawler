# Banco de dados

A baseline em `backend/supabase/migrations/` instala um banco novo. Ela substitui o histórico legado e não pode ser aplicada por cima do schema antigo. Nenhum reset remoto faz parte deste refactor.

## Tabelas

| Tabela | Responsabilidade |
| --- | --- |
| `public.listings` | Anúncios dos portais, com UUID interno, URL única, identificador opcional da fonte e últimos atributos conhecidos |
| `public.listing_price_history` | Primeiro preço e mudanças reais, ligados ao anúncio e ao job |
| `public.listing_marks` | Status e nota do proprietário por UUID de anúncio |
| `public.saved_searches` | Critérios tipados, limites em centavos, fontes e habilitação |
| `public.crawl_jobs` | Fila e execução em um registro: origem, chave idempotente, snapshot, estados e email |
| `public.crawl_source_runs` | Resultado, quantidade e diagnóstico de cada fonte/busca em um job |
| `private.worker_state` | Heartbeat, job atual, token de fencing e validade do lease |
| `private.app_owner` | UUID do usuário autorizado no Supabase Auth |

Um anúncio representa uma publicação, não um imóvel físico deduplicado entre portais. `(source, source_listing_id)` é único quando há identificador confiável; a URL canônica também é única. Relacionamentos usam o UUID interno. A aplicação conserva URLs nas rotas de detalhe para permitir links diretos.

Não existem colunas legadas `titulo`/`valor`, flags de importação nem tabela de correspondências persistidas. Preços usam centavos inteiros; valores desconhecidos permanecem nulos. `first_seen_at`, `last_seen_at`, `last_checked_at` e `removed_at` têm significados separados.

`shared/search.ts` converte critérios tipados para os objetos de formulário/providers e snapshots imutáveis para a execução. No banco, amenities `true` são exigências e `null` significa sem exigência; a UI mantém seus checkboxes atuais. Faixas e arrays têm constraints no banco.

## Consultas e transações

`listing_comparisons` é uma view com `security_invoker=true`: usa RLS das tabelas e calcula pares ativos do mesmo bairro/quartos, excluindo o próprio anúncio. São necessários cinco pares com preço/área válidos. Mediana, diferença percentual e horário da consulta não são persistidos.

| RPC | Responsabilidade |
| --- | --- |
| `is_app_owner` | Autoriza a identidade nas policies/RPCs |
| `enqueue_crawl` | Persiste um job manual, replay idempotente, limite de 60 segundos e uma tarefa ativa |
| `enqueue_scheduled_crawl` | Persiste uma tarefa por horário de Brasília, sem repetir slots concluídos |
| `seed_saved_search` | Configuração inicial padrão quando não há buscas |
| `claim_crawl_job` | Claim exclusivo e snapshot dos critérios; interrompe tarefa com lease expirado |
| `renew_worker_lease` | Renova somente o token/job atual |
| `save_listing_batch` | Atualiza observações e anexa mudanças de preço na mesma transação |
| `record_crawl_source` | Registra o resultado da fonte com lease válido |
| `finish_crawl_job` | Finaliza o job, resultado de email e diagnóstico geral sanitizado, liberando o lease |
| `record_worker_heartbeat` | Atualiza a saúde com relógio do banco |
| `worker_health` | Retorna apenas o heartbeat para o proprietário, sem expor o token |

O lease é renovado a cada 30 segundos e expira após 120 segundos. Claim, enqueue manual e agendado são serializados no banco. Uma CLI direta não ultrapassa um job já enfileirado. Todos os caminhos de escrita do worker validam o fencing token. Falhas gerais ficam em `crawl_jobs.error_category`; resultados por fonte aceitam apenas portais reais. Um job corresponde a uma tentativa; não há retentativa automática.

Ausência numa busca não confirma remoção. 403, timeout e falha de parser preservam a disponibilidade confirmada. Remoção mantém notas e preços. Preço desconhecido preserva o último preço e seu timestamp. Verificar apenas a disponibilidade também preserva o timestamp da observação de preço. Atributos desconhecidos não apagam valores conhecidos. Mudanças reais de preço dentro do mesmo job também são mantidas; observações repetidas sem mudança não criam linhas.

## Acesso e desenvolvimento

As seis tabelas públicas usam RLS e grants restritos ao proprietário; somente buscas e notas podem ser escritas pela sessão. O worker usa credencial de servidor. As tabelas privadas não são expostas no Data API. O usuário proprietário referencia `auth.users`.

```sh
rtk supabase db reset --local --no-seed --workdir backend
rtk supabase gen types --lang typescript --local --workdir backend > shared/database.types.ts
```

O reset acima é apenas para o ambiente local descartável. Tipos são gerados do schema local. Mudanças futuras usam novas migrations, sem reescrever uma baseline já implantada.
