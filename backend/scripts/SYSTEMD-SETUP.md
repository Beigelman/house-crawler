# Execução no Linux

Os dois scripts de execução são:

- `run-house-validator.sh`: executa `deno task validate` uma vez e envia os pings
  existentes de início, sucesso ou falha para Healthchecks.io.
- `run-house-worker.sh`: executa `deno task worker` continuamente. O worker
  processa a fila e agenda as coletas às 06h, 14h e 22h em America/Sao_Paulo.

O agendador existente do validador é um **timer systemd**, apesar do nome
`cron-logs` no Makefile. Ele permanece às **00h, 08h e 16h**, no fuso do host,
com recuperação após desligamento e atraso aleatório de até 5 minutos.
Não adicione também uma entrada no crontab para o mesmo comando.

## Instalação

Requer Linux com systemd, Bash, Deno, curl e acesso sudo. Mantenha o repositório
em um disco disponível no boot. Execute como o usuário que deve rodar o worker,
sem colocar `sudo` antes do instalador:

```sh
# A partir da raiz do repositório:
cp backend/.env.example backend/.env  # Somente se o .env ainda não existir
# Preencha backend/.env com as credenciais do worker.
bash backend/scripts/install-systemd.sh
```

O instalador usa sudo para instalar as unidades em `/etc/systemd/system/`.
Ele detecta o usuário, o diretório do backend e o binário real do Deno,
inclusive quando instalado pelo mise. Não depende do PATH de um shell interativo
no boot. Para escolher outro Deno:

```sh
DENO_BIN=/caminho/absoluto/deno bash backend/scripts/install-systemd.sh
```

O serviço `house-worker.service` inicia imediatamente e a cada boot, mesmo sem
login, e reinicia 10 segundos após o processo terminar. Um `systemctl stop`
explícito mantém o serviço parado até iniciá-lo novamente ou reiniciar o host.
O timer `house-validator.timer` é habilitado. O antigo `house-crawler.timer`
é desabilitado para evitar coletas duplicadas com o agendamento do worker.
Remova eventuais agendamentos antigos de coleta no crontab e pare workers
iniciados manualmente ou como serviços de usuário antes de instalar.

Os arquivos `.service` do repositório são modelos; use o instalador para preencher
os caminhos. Ambos os comandos carregam `backend/.env` pela aplicação Deno.
Após mover o repositório ou trocar a versão instalada do Deno, execute novamente
o instalador. Após editar `.env`, reinicie o worker.

## Operação

```sh
systemctl status house-worker.service house-validator.timer
systemctl is-enabled house-worker.service house-validator.timer
systemctl list-timers house-validator.timer
journalctl -u house-worker.service -f
journalctl -u house-validator.service -n 50
sudo systemctl restart house-worker.service
sudo systemctl start house-validator.service  # Validar agora
```

Para executar os scripts manualmente (com Deno no PATH):

```sh
bash backend/scripts/run-house-validator.sh
bash backend/scripts/run-house-worker.sh
```

Para alterar os horários da validação, edite `house-validator.timer` e execute
novamente o instalador; depois rode `sudo systemctl restart house-validator.timer`.
Para mudar a URL de Healthchecks.io, edite `run-house-validator.sh`. Falhas dos
pings não alteram o código de saída real da validação.

Após reiniciar o Linux, confirme com `systemctl status house-worker.service` e
`journalctl -b -u house-worker.service`. O host precisa estar ligado, acordado e
com rede para processar as solicitações.

## Remoção

```sh
bash backend/scripts/uninstall-systemd.sh
```

Remove os serviços e timers de sistema, incluindo as unidades antigas do crawler.
Preserva os arquivos do repositório e o `.env`.
