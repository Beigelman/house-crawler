# House Crawler 🏠

Crawler de imóveis que coleta anúncios de múltiplas fontes e armazena no
Supabase.

## 🚀 Funcionalidades

- Coleta automática de imóveis de diferentes sites:
  - DF Imóveis
  - Wimoveis
- Armazenamento em banco de dados Supabase
- Detecção automática de duplicatas (baseada no link)
- Backup local em JSON
- Inserção apenas de novos imóveis
- 📧 **Notificação por email com novos imóveis encontrados** (usando Resend)

## 📋 Pré-requisitos

- [Deno](https://deno.land/) instalado
- Conta no [Supabase](https://supabase.com/)
- Conta no [Resend](https://resend.com/) (para notificações por email)

## ⚙️ Configuração

### 1. Configurar o Supabase

1. Crie um novo projeto no [Supabase](https://app.supabase.com/)
2. No SQL Editor do Supabase, execute o script `setup-supabase.sql` para criar a
   tabela
3. Obtenha suas credenciais em **Settings > API**:
   - Project URL
   - Anon/Public Key

### 2. Configurar o Resend

1. Crie uma conta em [Resend](https://resend.com/)
2. Obtenha sua API Key em **API Keys**
3. (Opcional) Configure um domínio personalizado em **Domains**

### 3. Configurar Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```bash
# Supabase
SUPABASE_URL=https://seu-projeto-id.supabase.co
SUPABASE_ANON_KEY=sua-chave-anon-aqui

# Email (Resend)
RESEND_API_KEY=re_sua_chave_api_aqui
FROM_EMAIL=imoveis@seudominio.com
TO_EMAILS=seu.email@example.com,outro.email@example.com
```

**✨ O arquivo `.env` é carregado automaticamente!** Não é necessário exportar
as variáveis manualmente.

**Importante:**

- O arquivo `.env` já está no `.gitignore` e não será commitado
- `TO_EMAILS` aceita múltiplos emails separados por vírgula
- Para testes, use `onboarding@resend.dev` como `FROM_EMAIL`

### 4. Instalar Dependências

As dependências serão instaladas automaticamente pelo Deno ao executar o
projeto.

## 🎯 Uso

### Testar Configuração de Email

Antes de executar o crawler completo, teste a configuração de email:

```bash
deno task test-email
```

### Executar o Crawler

```bash
deno task run
```

Ou diretamente:

```bash
deno run --allow-net --allow-write --allow-env src/main.ts
```

### O que acontece ao executar?

1. 🔍 Coleta imóveis de todos os sites configurados
2. 💾 Salva backup local em `imoveis.json`
3. ☁️ Sincroniza com Supabase:
   - Novos imóveis são inseridos
   - Imóveis já existentes (mesmo link) são ignorados
4. 📧 Envia email de notificação com os novos imóveis (se houver)
5. 📊 Exibe relatório com número de imóveis novos e status do email

## 🗂️ Estrutura do Projeto

```
house-crawler/
├── src/
│   ├── main.ts              # Arquivo principal
│   ├── supabase.ts          # Cliente e funções Supabase
│   ├── email.ts             # Integração com Resend
│   ├── email-template.ts    # Template HTML do email
│   ├── types.ts             # Tipos TypeScript
│   ├── utils.ts             # Utilitários
│   ├── df_imoveis.ts        # Crawler DF Imóveis
│   ├── wimoveis.ts          # Crawler Wimoveis
│   ├── test-connection.ts   # Teste de conexão Supabase
│   └── test-email.ts        # Teste de email
├── deno.json                # Configuração Deno
├── setup-supabase.sql       # Script SQL
├── imoveis.json             # Backup local (gerado)
└── .env                     # Variáveis de ambiente (criar)
```

## 📊 Estrutura da Tabela `real_states`

| Coluna     | Tipo      | Descrição                       |
| ---------- | --------- | ------------------------------- |
| link       | TEXT (PK) | URL do anúncio (chave primária) |
| titulo     | TEXT      | Título do anúncio               |
| valor      | TEXT      | Valor do imóvel                 |
| created_at | TIMESTAMP | Data da primeira coleta         |

## 🔧 Comandos Úteis

```bash
# Testar conexão com Supabase
deno task test

# Testar configuração de email
deno task test-email

# Executar o crawler
deno task run

# Formatar código
deno task fmt

# Lint
deno task lint
```

## 📝 Notas

- O crawler mantém um backup local em `imoveis.json` antes de sincronizar com
  Supabase
- A chave primária é o `link`, garantindo que não haja duplicatas
- Imóveis já cadastrados são automaticamente ignorados
- O campo `created_at` registra quando o imóvel foi visto pela primeira vez
- Emails são enviados apenas quando há novos imóveis encontrados
- O template de email é responsivo e funciona em todos os clientes de email
- Se houver erro ao enviar o email, o crawler continua funcionando normalmente

## 🔒 Segurança

- As variáveis de ambiente nunca devem ser commitadas
- Use a chave `ANON_KEY` para operações públicas
- Configure políticas RLS (Row Level Security) no Supabase conforme necessário
- O script SQL já inclui políticas básicas de segurança

## 📄 Licença

Este projeto é de código aberto.
