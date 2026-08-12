# Brocante

Brocante est une PWA mobile-first pour photographier des objets en série, chercher des annonces comparables et estimer rapidement un prix de revente.

## Développement

Prérequis : Node.js 24, npm 11 et Chromium pour Playwright.

```bash
npm ci
npx playwright install chromium
npm run dev
```

Frontend : `http://localhost:5173`  
API : `http://localhost:8787`

La reconnaissance visuelle est optionnelle et utilise Ollama sur le serveur. Sans Ollama, le nom de l'objet peut être saisi avant l'analyse.

## Déploiement

Le frontend est statique. L'API est prévue pour un VPS derrière HTTPS ; le `docker-compose.yml` ne l'expose que sur localhost. Copie `.env.example` vers `.env`, configure au minimum un `API_TOKEN` en production, puis lance :

```bash
docker compose up -d --build
```

Vinted et Leboncoin sont des connecteurs web volontairement conservateurs : ils ralentissent les requêtes et peuvent cesser de fonctionner si les sites changent ou refusent l'accès.

## Projet

- [Roadmap](ROADMAP.md)
- [Contribution](CONTRIBUTING.md)
- [Sécurité](SECURITY.md)
- [Licence](LICENSE) — PolyForm Noncommercial 1.0.0
