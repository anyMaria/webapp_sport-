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
