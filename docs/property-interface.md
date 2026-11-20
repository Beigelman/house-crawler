# Casa Radar: operação da interface de imóveis

A interface React lê o Supabase com sessão do proprietário. O coletor Deno continua no host atual; requisições do navegador ficam na fila até o worker local executá-las. Nenhum servidor de scraping é executado no frontend.

## Desenvolvimento e provas locais

Requer Deno, Node/pnpm, Docker e Supabase CLI. Os comandos abaixo partem da raiz; comandos Supabase usam `--workdir backend`. A interface de desenvolvimento usa 5173 e o Playwright usa 5174, ambas autorizadas no Auth local. Os testes recusam URLs remotas. Eles truncam **somente o banco Supabase local** configurado em `backend/supabase/config.toml`; use esse projeto exclusivamente para desenvolvimento.

```sh
rtk supabase start --workdir backend
rtk pnpm --dir frontend install --frozen-lockfile
rtk pnpm --dir frontend exec playwright install chromium
rtk deno task --config backend/deno.json test
rtk pnpm --dir frontend run build
rtk pnpm --dir frontend exec playwright test
rtk deno task --config backend/deno.json lint
```

Os testes incluem callbacks reais do Auth local e processos CLI com `--preload` que substitui HTTP dos portais e Resend por respostas determinísticas. Esses processos usam um diretório temporário sem `backend/.env` de produção.

Execute as provas Deno e Playwright **sequencialmente**: compartilham os mesmos dados locais. Não carregue `backend/.env` de produção nas provas. `supabase start` aplica a migração em um banco novo; para um banco local já iniciado, recrie somente esse ambiente descartável com `rtk supabase db reset --local --no-seed --workdir backend`.

Para desenvolvimento manual, copie `frontend/.env.example` para `frontend/.env.local` e preencha a URL/chave pública do projeto de desenvolvimento. `pnpm --dir frontend run dev` abre a interface em localhost. Ela não contém credenciais de worker. Crie um usuário no Auth do ambiente de desenvolvimento e configure seu UUID como proprietário conforme abaixo; não use a identidade de teste em produção.

## Instalação em um banco novo

Esta baseline exige um banco de aplicação vazio. Ela substitui o histórico antigo; não é uma migração incremental de produção. O reset remoto e a implantação são operações separadas. Não execute `db reset --linked` como parte do desenvolvimento.

1. Pare o worker antigo e os timers antes de trocar o banco/schema.
2. Em um projeto novo ou previamente limpo pelo administrador, aplique a baseline em `backend/supabase/migrations/` com a CLI. Confira o projeto alvo antes de qualquer comando remoto.
3. Configure `SUPABASE_SECRET_KEY` exclusivamente no ambiente do worker, junto da URL do novo projeto. Nunca coloque essa credencial em `VITE_*`.
4. No ambiente local descartável, reinstale com `rtk supabase db reset --local --no-seed --workdir backend`. Esse comando apaga os dados locais e aplica a baseline.
5. Provisione a conta do proprietário no Supabase Auth (Dashboard ou administração confiável), desative novos cadastros no projeto se ele for dedicado, e execute em uma sessão administrativa:

```sql
insert into private.app_owner(singleton,user_id)
values(true,'UUID-DO-USUARIO-AUTH')
on conflict(singleton) do update set user_id=excluded.user_id;
```

Somente esse UUID recebe acesso. Não use `user_metadata` editável para autorização. Um usuário autenticado diferente não pode ler nem escrever imóveis, buscas, execuções ou solicitações.

6. Confira grants e RLS para as seis tabelas públicas e a view `listing_comparisons`; rode os advisors do Supabase. Os RPCs de worker só têm EXECUTE para `service_role`; o enqueue confere a identidade dentro do banco, com search path fixo. Não habilite acesso anônimo para resolver erros.
7. Configure URL do site e redirect allowlist do Auth para `https://SEU-DOMINIO/login` (e localhost apenas no projeto de desenvolvimento). O cliente usa magic link sem criar usuários. A sessão restaura o caminho privado solicitado.
8. Defina **somente** `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` no build estático. Rode `pnpm --dir frontend install --frozen-lockfile` e `pnpm --dir frontend run build`. Publique `frontend/dist`; `_redirects` e `vercel.json` fornecem exemplos de fallback SPA. Abrir diretamente `/imoveis`, `/buscas` ou `/execucoes` deve retornar o shell com HTTP 200.
9. Inicie `deno task --config backend/deno.json worker` no host onde os portais funcionam. `deno task --config backend/deno.json run` e `deno task --config backend/deno.json validate` continuam disponíveis; todos usam o mesmo lease. Retome os timers existentes após validar o novo caminho. Os horários desses timers não mudaram.

## Worker persistente

`deno task --config backend/deno.json worker` não recebe flags. Ele lê `backend/.env`, publica heartbeat a cada 30 segundos e procura solicitações ao iniciar e a cada 1 hora após cada ciclo. Durante a execução, renova o lease a cada 30 segundos. Após 120 segundos sem renovação, o próximo processo interrompe o run antigo; commits com o token antigo são recusados. Solicitações interrompidas não são reexecutadas automaticamente.

### Coleta agendada no worker

A baseline já inclui o agendamento. O worker agenda coletas diariamente às **06:00, 14:00 e 22:00 no fuso America/Sao_Paulo**, usando o relógio do banco. Não precisa instalar cron no computador nem habilitar pg_cron.

Em cada ciclo, o worker chama `enqueue_scheduled_crawl` com sua credencial de servidor. A função coloca uma solicitação na mesma fila de “Coletar agora”, com o horário e todas as buscas habilitadas. Depois, `claim_crawl_job` assume o mesmo job e registra seus resultados. O frontend pode ficar fechado.

O agendamento começa após aplicar a migração e reiniciar `deno task --config backend/deno.json worker`. Ao iniciar ou retornar de um período offline, o worker faz uma única coleta de recuperação para o horário agendado mais recente, inclusive se esse horário foi no dia anterior. Não acumula todas as coletas perdidas. A chave persistida impede repetir o mesmo horário após reinícios ou com múltiplos workers. Uma fila ocupada adia a nova solicitação até haver espaço; sem proprietário ou buscas habilitadas, nada é criado. Uma falha no agendamento não impede o processamento de solicitações manuais.

O worker precisa estar em execução e o computador acordado para iniciar coletas. Ele verifica o agendamento ao iniciar e 1 hora após terminar cada ciclo; pedidos manuais e horários agendados podem esperar até 1 hora pela próxima consulta, além do tempo de uma coleta em andamento. Não mantenha os antigos timers de coleta do sistema ativos junto desse agendamento, pois eles criam execuções independentes. A validação continua sendo um comando/timer separado.

Para manter somente a fila manual ou continuar usando timers externos, defina `WORKER_SCHEDULE_ENABLED=false` no `backend/.env` e reinicie o worker. O padrão é agendamento habilitado.

O arquivo `backend/scripts/house-worker.service` é um exemplo de **serviço systemd de usuário**. Ajuste WorkingDirectory, EnvironmentFile e o caminho do executável Deno para seu host antes de instalar. Não instala nem modifica os timers existentes. Em hosts sem systemd, use o supervisor já escolhido para executar o mesmo comando.

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
