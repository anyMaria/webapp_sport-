# À vérifier sur l'iPad

Pour chaque ligne : fais l'action, regarde le résultat attendu, puis note « OK » ou décris ce qui ne va pas. Ce que Claude a déjà vérifié sur ordinateur est indiqué, mais ça ne remplace pas l'iPad.

Avant tout : installe l'app sur l'écran d'accueil (Safari, Partager, « Sur l'écran d'accueil »), mets Spotify en lecture, ouvre l'app depuis l'icône.

## Phase 1 : socle

| # | Action | Résultat attendu |
|---|---|---|
| 1.1 | Ouvre l'app depuis l'icône, puis passe en mode avion et ferme/rouvre l'app. | Elle s'ouvre, les écrans et les polices s'affichent. |
| 1.2 | Réglages : change « Décompte entre exercices », ferme complètement l'app, rouvre-la. | Le nouveau réglage est conservé. |
| 1.3 | Réglages : touche « Sauvegarder ». | Un fichier .json arrive dans Fichiers ou propose un enregistrement. |
| 1.4 | Change un réglage, puis « Restaurer » avec ce fichier et confirme. | Le réglage revient à sa valeur sauvegardée. |
| 1.5 | Réglages : « Tester le son » avec Spotify en lecture. | Un bip s'entend, Spotify ne coupe pas. |
| 1.6 | Réglages : « Protéger mes données ». | Le message passe à « Stockage protégé » (sinon, note ce qui s'affiche). |
| 1.7 | Choisis une voix française dans la liste. | La liste n'est pas vide et la voix change au test du son (mode « + consignes »). |

Déjà vérifié sur ordinateur : sauvegarde puis restauration à l'identique (tests automatiques et navigateur), ouverture hors ligne, polices hors ligne.

## Phase 2 : lecteur de séance

Prépare une vidéo d'au moins 2 minutes. Va sur « Séance de démonstration », choisis-la : elle est copiée dans l'app et découpée en 5 extraits.

| # | Action | Résultat attendu |
|---|---|---|
| 2.1 | Touche « Commencer ». | Le premier exercice démarre, la vidéo tourne sans son, le minuteur descend. |
| 2.2 | Laisse tourner un exercice entier sans toucher. | Bips à 3, 2, 1, un bip plus long à zéro. Spotify continue. |
| 2.3 | À la fin de l'exercice. | La carte « Suivant dans 5 secondes » apparaît, la vidéo s'assombrit mais continue en boucle. |
| 2.4 | Ne touche rien pendant la transition. | L'exercice suivant démarre tout seul, sans à-coup ni écran noir. |
| 2.5 | Pendant un exercice, touche « Encore ». | Le minuteur gagne 30 s (réglable). |
| 2.6 | Pendant la transition, touche « Encore 30 s ». | Le même extrait repart pour 30 s. |
| 2.7 | « Suivant » et « Passer maintenant ». | Passage immédiat à l'exercice suivant. |
| 2.8 | Touche la vidéo, ou le gros bouton pause. | Tout se fige. « Reprendre » relance, sans temps perdu. |
| 2.9 | Pendant un exercice, change de mode : « Ma musique », « Musique + bips », « + consignes », « Son de la vidéo ». | Le changement est immédiat. « + consignes » dit « Ensuite : … » pendant la transition. « Son de la vidéo » : Spotify se met probablement en pause (c'est annoncé sous le sélecteur). |
| 2.10 | Pendant une séance, passe sur une autre app puis reviens. | La séance est en pause et attend ta touche pour reprendre. |
| 2.11 | Laisse une séance de 5 exercices aller au bout, sans toucher l'écran. | L'écran ne s'éteint pas, la séance finit, l'écran de fin affiche durée, exercices et « Encore ». |
| 2.12 | Pendant une séance, touche la croix puis « Quitter ». | Confirmation, puis écran « Séance arrêtée ». |
| 2.13 | Tourne l'iPad en portrait. | La vidéo passe au-dessus, le panneau en dessous, tout reste lisible et touchable. |
| 2.14 | Regarde le changement d'exercice de près. | Aucun noir ni saccade visible entre deux extraits. |
| 2.15 | Regarde la boucle d'un extrait. | Le retour au début est discret, pas de blocage. |

Déjà vérifié sur ordinateur : 16 tests automatiques du moteur (transitions, bips, pause, « Encore », fin, règle des 80 %). Séance complète jouée dans un navigateur : démarrage, minuteur, vidéo qui avance, « Encore », « Suivant », pause, transition, quitter, journal écrit.

## Phase 3 : import, découpage manuel, bibliothèque, composition

Prépare : trois vidéos TikTok enregistrées sur l'iPad (ou dans Fichiers) et une vidéo longue (5 à 15 minutes).

| # | Action | Résultat attendu |
|---|---|---|
| 3.1 | Importer une vidéo : choisis l'origine « TikTok », puis les trois TikTok d'un coup. | Barre de progression par fichier, puis la liste « Vidéos importées ». |
| 3.2 | Sur chaque TikTok : « Garder la vidéo entière comme un exercice ». | « Enregistré » s'affiche. Les exercices sont dans la bibliothèque avec leur vignette. |
| 3.3 | Importe la vidéo longue, puis « Découper ». | L'écran de découpage s'ouvre, avec un seul segment couvrant toute la vidéo. |
| 3.4 | Déplace la poignée de position, touche « Couper ici ». | Le segment se coupe en deux à cet endroit. L'aperçu boucle sur le segment sélectionné. |
| 3.5 | Boutons − et + de Début et Fin. | Les bornes bougent de 0,5 s, la frontière commune avec le voisin bouge aussi, l'aperçu suit. |
| 3.6 | « Fusionner avec le suivant ». | Deux segments redeviennent un. |
| 3.7 | « Gardé » / « Retiré » sur plusieurs segments. | L'étiquette et la frise du bas changent (gardé, retiré). Un segment retiré n'est pas enregistré. |
| 3.8 | Renomme des segments, saisis une consigne, choisis des zones du corps. | Ces informations se retrouvent dans la bibliothèque. |
| 3.9 | « Enregistrer N exercices ». | Retour à la bibliothèque, les N exercices sont là avec leur vignette. Temps d'attente raisonnable. |
| 3.10 | Bibliothèque : recherche, filtre par zone, filtre par vidéo d'origine. | La liste se filtre. Un filtre sans résultat affiche un message clair. |
| 3.11 | « Nouvelle séance » : ajoute des exercices des quatre vidéos, réordonne avec la poignée (glisser au doigt) et avec les flèches. | L'ordre change. Le glisser fonctionne au doigt sans faire défiler la page. |
| 3.12 | Règle la durée et le repos d'un exercice. | La durée totale en haut se met à jour. |
| 3.13 | Enregistre la séance, puis « Lancer ». | La séance mêle les quatre vidéos et se joue de bout en bout, boucle correcte sur chaque extrait. |
| 3.14 | Dupliquer, renommer, marquer « express », supprimer une séance. | Chaque action fonctionne ; la suppression demande confirmation. |
| 3.15 | Supprime un exercice utilisé dans une séance, puis lance cette séance. | La séance se joue en sautant l'exercice, et l'écran de départ le signale. |
| 3.16 | Réglages, « Mes vidéos » : supprime une vidéo. | La confirmation liste les séances touchées. L'espace utilisé baisse. |
| 3.17 | Ferme complètement l'app, rouvre-la. | Les vidéos, exercices et séances sont toujours là et se lisent. |

Déjà vérifié sur ordinateur : tests automatiques du découpage (couper, fusionner, ajuster, bornes) et des séances (durée, ordre, duplication), parcours complet dans un navigateur (import de deux fichiers, coupe, enregistrement, composition, lancement).

## Phase 4 : pré-marquage automatique

Utilise 3 de tes vraies vidéos : une montée avec des coupures de plan, une rythmée par des bips, une en plan continu sans coupure. Prends le temps de noter, pour chacune, combien de temps tu as mis à corriger le découpage (objectif du plan : moins de 2 minutes par vidéo).

| # | Action | Résultat attendu |
|---|---|---|
| 4.1 | Importe une vidéo de plus de 90 s et ouvre « Découper ». | L'analyse démarre toute seule : barre de progression, bouton « Annuler l'analyse ». |
| 4.2 | Pendant l'analyse, touche l'écran, fais défiler la page. | L'interface reste fluide, rien ne se fige. |
| 4.3 | Annule une analyse en cours. | Elle s'arrête, tu gardes l'écran de découpage tel quel. |
| 4.4 | Laisse finir l'analyse sur une vidéo de 15 minutes. | Fin en moins de 90 s environ, sans rechargement de la page. Note le temps. |
| 4.5 | Lis les messages sous les interrupteurs. | Ils disent combien de frontières chaque détecteur a trouvées. **Si l'audio échoue**, le message dit « Bips et silences indisponibles… » avec la raison : recopie-moi cette raison. L'analyse doit continuer avec les changements de plan. |
| 4.6 | Regarde le découpage proposé sur la vidéo montée. | Les coupures de plan sont là. Une courte pause entre exercices est proposée « Retiré ». Une intro parlée est retirée, sinon gardée avec « Fin à vérifier ». |
| 4.7 | Vidéo rythmée par des bips : active seulement « Bips et silences ». | Les frontières tombent près des bips ou des silences. |
| 4.8 | Plan continu sans coupure : lance l'analyse. | Peu de frontières, c'est normal. Utilise « Rythme régulier » : effort, pause, début du premier exercice. Les segments sont créés et calés sur les frontières détectées proches. |
| 4.9 | Les segments marqués « Fin à vérifier ». | Ils sont bien ceux où la frontière est douteuse. Corrige-les avec − et + ; l'étiquette disparaît après ajustement de la fin. |
| 4.10 | « Tout remettre à zéro » puis « Analyser » avec d'autres interrupteurs. | Le découpage est recalculé. |
| 4.11 | Combien de segments faux ou manquants en moyenne ? | Note-le : ça servira à régler les seuils. |

Déjà vérifié sur ordinateur : 18 tests automatiques sur des signaux synthétiques (silence de 1 s, silence trop court, bip de 300 ms, son trop long, hors bande, rythme, regroupement, rattachement, « Pause », intro retirée). Vidéo de test de 2 min : analyse en 6 s, 5 segments corrects. Le décodage audio de gros fichiers sur iPad n'est pas vérifié : c'est ce que le test 7 a fait échouer.

## Phase 5 : YouTube intégré

Cette phase demande une connexion. Je n'ai pas pu tester le lecteur YouTube lui-même (mon environnement n'a pas accès à YouTube) : tout ce qui touche au lecteur est à vérifier sur l'iPad. Prends une vidéo YouTube d'étirements dont la description contient des repères horaires (ex. « 2:15 Chat-vache »).

| # | Action | Résultat attendu |
|---|---|---|
| 5.1 | Importer une vidéo, colle un lien YouTube (watch, youtu.be ou shorts), « Ajouter la vidéo ». | L'écran de découpage s'ouvre avec le lecteur YouTube visible. |
| 5.2 | Colle un texte qui n'est pas un lien. | Message clair : lien non reconnu. |
| 5.3 | Regarde le lecteur dans l'écran de découpage. | Il est entier, avec ses commandes et son titre, rien ne le recouvre. La durée s'affiche une fois le lecteur prêt. |
| 5.4 | Touche « Marquer ici » à chaque changement d'exercice pendant la lecture. | Un segment est créé à chaque marque. |
| 5.5 | Colle les repères de la description, « Importer les repères ». | Un segment par repère, avec le bon nom. Un texte sans repère donne un message d'erreur. |
| 5.6 | Essaie « Appliquer le rythme régulier » (effort, pause, début). | Les segments sont créés, les pauses courtes sont proposées « Retiré ». |
| 5.7 | Sélectionne un segment. | L'aperçu boucle sur ce segment (retour au début à ±0,3 s près), et − / + ajustent les bornes. |
| 5.8 | Enregistre, puis regarde la bibliothèque. | Les exercices ont la miniature YouTube. |
| 5.9 | Compose une séance mêlant un exercice YouTube et un exercice de fichier local, puis lance-la. | Les deux se jouent avec une boucle correcte. Note le délai de retour au début sur YouTube. |
| 5.10 | Pendant un exercice YouTube, regarde l'écran de séance. | Le lecteur est visible, non recouvert. Les cartes de transition sont sous le lecteur. Le bouton Pause fonctionne. |
| 5.11 | Passe d'un exercice YouTube à un autre exercice. | Court délai de chargement accepté. Dis-moi s'il est gênant. |
| 5.12 | Mets l'iPad en mode avion puis lance un exercice YouTube. | Message clair « Pas de réseau », « Suivant » permet de passer. |
| 5.13 | Modes audio avec un exercice YouTube. | Muet dans tous les modes sauf « Son de la vidéo ». Spotify continue tant que la vidéo est muette. |

Déjà vérifié sur ordinateur : lecture des liens et des repères (9 tests automatiques), message d'erreur hors réseau dans l'écran de découpage et en séance, création de la source sans plantage.
