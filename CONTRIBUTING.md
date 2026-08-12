# Contributing

Brocante reste volontairement petit. Une modification doit rendre le produit plus sûr, plus simple ou plus fiable sans ajouter d'infrastructure par défaut.

## Avant une pull request

Utilise la version Node de `.node-version` et npm 11, puis lance :

```bash
npm ci
npm run check
npm audit --omit=dev --audit-level=high
```

Garde les PR ciblées, explique l'effet utilisateur et ajoute des tests pour les comportements modifiés. Mets à jour `package-lock.json` avec toute modification de dépendance.

## Règles d'ingénierie

Quand des objectifs entrent en conflit : sécurité/vie privée, correction, fiabilité, maintenabilité, performance, puis vitesse de livraison.

- Ne jamais committer de secrets, tokens, vraies photos utilisateur, données de production ou sessions marketplace.
- Valider les données non fiables aux frontières du système : HTML marketplace, URLs et sortie du modèle inclus.
- Ne pas ajouter de bypass CAPTCHA, spoofing d'empreinte, rotation de proxy ou autre contournement anti-abus.
- Garder chaque intégration marketplace derrière son provider ; l'UI ne dépend pas du HTML d'un site.
- Bloquer l'accès du navigateur aux réseaux loopback, privés/link-local, noms internes et endpoints metadata.
- Ne jamais utiliser de conteneur privilégié, host networking, `SYS_ADMIN` ou capabilities larges pour faire fonctionner Chromium.
- Préférer traitement et stockage locaux lorsqu'ils réduisent réellement l'exposition des données ou la charge serveur.
- Conserver files bornées, cache, timeouts et rythme prudent des providers sauf mesure justifiant un changement.
- Ne pas logger corps de requête, images, authorization, termes recherchés ou secrets.
- Tout nouveau comportement réseau doit avoir limites d'entrée, timeout et chemin d'échec explicite.
- Toute modification sensible à la sécurité doit tester les chemins acceptés et refusés.
- Les GitHub Actions utilisent le minimum de permissions et des SHAs immuables.
- Garder la documentation courte et à jour ; supprimer l'obsolète plutôt qu'empiler des fichiers.

Auth, CORS/proxy, isolation navigateur, permissions Docker, persistance, scripts d'installation, workflows et releases sont des surfaces à haut risque. Une PR qui les touche doit indiquer l'impact sécurité/vie privée et la méthode de rollback.

Les commits et titres de PR décrivent simplement le changement. Les préfixes conventionnels sont facultatifs.

Toute contribution est distribuée sous PolyForm Noncommercial 1.0.0.
