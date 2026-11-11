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
| 6 | Joker : rattaché au mois civil du dimanche de la semaine concernée. | Le plan ne dit pas quel mois choisir pour une semaine à cheval sur deux mois. |
| 6 | Un seul joker par mois, imposé par le schéma de données (clé = mois). Le réglage `jokersPerMonth` reste à 1. | Éviter une migration de base ; le plan fixe un joker par mois. |
| 6 | Jokers appliqués automatiquement à l'ouverture de l'accueil, de « Mon rythme » ou de la fin de séance (calcul pur depuis le journal, écriture idempotente). | Pas de serveur ni de tâche de fond : l'app calcule quand on l'ouvre. |
| 6 | Limites « une séance comptée par jour, une express par semaine » dans `src/motivation/streak.ts` (constantes `MAX_COUNTED_PER_DAY`, `MAX_EXPRESS_PER_WEEK`). | Hypothèses du plan à confirmer. Elles s'appliquent au calcul de la semaine, le journal garde tout. |
| 6 | L'accueil parle de « pochette » (plan, section 10) et non de « breloque » comme la maquette. Une pochette par semaine validée. | Le plan fait foi sur la maquette. |
| 6 | Prénom : réglage libre (vide par défaut), pas de prénom écrit dans le code. | Donnée personnelle ; la maquette montre un prénom mais le plan parle seulement de salutation. |
| 6 | Séance express : si aucune séance n'est marquée express, premiers exercices de la séance du jour jusqu'à 3 minutes et 4 exercices (`composeExpress`). | Hypothèse du plan à confirmer. |
| 6 | « Séance du jour » : séance choisie pour le créneau, sinon dernière utilisée, sinon la plus récente. | Le plan le décrit ainsi ; le choix se fait dans « Mon rythme ». |
