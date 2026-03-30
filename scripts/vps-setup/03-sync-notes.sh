#!/bin/bash
# ==============================================
# Script 3: Sync automatico diario
# Instalar em: /root/claude-intel/sync-notes.sh
# ==============================================

cd /root/claude-intel/notes

git add -A

# So commita se houver mudancas
if ! git diff --cached --quiet; then
  git commit -m "auto: $(date '+%Y-%m-%d')"
  git push origin main
else
  echo "Sem mudancas para sincronizar"
fi
