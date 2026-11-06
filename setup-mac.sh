#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="${HOME}/Projects/curatela-bewindvoering"

echo "==> Curatela Bewindvoeringsplatform installeren op Mac mini in: ${TARGET_DIR}"
mkdir -p "${HOME}/Projects"

if [ -d "${TARGET_DIR}/.git" ]; then
  echo "==> Bestaande map gevonden, laatste wijzigingen ophalen..."
  cd "${TARGET_DIR}"
  git pull origin main
else
  git clone https://github.com/superlucstah-hash/curatela-bewindvoering-app.git "${TARGET_DIR}"
  cd "${TARGET_DIR}"
fi

echo "==> NPM dependencies installeren..."
npm install

echo "==> Klaar! Open '${TARGET_DIR}' in Antigravity Desktop op je Mac mini of start direct met: npm run dev"
npm run dev
