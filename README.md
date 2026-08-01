# Touché-Coulé

**Ni vu ni connu. Placez, visez, coulez toute la flotte adverse.**

Joue ici : [games.hylst.fr/touchecoule/](https://games.hylst.fr/touchecoule/)

![Touché-Coulé](og-image.png)

## Comment on joue

Placez vos 5 navires sur votre grille (aléatoire ou manuel, touche R pour pivoter), puis
visez les eaux ennemies. Un tir manqué passe la main à l'adversaire ; un tir réussi (ou un
scan sonar) vous laisse continuer. Coulez toute la flotte adverse avant qu'elle ne coule la
vôtre.

## Contrôles

| Action | Effet |
|--------|-------|
| Clic sur une case (placement) | Poser le navire sélectionné |
| Touche R | Pivoter le navire (horizontal/vertical) |
| Clic sur une case ennemie (bataille) | Tirer avec l'arme active |
| Boutons d'armement | Changer d'arme active |

## Ce qu'il y a dedans

- 5 navires classiques (porte-avions, cuirassé, croiseur, sous-marin, destroyer)
- 3 niveaux d'IA (Facile, Normal, Amiral — ce dernier calcule une carte de probabilité de
  présence pour cibler intelligemment)
- 4 armements : canon standard (illimité), scan sonar 3×3 (ne consomme pas le tour), salve
  aérienne en croix, torpille qui file en ligne droite jusqu'à toucher sa cible
- Journal de bord complet des événements de la bataille
- Vibrations tactiles sur mobile, effets sonores synthétisés

## L'arborescence

```
touche-coule-game-development/
├── index.html          # template + bloc SEO
├── vite.config.ts      # base '/touchecoule/' + singlefile
├── public/
│   ├── favicon.png
│   ├── og-image.png / og-image.webp
│   └── icon.webp        # carte du menu, 128x128
└── src/
    ├── main.tsx
    ├── game.ts           # placement, tirs, IA (heatmap + chasse au parity), pur
    ├── components/Grid.tsx # rendu de la grille (placement et radar)
    ├── App.tsx            # écrans, armements, boucle IA
    └── utils/cn.ts
```

## Dev

```bash
npm install
npm run dev       # http://localhost:5173/
npm run build     # dist/index.html, un seul fichier
npm run preview
```

## Stack

React 19, TypeScript 5.9 (strict), Tailwind CSS 4, Vite 7, vite-plugin-singlefile.

## Licence

MIT, Geoffroy Streit (Hylst)
