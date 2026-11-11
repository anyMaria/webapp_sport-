# Décisions hors plan

Décisions prises par Claude Code quand le plan ne tranchait pas. Option la plus simple retenue, à signaler en fin de phase.

| Phase | Décision | Pourquoi |
|---|---|---|
| 0 | Le travail se fait sur la branche `claude/clever-johnson-orkto7`, pas sur `main`. | Imposé par la session ; `main` n'existe pas encore (dépôt vide). |
| 0 | Le projet de phase 0 contient déjà l'outillage PWA (manifeste, service worker, icônes provisoires). | Les tests 4 et 5 doivent tourner dans l'app installée sur l'écran d'accueil. |
| 0 | Les verdicts des sept tests se saisissent sur la page `/lab` (boutons + remarque), puis un rapport texte se copie. | L'iPad n'a pas de console ; le rapport se colle ensuite dans `docs/phase0.md`. |
| 0 | Icônes de l'app : disque menthe/abricot provisoire. | L'utilisatrice est graphiste et les remplacera. |
| 0 | Proposition : abandonner le détecteur « bips et silences » (plan B du test 7), garder changements de plan + rythme régulier. | Le décodage audio d'une vidéo de 15 min a échoué sur l'iPad. En attente de l'accord de l'utilisatrice. |
| 0 | Détecteur audio : l'utilisatrice demande de l'essayer quand même en phase 4 (repli : changements de plan + rythme régulier). | Décision de l'utilisatrice, 11/11/2026. L'échec du test 7 sera diagnostiqué avec le journal affiché. |
| 1 | Phase 1 lancée avec les tests 5 (stockage) et 7 (analyse) non terminés. | Demande de l'utilisatrice. Risque : si le test 5 échoue, le stockage des vidéos passera en IndexedDB (plan B). Le schéma de données n'est pas affecté. |
| 1 | Polices : sous-ensemble latin seulement, mises en cache par le service worker. | Les accents français sont couverts ; sans cela, les polices ne se chargeaient pas hors ligne. |
| 1 | Accueil, Mon rythme, Collection, Bibliothèque : écrans provisoires qui disent à quelle phase ils arrivent. | Le plan réserve ces écrans aux phases 3, 6 et 7. |
| 1 | Restauration : remplace tout, après confirmation, en une seule transaction. | Le plus simple et le plus sûr : un échec ne change rien. |
| 5 | Pas de préchargement caché du lecteur YouTube : le suivant se charge à son tour, avec un court délai. | Le plan interdit de masquer le lecteur ; un lecteur invisible serait contraire à l'esprit de la règle. |
| 5 | En séance, pour un exercice YouTube, pas de zone tactile ni d'assombrissement sur la vidéo, et les cartes sont placées sous le lecteur. | Le lecteur ne doit jamais être recouvert. La pause se fait par le bouton Pause. |
| 5 | Titre d'une vidéo YouTube saisi à la main (facultatif), pas de requête vers YouTube pour le récupérer. | Pas de service tiers non prévu. La miniature vient de i.ytimg.com. |
