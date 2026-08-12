# Security

Les correctifs de sécurité concernent `main` et la dernière release.

## Signaler une vulnérabilité

N'ouvre pas d'issue publique pour une vulnérabilité exploitable. Utilise le signalement privé GitHub lorsqu'il est activé et fournis version/commit, impact, reproduction et preuve de concept minimale. N'inclus jamais de vrais secrets, données de production ou photos personnelles.

## Déploiement

L'API est conçue pour être placée derrière HTTPS. En production :

- garde le port `8787` lié à localhost ;
- configure un `API_TOKEN` long et aléatoire sauf si un accès privé fiable protège déjà l'API ;
- active `TRUST_PROXY=1` uniquement derrière un unique reverse proxy de confiance ;
- n'utilise `CORS_ORIGINS` que si PWA et API ont volontairement des origines différentes ;
- garde Ollama privé ;
- conserve le conteneur non-root, read-only, avec PID limit, `/tmp` borné et le profil seccomp Playwright ;
- n'accorde jamais à Chromium le mode privileged, host networking ou `SYS_ADMIN` ;
- ne force pas `no-new-privileges` ni `cap_drop: ALL` sur ce conteneur : ces réglages empêchent le helper SUID de Chromium d'établir son sandbox ;
- bloque l'egress navigateur vers loopback, réseaux privés/link-local, noms internes et endpoints metadata ;
- applique régulièrement les mises à jour de sécurité OS, image de base et dépendances.

Chromium s'exécute avec son sandbox. La CI vérifie réellement le démarrage de l'API, l'utilisateur non-root et le lancement d'un navigateur sandboxé sous les mêmes contraintes que le déploiement.

## Vie privée et contenu externe

Le frontend n'intègre ni analytics ni scripts tiers par défaut. Photos et historique restent sur l'appareil sauf lorsqu'une analyse est explicitement demandée. L'API n'a pas de base utilisateur durable et ses logs excluent corps, images, recherches, authorization et secrets.

Les pages marketplace, URLs et sorties IA sont non fiables. La navigation principale est limitée aux hôtes des providers et les destinations locales/privées évidentes sont bloquées. Cette politique applicative complète, mais ne remplace pas, un pare-feu réseau lorsque le service est exposé plus largement.

Brocante n'implémente volontairement aucun bypass CAPTCHA, spoofing d'empreinte, rotation de proxy ou mécanisme équivalent.

## Supply chain

Les installations utilisent `npm ci`, les scripts lifecycle sont allowlistés explicitement, les Actions sont épinglées par SHA, CodeQL tourne en CI et les releases incluent checksums et SBOM CycloneDX.
