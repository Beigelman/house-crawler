# Banco de dados

O schema atual é definido pelas migrations em
`backend/supabase/migrations/`. Os arquivos foram movidos sem alteração de
conteúdo. A configuração local fica em `backend/supabase/config.toml`.

## Tabelas

| Tabela                       | Responsabilidade                                                                   |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| `public.real_states`         | Identidade do imóvel pelo link, atributos observados, disponibilidade e comparação |
| `public.property_profile`    | Buscas habilitadas, critérios e fontes                                             |
| `public.property_mark`       | Status e nota do usuário sobre um imóvel                                           |
| `public.property_request`    | Solicitações duráveis de coleta e chave idempotente                                |
| `public.property_run`        | Fotografia das buscas e resultado de cada execução                                 |
| `public.property_source_run` | Resultado, quantidade e diagnóstico de cada fonte                                  |
| `public.property_price`      | Observações de preço, incluindo importações legadas                                |
| `public.property_match`      | Relação entre buscas e imóveis correspondentes                                     |
| `public.property_heartbeat`  | Último sinal do worker                                                             |
| `private.property_owner`     | Identidade autorizada a acessar o painel                                           |
| `private.property_lease`     | Dono, token e validade da execução exclusiva                                       |

## Funções e invariantes

| RPC / função                       | Regra que protege                                                                        |
| ---------------------------------- | ---------------------------------------------------------------------------------------- |
| `is_property_owner`                | Identidade autorizada, verificada nas policies/RPCs                                      |
| `enqueue_property_crawl`           | Enqueue manual durável, replay idempotente, limite de frequência e uma solicitação ativa |
| `enqueue_scheduled_property_crawl` | Agenda pelo relógio do banco, com a mesma fila e uma identidade por horário              |
| `private.property_schedule_slot`   | Horário mais recente às 06:00, 14:00 ou 22:00 em Brasília                                |
| `seed_property_profile`            | Busca inicial padrão quando necessária                                                   |
| `claim_property_run`               | Aquisição exclusiva, fotografia dos perfis e interrupção de execução expirada            |
| `renew_property_lease`             | Renovação do dono atual                                                                  |
| `private.assert_property_lease`    | Rejeição de gravações com token vencido ou substituído                                   |
| `save_property_batch`              | Persistência de atributos, preço/histórico, correspondência e novidades                  |
| `record_property_source`           | Resultado da fonte vinculado à execução válida                                           |
| `finish_property_run`              | Finalização, comparação e resultado de email separado                                    |

O lease é renovado pelo worker a cada 30 segundos. Após 120 segundos sem
renovação, outro processo pode assumir; o token anterior não pode mais gravar.
Essas garantias dependem de transações e validação no banco, não apenas do timer
TypeScript.

Ausência numa busca não confirma remoção. 403, timeout e falha de parser deixam
a disponibilidade confirmada intacta. Remoção confirmada preserva histórico e
notas. Preço desconhecido preserva a última observação válida. Comparações usam
preços pedidos de anúncios coletados e exigem pelo menos cinco outros anúncios
ativos elegíveis.

## Acesso e evolução

RLS e grants restringem a interface ao proprietário configurado. Funções do worker
são chamadas com credencial de servidor. A interface usa chave pública e sessão.
Verifique o SQL das migrations para os predicados e permissões exatos.

Execute ferramentas locais a partir da raiz com `--workdir backend`:

```sh
rtk supabase status --workdir backend
rtk supabase migration list --local --workdir backend
rtk supabase gen types --lang typescript --local --workdir backend > shared/database.types.ts
```

Gere os tipos somente contra o schema local atualizado e revise o diff. Não edite
`shared/database.types.ts` manualmente. Mudanças futuras de schema usam novas
migrations; não reformate migrations já aplicadas. O material em
`docs/legacy-supabase/` é histórico e não deve ser usado para configurar acesso.
Consulte [property-interface.md](property-interface.md) para a operação atual.
