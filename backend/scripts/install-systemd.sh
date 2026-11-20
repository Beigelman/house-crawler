#!/bin/bash

# Script para instalar e configurar o systemd timer do House Crawler

set -e

echo "🏠 Instalando House Crawler systemd timer..."

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar se está rodando como root
if [ "$EUID" -eq 0 ]; then 
    echo -e "${YELLOW}⚠️  Não execute este script como root/sudo${NC}"
    exit 1
fi

# Diretório do projeto
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "📁 Diretório do projeto: $PROJECT_DIR"

# Garantir que os wrappers usados pelo systemd sejam executáveis
echo "🔧 Ajustando permissões dos scripts..."
chmod +x "$PROJECT_DIR/run-house-crawler.sh"
chmod +x "$PROJECT_DIR/run-house-validator.sh"

# Copiar arquivos para /etc/systemd/system/
echo "📋 Copiando arquivos de serviço para /etc/systemd/system/..."
sudo cp "$PROJECT_DIR/house-crawler.service" /etc/systemd/system/
sudo cp "$PROJECT_DIR/house-crawler.timer" /etc/systemd/system/
sudo cp "$PROJECT_DIR/house-validator.service" /etc/systemd/system/
sudo cp "$PROJECT_DIR/house-validator.timer" /etc/systemd/system/

# Recarregar systemd
echo "🔄 Recarregando systemd daemon..."
sudo systemctl daemon-reload

# Habilitar timers
echo "✅ Habilitando timers..."
sudo systemctl enable house-crawler.timer
sudo systemctl enable house-validator.timer

# Iniciar timers
echo "▶️  Iniciando timers..."
sudo systemctl start house-crawler.timer
sudo systemctl start house-validator.timer

# Mostrar status
echo ""
echo -e "${GREEN}✨ Instalação concluída!${NC}"
echo ""
echo "📊 Status dos timers:"
sudo systemctl status house-crawler.timer --no-pager
echo ""
sudo systemctl status house-validator.timer --no-pager

echo ""
echo "📅 Próximas execuções agendadas:"
sudo systemctl list-timers house-crawler.timer house-validator.timer --no-pager

echo ""
echo -e "${GREEN}Comandos úteis:${NC}"
echo "House Crawler (busca):"
echo "  Ver status:        systemctl status house-crawler.timer"
echo "  Ver logs:          journalctl -u house-crawler.service -f"
echo "  Parar timer:       sudo systemctl stop house-crawler.timer"
echo "  Desabilitar:       sudo systemctl disable house-crawler.timer"
echo "  Executar agora:    sudo systemctl start house-crawler.service"
echo ""
echo "House Validator (validação):"
echo "  Ver status:        systemctl status house-validator.timer"
echo "  Ver logs:          journalctl -u house-validator.service -f"
echo "  Parar timer:       sudo systemctl stop house-validator.timer"
echo "  Desabilitar:       sudo systemctl disable house-validator.timer"
echo "  Executar agora:    sudo systemctl start house-validator.service"
echo ""
echo "  Ver próximas runs: systemctl list-timers"
