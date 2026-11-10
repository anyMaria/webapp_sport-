# Consignes Claude Code – webapp_sport

2026-11-10 · Ana-Maria

## 1. Contexte et objectif

L'app transforme des vidéos d'exercices (YouTube et TikTok) en séances d'étirements et de posture que l'on suit à son rythme, avec sa propre musique. Elle sert une seule personne, sur un iPad posé au sol ou sur une chaise, à portée de main.

Ce qu'elle doit résoudre :

- **Rythme imposé.** Une vidéo avance toute seule. Prolonger un exercice oblige à mettre en pause puis à revenir en arrière, souvent sans chapitres.
- **Musique imposée.** L'utilisatrice veut sa musique (Spotify, sur le même iPad) et garder des signaux sonores pour les changements d'exercice.
- **TikTok inutilisable en séance.** L'extrait dure 30 secondes, il faut le relancer à la main et l'écran s'éteint.
- **Aucune combinaison possible.** Impossible d'enchaîner des exercices venant de plusieurs vidéos sans tout rechercher à chaque fois.
- **Difficulté à s'y mettre.** Planning chargé, peu de motivation : il faut un créneau fixe, une série à entretenir et de petites récompenses.

Le résultat attendu : ouvrir l'app, toucher « Commencer », et suivre une séance de 3 à 15 minutes sans autre manipulation que « Encore » ou « Suivant ».

Le nom de l'app n'est pas décidé. Utilise une seule constante `APP_NAME` (valeur provisoire : « Séance ») pour pouvoir le changer partout d'un coup.

## 2. Décisions validées

Ces points ont été tranchés avec l'utilisatrice. Ne les remets pas en question sans raison technique bloquante.

| Sujet | Décision |
|---|---|
| Format | Web app installable (PWA), ajoutée à l'écran d'accueil de l'iPad depuis Safari. Pas d'app native. |
| Appareil cible | iPad à jour, orientation paysage en priorité. Tous les navigateurs iPad utilisent WebKit : seul Safari compte. |
| Vidéos TikTok | Fichiers déjà enregistrés sur son téléphone, importés dans l'app comme fichiers locaux. |
| Vidéos YouTube | Deux voies acceptées : lecteur YouTube intégré et piloté (marquage manuel), ou import d'un fichier vidéo qu'elle possède déjà. L'app ne télécharge jamais depuis YouTube ou TikTok. |
| Pré-marquage | Automatique sur les fichiers importés, puis ajustable à la main. Nommage par IA en option. |
| Fin d'exercice | Décompte de 5 secondes puis passage automatique au suivant. « Encore 30 s » relance le même extrait, autant de fois que voulu. |
| Audio | Quatre modes au choix pendant la lecture : Ma musique, Musique + bips, Musique + bips + consignes, Son de la vidéo. |
| Consignes | Voix de synthèse qui annonce l'exercice et une courte consigne. On ne cherche pas à isoler la voix du coach de la vidéo. |
| Musique | Spotify, lu sur le même iPad, en dehors de l'app. L'app ne pilote pas Spotify. |
| Série | Par semaine : une semaine est validée avec 2 séances. Un joker par mois. |
| Créneau | Créneau fixe hebdomadaire, exporté vers son calendrier avec rappel. |
| Récompenses | Stickers à collectionner, un par semaine validée, avec une animation de révélation soignée (référence : la révélation des gemmes dans l'app Opal). |
| Ambiance | Thème nuit, pour toute l'app. |
| Portée | Usage personnel, une seule utilisatrice, pas de compte ni de partage pour l'instant. |

## 3. Phase 0 : vérifier la faisabilité sur l'iPad

Rien d'autre ne se construit avant que ces sept tests soient passés sur son iPad, app installée sur l'écran d'accueil et Spotify en lecture. Les tests 1 et 2 décident de toute l'architecture audio.

Tu ne peux pas tester sur iPad toi-même. Publie une page `/lab` avec un bouton par test et un résultat lisible à l'écran, déploie-la, puis demande à l'utilisatrice de la parcourir et de te rapporter chaque résultat. Consigne les résultats dans `docs/phase0.md`.

| # | Test | Réussi si | Plan B |
|---|---|---|---|
| 1 | Bip par-dessus Spotify. Jouer un bip Web Audio avec `navigator.audioSession.type` réglé sur `ambient`, puis `transient`, puis sans réglage. Tester aussi un élément `<audio>`. | Spotify continue sans coupure et le bip s'entend, dans au moins une variante. | Signal visuel seul (flash plein écran et changement de couleur), ou Spotify sur un autre appareil. |
| 2 | Voix de synthèse par-dessus Spotify, avec `speechSynthesis` et une voix française. | La phrase est dite sans couper Spotify. | Clips audio pré-générés joués par le même canal que les bips, ou consigne affichée en grand sans voix. |
| 3 | Vidéo locale muette en boucle (`muted playsinline`) pendant que Spotify joue, puis lecteur YouTube intégré muet. | Spotify continue dans les deux cas. | Aucun : c'est un prérequis. Si ça échoue, le signaler avant d'aller plus loin. |
| 4 | Écran allumé avec `navigator.wakeLock.request("screen")`, redemandé au retour au premier plan. | L'écran reste allumé 5 minutes sans toucher. | La vidéo de l'exercice, toujours en lecture, maintient l'écran allumé. |
| 5 | Stockage. Importer un fichier vidéo de 150 Mo, l'écrire dans OPFS, appeler `navigator.storage.persist()`, afficher `navigator.storage.estimate()`. | Le fichier se relit après fermeture complète de l'app, le lendemain aussi. | Blobs dans IndexedDB, et alerte quand l'espace manque. |
| 6 | Boucle sur un extrait de fichier local entre deux temps donnés, et même chose avec YouTube (`seekTo`). | Le retour au début de l'extrait prend moins de 0,3 s en local. Noter le délai observé pour YouTube. | Fondu au noir court au moment de la boucle. |
| 7 | Analyse d'une vidéo de 15 minutes : échantillonnage d'images par déplacement dans la vidéo, décodage de la piste audio à faible fréquence d'échantillonnage. | Moins de 90 secondes, sans plantage ni rechargement de la page. | Échantillonner moins souvent, ou abandonner l'audio et garder les changements de plan. |

Références : [Audio Session API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Audio_Session_API), dont le comportement réel sur iOS a varié selon les versions ([bug WebKit 264473](https://bugs.webkit.org/show_bug.cgi?id=264473)), et [Screen Wake Lock dans les web apps installées](https://progressier.com/pwa-capabilities/screen-wake-lock), qui fonctionne depuis iOS 18.4.

## 4. Architecture et stack

L'app est entièrement côté client : pas de base de données serveur, pas de compte. Les données et les vidéos vivent sur l'iPad. Une seule fonction serveur existe, optionnelle, pour le nommage par IA.

| Couche | Choix | Pourquoi |
|---|---|---|
| Base | Vite, React, TypeScript strict | Simple, rapide, bien outillé pour une PWA. |
| PWA | `vite-plugin-pwa` : manifeste (`display: standalone`), service worker qui met l'interface en cache | L'app s'ouvre sans réseau. Les fichiers vidéo locaux se lisent hors ligne. |
| Navigation | React Router | Peu d'écrans, routes simples. |
| État de séance | Un réducteur pur (voir section 7) exposé par un store Zustand | Logique testable sans navigateur. |
| Données | IndexedDB via Dexie | Exercices, séances, journal, réglages, stickers, vignettes. |
| Fichiers vidéo | OPFS (`navigator.storage.getDirectory()`), lus par `getFile()` puis `URL.createObjectURL` | Les gros fichiers ne passent jamais entièrement en mémoire. Révoquer les URL après usage. |
| Vidéo YouTube | API IFrame officielle, lecteur visible et non masqué | Seule voie autorisée. Demande une connexion. |
| Styles | Variables CSS (jetons de la section 11) et CSS Modules | Pas de kit d'interface. |
| Animations | Web Animations API et transformations CSS 3D. Canvas 2D pour les particules. | Pas de moteur 3D. |
| Polices | Outfit et Inter, auto-hébergées (`@fontsource`) | Disponibles hors ligne. |
| Analyse vidéo | Web Worker pour les calculs, élément vidéo caché pour l'échantillonnage | L'interface reste fluide. |
| Tests | Vitest sur la logique pure : moteur de séance, série, fusion des segments | Ce sont les trois endroits où un bug coûte cher. |
| Hébergement | Vercel : site statique, plus la fonction `/api/label-segments` en phase 8 | Aperçu par déploiement pour les tests sur iPad. |

Cible : Safari sur iPadOS 18.4 ou plus récent, en mode installé. L'app doit aussi tourner dans Chrome sur ordinateur pour le développement.

Arborescence proposée :

```
src/
  app/            routes, mise en page, thème
  engine/         moteur de séance (réducteur pur, effets, tests)
  audio/          bips, voix, session audio, modes
  video/          lecteur fichier local, lecteur YouTube, boucle sur extrait
  import/         import de fichier, analyse, fusion des segments, écran de découpage
  library/        exercices, séances, composition
  motivation/     série, joker, créneau, export .ics
  stickers/       catalogue, déblocage, révélation, collection
  data/           schéma Dexie, accès OPFS, sauvegarde et restauration
  ui/             composants partagés (boutons, interrupteurs, minuteur)
  lab/            page de tests de la phase 0
api/
  label-segments.ts
docs/
  PLAN.md  phase0.md  decisions.md
```

Prévois dès la phase 1 une sauvegarde : export et import d'un fichier JSON contenant tout sauf les vidéos.

## 5. Modèle de données

Trois objets portent tout : une **source** (une vidéo), un **exercice** (un extrait d'une source) et une **séance** (une liste ordonnée d'exercices, venant de n'importe quelles sources). La série et les stickers se calculent à partir du journal des séances faites.

```ts
type SourceKind = "file" | "youtube";

interface VideoSource {
  id: string;
  kind: SourceKind;
  title: string;
  durationSec: number;
  originLabel: "TikTok" | "YouTube" | "Autre"; // affichage seulement
  opfsPath?: string;      // kind = "file"
  sizeBytes?: number;     // kind = "file"
  youtubeId?: string;     // kind = "youtube"
  createdAt: string;
}

interface Exercise {
  id: string;
  sourceId: string;
  name: string;
  startSec: number;
  endSec: number;
  cue?: string;           // consigne courte, 80 caractères au plus, lue par la voix
  tags: string[];         // zone du corps, ex. "dos", "épaules", "hanches"
  thumbId?: string;       // vignette JPEG stockée dans IndexedDB
  createdAt: string;
}

interface WorkoutItem {
  exerciseId: string;
  durationSec: number;    // durée voulue ; l'extrait boucle s'il est plus court
  restAfterSec: number;   // 0 par défaut
}

interface Workout {
  id: string;
  name: string;
  items: WorkoutItem[];
  isExpress: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SessionLog {
  id: string;
  workoutId: string;
  startedAt: string;
  endedAt: string;
  activeSec: number;      // temps hors pause
  plannedSec: number;
  extensions: number;     // nombre de « Encore »
  isExpress: boolean;
  counted: boolean;       // compte pour l'objectif de la semaine (règles en section 9)
}

interface StickerUnlock {
  stickerId: string;
  reason: "week" | "milestone" | "bonus";
  weekKey?: string;       // semaine ISO, ex. "2026-W46"
  unlockedAt: string;
  revealed: boolean;      // false tant que la pochette n'est pas ouverte
}

interface JokerUse { monthKey: string; weekKey: string; }

interface Settings {
  weeklyGoal: number;             // 2
  jokersPerMonth: number;         // 1
  slot: { days: number[]; time: string; durationMin: number }; // ex. [1,2,4], "19:00", 15
  audioMode: "music" | "music+beeps" | "music+beeps+voice" | "video";
  countdownSec: number;           // 5
  extendSec: number;              // 30
  beepVolume: number;             // 0 à 1
  voiceName?: string;
}
```

Règles :

- Supprimer une source supprime son fichier OPFS et ses exercices, après confirmation qui liste les séances touchées.
- Une séance qui référence un exercice supprimé reste lisible : elle saute l'élément manquant et le signale.
- Les semaines vont du lundi au dimanche, en heure locale de l'appareil.

## 6. Écrans et parcours

L'app compte neuf écrans. Le parcours principal tient en deux touches : Accueil, « Commencer », séance. Tout le reste (import, composition, réglages) se fait en dehors des moments d'entraînement.

La référence de mise en page est l'iPad en paysage (environ 1180 × 820). En portrait, la vidéo passe au-dessus et le panneau en dessous.

### 6.1 Accueil

- En-tête : salutation, rappel du créneau du jour s'il y en a un, pastille de série (« 3 semaines d'affilée »), bouton « Importer une vidéo ».
- Carte « Séance du jour » : la dernière séance utilisée ou celle choisie pour le créneau. Nom, durée, nombre d'exercices. Bouton principal « Commencer » et bouton secondaire « Version express · 3 min ».
- Carte « Cette semaine » : séances comptées sur l'objectif (ex. 1 / 2), sept pastilles de jours (faite, aujourd'hui, créneau prévu, vide), progression vers le prochain sticker.
- Grille « Mes séances » : une carte par séance sauvegardée (vignette, nom, durée, nombre d'exercices, origine des vidéos, bouton lecture). Dernière carte : « Nouvelle séance ».
- Lien « Bibliothèque d'exercices ». Accès à « Mon rythme », « Collection » et « Réglages ».
- Si un sticker attend d'être révélé, une pastille lumineuse l'indique.

### 6.2 Séance en cours

- À gauche, environ 63 % de la largeur : la vidéo de l'exercice sur fond très sombre, en boucle sur l'extrait. Une vidéo verticale est centrée, sans recadrage. Bouton « Quitter » en haut à gauche, grand bouton « Pause » en bas à gauche, étiquette de l'origine et des temps de l'extrait.
- À droite : « Exercice 3 sur 8 », pastille de phase (« Effort »), barre de progression à segments, nom de l'exercice, minuteur géant, durée prévue.
- Deux grands boutons : « Encore » (ajoute 30 secondes) et « Suivant ».
- Carte « Ensuite » : vignette, nom et durée du prochain exercice.
- Sélecteur « Son » à quatre choix, modifiable à tout moment.
- Toucher la vidéo met en pause ou relance.

### 6.3 Fin d'exercice

- S'affiche par-dessus la vidéo quand le minuteur atteint zéro. L'extrait continue en boucle, assombri.
- Carte : anneau de décompte avec le chiffre, « Suivant dans 5 secondes », nom, durée et consigne du prochain exercice, sa vignette.
- Deux boutons : « Encore 30 s » et « Passer maintenant ». Sans action, la séance avance seule.
- La pastille de phase passe à « Transition ».

### 6.4 Fin de séance

- Récapitulatif : durée active, nombre d'exercices, nombre de « Encore ».
- État de la semaine : « 2 / 2, semaine validée » ou « Encore 1 séance cette semaine ».
- Si la séance valide la semaine : bouton « Ouvrir ma pochette », qui lance la révélation (section 10).
- Bouton « Terminer », retour à l'accueil.

### 6.5 Import et découpage

- Entrée : choix d'un ou plusieurs fichiers vidéo, ou collage d'un lien YouTube.
- Pour un fichier court (moins de 90 secondes) : proposition directe « Garder la vidéo entière comme un exercice ».
- En-tête : nom du fichier, durée, nombre de segments détectés, bouton « Enregistrer N exercices ».
- Colonne gauche : aperçu du segment sélectionné, en boucle. Carte « Pré-marquage automatique » avec trois interrupteurs (Changements de plan, Bips et silences, Rythme régulier avec ses deux durées) et le bouton « Nommer les exercices avec l'IA ».
- Colonne droite : liste des segments. Chaque ligne : vignette, nom modifiable, début, fin, durée, bouton Gardé ou Retiré. Une ligne incertaine porte l'étiquette « Fin à vérifier ».
- Sur un segment sélectionné : ajuster le début et la fin (poignées et boutons ± 0,5 s), couper à la position de lecture, fusionner avec le suivant, saisir la consigne, choisir les tags.
- En bas : frise de toute la vidéo, segments colorés par état (gardé, à vérifier, retiré).

### 6.6 Bibliothèque et composition d'une séance

- Bibliothèque : tous les exercices, filtrables par tag et par vidéo d'origine, avec recherche par nom.
- Composition : ajouter des exercices depuis la bibliothèque, les réordonner par glisser-déposer, régler la durée de chacun et le repos éventuel. La durée totale s'affiche en continu.
- Actions sur une séance : renommer, dupliquer, supprimer, marquer comme séance express.

### 6.7 Mon rythme

- Série en cours en très grand, objectif hebdomadaire, historique des dernières semaines en pastilles, joker expliqué en une phrase.
- Créneau : jours, heure, durée, interrupteur « Rappel 10 min avant », bouton « Ajouter à mon calendrier ».
- Interrupteur « Séance express de secours ».

### 6.8 Collection

- Planche de stickers par série, emplacements vides en silhouette avec leur condition de déblocage.
- Toucher un sticker l'agrandit et permet de le faire miroiter.
- Voir la section 10.

### 6.9 Réglages

- Son : volume des bips, voix utilisée, test du son.
- Séance : durée du décompte, durée du « Encore ».
- Données : espace utilisé par les vidéos, sauvegarde et restauration, suppression d'une vidéo.
- Lien vers la page `/lab`.

## 7. Moteur de séance et modes audio

Le moteur est un réducteur pur : `(état, événement) → (état, effets)`. Il ne touche ni à la vidéo ni au son. Une couche d'effets exécute ce qu'il demande (jouer un bip, changer d'extrait, parler). C'est ce réducteur que couvrent les tests.

### États et transitions

| État | Ce qui se passe | Événement | État suivant |
|---|---|---|---|
| `ready` | Séance chargée, rien ne tourne. | `START` (touche « Commencer ») | `exercise` (élément 1) |
| `exercise` | Le minuteur descend. L'extrait boucle. | `TICK` jusqu'à zéro | `transition` |
| `exercise` |  | `EXTEND` (« Encore ») | `exercise`, temps restant + 30 s |
| `exercise` |  | `SKIP` (« Suivant ») | `exercise` (élément suivant), sans décompte |
| `exercise` ou `transition` |  | `PAUSE`, ou l'app passe en arrière-plan | `paused` |
| `paused` | Minuteur et vidéo figés. | `RESUME` (toujours par une touche) | l'état d'avant la pause |
| `transition` | Décompte de 5 s. L'extrait courant boucle, assombri. | `TICK` jusqu'à zéro, ou `SKIP` | `exercise` (élément suivant) |
| `transition` |  | `EXTEND` (« Encore 30 s ») | `exercise` (même élément), 30 s |
| `exercise` ou `transition` (dernier élément) |  | fin du temps ou `SKIP` | `finished` |
| tout état |  | `QUIT` confirmé | `finished`, séance partielle |

Précisions :

- Si `restAfterSec` dépasse la durée du décompte, la transition dure `restAfterSec`.
- Le temps se calcule par différences d'horloge (`performance.now()`), jamais en comptant des intervalles.
- À `finished`, écrire un `SessionLog`. Les règles qui décident si la séance compte sont en section 9.
- Le maintien de l'écran allumé est demandé à `START`, redemandé à chaque retour au premier plan, relâché à `finished`.

### Vidéo

- Fichier local : élément `<video muted playsinline>`. Surveiller la position à chaque image (`requestVideoFrameCallback`, sinon `requestAnimationFrame`) et revenir à `startSec` juste avant `endSec`.
- Précharger l'extrait suivant dans un second élément vidéo caché, pour un changement sans attente.
- YouTube : API IFrame, position lue toutes les 250 ms, retour par `seekTo(startSec, true)`. Sans réseau, afficher un message clair et proposer de passer l'exercice.

### Les quatre modes audio

| Mode | Vidéo | Bips | Voix | Effet attendu sur Spotify |
|---|---|---|---|---|
| Ma musique | muette | non | non | continue |
| Musique + bips | muette | oui | non | continue |
| Musique + bips + consignes | muette | oui | oui | continue, selon les tests 1 et 2 |
| Son de la vidéo | avec le son | oui | non | iOS mettra probablement Spotify en pause : l'indiquer sous le sélecteur |

- Bips : synthétisés avec Web Audio, sans fichier son. Un bip court à 3, 2 et 1 seconde de la fin, un bip plus long et plus aigu à zéro. Enveloppe de gain pour éviter les claquements.
- Créer et débloquer le contexte audio sur la touche « Commencer ». Régler le type de session audio selon le résultat de la phase 0.
- Voix : pendant la transition, dire « Ensuite : {nom}, {durée} secondes. » puis la consigne si elle existe. Voix française du système, choisie dans les réglages.
- Le mode se change en cours de séance et s'applique immédiatement. Il est mémorisé.

## 8. Import des vidéos et pré-marquage

L'analyse automatique ne fonctionne que sur les fichiers importés. Un lecteur YouTube intégré ne donne accès ni aux images ni au son : là, le marquage est manuel ou par rythme régulier.

L'app ne télécharge jamais une vidéo depuis YouTube ou TikTok. N'ajoute aucune fonction de ce type, même si elle paraît pratique.

### Import d'un fichier

1. Sélection d'un ou plusieurs fichiers (`accept="video/*"`).
2. Copie dans OPFS avec barre de progression. Lecture de la durée et des dimensions.
3. Fichier de moins de 90 secondes : proposer « Garder la vidéo entière comme un exercice ». C'est le cas courant pour les TikTok.
4. Sinon, analyse, puis écran de découpage (6.5).
5. « Enregistrer » crée un exercice par segment gardé, avec sa vignette.

### Détection locale

Trois détecteurs proposent des frontières, puis une étape de fusion décide.

- **Changements de plan.** Parcourir la vidéo par sauts de 0,5 s (1 s au-delà de 10 minutes) dans un élément vidéo caché. Dessiner chaque image en 64 × 36, comparer les histogrammes de luminance de deux images voisines. Une frontière est un écart supérieur à un seuil adaptatif (médiane plus quelques écarts médians).
- **Bips et silences.** Décoder la piste audio en mono à faible fréquence d'échantillonnage (essayer 8 à 16 kHz avec `OfflineAudioContext`) pour limiter la mémoire. Calculer l'enveloppe d'énergie par fenêtres de 50 ms. Un silence est un creux d'au moins 0,7 s. Un bip est un pic étroit entre 800 et 2500 Hz, de 80 à 600 ms.
- **Rythme régulier.** L'utilisatrice saisit la durée d'effort, la durée de pause et le début du premier exercice. Générer les segments, puis caler chaque frontière sur une frontière détectée à moins de 1,5 s si elle existe.

Fusion :

- Regrouper les frontières à moins de 1 s les unes des autres.
- Un segment de moins de 8 s est rattaché à son voisin.
- Un segment de moins de 15 s entre deux segments longs est proposé comme « Pause », retiré par défaut.
- Le premier et le dernier segment sont proposés retirés s'ils ne contiennent pas de mouvement répétitif évident. En cas de doute, les garder et les marquer « à vérifier ».
- Chaque frontière porte un score de confiance. Deux détecteurs d'accord : confiance haute. Un seul, proche du seuil : « Fin à vérifier ».

L'analyse affiche sa progression et peut être annulée. Elle ne doit jamais bloquer l'interface. Si elle échoue, l'écran de découpage s'ouvre quand même, avec un seul segment à couper à la main.

La détection sera bonne sur les vidéos montées ou rythmées par des bips, plus approximative sur un plan continu sans coupure. L'écran de découpage doit donc rester rapide à corriger : c'est lui qui garantit le résultat.

### YouTube

1. Coller un lien, en extraire l'identifiant, afficher le lecteur intégré.
2. Trois façons de marquer : toucher « Marquer » à chaque changement d'exercice pendant la lecture, saisir un rythme régulier, ou coller des repères copiés de la description (lignes du type `2:15 Nom de l'exercice`).
3. Même écran de découpage ensuite, sans vignettes extraites (utiliser la miniature YouTube).

### Nommage par IA (option, phase 8)

- Pour chaque segment gardé, envoyer deux ou trois images réduites (512 px de large, JPEG) à `/api/label-segments`.
- La fonction appelle un modèle de vision et renvoie, en français, `{ name, cue }` par segment : un nom d'exercice court et une consigne de 80 caractères au plus.
- L'utilisatrice valide ou corrige chaque proposition. Rien n'est enregistré sans validation.
- La clé d'API reste côté serveur, en variable d'environnement. Sans clé, le bouton n'apparaît pas.
- Vérifie dans la documentation actuelle de l'API le nom du modèle et les limites d'images. Ne les écris pas de mémoire.
- Afficher avant l'envoi que des images de la vidéo quittent l'appareil.

## 9. Motivation : série, créneau fixe, séance express

La série compte des semaines, pas des jours : une semaine est validée avec 2 séances comptées. Un jour sans séance ne casse donc rien, ce qui convient à un planning chargé.

### Quand une séance compte

- Elle est allée jusqu'au dernier exercice, ou son temps actif atteint 80 % du temps prévu.
- Une séance express compte comme une séance.
- Hypothèse à confirmer avec l'utilisatrice : une seule séance comptée par jour, et une seule express comptée par semaine. Mets ces deux limites dans des constantes faciles à changer.

### Calcul de la série

- Semaine du lundi au dimanche, heure locale. Clé au format semaine ISO.
- Série = nombre de semaines validées consécutives, en remontant depuis la dernière semaine terminée. La semaine en cours s'ajoute dès qu'elle est validée. Tant qu'elle ne l'est pas, elle ne casse pas la série.
- Joker : un par mois civil. Au changement de semaine, si la semaine écoulée a exactement 1 séance comptée et que le joker du mois est libre, il s'applique tout seul. La série continue, sans sticker pour cette semaine.
- Une semaine à 0 séance, ou à 1 séance sans joker disponible, remet la série à zéro.
- Tout se calcule à partir du journal (`SessionLog`, `JokerUse`) par une fonction pure, testée sur les cas limites : changement d'année, semaine à cheval sur deux mois, changement d'heure.

### Ton des messages

Jamais de reproche. Série interrompue : « On repart cette semaine. » Semaine sauvée par le joker : « Joker utilisé, ta série continue. » Pas de notification insistante, pas de compteur de jours manqués.

### Créneau fixe

- Réglage : jours de la semaine, heure, durée (15 minutes par défaut).
- « Ajouter à mon calendrier » génère un fichier `.ics` : un événement récurrent hebdomadaire (`RRULE:FREQ=WEEKLY;BYDAY=…`), en heure locale flottante, avec une alarme 10 minutes avant et l'adresse de l'app dans le champ `URL`.
- Sur iPad en mode installé, vérifier comment le fichier s'ouvre. Si le téléchargement direct ne propose pas l'ajout au calendrier, passer par la feuille de partage (`navigator.share` avec un fichier).
- Si le créneau change, prévenir qu'il faut supprimer l'ancien événement avant d'ajouter le nouveau.
- L'accueil rappelle le créneau du jour (« Ton créneau est à 19h00 »).
- Les notifications push ne font pas partie de cette version : elles demandent un serveur d'envoi. Le rappel passe par le calendrier.

### Séance express

- Environ 3 minutes, 3 ou 4 exercices.
- Si une séance est marquée express, c'est elle qui se lance. Sinon, l'app la compose avec les premiers exercices de la séance du jour, jusqu'à 3 minutes.
- Accessible depuis l'accueil en une touche, à côté de « Commencer ».

## 10. Collection de stickers et révélation

Chaque semaine validée donne une pochette surprise qui contient un sticker holographique. L'ouvrir est un petit moment à part, déclenché par l'utilisatrice, dans l'esprit de la [révélation des gemmes d'Opal](https://opalapp.com/blog/the-milestone-reveal-moment) : un geste, une animation soignée, un son. On en reprend l'esprit, pas l'apparence.

### Catalogue de départ (24 stickers)

| Série | Stickers | Déblocage |
|---|---|---|
| Ciel de nuit (8) | Croissant de lune, Étoile filante, Saturne, Comète, Constellation du chat, Aurore boréale, Éclipse, Nébuleuse | Une semaine validée : tirage au hasard parmi les stickers hebdomadaires pas encore obtenus |
| Petits rituels (8) | Tapis roulé, Tasse fumante, Bougie, Monstera, Chaussettes épaisses, Casque audio, Gourde, Chat qui s'étire | Idem |
| Pierres (5, rares) | Pierre de lune, Améthyste, Labradorite, Obsidienne dorée, Étoile polaire | Paliers de série : 4, 8, 12, 26 et 52 semaines |
| Bonus (3) | Ciseaux dorés, Mixtape, Boucle infinie | Premier découpage enregistré, première séance mêlant deux vidéos, premier « Encore » |

- Le catalogue est un fichier de données (`src/stickers/catalog.ts`) : identifiant, nom, série, rareté, règle de déblocage. Ajouter une série ne demande aucun autre changement de code.
- Chaque dessin est un SVG de 512 × 512 à fond transparent, dans `src/stickers/art/{id}.svg`, avec un contour clair épais façon sticker découpé.
- Pour cette version, dessine des SVG simples et propres. L'utilisatrice est graphiste : elle remplacera les fichiers par ses illustrations, sous les mêmes noms.
- Quand les 16 stickers hebdomadaires sont obtenus, une semaine validée donne un doublon « brillant » (même dessin, finition dorée), en attendant de nouvelles séries.

### Séquence de révélation

Durée totale : 6 secondes au plus, une fois le geste fait. Tout se passe sur un fond assombri, par-dessus l'écran de fin de séance ou la collection.

1. **Pochette scellée.** Une pochette en papier métallisé flotte au centre, avec un léger balancement et un reflet qui la traverse. Texte : « Semaine validée. Maintiens pour ouvrir. »
2. **Le geste.** Appui maintenu environ 1,2 s. La pochette tremble de plus en plus, une lueur monte par la déchirure. Relâcher trop tôt la fait retomber doucement. Un simple toucher sur le bouton « Ouvrir » fait la même chose, pour l'accessibilité.
3. **L'ouverture.** Éclair bref, les deux moitiés de la pochette s'écartent et sortent de l'écran, 20 à 40 particules partent en gerbe.
4. **L'apparition.** Le sticker monte en tournant sur lui-même (un tour sur l'axe vertical), avec un effet ressort : il dépasse un peu sa taille puis se pose.
5. **Le miroitement.** Le sticker suit le doigt : il s'incline jusqu'à 14° et son reflet holographique se déplace. Le nom et la série apparaissent en dessous. Un sticker rare a un reflet plus intense et un halo.
6. **Le collage.** Bouton « Coller dans ma collection » : le sticker file vers son emplacement sur la planche, s'écrase légèrement en se posant, et le compteur s'incrémente.

### Réalisation

- Transformations CSS 3D et Web Animations API. Particules sur un canvas 2D. Pas de moteur 3D.
- Reflet holographique : le dessin, puis une couche de dégradé arc-en-ciel en `mix-blend-mode: color-dodge`, masquée par la forme du sticker, puis une bande claire étroite. L'inclinaison décale les deux couches.
- Inclinaison pilotée par la position du doigt, retour élastique au relâchement. En option, l'orientation de l'iPad : la permission se demande sur la touche « Ouvrir ». En cas de refus, le doigt suffit.
- Son : un carillon court de deux notes, synthétisé avec Web Audio, au volume des bips. Pas de vibration : Safari sur iPad n'en propose pas.
- N'animer que `transform` et `opacity`. Viser 60 images par seconde sur l'iPad.
- `prefers-reduced-motion` : un simple fondu vers le sticker révélé. Un bouton « Passer » est toujours présent.

### Règles

- La révélation n'est jamais automatique. Une pochette non ouverte attend, sans limite de temps, signalée sur l'accueil et dans la collection.
- Collection : une planche par série, emplacements vides en silhouette avec leur condition. Toucher un sticker obtenu l'agrandit et rejoue le miroitement.

## 11. Design system : thème nuit

Toute l'app est en thème nuit : fonds vert-noir, texte clair, une couleur d'effort (menthe) et une couleur de transition (abricot). Il n'y a pas de thème clair.

Les maquettes validées sont sur un canevas privé de l'utilisatrice. Elles montrent la mise en page des écrans 6.1 à 6.5 et 6.7 en version claire, et l'écran de séance en version nuit. Applique la palette ci-dessous à tous les écrans. Demande-lui des captures si une mise en page n'est pas claire.

### Couleurs

| Jeton | Valeur | Usage |
|---|---|---|
| `--bg` | `#161E1B` | Fond des écrans et des panneaux |
| `--bg-deep` | `#0B100E` | Fond derrière la vidéo, fond de la révélation |
| `--surface` | `#222D29` | Cartes |
| `--surface-2` | `#1F2A26` | Boutons ronds, étiquettes, zones vidéo vides |
| `--line` | `#37443F` | Segments de progression inactifs, séparateurs |
| `--border` | `#4A5852` | Contour des boutons secondaires |
| `--text` | `#F2F5F1` | Texte principal |
| `--text-muted` | `#A9B6B0` | Texte secondaire, libellés |
| `--effort` | `#6FE0CC` | Phase d'effort, minuteur, bouton principal, séance faite |
| `--transition` | `#FFB27A` | Décompte, « Ensuite », éléments à vérifier, joker |
| `--on-accent` | `#0B100E` | Texte posé sur `--effort` ou `--transition` |
| `--danger` | `#FF9A8B` | Suppression |

### Typographie

- Outfit (500, 600, 700) pour les titres, les chiffres et les boutons principaux. Inter (400, 500, 600) pour le reste.
- Minuteur : 148 px, graisse 600, chiffres à chasse fixe (`font-variant-numeric: tabular-nums`).
- Titre d'écran : 30 à 34 px. Nom de séance en vedette : 46 px. Texte courant : 16 à 17 px. Libellés en capitales : 13 px, interlettrage 1,2 px.
- Rien sous 13 px.

### Formes et espacements

- Grille de 4 px. Marge d'écran : 32 à 36 px. Espace entre cartes : 20 à 24 px.
- Rayons : 14 à 16 px pour les pastilles et petits boutons, 20 à 24 px pour les boutons et petites cartes, 28 px pour les grandes cartes.
- Zones tactiles : 52 px au minimum. Boutons de séance (« Encore », « Suivant », « Pause ») : 76 à 80 px de haut. L'iPad est au sol ou sur une chaise, on le touche à bout de bras, souvent en plein mouvement.
- Pas d'ombres portées marquées, pas de dégradés décoratifs. La seule exception est le reflet des stickers.
- Icônes au trait en SVG (Lucide convient). Aucun emoji dans l'interface.

### Accessibilité

- Contraste du texte : 4,5:1 au minimum.
- Un état ne repose jamais sur la couleur seule : la phase est écrite (« Effort », « Transition »), un segment retiré est aussi libellé « Retiré ».
- Vrais éléments `<button>`, libellés `aria-label` sur les boutons à icône seule, `aria-pressed` sur les interrupteurs et sélecteurs.
- Transitions d'interface de 200 à 300 ms. `prefers-reduced-motion` respecté partout.

### Textes

- Interface en français, tutoiement, libellés courts.
- Libellés déjà validés : « Commencer », « Version express · 3 min », « Encore », « Encore 30 s », « Suivant », « Passer maintenant », « Suivant dans 5 secondes », « Ensuite », « Ma musique », « Musique + bips », « + consignes », « Son de la vidéo », « Gardé », « Retiré », « Fin à vérifier », « Enregistrer N exercices », « Mon rythme », « Ajouter à mon calendrier ».

## 12. Phases de livraison et critères d'acceptation

Neuf phases, dans cet ordre. Chaque phase se termine par un déploiement d'aperçu et une courte liste de vérifications que l'utilisatrice fait sur son iPad. La phase suivante ne commence qu'après son accord.

| Phase | Contenu | Terminée quand |
|---|---|---|
| 0. Faisabilité | Projet minimal, déploiement, page `/lab` avec les sept tests de la section 3. | Les sept résultats sont notés dans `docs/phase0.md` et la stratégie audio est choisie. |
| 1. Socle | PWA installable, thème nuit, navigation, schéma de données, réglages, sauvegarde et restauration JSON. | L'app s'installe sur l'iPad, s'ouvre sans réseau, et une sauvegarde se restaure à l'identique. |
| 2. Lecteur de séance | Moteur (section 7), minuteur, boucle sur extrait, décompte de fin d'exercice, « Encore », « Suivant », pause, quatre modes audio, écran allumé. Séance de démonstration à partir d'un fichier importé à la main. | Une séance de 5 exercices se déroule de bout en bout sans toucher l'écran, Spotify en fond, avec les bips. Les tests du réducteur passent. |
| 3. Import et découpage manuel | Import de fichiers dans OPFS, raccourci « vidéo entière », écran de découpage sans détection (couper, fusionner, ajuster, nommer, garder ou retirer), bibliothèque, composition de séances. | Elle importe trois TikTok et une vidéo longue, crée une séance qui mélange les quatre, et la joue. |
| 4. Pré-marquage automatique | Les trois détecteurs, la fusion, les scores de confiance, la progression et l'annulation. | Sur trois de ses vraies vidéos, elle corrige le découpage proposé en moins de 2 minutes par vidéo. |
| 5. YouTube intégré | Collage d'un lien, lecteur piloté, marquage manuel, rythme régulier, repères collés, lecture en séance. | Une séance mêle un exercice YouTube et un exercice de fichier local, avec boucle correcte sur les deux. |
| 6. Motivation | Journal des séances, série hebdomadaire, joker, écran « Mon rythme », créneau fixe et export `.ics`, séance express, accueil complet. | L'événement récurrent apparaît dans son calendrier avec le rappel. Les tests de la série passent sur les cas limites. |
| 7. Collection | Catalogue, règles de déblocage, pochettes en attente, révélation complète, planche de collection. | La révélation tourne de façon fluide sur l'iPad et elle la trouve à son goût. Prévoir un bouton de test dans `/lab` pour la rejouer. |
| 8. Finitions | Nommage par IA (option), passe d'accessibilité, états vides, messages d'erreur, gestion de l'espace disque. | Aucun écran sans état vide ni message d'erreur clair. Le bouton IA n'apparaît que si la clé existe. |

La phase 2 passe avant l'import pour une raison : c'est le lecteur qui fait la valeur de l'app, et c'est lui qui dépend le plus des résultats de la phase 0.

## 13. Règles de travail pour Claude Code

Travaille une phase à la fois, arrête-toi à la fin de chacune, et ne suppose jamais qu'un comportement fonctionne sur iPad sans que l'utilisatrice l'ait vérifié.

### Dépôt

- Dépôt GitHub : `anyMaria/webapp_sport-` (le nom se termine par un tiret). Il est vide au 10 novembre 2026.
- Premier commit : la structure du projet, ce plan copié dans `docs/PLAN.md`, un `README.md` court et un `CLAUDE.md` qui résume les règles de cette section et renvoie au plan.
- Branche `main`, petits commits au message clair. Lint et vérification des types avant chaque commit.

### Façon de travailler

- En début de phase, annonce ce que tu vas construire en quelques lignes. En fin de phase, donne l'adresse de l'aperçu et la liste des vérifications à faire sur l'iPad, puis attends son retour.
- L'utilisatrice est graphiste, pas développeuse. Explique tes choix sans jargon et pose tes questions une par une.
- Dis toujours ce que tu as vérifié toi-même (navigateur d'ordinateur, tests) et ce qui reste à vérifier sur l'iPad.
- Une décision non couverte par ce plan : choisis l'option la plus simple, note-la dans `docs/decisions.md`, signale-la en fin de phase.
- Si un résultat de la phase 0 contredit ce plan, arrête-toi et propose une adaptation avant de continuer.

### Interdits

- Télécharger des vidéos depuis YouTube, TikTok ou toute autre plateforme.
- Masquer ou recouvrir les éléments du lecteur YouTube intégré.
- Ajouter un compte, un suivi d'audience, de la publicité ou un service tiers non prévu ici.
- Mettre une clé d'API dans le code client ou dans le dépôt.
- Charger un fichier vidéo entier en mémoire.
- Utiliser des emojis dans l'interface, ou des messages culpabilisants.

### Hypothèses à confirmer avec elle

- Une seule séance comptée par jour, une seule express comptée par semaine (section 9).
- Les thèmes et les noms des 24 stickers (section 10).
- La composition automatique de la séance express (section 9).
- Le nom de l'app.
- L'usage du nommage par IA, qui envoie des images de ses vidéos à un service externe et se paie à l'usage (coût à chiffrer avant de l'activer).

### Hors périmètre pour cette version

Notifications push, synchronisation entre appareils, comptes, partage de séances, pilotage de Spotify, version iPhone soignée, thème clair.
