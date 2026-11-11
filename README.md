# webapp_sport

PWA personnelle qui transforme des vidéos d'exercices en séances d'étirements et de posture, à suivre avec sa propre musique sur iPad.

Le plan complet : [docs/PLAN.md](docs/PLAN.md). Règles de travail : [CLAUDE.md](CLAUDE.md).

## État
Phase 0 (faisabilité) : tests passés sur iPad, sauf le 5 (stockage) et le 7 (analyse audio). Résultats dans [docs/phase0.md](docs/phase0.md).
Phase 1 (socle) : PWA, thème nuit, navigation, base de données locale, réglages, sauvegarde et restauration JSON.

## Commandes
```bash
npm install
npm run dev      # développement (Chrome sur ordinateur)
npm run check    # types + lint, à passer avant chaque commit
npm run build    # build de production + service worker
```

Hébergement prévu : Vercel (site statique, `vercel.json` gère les routes de l'app).
