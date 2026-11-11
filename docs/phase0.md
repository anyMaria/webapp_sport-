# Phase 0 : résultats des tests de faisabilité

Page de tests : `/lab` (voir `src/lab/`). À passer sur l'iPad, app installée sur l'écran d'accueil, Spotify en lecture.
Coller ici le rapport généré en bas de la page `/lab` après chaque passage.

| # | Test | Verdict | Remarques |
|---|---|---|---|
| 1 | Bip par-dessus Spotify | Réussi | |
| 2 | Voix de synthèse par-dessus Spotify | Réussi | Un peu moins de délai après la voix souhaité |
| 3 | Vidéo locale muette puis YouTube muet, Spotify en fond | Réussi | |
| 4 | Écran allumé 5 minutes (Wake Lock) | Réussi | Testé dans Safari, pas encore en app installée |
| 5 | Stockage OPFS 150 Mo, relecture après fermeture et le lendemain | Non passé | À refaire |
| 6 | Boucle sur extrait, local (< 0,3 s) et YouTube | Réussi | |
| 7 | Analyse d'une vidéo de 15 minutes (< 90 s) | Échec sur l'audio | Pas d'aperçu affiché (ajouté depuis). Images seules : à confirmer |

## Stratégie audio retenue
Tests 1 et 2 réussis : bips et voix de synthèse passent par-dessus Spotify. Le réglage audioSession exact (ambient, transient ou aucun) reste à noter, la phase 2 l'exposera en réglage. À valider de nouveau en app installée.

## Rapports bruts

### 11/11/2026, Safari 26.4, onglet Safari (app non installée)
App installée : non. audioSession, Wake Lock, speechSynthesis, OPFS, requestVideoFrameCallback : tous disponibles.
