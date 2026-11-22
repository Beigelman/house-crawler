# Casa Radar / House Crawler

Radar pessoal de imóveis em Brasília. Coleta anúncios de DF Imóveis e Wimoveis,
armazena observações e histórico no Supabase e envia novidades por email.
A interface permite filtrar imóveis, guardar notas e favoritos, editar buscas e
acompanhar execuções.

## Organização

```text
backend/
  src/
    runtime/             # Comandos, configuração, composição e polling
    property/
      domain/            # Regras puras de correspondência das buscas
      application/       # Coleta, validação, notificação e ciclo da execução
      providers/         # Integrações com os portais e parsing de HTML
      persistence/       # Implementação do store com tabelas e RPCs
      notifications/     # Resend e templates de email
      ports.ts           # Contratos usados pelos casos de uso
    platform/            # HTTP, diagnósticos, cliente de banco e robots.txt
  supabase/              # Configuração local e migrations versionadas
  tests/                 # Unitários, integração, suporte e fixtures
  scripts/               # Execução e supervisão no host
  deno.json              # Tarefas, dependências e formatação Deno
  deno.lock              # Lockfile do backend
  .env.example           # Modelo do ambiente do worker
  Makefile               # Atalhos de execução e logs
frontend/
  src/
    app/                 # Composição, rotas e layout
    features/            # Auth, dashboard, imóveis, buscas e execuções
    components/          # Cabeçalho e estados compartilhados
    lib/                 # Cliente público, respostas e formatação
    styles/              # Estilos globais e tokens
  tests/                 # Fluxos no navegador
shared/                  # Contratos, conversão monetária e tipos gerados
```

Comece pelo [mapa de arquitetura](docs/architecture.md). As regras de persistência
estão no [mapa do banco](docs/database.md), e a instalação completa está no
[guia de operação](docs/property-interface.md).

## Desenvolvimento

Requer Deno, Node, pnpm, Docker e Supabase CLI. Execute os comandos na raiz do
repositório. O arquivo `deno.json`, o `deno.lock` e o `.env` do worker ficam em
`backend/`. Para executar tarefas Deno da raiz, use `--config backend/deno.json`;
dentro de `backend/`, use `deno task <tarefa>`.

```sh
rtk supabase start --workdir backend
rtk pnpm --dir frontend install --frozen-lockfile
rtk pnpm --dir frontend exec playwright install chromium
rtk pnpm --dir frontend run dev
```

Configure `frontend/.env.local` com a URL e a chave pública do ambiente de
desenvolvimento, seguindo `frontend/.env.example`. A interface usa a porta 5173;
os testes usam 5174. O login exige a conta configurada como proprietária.

## Coletor

Copie `backend/.env.example` para `backend/.env` e preencha as credenciais do ambiente escolhido.
A credencial `SUPABASE_SECRET_KEY` (`sb_secret_...`) pertence exclusivamente ao worker.
Use a chave **Secret** de `rtk supabase status --workdir backend` no ambiente local
ou de **Settings > API Keys** no projeto hospedado. Não use a chave publishable
nem a chave JWT legada `service_role`.
Configure também `RESEND_API_KEY`, `FROM_EMAIL` e `TO_EMAILS` para os emails.

```sh
rtk deno task --config backend/deno.json run        # Uma coleta
rtk deno task --config backend/deno.json validate   # Verificação dos anúncios existentes
rtk deno task --config backend/deno.json worker     # Fila manual e agendamento persistente
```

O worker verifica a fila ao iniciar e a cada 1 hora após cada ciclo e agenda coletas às 06:00, 14:00 e
22:00 em `America/Sao_Paulo`. `WORKER_SCHEDULE_ENABLED=false` desabilita o
agendamento interno. Todos os comandos compartilham o mesmo lease no banco.
404/410 confirmam remoção; bloqueios e falhas de rede preservam o último estado
conhecido. Uma falha de email fica registrada separadamente da coleta.

## Verificação local

Os testes de integração preparam e limpam apenas o Supabase local descartável.
Não carregue o `.env` de produção nas provas. Execute Deno e Playwright
sequencialmente, pois compartilham os dados locais.

```sh
rtk deno task --config backend/deno.json test:unit
rtk deno task --config backend/deno.json test
rtk pnpm --dir frontend run build
rtk pnpm --dir frontend test
rtk deno task --config backend/deno.json check
rtk deno task --config backend/deno.json lint
rtk deno task --config backend/deno.json fmt:check
```

As provas de CLI usam substituições determinísticas para portais e email, sem
contatar esses serviços. A aplicação em produção continua usando as integrações
reais. Os testes de navegador incluem login, filtros, notas, buscas, fila,
responsividade e navegação por teclado.

Alterações de schema seguem novas migrations em `backend/supabase/migrations/`.
O histórico aplicado não deve ser reescrito.

No Linux com systemd, após configurar `backend/.env`, execute
`bash backend/scripts/install-systemd.sh`. O worker inicia no boot e reinicia
se terminar; o validador mantém o timer existente às 00h, 08h e 16h.
Para implantar ou operar os serviços, consulte o [guia de operação](docs/property-interface.md) e
[backend/scripts/SYSTEMD-SETUP.md](backend/scripts/SYSTEMD-SETUP.md).
