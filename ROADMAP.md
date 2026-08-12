# Roadmap

Objectif : la première release publique doit être réellement exploitable en production, pas seulement démontrable. Les jalons `v0.x` servent à fermer les risques de fiabilité avant le tag `v1.0.0`. Sécurité, correction et récupérabilité restent prioritaires sur l'ajout de fonctionnalités.

## v0.1 — fondations ✅

- [x] capture en rafale et import multiple ;
- [x] historique local IndexedDB et préférences persistantes ;
- [x] Vinted et Leboncoin en file séquentielle ;
- [x] estimation plancher / médiane ;
- [x] Ollama optionnel ;
- [x] API durcie, cache, Docker, CI et analyse de sécurité.

## v0.2 — fiabilité terrain ✅

- [x] améliorer la tolérance aux changements Vinted / Leboncoin avec parsing testable, validation d'URL, déduplication et limite stricte ;
- [x] ajouter eBay proprement via l'API Browse officielle, optionnelle et configurée uniquement côté serveur ;
- [x] renforcer la reprise de file et les retours d'erreur avec classification transient/configuration/item et reprise persistée après interruption ;
- [x] ajouter des E2E mobiles représentatifs : Chromium/Pixel 5 et WebKit/iPhone 12, avec import de lot, analyse, filtrage, reprise IndexedDB après interruption et persistance après reload.

## v1.0 — gate prod-ready

Le tag `v1.0.0` n'est créé que lorsque tous les points suivants sont validés :

- [x] v0.2 terminé ;
- [x] parcours capture → analyse → filtrage → reprise après interruption validé sur Chromium mobile et WebKit mobile ;
- [ ] wrapper Android Capacitor reproductible, APK de test généré en CI et validé sur appareil physique ;
- [ ] wrapper iOS Capacitor reproductible, build Xcode validé en CI et parcours d'installation/test sur iPhone documenté ;
- [ ] configuration native HTTPS/CORS, permissions caméra et limites de sécurité documentées et testées ;
- [ ] au moins un smoke test contrôlé de chaque provider activé en production, sans contournement anti-bot ;
- [ ] déploiement et rollback répétés depuis un tag release-candidate sur la topologie supportée ;
- [ ] CI, E2E mobile, CI native, CodeQL, audit production, build Docker, runtime non-root et Chromium sandbox verts sur le commit de release ;
- [ ] release candidate contenant PWA, APK Android de test, projet iOS/Xcode, checksums et SBOM vérifiés ;
- [ ] stratégie de signature/distribution de la release stable validée pour Android et iOS ;
- [ ] aucun défaut connu bloquant sécurité, correction, récupération ou utilisation terrain du flux principal.

## Après v1.0 — surveillance

- favoris et seuils par objet ;
- contrôles périodiques côté serveur ;
- notifications sans dépendance payante.

## Plus tard

- identification davantage exécutée sur l'appareil ;
- meilleure fusion des comparables et score de confiance.
