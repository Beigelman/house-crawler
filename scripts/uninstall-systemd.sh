#!/bin/bash

# Script para desinstalar o systemd timer do House Crawler

set -e

echo "🗑️  Desinstalando House Crawler systemd timer..."

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Verificar se está rodando como root
if [ "$EUID" -eq 0 ]; then 
    echo -e "${RED}⚠️  Não execute este script como root/sudo${NC}"
    exit 1
fi

# Parar timers
echo "⏹️  Parando timers..."
sudo systemctl stop house-crawler.timer 2>/dev/null || true
sudo systemctl stop house-validator.timer 2>/dev/null || true

# Desabilitar timers
echo "❌ Desabilitando timers..."
sudo systemctl disable house-crawler.timer 2>/dev/null || true
sudo systemctl disable house-validator.timer 2>/dev/null || true

# Remover arquivos
echo "🗑️  Removendo arquivos de /etc/systemd/system/..."
sudo rm -f /etc/systemd/system/house-crawler.service
sudo rm -f /etc/systemd/system/house-crawler.timer
sudo rm -f /etc/systemd/system/house-validator.service
sudo rm -f /etc/systemd/system/house-validator.timer

# Recarregar systemd
echo "🔄 Recarregando systemd daemon..."
sudo systemctl daemon-reload

# Reset de serviços com falha (se houver)
sudo systemctl reset-failed 2>/dev/null || true

echo ""
echo -e "${GREEN}✅ Desinstalação concluída!${NC}"
echo ""
echo "Os arquivos locais (house-crawler.* e house-validator.*) foram mantidos."
echo "Para reinstalar, execute: ./install-systemd.sh"

