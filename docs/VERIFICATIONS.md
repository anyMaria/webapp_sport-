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

## Phase 6 : motivation (série, créneau, express, accueil)

Pour tester la série sans attendre des semaines, regarde d'abord l'accueil et « Mon rythme » avec tes vraies séances. Les cas limites (changement d'année, d'heure, semaine sur deux mois, joker) sont couverts par des tests automatiques ; sur l'iPad on vérifie l'usage réel.

| # | Action | Résultat attendu |
|---|---|---|
| 6.1 | Ouvre l'accueil sans aucune séance. | Un message d'accueil clair avec « Importer une vidéo », pas d'écran vide. |
| 6.2 | Avec des séances : regarde l'en-tête. | Salutation (Bonjour / Bonsoir), ligne du créneau du jour, pastille de série, bouton « Importer une vidéo ». Réglages : mets ton prénom, il apparaît. |
| 6.3 | La carte « Séance du jour ». | Nom, durée, nombre d'exercices, « Commencer » et « Version express ». |
| 6.4 | Fais une séance complète, reviens à l'accueil. | La carte « Cette semaine » passe à 1 / 2, la pastille du jour est cochée (avec une coche, pas seulement une couleur), la barre avance. |
| 6.5 | L'écran de fin de séance. | Il dit « Cette séance compte pour ta semaine » et l'état de la semaine (« encore 1 séance » ou « semaine validée »). Une séance arrêtée très tôt ne compte pas, sans reproche. |
| 6.6 | Fais deux séances le même jour. | Une seule compte pour la semaine (hypothèse à confirmer : **dis-moi si ça te convient**). |
| 6.7 | Touche « Version express ». | Si une séance est marquée express, c'est elle ; sinon les premiers exercices de la séance du jour, environ 3 minutes. Dis-moi si la composition te convient. |
| 6.8 | « Mon rythme ». | Série en grand, objectif, quatre dernières semaines en pastilles, phrase sur le joker. |
| 6.9 | Change les jours, l'heure et la durée du créneau. | Les valeurs sont gardées après fermeture de l'app. |
| 6.10 | « Ajouter à mon calendrier ». | La feuille de partage propose « Calendrier » (sinon un fichier .ics s'ouvre). L'événement apparaît chaque semaine aux bons jours, à la bonne heure, **avec le rappel 10 minutes avant** et le lien de l'app. |
| 6.11 | Change le créneau après l'export. | Un message te demande de supprimer l'ancien événement avant d'ajouter le nouveau. |
| 6.12 | Désactive « Séance express de secours ». | Le bouton express disparaît de l'accueil. |
| 6.13 | Choisis une « Séance du créneau ». | Elle devient la séance du jour sur l'accueil. |
| 6.14 | Ton de tous les messages. | Aucun reproche, aucun compteur de jours manqués. Dis-moi s'un texte te gêne. |

Pas de notification : le rappel passe par le calendrier (plan). Pour tester la série sur plusieurs semaines sans attendre, tu peux me demander un jeu de données d'essai.

Déjà vérifié : 31 tests automatiques (série sur tous les cas limites, y compris dans trois fuseaux horaires dont changement d'heure ; limites par jour et express ; export .ics : récurrence, heure flottante, alarme, longues lignes ; composition express). Accueil et « Mon rythme » affichés dans un navigateur avec des données d'essai, fichier .ics généré.

## Phase 7 : collection et révélation

Pour voir la révélation sans attendre une semaine validée : Réglages, « Page de tests (/lab) », tout en bas « Révélation d'une pochette », trois boutons (sticker courant, rare, brillant). Ça ne touche pas à ta collection. Fais-le avec Spotify en lecture, et sur l'iPad installé.

| # | Action | Résultat attendu |
|---|---|---|
| 7.1 | Lance « Rejouer (sticker courant) ». | Fond sombre, pochette métallisée qui flotte, reflet qui la traverse, texte « Semaine validée. Maintiens pour ouvrir. » |
| 7.2 | Appuie sur la pochette et relâche tout de suite (moins d'une seconde). | Elle tremble un peu, une lueur monte, puis elle retombe doucement. Rien ne s'ouvre. |
| 7.3 | Maintiens environ 1,2 s. | Elle tremble de plus en plus, une lueur monte, puis éclair bref, les deux moitiés s'écartent et sortent de l'écran, une gerbe de particules part. |
| 7.4 | Juste après l'ouverture. | Le sticker monte en tournant sur lui-même (un tour), dépasse un peu sa taille puis se pose. Un carillon de deux notes joue au volume des bips. **Spotify ne doit pas couper.** |
| 7.5 | Glisse le doigt sur le sticker. | Il s'incline jusqu'à 14° et son reflet arc-en-ciel se déplace. Retour élastique quand tu lèves le doigt. **Dis-moi si le reflet est assez visible** (il est discret). |
| 7.6 | Touche « Ouvrir » au lieu de maintenir. | Même ouverture. L'iPad peut demander l'accès à l'orientation : refuse, le doigt suffit ; accepte, l'inclinaison de l'iPad doit aussi faire bouger le reflet. |
| 7.7 | Touche « Passer » sur la pochette. | Le sticker apparaît directement. |
| 7.8 | « Rejouer (sticker rare) » et « brillant ». | Le rare a un halo et un reflet plus intense ; le brillant a un reflet doré. Le nom et la série s'affichent en dessous. |
| 7.9 | Fluidité de toute la séquence. | Aucune saccade (objectif 60 images par seconde). **Note ce qui saccade**, c'est ce qui compte le plus pour cette phase. |
| 7.10 | Réglages iPad : Accessibilité, Animations réduites activées, puis rejoue. | Pas de secousse : un simple fondu vers le sticker. Le bouton « Passer » reste présent. |
| 7.11 | Touche « Coller dans ma collection » (depuis la page de test). | Le sticker disparaît vers le coin. Dans la vraie collection, il file vers son emplacement, s'écrase légèrement et le compteur monte. |
| 7.12 | Collection (accueil, « Collection »). | Quatre planches (Ciel de nuit, Petits rituels, Pierres, Bonus), emplacements vides en silhouette avec leur condition de déblocage. |
| 7.13 | Touche un sticker obtenu. | Il s'agrandit et le miroitement se rejoue. |
| 7.14 | Valide une vraie semaine (2 séances comptées). | À la fin de la 2e séance : bouton « Ouvrir ma pochette ». L'accueil et la collection affichent une pastille tant que la pochette n'est pas ouverte, sans limite de temps. |
| 7.15 | Premier découpage enregistré, première séance mêlant deux vidéos, premier « Encore ». | Chaque événement ajoute une pochette bonus (Ciseaux dorés, Mixtape, Boucle infinie). |
| 7.16 | Les dessins. | Dis-moi s'ils te conviennent comme emplacements provisoires. Tu les remplaceras par les tiens (mêmes noms de fichiers dans `src/stickers/art/`). |

Déjà vérifié sur ordinateur : 11 tests automatiques (catalogue de 24 stickers, tirage sans doublon, doublons brillants, une pochette par semaine, paliers de série, bonus, pas de double déblocage). Séquence jouée dans un navigateur : maintien trop court qui retombe, ouverture, apparition, inclinaison, collage, compteur. **La fluidité à 60 images par seconde n'est pas mesurée : seul l'iPad peut le dire.**

## Phase 8 : finitions

| # | Action | Résultat attendu |
|---|---|---|
| 8.1 | Parcours chaque écran sans données (app neuve, ou après une restauration vide) : accueil, bibliothèque, collection, mon rythme, réglages. | Aucun écran vide sans explication : chaque état vide dit quoi faire ensuite. |
| 8.2 | Navigue au clavier (clavier Bluetooth) ou avec le contrôle de sélection : Tab. | Un contour menthe bien visible entoure l'élément actif. |
| 8.3 | Active VoiceOver, passe sur les boutons ronds, les interrupteurs, les pastilles de jours, la frise. | Chaque bouton à icône a un nom (« Retour à l'accueil », « Monter »…), les interrupteurs disent activé ou désactivé, la phase est lue (« Effort », « Transition »). |
| 8.4 | Texte en grand (Réglages iPad, Affichage, Taille du texte). | L'interface reste utilisable, rien d'illisible ni de coupé. |
| 8.5 | Essaie d'importer une vidéo plus grosse que l'espace libre (ou remplis l'iPad). | Message clair « Pas assez de place », rien de copié à moitié. |
| 8.6 | Réglages, quand l'espace dépasse 80 %. | Avertissement « Il reste peu d'espace ». |
| 8.7 | Coupe le réseau, lance un exercice YouTube, puis rouvre l'app. | Messages clairs, l'app s'ouvre. Rien ne plante. |
| 8.8 | Cherche un écran qui affiche une erreur technique ou un texte culpabilisant. | Il n'y en a aucun. Dis-moi s'il y en a. |
| 8.9 | Bouton « Nommer les exercices avec l'IA ». | **Il n'apparaît pas tant que la clé et le modèle ne sont pas configurés sur Vercel.** C'est voulu. Pour l'activer : variables `ANTHROPIC_API_KEY` et `LABEL_MODEL` dans Vercel, puis redéploiement. |
| 8.10 | Après activation : le bouton, la confirmation, les propositions. | Avant l'envoi, un message dit que des images quittent l'appareil et que c'est payant. Rien n'est appliqué avant « Valider ces noms ». |

Avant d'activer l'IA : je n'ai pas pu lire la documentation d'Anthropic depuis ma session. Le nom du modèle, les limites d'images et l'en-tête de version sont à vérifier, et le coût à chiffrer (le plan l'exige). Rien n'est envoyé à un service tant que ce n'est pas activé.

Déjà vérifié : 18 tests de contraste sur toutes les paires texte/fond, 3 tests de la fonction serveur sans clé, build de production, vérifications des phases précédentes inchangées (123 tests au total).


## Phase 13 : interface plus claire, coupes à glisser, IA avec Groq

Vérifié par moi (navigateur d'ordinateur, écran tactile simulé à la taille d'un iPad, faux service d'IA) : parcours complet de l'accueil vide à la séance prête ; glissement d'un trait à la souris et au doigt simulé ; réglage par boutons et au clavier ; zoom ; brouillon repris après rechargement ; repérage IA sur une vidéo de test de 30 s (6 exercices retrouvés aux bons instants, pause du service gérée) ; 194 tests ; construction de production ; fonction serveur compilée aussi avec des réglages non stricts.

Pas vérifié : le vrai service Groq (hors du réseau de ma session), et tout ce qui dépend du doigt et de Safari sur l'iPad.

Attention : la clé de l'IA n'est réglée dans Vercel que pour l'app habituelle (« Production »). Sur l'adresse d'aperçu, les lignes 13.8 et 13.9 ne peuvent pas se tester tant que la clé n'y est pas ; et tes vidéos déjà importées n'y apparaissent pas (il faut en réimporter une).

| # | À faire sur l'iPad | Attendu |
|---|---|---|
| 13.1 | Réglages : regarde la version de l'app en bas. | Elle correspond au dernier déploiement. Sinon, ferme complètement l'app et rouvre-la. |
| 13.2 | Ouvre une vidéo TikTok à découper, iPad en paysage. | Comme avant : vitesses en rangée sous la vidéo, « Couper ici » et le pas en haut à droite. La frise est visible. |
| 13.3 | Lance la lecture, touche « Couper ici » deux ou trois fois. | Un trait blanc avec une poignée apparaît à chaque coupe. |
| 13.4 | Pose le doigt sur un trait et glisse à gauche, à droite. | Le trait suit le doigt, une bulle donne l'instant, la vidéo montre l'image à cet instant. Dis-moi si c'est saccadé ou si le trait est dur à attraper. |
| 13.5 | Touche un trait sans glisser, puis « +0,1 s », « −1 s », « Retirer la coupe ». | La coupe bouge du pas indiqué, puis disparaît (les deux exercices fusionnent). |
| 13.6 | Glisse le doigt sur la règle graduée, au-dessus des blocs. | La lecture se déplace dans la vidéo. |
| 13.7 | Loupe + deux fois, puis glisse le doigt sur les blocs. | La frise est agrandie et défile ; les traits s'attrapent toujours. |
| 13.8 | « Repérer avec l'IA », puis « Envoyer les images et repérer », sur ta vidéo TikTok de référence. | Une barre avance (« partie 2 sur 6 »…), puis des traits orange apparaissent avec des noms d'exercices. **C'est le vrai test du service** : si un message d'erreur s'affiche, recopie-le-moi tel quel. |
| 13.9 | Ajuste deux ou trois traits orange, puis « Tout est bon ». | Les traits deviennent blancs. |
| 13.10 | « Suivant : nommer », puis « Enregistrer N exercices ». | Tu arrives sur « Nouvelle séance », déjà remplie, étape 4. « Enregistrer la séance » te ramène à l'accueil, la séance est là. |
| 13.11 | Accueil avec une vidéo importée mais pas découpée. | Rubrique « À continuer » avec la vignette et « Découper ». |
| 13.12 | Vidéo YouTube (lien) : « Marquer ici », glisser un trait. | Même fonctionnement ; le lecteur YouTube suit avec un léger retard, c'est normal. |
| 13.13 | Réglages : « Langue des annonces » sur English, choisis une voix anglaise, « Tester le son » (mode « + consignes »). | « Next: Cat cow, 45 seconds. » avec une voix anglaise, Spotify continue. |
| 13.14 | Lance une séance en mode « + consignes ». | Entre deux exercices : « Next: {nom}, {durée} seconds. » |
| 13.15 | Étape « Nommer » : « Équipement pour cette vidéo », coche « Bandes élastiques », puis « Autre… » et écris « Tapis ». | La séance faite avec cette vidéo affiche cet équipement (carte, séance du jour, départ de la séance : « Prépare : … »). |
| 13.16 | Rythme régulier, effort 5 s et pause 5 s, « Appliquer le rythme ». | Chaque pause est « Pause », grise, « Retiré ». Seuls les efforts sont gardés. |
| 13.17 | « Suivant : nommer ». | À gauche la vidéo du premier exercice en boucle, à droite la liste. Rien à faire défiler. |
| 13.18 | Touche le champ du nom, tape un nom, « Suivant » (ou Entrée sur le clavier), tape le suivant… | Le nom par défaut est remplacé dès la première lettre ; la vidéo passe à l'exercice suivant. Dis-moi si le clavier cache quelque chose d'important. |
| 13.19 | Touche une ligne de la liste. | La vidéo montre tout de suite cet exercice. |
| 13.20 | Case « Montrer les parties retirées ». | Les pauses apparaissent en gris ; « Garder cette partie » en fait un exercice. Le choix est retenu la fois suivante. |
| 13.21 | Mes vidéos, une vidéo déjà découpée : « Noms et équipement », change un nom, « Terminé ». | Le nouveau nom est dans la bibliothèque et dans les séances. |
| 13.22 | Découpage d'une vidéo YouTube longue : « 10 s » en avant et en arrière. | La lecture saute de 10 s. |
| 13.23 | Étape « Nommer » : tape un nom en anglais, touche « Écouter ». | La voix choisie dit « Next: {nom}, {durée} seconds. » ; avec Spotify en marche, la musique continue. |
