# Casa Radar: operação da interface de imóveis

A interface React lê o Supabase com sessão do proprietário. O coletor Deno continua no host atual; requisições do navegador ficam na fila até o worker local executá-las. Nenhum servidor de scraping é executado no frontend.

## Desenvolvimento e provas locais

Requer Deno, Node/npm, Docker e Supabase CLI. Os testes recusam URLs remotas. Eles truncam **somente o banco Supabase local** configurado em `supabase/config.toml`; use esse projeto exclusivamente para desenvolvimento.

```sh
rtk supabase start
rtk npm --prefix frontend ci
rtk npm --prefix frontend exec -- playwright install chromium
rtk deno task test
rtk npm --prefix frontend run build
rtk npm --prefix frontend exec -- playwright test
rtk deno task lint
```

Os testes incluem callbacks reais do Auth local e processos CLI com `--preload` que substitui HTTP dos portais e Resend por respostas determinísticas. Esses processos usam um diretório temporário sem `.env` de produção.

Execute as provas Deno e Playwright **sequencialmente**: compartilham os mesmos dados locais. Não carregue `.env` de produção nas provas. `supabase start` aplica a migração em um banco novo; para um banco local já iniciado, aplique o arquivo SQL em uma sessão local ou recrie somente esse ambiente descartável.

Para desenvolvimento manual, copie `frontend/.env.example` para `frontend/.env.local` e preencha a URL/chave pública do projeto de desenvolvimento. `npm --prefix frontend run dev` abre a interface em localhost. Ela não contém credenciais de worker. Crie um usuário no Auth do ambiente de desenvolvimento e configure seu UUID como proprietário conforme abaixo; não use a identidade de teste em produção.

## Corte de credenciais e migração em produção

Push, implantação e alterações no banco real exigem autorização explícita; este documento não as executa.

1. Inventarie o schema e as policies reais. Faça backup do banco e registre a quantidade e uma exportação de `link,titulo,valor,created_at`. A migração preserva esses campos e acrescenta atributos opcionais. Imóveis antigos não ganham quartos/área/bairro inventados.
2. Pause os timers atuais e espere qualquer coleta/validação terminar. Não rode a versão antiga junto da versão nova durante o corte: a versão antiga não participa do lease.
3. Configure `SUPABASE_SERVICE_ROLE_KEY` no ambiente **do worker**. Antes de revogar permissões antigas, verifique essa credencial com uma consulta somente leitura à tabela existente; não a imprima nem a coloque em uma variável `VITE_*`. O código novo recusa o fallback para a chave anônima.
4. Revise e aplique `supabase/migrations/*_property_interface.sql` no banco autorizado. Ele é aditivo e repetível, mas revoga as policies públicas antigas. Confira a exportação do passo 1 e os totais após o backfill; preços legados têm uma observação marcada `legacy`, não uma variação de preço fabricada.
5. Provisione a conta do proprietário no Supabase Auth (Dashboard ou administração confiável), desative novos cadastros no projeto se ele for dedicado, e execute em uma sessão administrativa:

```sql
insert into private.property_owner(singleton,user_id)
values(true,'UUID-DO-USUARIO-AUTH')
on conflict(singleton) do update set user_id=excluded.user_id;
```

Somente esse UUID recebe acesso. Não use `user_metadata` editável para autorização. Um usuário autenticado diferente não pode ler nem escrever imóveis, buscas, execuções ou solicitações.

6. Confira grants e RLS para todas as tabelas `property_*` e `real_states`; rode os advisors do Supabase. Os RPCs de worker só têm EXECUTE para `service_role`; o enqueue confere a identidade dentro do banco, com search path fixo. Não habilite acesso anônimo para resolver erros.
7. Configure URL do site e redirect allowlist do Auth para `https://SEU-DOMINIO/login` (e localhost apenas no projeto de desenvolvimento). O cliente usa magic link sem criar usuários. A sessão restaura o caminho privado solicitado.
8. Defina **somente** `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` no build estático. Rode `npm --prefix frontend ci` e `npm --prefix frontend run build`. Publique `frontend/dist`; `_redirects` e `vercel.json` fornecem exemplos de fallback SPA. Abrir diretamente `/imoveis`, `/buscas` ou `/execucoes` deve retornar o shell com HTTP 200.
9. Inicie `deno task worker` no host onde os portais funcionam. `deno task run` e `deno task validate` continuam disponíveis; todos usam o mesmo lease. Retome os timers existentes após validar o novo caminho. Os horários desses timers não mudaram.

## Worker persistente

`deno task worker` não recebe flags. Ele lê `.env`, publica heartbeat, procura solicitações a cada 30 segundos e renova o lease a cada 30 segundos durante a execução. Após 120 segundos sem renovação, o próximo processo interrompe o run antigo; commits com o token antigo são recusados. Solicitações interrompidas não são reexecutadas automaticamente.

### Coleta agendada no worker

Aplique também `supabase/migrations/20261118223050_property_worker_schedule.sql` antes de reiniciar o worker. Ele agenda coletas diariamente às **06:00, 14:00 e 22:00 no fuso America/Sao_Paulo**, usando o relógio do banco. Não precisa instalar cron no computador nem habilitar pg_cron.

Em cada ciclo, o worker chama `enqueue_scheduled_property_crawl` com sua credencial de servidor. A função coloca uma solicitação na mesma fila de “Coletar agora”, com o proprietário e todas as buscas habilitadas. Depois, `claim_property_run` assume a solicitação e registra a execução e seus resultados. O frontend pode ficar fechado.

O agendamento começa após aplicar a migração e reiniciar `deno task worker`. Ao iniciar ou retornar de um período offline, o worker faz uma única coleta de recuperação para o horário agendado mais recente, inclusive se esse horário foi no dia anterior. Não acumula todas as coletas perdidas. A chave persistida impede repetir o mesmo horário após reinícios ou com múltiplos workers. Uma fila ocupada adia a nova solicitação até haver espaço; sem proprietário ou buscas habilitadas, nada é criado. Uma falha no agendamento não impede o processamento de solicitações manuais.

O worker precisa estar em execução e o computador acordado para iniciar coletas. Ele verifica o agendamento no máximo 30 segundos após terminar a execução anterior; coletas longas podem atrasar o próximo horário. Não mantenha os antigos timers de coleta do sistema ativos junto desse agendamento, pois eles criam execuções independentes. A validação continua sendo um comando/timer separado.

Para manter somente a fila manual ou continuar usando timers externos, defina `WORKER_SCHEDULE_ENABLED=false` no `.env` e reinicie o worker. O padrão é agendamento habilitado.

O arquivo `scripts/house-worker.service` é um exemplo de **serviço systemd de usuário**. Ajuste WorkingDirectory, EnvironmentFile e o caminho do executável Deno para seu host antes de instalar. Não instala nem modifica os timers existentes. Em hosts sem systemd, use o supervisor já escolhido para executar o mesmo comando.

Saídas: 0 para execução concluída, 1 para parcial/falha, 2 para coletor ocupado. Resumos incluem o UUID da execução. O daemon permanece ativo entre execuções. Credenciais e detalhes arbitrários de exceções não entram nos diagnósticos persistidos.

## Smoke test de go-live

- Faça login como proprietário; abra listagem/detalhe, grave nota/favorito e recarregue.
- Abra uma rota privada sem sessão e consulte o Data API com outra identidade: nenhum dado privado deve aparecer.
- Edite uma busca, solicite uma coleta e feche o navegador. Verifique queued/running e o resultado em Execuções após reabrir.
- Confirme no host que ambos os portais são acessíveis. Um 403 aparece como falha da fonte; não exclui histórico. Acesso em nuvem não foi presumido nem testado.
- Confira os novos anúncios e o resultado separado do email. Resend usa os destinatários do ambiente; uma falha de email não reexecuta a coleta nem dispara reenvio automático.
- Abra caminhos profundos no domínio estático e confira login/redirects reais.

## Retenção e rollback operacional

Não há purge nem exclusão física de anúncios pela interface. 404/410 ou remoção explícita confirmam indisponibilidade; 403, timeout e erro de parser deixam a última disponibilidade confirmada intacta e registram verificação desconhecida. Sumir de uma busca não comprova remoção.

Para suspender a nova experiência, pare o worker e despublique/desabilite a interface estática. Preserve tabelas, policies privadas, notas e histórico. Não reintroduza as policies públicas antigas. Para voltar ao coletor antigo, faça primeiro um ajuste revisado para credencial de servidor e não execute duas versões concorrentes; o coletor antigo ignora o lease e o histórico novo.

Comparações são de **preços pedidos dos anúncios coletados**, nunca avaliações do mercado ou preços de transação. Exigem cinco outros anúncios ativos com mesmo bairro/quartos e preço/área válidos. A amostra reflete o que suas buscas coletaram.

## Dependências e limites

Versões diretas estão fixadas e os lockfiles são versionados. A auditoria npm inicial reportou um advisory transitivo de ReDoS em picomatch (ferramentas de desenvolvimento Vite), sem versão corrigida disponível no registry consultado. Não aceite padrões glob de usuários no servidor de desenvolvimento e mantenha-o vinculado a localhost; reavalie o advisory ao atualizar as dependências. A implantação é estática e não executa o scanner glob do Vite.
