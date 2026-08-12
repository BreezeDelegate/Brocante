# Brocante

Brocante est une PWA mobile-first pour photographier des objets en série, chercher des annonces comparables et estimer rapidement un prix de revente.

Les photos et l'historique restent sur l'appareil. L'API self-hosted sert uniquement à l'identification optionnelle et aux recherches marketplace.

## Développement

Prérequis : la version Node.js indiquée dans `.node-version`, npm 11 et Chromium pour Playwright.

```bash
npm ci
npx playwright install chromium
npm run dev
```

Frontend : `http://localhost:5173`  
API : `http://localhost:8787`

## Déploiement

Copie `.env.example` vers `.env`, configure un `API_TOKEN`, puis :

```bash
docker compose build --pull
docker compose up -d
curl --fail http://127.0.0.1:8787/health
```

L'API est prévue derrière HTTPS et reste liée à `127.0.0.1`. Le conteneur tourne non-root, en lecture seule, avec un profil seccomp dédié et Chromium sandboxé.

Vinted et Leboncoin sont des connecteurs web conservateurs : ils ralentissent les requêtes et peuvent cesser de fonctionner si les sites changent ou refusent l'accès. Brocante n'implémente pas de contournement CAPTCHA/anti-bot.

## Projet

- [Roadmap](ROADMAP.md)
- [Contribution](CONTRIBUTING.md)
- [Sécurité](SECURITY.md)
- [Licence](LICENSE) — PolyForm Noncommercial 1.0.0
