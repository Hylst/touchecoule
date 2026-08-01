# Fonctionnalités de Touché-Coulé

## Gameplay

- ✅ Placement de 5 navires (manuel avec pivot, ou aléatoire), sans chevauchement
- ✅ Combat au tour par tour, tir manqué passe la main, tir réussi continue
- ✅ 3 niveaux d'IA : Facile (aléatoire), Normal (chasse + suivi de ligne), Amiral (carte
  de probabilité de présence, cible la case la plus probable)
- ✅ 4 armements : canon (illimité), sonar 3×3 (gratuit en tour), salve en croix (2
  charges), torpille en ligne (1 charge)
- ✅ **Torpille désormais fidèle à sa visée** (bug corrigé — voir todo.md) : elle part
  réellement de la case cliquée par le joueur, plus toujours de la colonne 0
- ✅ Détection de victoire (flotte adverse entièrement coulée)

## Interface

- ✅ Grille de placement avec aperçu (vert = valide, rouge = invalide) et aperçu de zone
  pour chaque arme spéciale au survol
- ✅ Statut de flotte en temps réel (silhouettes par navire, coups reçus)
- ✅ Journal de bord horodaté de tous les événements
- ✅ Vibrations tactiles sur mobile (tir, touché, coulé)
- ✅ Écran de fin avec statistiques (précision, tours joués)
- ✅ Aucun débordement horizontal en 390×844

## Audio

- ✅ Effets sonores (lancement, impact, manqué, coulé, sonar, victoire/défaite)
  synthétisés en Web Audio
- ✅ Musique d'ambiance sous-marine, coupure indépendante musique/effets

## Technique

- ✅ Build en un seul fichier (~311 Ko), fonctionne hors ligne
- ✅ TypeScript strict, `tsc --noEmit` propre (0 avertissement)
- ✅ Logique de jeu pure (`game.ts`) totalement indépendante du rendu
- ✅ Bloc SEO complet, favicon, og-image (capture réelle du jeu)
- ⬜ Pas de tests automatisés embarqués
