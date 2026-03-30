#!/bin/bash
# ==============================================
# Script 2: Configurar remote do GitHub
# Uso: bash 02-setup-remote.sh <SEU_TOKEN_GITHUB>
# ==============================================

set -e

TOKEN="$1"

if [ -z "$TOKEN" ]; then
  echo "ERRO: Passe o token como argumento"
  echo "Uso: bash 02-setup-remote.sh ghp_SeuNovoTokenAqui"
  exit 1
fi

cd /root/claude-intel/notes

# Remove remote antigo se existir
git remote remove origin 2>/dev/null || true

# Adiciona remote com token
git remote add origin "https://${TOKEN}@github.com/b3njamimmacedo-web/claude-intel-notes.git"

# Push inicial
git push -u origin main

echo "Remote configurado e push realizado com sucesso!"
