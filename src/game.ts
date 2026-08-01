export const GRID = 10;

export type Orientation = "h" | "v";
export type Difficulty = "facile" | "normal" | "amiral";

export interface ShipDef {
  id: string;
  name: string;
  size: number;
}

export const SHIP_DEFS: ShipDef[] = [
  { id: "carrier", name: "Porte-avions", size: 5 },
  { id: "battleship", name: "Cuirassé", size: 4 },
  { id: "cruiser", name: "Croiseur", size: 3 },
  { id: "submarine", name: "Sous-marin", size: 3 },
  { id: "destroyer", name: "Destroyer", size: 2 },
];

export interface PlacedShip {
  id: string;
  name: string;
  size: number;
  row: number;
  col: number;
  orientation: Orientation;
  hits: boolean[]; // hits per segment
}

export type ShotResult = "miss" | "hit" | "sunk" | "already";

export interface Board {
  ships: PlacedShip[];
  shots: Map<string, "hit" | "miss">; // key "r-c" of incoming shots
}

export const key = (r: number, c: number) => `${r}-${c}`;

export function shipCells(ship: {
  row: number;
  col: number;
  size: number;
  orientation: Orientation;
}): { r: number; c: number }[] {
  const cells: { r: number; c: number }[] = [];
  for (let i = 0; i < ship.size; i++) {
    cells.push({
      r: ship.orientation === "v" ? ship.row + i : ship.row,
      c: ship.orientation === "h" ? ship.col + i : ship.col,
    });
  }
  return cells;
}

export function canPlace(
  ships: PlacedShip[],
  candidate: { row: number; col: number; size: number; orientation: Orientation },
  ignoreId?: string,
): boolean {
  const cells = shipCells(candidate);
  // bounds
  for (const { r, c } of cells) {
    if (r < 0 || c < 0 || r >= GRID || c >= GRID) return false;
  }
  // overlap
  const occupied = new Set<string>();
  for (const s of ships) {
    if (s.id === ignoreId) continue;
    for (const cell of shipCells(s)) occupied.add(key(cell.r, cell.c));
  }
  for (const { r, c } of cells) {
    if (occupied.has(key(r, c))) return false;
  }
  return true;
}

export function randomPlacement(): PlacedShip[] {
  const ships: PlacedShip[] = [];
  for (const def of SHIP_DEFS) {
    let placed = false;
    let attempts = 0;
    while (!placed && attempts < 1000) {
      attempts++;
      const orientation: Orientation = Math.random() < 0.5 ? "h" : "v";
      const row = Math.floor(Math.random() * GRID);
      const col = Math.floor(Math.random() * GRID);
      if (canPlace(ships, { row, col, size: def.size, orientation })) {
        ships.push({
          id: def.id,
          name: def.name,
          size: def.size,
          row,
          col,
          orientation,
          hits: new Array(def.size).fill(false),
        });
        placed = true;
      }
    }
  }
  return ships;
}

export function findShipAt(
  ships: PlacedShip[],
  r: number,
  c: number,
): { ship: PlacedShip; index: number } | null {
  for (const ship of ships) {
    const cells = shipCells(ship);
    for (let i = 0; i < cells.length; i++) {
      if (cells[i].r === r && cells[i].c === c) return { ship, index: i };
    }
  }
  return null;
}

export function isSunk(ship: PlacedShip): boolean {
  return ship.hits.every(Boolean);
}

/** Apply a shot at r,c against a board. Returns result + mutated board copy. */
export function applyShot(
  board: Board,
  r: number,
  c: number,
): { board: Board; result: ShotResult; ship?: PlacedShip } {
  const k = key(r, c);
  if (board.shots.has(k) || r < 0 || c < 0 || r >= GRID || c >= GRID) {
    return { board, result: "already" };
  }
  const newShots = new Map(board.shots);
  const hit = findShipAt(board.ships, r, c);
  if (!hit) {
    newShots.set(k, "miss");
    return { board: { ...board, shots: newShots }, result: "miss" };
  }
  newShots.set(k, "hit");
  const newShips = board.ships.map((s) => {
    if (s.id !== hit.ship.id) return s;
    const newHits = [...s.hits];
    newHits[hit.index] = true;
    return { ...s, hits: newHits };
  });
  const updatedShip = newShips.find((s) => s.id === hit.ship.id)!;
  return {
    board: { ships: newShips, shots: newShots },
    result: isSunk(updatedShip) ? "sunk" : "hit",
    ship: updatedShip,
  };
}

export function allSunk(board: Board): boolean {
  return board.ships.length > 0 && board.ships.every(isSunk);
}

/** AI shot selection with Difficulty options */
export interface AIState {
  targets: string[]; // queued cells to try (key form)
  hitsStack: { r: number; c: number }[]; // current hits not yet sunk
}

export function aiChooseShot(
  board: Board,
  ai: AIState,
  difficulty: Difficulty = "amiral",
): { r: number; c: number } {
  const tried = (r: number, c: number) =>
    board.shots.has(key(r, c)) || r < 0 || c < 0 || r >= GRID || c >= GRID;

  if (difficulty === "facile") {
    // Pick entirely at random from unknown cells
    const candidates: { r: number; c: number }[] = [];
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        if (!tried(r, c)) candidates.push({ r, c });
      }
    }
    return candidates[Math.floor(Math.random() * candidates.length)] ?? { r: 0, c: 0 };
  }

  // Pop from target queue if we have active hits
  while (ai.targets.length > 0) {
    const t = ai.targets.shift()!;
    const [r, c] = t.split("-").map(Number);
    if (!tried(r, c)) return { r, c };
  }

  if (difficulty === "amiral") {
    // Amiral Heatmap Probability Mode: calculate all valid placements for unsunk ships
    // and fire at the coordinate with the highest density.
    const unsunkSizes = board.ships.filter((s) => !isSunk(s)).map((s) => s.size);
    if (unsunkSizes.length > 0) {
      const counts = Array.from({ length: GRID }, () => new Array(GRID).fill(0));
      let maxCount = -1;
      const bestCoords: { r: number; c: number }[] = [];

      // Simulated placements
      for (const size of unsunkSizes) {
        for (let r = 0; r < GRID; r++) {
          for (let c = 0; c < GRID; c++) {
            // horizontal
            if (c + size <= GRID) {
              let possible = true;
              for (let k = 0; k < size; k++) {
                if (board.shots.get(key(r, c + k)) === "miss") {
                  possible = false;
                  break;
                }
              }
              if (possible) {
                for (let k = 0; k < size; k++) {
                  if (!board.shots.has(key(r, c + k))) counts[r][c + k]++;
                }
              }
            }
            // vertical
            if (r + size <= GRID) {
              let possible = true;
              for (let k = 0; k < size; k++) {
                if (board.shots.get(key(r + k, c)) === "miss") {
                  possible = false;
                  break;
                }
              }
              if (possible) {
                for (let k = 0; k < size; k++) {
                  if (!board.shots.has(key(r + k, c))) counts[r + k][c]++;
                }
              }
            }
          }
        }
      }

      for (let r = 0; r < GRID; r++) {
        for (let c = 0; c < GRID; c++) {
          if (!tried(r, c)) {
            if (counts[r][c] > maxCount) {
              maxCount = counts[r][c];
              bestCoords.length = 0;
              bestCoords.push({ r, c });
            } else if (counts[r][c] === maxCount && maxCount > 0) {
              bestCoords.push({ r, c });
            }
          }
        }
      }

      if (bestCoords.length > 0) {
        return bestCoords[Math.floor(Math.random() * bestCoords.length)];
      }
    }
  }

  // Hunt mode - normal parity checkerboard
  const candidates: { r: number; c: number }[] = [];
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (!tried(r, c) && (r + c) % 2 === 0) candidates.push({ r, c });
    }
  }
  if (candidates.length === 0) {
    for (let r = 0; r < GRID; r++)
      for (let c = 0; c < GRID; c++)
        if (!tried(r, c)) candidates.push({ r, c });
  }
  return candidates[Math.floor(Math.random() * candidates.length)] ?? { r: 0, c: 0 };
}

export function aiRegister(
  ai: AIState,
  r: number,
  c: number,
  result: ShotResult,
): AIState {
  const next: AIState = {
    targets: [...ai.targets],
    hitsStack: [...ai.hitsStack],
  };
  if (result === "hit") {
    next.hitsStack.push({ r, c });
    // enqueue neighbors
    const neighbors = [
      { r: r - 1, c },
      { r: r + 1, c },
      { r, c: c - 1 },
      { r, c: c + 1 },
    ];
    for (const n of neighbors) next.targets.push(key(n.r, n.c));
    if (next.hitsStack.length >= 2) {
      const ordered = orderTargetsByLine(next.hitsStack, next.targets);
      next.targets = ordered;
    }
  } else if (result === "sunk") {
    next.hitsStack = [];
    next.targets = [];
  }
  return next;
}

function orderTargetsByLine(
  hits: { r: number; c: number }[],
  targets: string[],
): string[] {
  const sameRow = hits.every((h) => h.r === hits[0].r);
  const sameCol = hits.every((h) => h.c === hits[0].c);
  if (!sameRow && !sameCol) return targets;
  const inline: string[] = [];
  const rest: string[] = [];
  for (const t of targets) {
    const [r, c] = t.split("-").map(Number);
    if (sameRow && r === hits[0].r) inline.push(t);
    else if (sameCol && c === hits[0].c) inline.push(t);
    else rest.push(t);
  }
  return [...inline, ...rest];
}
