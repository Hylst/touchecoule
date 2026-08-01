# Structure de Touché-Coulé

## Arborescence

```
touche-coule-game-development/
├── index.html              # template Vite + bloc SEO (lang=fr)
├── package.json            # touchecoule v0.0.0
├── vite.config.ts          # base '/touchecoule/', react + tailwind + singlefile
├── tsconfig.json
├── .gitignore                 # deps, secrets, fichiers d'agents IA
├── about.md / README.md / structure.md / features.md / todo.md / changelog.md
├── public/
│   ├── favicon.png
│   ├── og-image.png / og-image.webp
│   └── icon.webp             # carte du menu, 128x128
└── src/
    ├── main.tsx
    ├── index.css
    ├── game.ts                # types, placement, tirs, IA — pur, aucune dependance DOM
    ├── components/Grid.tsx      # rendu de la grille (placement ET combat, meme composant)
    ├── audio.ts                  # effets sonores synthetises Web Audio
    ├── App.tsx                    # ecrans, armements speciaux, boucle IA asynchrone
    └── utils/cn.ts
```

## Logique de jeu (`game.ts`)

Module pur : `randomPlacement` place les 5 navires sans chevauchement (`canPlace`, jusqu'a
1000 tentatives par navire), `applyShot` traite un tir et retourne le resultat
(`miss`/`hit`/`sunk`/`already`) sans muter l'etat d'entree. L'IA (`aiChooseShot`) a 3
modes : `facile` (aleatoire pur), `normal` (chasse parity + suivi de ligne apres un
succes), `amiral` (carte de densite de probabilite : simule tous les placements possibles
des navires restants et tire sur la case la plus probable).

## Armements speciaux (`App.tsx`)

Le canon standard est illimite. Trois armes limitees en stock : sonar (revele une zone 3x3
sans consommer le tour), salve (frappe en croix sur 5 cases), torpille (tire en ligne
depuis la case visee, cible la premiere case jamais tiree ou contenant un navire en
avancant vers la droite). **La torpille demarrait systematiquement son balayage a la
colonne 0 du plateau au lieu de la colonne visee par le joueur** — bug corrige, voir
`todo.md`.

## Build

`vite-plugin-singlefile` inline le JS et le CSS dans `index.html` (~311 Ko). Le `dist/`
contient en plus `favicon.png`, `og-image.png/webp` et `icon.webp` copies depuis `public/`.
`base: '/touchecoule/'` fait resoudre ces assets sous `https://games.hylst.fr/touchecoule/`.
