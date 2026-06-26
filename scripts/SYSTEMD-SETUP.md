# Configuração do systemd Timer

Este documento explica como usar o systemd timer para executar o crawler
automaticamente às **06h e 18h** todos os dias.

## 📋 Arquivos criados

- `house-crawler.service` - Define o serviço que executa o crawler
- `house-crawler.timer` - Define os horários de execução (06h e 18h)
- `install-systemd.sh` - Script para instalar e configurar automaticamente

## 🚀 Instalação Rápida

```bash
# Execute o script de instalação
./install-systemd.sh
```

Pronto! O crawler agora rodará automaticamente às 06h e 18h todos os dias.

## 🔧 Instalação Manual

Se preferir instalar manualmente:

```bash
# 1. Copiar arquivos para /etc/systemd/system/
sudo cp house-crawler.service /etc/systemd/system/
sudo cp house-crawler.timer /etc/systemd/system/

# 2. Recarregar systemd
sudo systemctl daemon-reload

# 3. Habilitar o timer
sudo systemctl enable house-crawler.timer

# 4. Iniciar o timer
sudo systemctl start house-crawler.timer

# 5. Verificar status
systemctl status house-crawler.timer
```

## 📊 Comandos Úteis

### Ver status do timer

```bash
systemctl status house-crawler.timer
```

### Ver próximas execuções agendadas

```bash
systemctl list-timers house-crawler.timer
```

### Ver logs em tempo real

```bash
journalctl -u house-crawler.service -f
```

### Ver logs das últimas execuções

```bash
journalctl -u house-crawler.service -n 50
```

### Executar manualmente agora

```bash
sudo systemctl start house-crawler.service
```

### Parar o timer

```bash
sudo systemctl stop house-crawler.timer
```

### Desabilitar o timer (não inicia automaticamente)

```bash
sudo systemctl disable house-crawler.timer
```

### Recarregar após alterar arquivos .service ou .timer

```bash
sudo systemctl daemon-reload
sudo systemctl restart house-crawler.timer
```

## ⚙️ Personalizações

### Alterar horários de execução

Edite o arquivo `house-crawler.timer` e modifique as linhas `OnCalendar`:

```ini
# Para rodar às 08h e 20h
OnCalendar=*-*-* 08:00:00
OnCalendar=*-*-* 20:00:00

# Para rodar apenas às 09h
OnCalendar=*-*-* 09:00:00

# Para rodar a cada 6 horas
OnCalendar=*-*-* 00/6:00:00

# Para rodar de segunda a sexta às 09h
OnCalendar=Mon-Fri *-*-* 09:00:00
```

Depois de alterar:

```bash
sudo systemctl daemon-reload
sudo systemctl restart house-crawler.timer
```

### Adicionar variáveis de ambiente

Edite `house-crawler.service` e adicione suas variáveis:

**Opção 1: Diretamente no arquivo**

```ini
[Service]
Environment="SUPABASE_URL=your-url"
Environment="SUPABASE_KEY=your-key"
Environment="RESEND_API_KEY=your-key"
```

**Opção 2: Usando arquivo .env (recomendado)**

```ini
[Service]
EnvironmentFile=/home/beigelman/dev/house-crawler/.env
```

Depois de alterar:

```bash
sudo systemctl daemon-reload
```

## 🔍 Verificar se está funcionando

```bash
# Ver próximas execuções
systemctl list-timers house-crawler.timer

# Deve mostrar algo como:
# NEXT                        LEFT       LAST PASSED UNIT                   ACTIVATES
# Thu 2025-10-16 18:00:00 -03 5h left    n/a  n/a    house-crawler.timer    house-crawler.service
```

## 🐛 Troubleshooting

### Timer não está rodando

```bash
# Verificar se está ativo
systemctl is-active house-crawler.timer

# Se não estiver, iniciar
sudo systemctl start house-crawler.timer
```

### Ver erros de execução

```bash
# Ver logs com erros
journalctl -u house-crawler.service -p err

# Ver todas as execuções (sucesso e falha)
journalctl -u house-crawler.service --since "24 hours ago"
```

### Testar execução manual

```bash
# Executar o serviço manualmente para ver se há erros
sudo systemctl start house-crawler.service

# Ver resultado
systemctl status house-crawler.service
```

### Verificar caminho do Deno

```bash
# O script usa: /home/beigelman/.local/share/mise/installs/deno/2.8.3/bin/deno
# Verificar se está correto:
which deno

# Se diferente, edite house-crawler.service e ajuste o ExecStart
```

## 📝 Notas

- O timer usa `Persistent=true`, o que significa que se o sistema estiver
  desligado no horário agendado, a execução será feita quando o sistema ligar
- `RandomizedDelaySec=300` adiciona um atraso aleatório de até 5 minutos para
  evitar sobrecarga
- Os logs são armazenados no systemd journal e podem ser visualizados com
  `journalctl`
