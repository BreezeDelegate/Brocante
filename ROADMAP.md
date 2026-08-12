# Roadmap

Objectif : la première release publique doit être réellement exploitable en production, pas seulement démontrable. Les jalons `v0.x` servent à fermer les risques de fiabilité avant le tag `v1.0.0`. Sécurité, correction et récupérabilité restent prioritaires sur l'ajout de fonctionnalités.

## v0.1 — fondations ✅

- [x] capture en rafale et import multiple ;
- [x] historique local IndexedDB et préférences persistantes ;
- [x] Vinted et Leboncoin en file séquentielle ;
- [x] estimation plancher / médiane ;
- [x] Ollama optionnel ;
- [x] API durcie, cache, Docker, CI et analyse de sécurité.

## v0.2 — fiabilité terrain — bloquant v1.0

- [ ] améliorer la tolérance aux changements Vinted / Leboncoin ;
- [x] ajouter eBay proprement via l'API Browse officielle, optionnelle et configurée uniquement côté serveur ;
- [x] renforcer la reprise de file et les retours d'erreur avec classification transient/configuration/item et reprise persistée après interruption ;
- [ ] ajouter des tests end-to-end sur appareils mobiles / profils mobiles représentatifs.

## v1.0 — gate prod-ready

Le tag `v1.0.0` n'est créé que lorsque tous les points suivants sont validés :

- [ ] v0.2 terminé ;
- [ ] parcours capture → analyse → filtrage → reprise après interruption validé sur mobile ;
- [ ] au moins un smoke test contrôlé de chaque provider activé en production, sans contournement anti-bot ;
- [ ] déploiement et rollback répétés depuis un tag release-candidate sur la topologie supportée ;
- [ ] CI, CodeQL, audit production, build Docker, runtime non-root et Chromium sandbox verts sur le commit de release ;
- [ ] artefacts release, checksums et SBOM vérifiés ;
- [ ] aucun défaut connu bloquant sécurité, correction, récupération ou utilisation terrain du flux principal.

## Après v1.0 — surveillance

- favoris et seuils par objet ;
- contrôles périodiques côté serveur ;
- notifications sans dépendance payante.

## Plus tard

- identification davantage exécutée sur l'appareil ;
- meilleure fusion des comparables et score de confiance ;
- empaquetage natif Android/iOS si la PWA ne suffit plus.
