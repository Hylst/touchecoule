# Changelog de Touché-Coulé

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versionnage
[SemVer](https://semver.org/lang/fr/).

## [1.0.0] 2026-08-01

Première version intégrable à Hylst.Games, partie d'un export brut audité puis corrigé.

### Ajouté
- Bloc SEO complet dans `index.html` (description, keywords, og, twitter, robots,
  canonical) et `lang="fr"`
- `favicon.png` 32×32, `og-image.png` 1024×576 (capture réelle du jeu) et sa variante
  `og-image.webp`, `icon.webp` 128×128 pour la carte du menu
- `base: '/touchecoule/'` dans `vite.config.ts`

### Modifié
- Renommé **Bataille Navale** en **Touché-Coulé** (nom traditionnel français le plus
  spécifique à ce jeu, l'exclamation qu'on prononce en coulant un navire adverse)
- `package.json` : `react-vite-tailwind` v0.0.0 devenu `touchecoule` v0.0.0
- Tiret long dans un libellé d'interface remplacé par deux-points (règle du dépôt)

### Corrigé
- **La torpille (arme spéciale à charge unique) ignorait la colonne visée par le joueur et
  touchait presque toujours la colonne 0 du plateau.** Le calcul de la case cible partait
  systématiquement de la colonne 0 au lieu de la colonne cliquée, à cause d'une condition
  d'arrêt qui se déclenchait dès la première case jamais tirée de la ligne (donc quasiment
  toujours la première case en début de partie). Corrigé en faisant partir le balayage de
  la colonne réellement visée. Vérifié sur l'application réelle : tir visé en (2,7),
  impact enregistré exactement à cette position.

### Vérifié
- QA Playwright : placement, tir canon avec compteur vérifié, riposte IA observée, tour
  repassé au joueur, correctif de la torpille confirmé par lecture directe de l'impact
  (pas seulement par lecture de code), aucun débordement horizontal en 390×844.
