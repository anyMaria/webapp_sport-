# CLAUDE.md

Le plan complet est dans `docs/PLAN.md`. Il fait foi : lis-le avant toute phase. Ce fichier n'en résume que les règles de travail (section 13).

## Le projet en une phrase
PWA personnelle (iPad, Safari, mode installé) qui transforme des vidéos d'exercices en séances d'étirements, avec la musique de l'utilisatrice. Une seule utilisatrice, aucun compte.

## Règles de travail
- Une phase à la fois (section 12). Arrête-toi à la fin de chacune et attends l'accord de l'utilisatrice.
- Ne suppose jamais qu'un comportement fonctionne sur iPad sans qu'elle l'ait vérifié. Tu ne peux pas tester sur iPad.
- L'utilisatrice est graphiste, pas développeuse : explique sans jargon, pose tes questions une par une.
- Début de phase : annonce ce que tu construis en quelques lignes. Fin de phase : adresse de l'aperçu, liste des vérifications à faire sur l'iPad, puis attends.
- Dis toujours ce que tu as vérifié toi-même (navigateur d'ordinateur, tests) et ce qui reste à vérifier sur l'iPad.
- Décision non couverte par le plan : option la plus simple, notée dans `docs/decisions.md`, signalée en fin de phase.
- Si un résultat de la phase 0 contredit le plan, arrête-toi et propose une adaptation.
- Petits commits au message clair. Avant chaque commit : `npm run check` (types + lint).

## Interdits
- Télécharger des vidéos depuis YouTube, TikTok ou toute autre plateforme.
- Masquer ou recouvrir les éléments du lecteur YouTube intégré.
- Compte, suivi d'audience, publicité, service tiers non prévu.
- Clé d'API dans le code client ou dans le dépôt.
- Charger un fichier vidéo entier en mémoire (hors test 7 de la phase 0, qui mesure justement ça).
- Emojis dans l'interface, messages culpabilisants.

## Conventions
- Vite, React, TypeScript strict, CSS Modules + variables CSS (`src/styles/tokens.css`, thème nuit uniquement).
- Nom de l'app : constante `APP_NAME` dans `src/lib/constants.ts` (et manifeste dans `vite.config.ts`).
- Interface en français, tutoiement, libellés courts. Libellés validés : section 11 du plan.
- Zones tactiles 52 px minimum, rien sous 13 px, contraste 4,5:1, vrais `<button>`.

## Dépôt
- Dépôt GitHub : anyMaria/webapp_sport- (le nom se termine par un tiret).
- Branche de travail de cette session : `claude/clever-johnson-orkto7` (le plan parle de `main` : fusion à faire par l'utilisatrice).
