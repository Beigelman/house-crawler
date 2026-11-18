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
frontend/
  src/
    app/                 # Composição, rotas e layout
    features/            # Auth, dashboard, imóveis, buscas e execuções
    components/          # Cabeçalho e estados compartilhados
    lib/                 # Cliente público, respostas e formatação
    styles/              # Estilos globais e tokens
  tests/                 # Fluxos no navegador
shared/                  # Contratos, conversão monetária e tipos gerados
tests/                  # Unitários, integração, suporte e fixtures
scripts/                 # Execução e supervisão no host
```

Comece pelo [mapa de arquitetura](docs/architecture.md). As regras de persistência
estão no [mapa do banco](docs/database.md), e a instalação completa está no
[guia de operação](docs/property-interface.md).

## Desenvolvimento

Requer Deno, Node, pnpm, Docker e Supabase CLI. Execute os comandos na raiz do
repositório. O arquivo `deno.json`, o `deno.lock` e o `.env` do worker ficam na raiz.

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

Copie `.env.example` para `.env` e preencha as credenciais do ambiente escolhido.
A credencial `SUPABASE_SERVICE_ROLE_KEY` pertence exclusivamente ao worker.
Configure também `RESEND_API_KEY`, `FROM_EMAIL` e `TO_EMAILS` para os emails.

```sh
rtk deno task run        # Uma coleta
rtk deno task validate   # Verificação dos anúncios existentes
rtk deno task worker     # Fila manual e agendamento persistente
```

O worker verifica a fila a cada 30 segundos e agenda coletas às 06:00, 14:00 e
22:00 em `America/Sao_Paulo`. `WORKER_SCHEDULE_ENABLED=false` desabilita o
agendamento interno. Todos os comandos compartilham o mesmo lease no banco.
404/410 confirmam remoção; bloqueios e falhas de rede preservam o último estado
conhecido. Uma falha de email fica registrada separadamente da coleta.

## Verificação local

Os testes de integração preparam e limpam apenas o Supabase local descartável.
Não carregue o `.env` de produção nas provas. Execute Deno e Playwright
sequencialmente, pois compartilham os dados locais.

```sh
rtk deno task test:unit
rtk deno task test
rtk pnpm --dir frontend run build
rtk pnpm --dir frontend test
rtk deno task check
rtk deno task lint
rtk deno task fmt:check
```

As provas de CLI usam substituições determinísticas para portais e email, sem
contatar esses serviços. A aplicação em produção continua usando as integrações
reais. Os testes de navegador incluem login, filtros, notas, buscas, fila,
responsividade e navegação por teclado.

Alterações de schema seguem novas migrations em `backend/supabase/migrations/`.
O histórico aplicado não deve ser reescrito. Para implantar ou operar serviços
systemd, consulte o [guia de operação](docs/property-interface.md) e
[scripts/SYSTEMD-SETUP.md](scripts/SYSTEMD-SETUP.md).
