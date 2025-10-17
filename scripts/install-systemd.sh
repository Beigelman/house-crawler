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

# Copiar arquivos para /etc/systemd/system/
echo "📋 Copiando arquivos de serviço para /etc/systemd/system/..."
sudo cp "$PROJECT_DIR/house-crawler.service" /etc/systemd/system/
sudo cp "$PROJECT_DIR/house-crawler.timer" /etc/systemd/system/

# Recarregar systemd
echo "🔄 Recarregando systemd daemon..."
sudo systemctl daemon-reload

# Habilitar timer
echo "✅ Habilitando timer..."
sudo systemctl enable house-crawler.timer

# Iniciar timer
echo "▶️  Iniciando timer..."
sudo systemctl start house-crawler.timer

# Mostrar status
echo ""
echo -e "${GREEN}✨ Instalação concluída!${NC}"
echo ""
echo "📊 Status do timer:"
sudo systemctl status house-crawler.timer --no-pager

echo ""
echo "📅 Próximas execuções agendadas:"
sudo systemctl list-timers house-crawler.timer --no-pager

echo ""
echo -e "${GREEN}Comandos úteis:${NC}"
echo "  Ver status:        systemctl status house-crawler.timer"
echo "  Ver logs:          journalctl -u house-crawler.service -f"
echo "  Parar timer:       sudo systemctl stop house-crawler.timer"
echo "  Desabilitar:       sudo systemctl disable house-crawler.timer"
echo "  Executar agora:    sudo systemctl start house-crawler.service"
echo "  Ver próximas runs: systemctl list-timers house-crawler.timer"

