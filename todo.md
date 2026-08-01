# TODO de Touché-Coulé

Audit fait le 2026-08-01 sur l'export brut (`battleship-game`), suivi d'une passe QA
navigateur (Playwright + Chromium) avec vérification réelle du correctif et de la
mécanique centrale.

---

## ✅ Corrigé — la torpille ignorait la case visée par le joueur

- [x] **L'arme spéciale « Torpille Ligne » (1 charge par partie, cible en théorie la
  première case rencontrée en avançant depuis le point visé) touchait en pratique presque
  toujours la colonne 0 du plateau, quelle que soit la colonne réellement cliquée par le
  joueur.** Le code de balayage (`handleAttack`, cas `torpille`, dans `App.tsx`) initialise
  `targetCol` à `0` puis avance tant que la case courante est déjà tirée ET ne contient pas
  de navire : `while (targetCol < GRID) { if (!board.shots.has(...) || board.ships.some(...))
  break; targetCol++; }`. Le problème est que la condition d'arrêt utilise un OU : dès
  qu'une case n'a **jamais été tirée** (ce qui est le cas de la quasi-totalité d'une ligne
  fraîche), la boucle s'arrête immédiatement à `targetCol = 0`, avant même de tester la
  présence d'un navire ailleurs sur la ligne. Le clic du joueur sur une colonne précise
  (paramètre `c` de `handleAttack`) n'était donc jamais utilisé pour ce calcul — seule la
  ligne `r` comptait, la colonne visée étant silencieusement ignorée au profit du bord
  gauche du plateau. Corrigé en faisant partir le balayage de la colonne réellement visée
  (`let targetCol = c` au lieu de `= 0`), pour que la torpille voyage bien depuis le point
  d'impact choisi. **Vérifié sur l'application réelle** : torpille tirée en visant
  précisément la case (ligne 2, colonne 7) sur un plateau où rien n'avait encore été tiré
  sur cette ligne — impact enregistré exactement en « 2-7 », confirmé par lecture directe
  de l'état du jeu après le tir (pas seulement par lecture de code).

## ✅ Corrigé — tiret long dans un libellé d'interface

- [x] « À VOTRE TOUR — CIBLEZ LES EAUX ENNEMIES » utilisait un tiret long (`—`), en
  violation de la règle du dépôt (aucun tiret long, ni dans les titres ni dans le code ni
  l'interface). Remplacé par deux-points.

## ✅ La passe QA navigateur

- [x] 0 erreur console, 0 exception non gérée
- [x] **Mécanique centrale observée réellement** : placement aléatoire de la flotte,
  bataille lancée, tir canon déclenché avec incrément du compteur de tirs confirmé,
  riposte automatique de l'IA observée (tir enregistré sur notre flotte, tour repassé au
  joueur)
- [x] **Correctif de la torpille vérifié par lecture directe de l'impact enregistré**, pas
  seulement par lecture de code (voir ci-dessus) ; l'arme revient bien sur « canon » après
  usage (comportement automatique confirmé intact)
- [x] Aucun débordement horizontal en 390×844, écran de placement comme écran de bataille

### Méthode de vérification

Instrumentation temporaire `window.__qa` (miroir des états `phase`, `turn`, `activeWeapon`,
`inventory`, `lastPlayerShot`, `lastEnemyShot`, compteurs de tirs), mise à jour par un
`useEffect` classique sur les states React concernés — retirée avant le build final (hash
de bundle identique avant/après son ajout puis son retrait). **Piège rencontré** : un
premier essai de tir à la torpille juste après le tir au canon a échoué silencieusement
(aucun tir enregistré) — la grille radar est désactivée pendant le délai de riposte de
l'IA (~850ms) après chaque tir du joueur, un clic sur un bouton `disabled` ne déclenche
simplement pas `onClick`. Corrigé en attendant explicitement le retour du tour au joueur
(`turn === "player"`) avant tout tir suivant dans le script de test.

---

## ⬜ Idées d'amélioration (non corrigées, notes d'audit)

- [ ] L'IA accumule dans `hitsStack` les coups au but de la case en cours de traque, sans
  distinguer à quel navire ils appartiennent. Si deux navires adverses sont placés côte à
  côte (autorisé : `canPlace` ne vérifie que le chevauchement exact, pas une marge de
  séparation), un coup sur un second navire pendant la traque du premier peut brouiller
  l'algorithme de suivi de ligne (`orderTargetsByLine`). Cas rare, dégrade l'efficacité de
  l'IA sans jamais produire de comportement incorrect (pas de plantage, pas de triche) :
  pas corrigé.
