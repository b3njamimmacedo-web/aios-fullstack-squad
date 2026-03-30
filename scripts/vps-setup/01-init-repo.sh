#!/bin/bash
# ==============================================
# Script 1: Inicializar repo claude-intel-notes
# Executar na VPS: bash 01-init-repo.sh
# ==============================================

set -e

REPO_DIR="/root/claude-intel/notes"

# Cria diretorio se nao existe
mkdir -p "$REPO_DIR"
cd "$REPO_DIR"

# Inicializa git se necessario
if [ ! -d .git ]; then
  git init
fi

# Cria README
cat > README.md << 'EOF'
# Claude Intel Notes - Benjamim Macedo
Notas geradas pelo agente CLAUDE INTEL v2.0
EOF

git add -A
git commit -m "init: primeiro commit" || echo "Nada para commitar"
git branch -M main

echo "Repo inicializado em $REPO_DIR"
echo ""
echo "PROXIMO PASSO: Configure o remote com seu token NOVO (nao use o token antigo, ele vazou):"
echo "  git remote add origin https://<SEU_NOVO_TOKEN>@github.com/b3njamimmacedo-web/claude-intel-notes.git"
echo "  git push -u origin main"
