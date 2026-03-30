#!/bin/bash
# ==============================================
# Script 4: Configurar crontab para sync diario
# Executar na VPS: bash 04-setup-cron.sh
# ==============================================

set -e

SYNC_SCRIPT="/root/claude-intel/sync-notes.sh"

# Copia o script de sync para o local correto
cp "$(dirname "$0")/03-sync-notes.sh" "$SYNC_SCRIPT"
chmod +x "$SYNC_SCRIPT"

# Adiciona ao crontab (remove entrada anterior se existir)
(crontab -l 2>/dev/null | grep -v sync-notes; echo "5 6 * * * $SYNC_SCRIPT >> /root/claude-intel/sync.log 2>&1") | crontab -

echo "Crontab configurado! Sync diario as 06:05"
echo ""
echo "Verificar com: crontab -l"
echo "Logs em: /root/claude-intel/sync.log"
