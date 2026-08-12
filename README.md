# Brocante

Brocante est une PWA mobile-first pour photographier des objets en série, chercher des annonces comparables et estimer rapidement un prix de revente.

Le projet est volontairement simple : historique et photos restent dans le navigateur, l'API self-hosted ne possède pas de base de données utilisateur, et les connecteurs marketplace sont isolés derrière des providers conservateurs.

## Développement

Prérequis : la version Node.js indiquée dans `.node-version`, npm 11 et Chromium pour Playwright.

```bash
npm ci
npx playwright install chromium
npm run dev
```

Frontend : `http://localhost:5173`  
API : `http://localhost:8787`

Avant une PR :

```bash
npm run check
npm audit --omit=dev --audit-level=high
```

La reconnaissance visuelle est optionnelle et utilise Ollama sur le serveur. Sans Ollama, le nom de l'objet peut être saisi avant l'analyse.

## Providers marketplace

Vinted et Leboncoin sont des connecteurs web volontairement conservateurs : ils ralentissent les requêtes, limitent leur navigation et peuvent cesser de fonctionner si les sites changent ou refusent l'accès. Le projet n'ajoute pas de contournement CAPTCHA/anti-bot.

eBay utilise l'API Browse officielle quand `EBAY_CLIENT_ID` et `EBAY_CLIENT_SECRET` sont configurés côté serveur. Le provider reste désactivé par défaut dans la PWA et l'application doit rester utilisable sans eBay. Le token application OAuth est mis en cache en mémoire et n'est jamais envoyé au client. L'accès production aux Buy APIs dépend des conditions et de l'approbation eBay en vigueur ; il faut donc valider l'accès du compte développeur avant de considérer eBay comme une source disponible en production.

## Déploiement

Le frontend est statique. L'API est prévue pour un VPS derrière HTTPS ; le `docker-compose.yml` ne l'expose que sur `127.0.0.1`, exécute l'API en non-root/read-only, retire toutes les capabilities Linux puis ne réintroduit que `SYS_CHROOT` nécessaire au sandbox Chromium, et interdit l'escalade de privilèges. Le profil seccomp fourni garde le sandbox navigateur actif sans `SYS_ADMIN` ni mode privilégié.

Copie `.env.example` vers `.env`, configure au minimum un `API_TOKEN` en production, puis :

```bash
docker compose build --pull
docker compose up -d
curl --fail http://127.0.0.1:8787/health
```

Pour la topologie HTTPS/reverse-proxy, le rollback et les incidents, suis `docs/OPERATIONS.md` plutôt que d'exposer directement l'API.

## Sécurité et supply chain

CI vérifie format, lint, TypeScript, tests, build, audit des dépendances, image Docker, runtime non-root et lancement réel de Chromium sandboxé sous les mêmes restrictions de capabilities/seccomp que la configuration fournie. CodeQL tourne sur les changements et de façon planifiée. Les releases incluent des checksums et un SBOM CycloneDX.

Les réglages qui ne peuvent pas vivre dans Git — protection de `main`, Dependency Graph, secret scanning/push protection, private vulnerability reporting — sont listés dans `docs/GITHUB_SETTINGS.md`.

## Documentation du projet

- [Règles locales du dépôt](AGENTS.md)
- [Contribution](CONTRIBUTING.md)
- [Standards d'ingénierie](docs/ENGINEERING_STANDARDS.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Threat model](docs/THREAT_MODEL.md)
- [Runbook opérations / incident / rollback](docs/OPERATIONS.md)
- [Réglages GitHub à durcir](docs/GITHUB_SETTINGS.md)
- [Décisions d'architecture](docs/decisions/)
- [Roadmap](ROADMAP.md)
- [Sécurité](SECURITY.md)
- [Licence](LICENSE) — PolyForm Noncommercial 1.0.0
