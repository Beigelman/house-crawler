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

# Parar timer
echo "⏹️  Parando timer..."
sudo systemctl stop house-crawler.timer 2>/dev/null || true

# Desabilitar timer
echo "❌ Desabilitando timer..."
sudo systemctl disable house-crawler.timer 2>/dev/null || true

# Remover arquivos
echo "🗑️  Removendo arquivos de /etc/systemd/system/..."
sudo rm -f /etc/systemd/system/house-crawler.service
sudo rm -f /etc/systemd/system/house-crawler.timer

# Recarregar systemd
echo "🔄 Recarregando systemd daemon..."
sudo systemctl daemon-reload

# Reset de serviços com falha (se houver)
sudo systemctl reset-failed 2>/dev/null || true

echo ""
echo -e "${GREEN}✅ Desinstalação concluída!${NC}"
echo ""
echo "Os arquivos locais (house-crawler.service e house-crawler.timer) foram mantidos."
echo "Para reinstalar, execute: ./install-systemd.sh"

