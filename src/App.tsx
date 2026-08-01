import { useEffect, useRef, useState } from "react";
import Grid, { type SpecialWeapon } from "./components/Grid";
import {
  SHIP_DEFS,
  GRID,
  key,
  shipCells,
  canPlace,
  randomPlacement,
  applyShot,
  allSunk,
  aiChooseShot,
  aiRegister,
  isSunk,
  findShipAt,
  type PlacedShip,
  type Orientation,
  type Board,
  type AIState,
  type Difficulty,
} from "./game";
import { sound } from "./audio";
import { cn } from "./utils/cn";

type Phase = "placement" | "battle" | "over";

interface LogEntry {
  id: number;
  who: "player" | "enemy";
  text: string;
  kind: "hit" | "miss" | "sunk" | "info" | "special";
}

let logId = 0;

export default function App() {
  const [phase, setPhase] = useState<Phase>("placement");
  const [difficulty, setDifficulty] = useState<Difficulty>("amiral");

  // audio toggles
  const [musicMuted, setMusicMuted] = useState(sound.getMusicMuted());
  const [sfxMuted, setSfxMuted] = useState(sound.getSfxMuted());

  // placement state
  const [playerShips, setPlayerShips] = useState<PlacedShip[]>([]);
  const [selectedId, setSelectedId] = useState<string>(SHIP_DEFS[0].id);
  const [orientation, setOrientation] = useState<Orientation>("h");
  const [hoverCell, setHoverCell] = useState<{ r: number; c: number } | null>(
    null,
  );

  // battle state
  const [enemyBoard, setEnemyBoard] = useState<Board>({
    ships: [],
    shots: new Map(),
  });
  const [playerBoard, setPlayerBoard] = useState<Board>({
    ships: [],
    shots: new Map(),
  });
  const [sonarScans, setSonarScans] = useState<Set<string>>(new Set());
  const [turn, setTurn] = useState<"player" | "enemy">("player");
  const [aiState, setAiState] = useState<AIState>({ targets: [], hitsStack: [] });
  const [lastPlayerShot, setLastPlayerShot] = useState<string | null>(null);
  const [lastEnemyShot, setLastEnemyShot] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [winner, setWinner] = useState<"player" | "enemy" | null>(null);

  // Special weapons inventory
  const [activeWeapon, setActiveWeapon] = useState<SpecialWeapon>("canon");
  const [inventory, setInventory] = useState<{
    salve: number;
    torpille: number;
    sonar: number;
  }>({
    salve: 2,
    torpille: 1,
    sonar: 3,
  });

  // Turn counters for statistics
  const [stats, setStats] = useState({
    playerShots: 0,
    playerHits: 0,
    turns: 0,
  });

  // refs for asynchronous AI loops
  const enemyBoardRef = useRef(enemyBoard);
  enemyBoardRef.current = enemyBoard;
  const playerBoardRef = useRef(playerBoard);
  playerBoardRef.current = playerBoard;
  const aiStateRef = useRef(aiState);
  aiStateRef.current = aiState;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const difficultyRef = useRef(difficulty);
  difficultyRef.current = difficulty;

  function addLog(entry: Omit<LogEntry, "id">) {
    setLog((l) => [{ ...entry, id: logId++ }, ...l].slice(0, 50));
  }

  // Auto-init ambient noise on first click
  useEffect(() => {
    function onFirstClick() {
      sound.startAmbient();
      window.removeEventListener("click", onFirstClick);
    }
    window.addEventListener("click", onFirstClick);
    return () => window.removeEventListener("click", onFirstClick);
  }, []);

  function handleToggleMusic() {
    sound.playClick();
    const muted = sound.toggleMusic();
    setMusicMuted(muted);
  }

  function handleToggleSfx() {
    sound.playClick();
    const muted = sound.toggleSfx();
    setSfxMuted(muted);
  }

  // ---------- Placement ----------
  const placedIds = new Set(playerShips.map((s) => s.id));
  const selectedDef = SHIP_DEFS.find((d) => d.id === selectedId);

  const preview = (() => {
    if (!hoverCell || !selectedDef || placedIds.has(selectedId)) return null;
    const candidate = {
      row: hoverCell.r,
      col: hoverCell.c,
      size: selectedDef.size,
      orientation,
    };
    const valid = canPlace(playerShips, candidate);
    const cells = new Set(
      shipCells(candidate)
        .filter((c) => c.r >= 0 && c.c >= 0 && c.r < GRID && c.c < GRID)
        .map((c) => key(c.r, c.c)),
    );
    return { cells, valid };
  })();

  function nextUnplaced(after: string): string {
    const ids = SHIP_DEFS.map((d) => d.id);
    const placed = new Set([...placedIds, after]);
    return ids.find((id) => !placed.has(id)) ?? after;
  }

  function placeShip(r: number, c: number) {
    if (!selectedDef || placedIds.has(selectedId)) return;
    const candidate = {
      row: r,
      col: c,
      size: selectedDef.size,
      orientation,
    };
    if (!canPlace(playerShips, candidate)) {
      sound.playClick();
      return;
    }
    sound.playSonarPing();
    const ship: PlacedShip = {
      id: selectedDef.id,
      name: selectedDef.name,
      size: selectedDef.size,
      row: r,
      col: c,
      orientation,
      hits: new Array(selectedDef.size).fill(false),
    };
    setPlayerShips((s) => [...s, ship]);
    setSelectedId(nextUnplaced(selectedDef.id));
  }

  function resetPlacement() {
    sound.playClick();
    setPlayerShips([]);
    setSelectedId(SHIP_DEFS[0].id);
  }

  function randomizePlayer() {
    sound.playLaunch();
    setPlayerShips(randomPlacement());
    setSelectedId(SHIP_DEFS[SHIP_DEFS.length - 1].id);
  }

  // Rotate with R key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "r" && phaseRef.current === "placement") {
        setOrientation((o) => (o === "h" ? "v" : "h"));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function startBattle() {
    if (playerShips.length !== SHIP_DEFS.length) return;
    sound.playVictory();
    const enemyShips = randomPlacement();
    setEnemyBoard({ ships: enemyShips, shots: new Map() });
    setPlayerBoard({ ships: playerShips, shots: new Map() });
    setSonarScans(new Set());
    setAiState({ targets: [], hitsStack: [] });
    setLog([]);
    setWinner(null);
    setTurn("player");
    setActiveWeapon("canon");
    setInventory({ salve: 2, torpille: 1, sonar: 3 });
    setLastPlayerShot(null);
    setLastEnemyShot(null);
    setStats({ playerShots: 0, playerHits: 0, turns: 1 });

    addLog({
      who: "player",
      text: "Stations de combat prêtes ! À vos ordres, Amiral.",
      kind: "info",
    });
    setPhase("battle");
  }

  // ---------- Helper for tactile vibration ----------
  function vibrate(pattern: number | number[]) {
    if ("vibrate" in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {}
    }
  }

  // ---------- Battle: player attack / special abilities ----------
  function handleAttack(r: number, c: number) {
    if (turn !== "player" || phaseRef.current !== "battle") return;
    const board = enemyBoardRef.current;

    // Execute active tactical weapon
    if (activeWeapon === "sonar") {
      if (inventory.sonar <= 0) return;
      sound.playSonarPing();
      vibrate([50, 100, 50]);
      setInventory((inv) => ({ ...inv, sonar: inv.sonar - 1 }));

      const newScans = new Set(sonarScans);
      let shipsFound = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nc >= 0 && nr < GRID && nc < GRID) {
            const k = key(nr, nc);
            newScans.add(k);
            if (board.ships.some((s) => findShipAt([s], nr, nc))) {
              shipsFound++;
            }
          }
        }
      }
      setSonarScans(newScans);
      setActiveWeapon("canon");
      const coord = `${"ABCDEFGHIJ"[c]}${r + 1}`;
      addLog({
        who: "player",
        text: `Balayage Sonar en ${coord} : ${
          shipsFound > 0
            ? `⚠️ ${shipsFound} section(s) hostile(s) détectée(s) !`
            : "Rien à signaler dans cette zone."
        }`,
        kind: "special",
      });
      // Sonar doesn't end turn! It's a true tactical advantage.
      return;
    }

    if (activeWeapon === "torpille") {
      if (inventory.torpille <= 0) return;
      sound.playLaunch();
      vibrate(200);
      setInventory((inv) => ({ ...inv, torpille: inv.torpille - 1 }));
      setActiveWeapon("canon");

      // Torpille lancee depuis la case visee, avance vers la droite jusqu'a une cible.
      // Partir de 0 revenait a ignorer systematiquement la colonne cliquee par le
      // joueur : des qu'une case n'a jamais ete visee (donc presque toute la ligne en
      // debut de partie), la condition "pas encore tiree" est vraie avant meme de tester
      // la presence d'un navire, et la boucle s'arretait donc quasi toujours en colonne 0.
      let targetCol = c;
      while (targetCol < GRID) {
        // Find first ship or un-shot target
        if (
          !board.shots.has(key(r, targetCol)) ||
          board.ships.some((s) => findShipAt([s], r, targetCol))
        ) {
          break;
        }
        targetCol++;
      }
      if (targetCol >= GRID) targetCol = GRID - 1; // hit end of board

      executeShots([{ r, c: targetCol }], "Torpille lourde");
      return;
    }

    if (activeWeapon === "salve") {
      if (inventory.salve <= 0) return;
      sound.playLaunch();
      vibrate([100, 50, 100, 50, 100]);
      setInventory((inv) => ({ ...inv, salve: inv.salve - 1 }));
      setActiveWeapon("canon");

      // Attack cross
      const targets: { r: number; c: number }[] = [{ r, c }];
      if (r > 0) targets.push({ r: r - 1, c });
      if (r < GRID - 1) targets.push({ r: r + 1, c });
      if (c > 0) targets.push({ r, c: c - 1 });
      if (c < GRID - 1) targets.push({ r, c: c + 1 });

      executeShots(targets, "Frappe Aérienne (Salve)");
      return;
    }

    // Default canon shot
    if (board.shots.has(key(r, c))) return;
    sound.playLaunch();
    executeShots([{ r, c }], null);
  }

  function executeShots(
    targets: { r: number; c: number }[],
    weaponName: string | null,
  ) {
    let currentBoard = enemyBoardRef.current;
    let anyHit = false;
    let anySunk = false;
    let lastSunkShipName = "";
    let lastK = "";

    let newShotsCount = 0;
    let newHitsCount = 0;

    for (const { r, c } of targets) {
      if (currentBoard.shots.has(key(r, c))) continue;
      newShotsCount++;
      lastK = key(r, c);
      const { board: nb, result, ship } = applyShot(currentBoard, r, c);
      currentBoard = nb;

      if (result === "hit" || result === "sunk") {
        anyHit = true;
        newHitsCount++;
        if (result === "sunk") {
          anySunk = true;
          lastSunkShipName = ship?.name ?? "";
        }
      }
    }

    if (newShotsCount === 0) return;

    enemyBoardRef.current = currentBoard;
    setEnemyBoard(currentBoard);
    setLastPlayerShot(lastK);

    setStats((s) => ({
      ...s,
      playerShots: s.playerShots + newShotsCount,
      playerHits: s.playerHits + newHitsCount,
    }));

    if (anySunk) {
      sound.playSunk();
      vibrate([300, 100, 400]);
      addLog({
        who: "player",
        text: `${weaponName ? `[${weaponName}] ` : ""}Cible détruite ! Vous avez coulé le ${lastSunkShipName} adverse ! 🔥`,
        kind: "sunk",
      });
    } else if (anyHit) {
      sound.playHit();
      vibrate(150);
      addLog({
        who: "player",
        text: `${weaponName ? `[${weaponName}] ` : ""}Impact confirmé sur la cible !`,
        kind: "hit",
      });
    } else {
      sound.playMiss();
      addLog({
        who: "player",
        text: `${weaponName ? `[${weaponName}] ` : ""}Dans l'eau, tir manqué.`,
        kind: "miss",
      });
    }

    if (allSunk(currentBoard)) {
      sound.playVictory();
      setWinner("player");
      setPhase("over");
      addLog({
        who: "player",
        text: "🎉 Victoire totale ! Toute la flotte ennemie a été anéantie.",
        kind: "sunk",
      });
      return;
    }

    // Switch turn
    setTurn("enemy");
  }

  // ---------- Battle: AI opponent loop ----------
  useEffect(() => {
    if (turn !== "enemy" || phase !== "battle") return;
    let cancelled = false;

    function aiShoot() {
      if (cancelled) return;
      const board = playerBoardRef.current;
      const { r, c } = aiChooseShot(
        board,
        aiStateRef.current,
        difficultyRef.current,
      );
      const { board: nb, result, ship } = applyShot(board, r, c);
      playerBoardRef.current = nb;
      setPlayerBoard(nb);
      setLastEnemyShot(key(r, c));

      const newAi = aiRegister(aiStateRef.current, r, c, result);
      aiStateRef.current = newAi;
      setAiState(newAi);

      const coord = `${"ABCDEFGHIJ"[c]}${r + 1}`;
      if (result === "sunk") {
        sound.playSunk();
        vibrate([400, 200, 400]);
        addLog({
          who: "enemy",
          text: `Alerte rouge ! L'ennemi a coulé votre ${ship?.name} ! 💀`,
          kind: "sunk",
        });
      } else if (result === "hit") {
        sound.playHit();
        vibrate(200);
        addLog({
          who: "enemy",
          text: `Impact hostile en ${coord} ! Navire touché !`,
          kind: "hit",
        });
      } else {
        sound.playMiss();
        addLog({
          who: "enemy",
          text: `Tir hostile en ${coord} : Aucun dégât (manqué).`,
          kind: "miss",
        });
      }

      if (allSunk(nb)) {
        sound.playDefeat();
        setWinner("enemy");
        setPhase("over");
        addLog({
          who: "enemy",
          text: "🏳️ Défaite critique. Toute votre flotte repose au fond de l'océan.",
          kind: "sunk",
        });
        return;
      }

      // Increment turn counter
      setStats((s) => ({ ...s, turns: s.turns + 1 }));

      if (result === "hit" || result === "sunk") {
        // Admiral IA takes another fast tactical follow up
        setTimeout(aiShoot, 900);
      } else {
        setTurn("player");
      }
    }

    const timer = setTimeout(aiShoot, 850);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [turn, phase]);

  function resetGame() {
    sound.playClick();
    setPhase("placement");
    setPlayerShips([]);
    setSelectedId(SHIP_DEFS[0].id);
    setOrientation("h");
    setEnemyBoard({ ships: [], shots: new Map() });
    setPlayerBoard({ ships: [], shots: new Map() });
    setSonarScans(new Set());
    setLog([]);
    setWinner(null);
  }

  // ---------- Derived fleet status ----------
  function fleetStatus(board: Board) {
    return SHIP_DEFS.map((def) => {
      const ship = board.ships.find((s) => s.id === def.id);
      const sunk = ship ? isSunk(ship) : false;
      const hits = ship ? ship.hits.filter(Boolean).length : 0;
      return { ...def, sunk, hits };
    });
  }

  const enemyFleet = fleetStatus(enemyBoard);
  const playerFleet = fleetStatus(playerBoard);

  return (
    <div className="min-h-screen bg-[#030b14] text-slate-100 scanlines flex flex-col justify-between select-none">
      <div className="mx-auto max-w-6xl w-full px-4 py-6 flex-1">
        {/* Superior Tactical Header */}
        <header className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 glass-panel p-4 rounded-2xl border border-cyan-500/30">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center shadow-[0_0_20px_rgba(0,240,255,0.4)]">
              <span className="text-2xl animate-pulse">⚓</span>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-wider bg-gradient-to-r from-cyan-300 via-blue-200 to-indigo-300 bg-clip-text text-transparent">
                TOUCHÉ-COULÉ
              </h1>
              <p className="text-xs text-cyan-400 font-mono tracking-wide">
                SYSTÈME DE COMMANDEMENT TACTIQUE V3.0
              </p>
            </div>
          </div>

          {/* Difficulty & Sound controls */}
          <div className="flex flex-wrap items-center gap-3">
            {phase === "placement" && (
              <div className="flex items-center gap-1.5 bg-[#05182e] px-3 py-1.5 rounded-xl border border-cyan-500/30">
                <span className="text-xs text-cyan-300 font-mono uppercase font-bold">
                  IA :
                </span>
                <select
                  value={difficulty}
                  onChange={(e) => {
                    sound.playClick();
                    setDifficulty(e.target.value as Difficulty);
                  }}
                  className="bg-transparent text-xs text-white font-mono font-bold focus:outline-none cursor-pointer"
                >
                  <option value="facile" className="bg-[#05182e] text-white">
                    Facile
                  </option>
                  <option value="normal" className="bg-[#05182e] text-white">
                    Normal
                  </option>
                  <option value="amiral" className="bg-[#05182e] text-cyan-300">
                    Amiral (Expert)
                  </option>
                </select>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleMusic}
                title={musicMuted ? "Activer la musique" : "Couper la musique"}
                className={cn(
                  "p-2.5 rounded-xl border transition-all flex items-center justify-center font-mono text-xs gap-1",
                  musicMuted
                    ? "bg-[#06182c]/80 border-slate-700 text-slate-400"
                    : "neon-btn bg-cyan-950/40 text-cyan-300",
                )}
              >
                <span>🎵</span>
                <span className="hidden md:inline">
                  {musicMuted ? "Musique OFF" : "Musique ON"}
                </span>
              </button>
              <button
                onClick={handleToggleSfx}
                title={sfxMuted ? "Activer les bruitages" : "Couper les bruitages"}
                className={cn(
                  "p-2.5 rounded-xl border transition-all flex items-center justify-center font-mono text-xs gap-1",
                  sfxMuted
                    ? "bg-[#06182c]/80 border-slate-700 text-slate-400"
                    : "neon-btn bg-cyan-950/40 text-cyan-300",
                )}
              >
                <span>🔊</span>
                <span className="hidden md:inline">
                  {sfxMuted ? "SFX OFF" : "SFX ON"}
                </span>
              </button>
            </div>
          </div>
        </header>

        {/* Phase Container */}
        <main className="transition-all duration-300">
          {phase === "placement" ? (
            <PlacementView
              playerShips={playerShips}
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              placedIds={placedIds}
              orientation={orientation}
              setOrientation={setOrientation}
              preview={preview}
              onPlace={placeShip}
              onHover={(r, c) => setHoverCell({ r, c })}
              onLeave={() => setHoverCell(null)}
              onReset={resetPlacement}
              onRandom={randomizePlayer}
              onStart={startBattle}
            />
          ) : phase === "battle" ? (
            <BattleView
              enemyBoard={enemyBoard}
              playerBoard={playerBoard}
              sonarScans={sonarScans}
              turn={turn}
              phase={phase}
              onAttack={handleAttack}
              activeWeapon={activeWeapon}
              setActiveWeapon={setActiveWeapon}
              inventory={inventory}
              lastPlayerShot={lastPlayerShot}
              lastEnemyShot={lastEnemyShot}
              enemyFleet={enemyFleet}
              playerFleet={playerFleet}
              log={log}
              winner={winner}
              onReset={resetGame}
            />
          ) : (
            <GameOverView
              winner={winner}
              stats={stats}
              enemyFleet={enemyFleet}
              playerFleet={playerFleet}
              onReset={resetGame}
            />
          )}
        </main>
      </div>

      {/* Premium French Creator Footer */}
      <footer className="w-full py-5 text-center border-t border-cyan-500/20 bg-[#020b16]/90 backdrop-blur mt-12">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-xs font-mono text-cyan-300/70">
          <span>créateur de l'app :</span>
          <span className="font-bold text-cyan-300 tracking-wider px-2 py-0.5 bg-cyan-950/60 rounded border border-cyan-500/40 shadow-[0_0_10px_rgba(0,240,255,0.2)]">
            Hylst - Geoffroy
          </span>
          <span className="hidden sm:inline">•</span>
          <span className="text-slate-500">
            Interface Holographique Tactique & Audio FX Subaquatique
          </span>
        </div>
      </footer>
    </div>
  );
}

/* =================== Placement View =================== */
function PlacementView(props: {
  playerShips: PlacedShip[];
  selectedId: string;
  setSelectedId: (id: string) => void;
  placedIds: Set<string>;
  orientation: Orientation;
  setOrientation: (o: Orientation) => void;
  preview: { cells: Set<string>; valid: boolean } | null;
  onPlace: (r: number, c: number) => void;
  onHover: (r: number, c: number) => void;
  onLeave: () => void;
  onReset: () => void;
  onRandom: () => void;
  onStart: () => void;
}) {
  const allPlaced = props.placedIds.size === SHIP_DEFS.length;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="glass-panel p-5 rounded-3xl">
        <div className="mb-4 flex items-center justify-between border-b border-cyan-500/20 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            <h2 className="text-sm font-mono font-bold uppercase tracking-widest text-cyan-300">
              DÉPLOIEMENT DE VOTRE FLOTTE
            </h2>
          </div>
          <span className="text-xs text-cyan-200/60 font-mono bg-[#031528] px-2.5 py-1 rounded-lg border border-cyan-500/20">
            Touche <kbd className="font-bold text-cyan-300">R</kbd> = Pivoter
          </span>
        </div>
        <Grid
          ships={props.playerShips}
          shots={new Map()}
          revealShips
          interactive
          onCellClick={props.onPlace}
          onCellHover={props.onHover}
          onLeave={props.onLeave}
          preview={props.preview}
        />
      </div>

      <div className="flex flex-col gap-5">
        <div className="glass-panel p-5 rounded-3xl flex flex-col gap-3">
          <h2 className="text-sm font-mono font-bold uppercase tracking-widest text-cyan-300 border-b border-cyan-500/20 pb-2">
            NAVIRES REQUIS
          </h2>
          <div className="flex flex-col gap-2.5">
            {SHIP_DEFS.map((def) => {
              const placed = props.placedIds.has(def.id);
              const selected = props.selectedId === def.id;
              return (
                <button
                  key={def.id}
                  onClick={() => {
                    sound.playClick();
                    !placed && props.setSelectedId(def.id);
                  }}
                  disabled={placed}
                  className={cn(
                    "flex items-center justify-between rounded-2xl px-4 py-3 text-left transition-all border",
                    placed
                      ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-400/60 cursor-default"
                      : selected
                        ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.3)] scale-[1.02]"
                        : "bg-[#06172a]/60 border-cyan-500/20 hover:border-cyan-400/50 hover:bg-[#06172a]",
                  )}
                >
                  <div>
                    <div className={cn("text-sm font-bold font-mono tracking-wide", placed && "line-through")}>
                      {def.name}
                    </div>
                    <div className="flex gap-1 pt-1.5">
                      {Array.from({ length: def.size }).map((_, i) => (
                        <span
                          key={i}
                          className={cn(
                            "h-2 w-4 rounded-sm transition-all",
                            placed
                              ? "bg-emerald-500/50 shadow-[0_0_6px_#10b981]"
                              : selected
                                ? "bg-cyan-400 shadow-[0_0_8px_#00f0ff]"
                                : "bg-slate-500/60",
                          )}
                        />
                      ))}
                    </div>
                  </div>
                  <span className="text-xs font-mono">
                    {placed ? "✓ PRÊT" : selected ? "▸ EN COURS" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="glass-panel p-5 rounded-3xl flex flex-col gap-3">
          <h2 className="text-sm font-mono font-bold uppercase tracking-widest text-cyan-300 border-b border-cyan-500/20 pb-2">
            COMMANDES TACTIQUES
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                sound.playClick();
                props.setOrientation(props.orientation === "h" ? "v" : "h");
              }}
              className="neon-btn rounded-xl py-3 text-xs font-mono font-bold transition-all flex items-center justify-center gap-1.5"
            >
              <span>↻</span>
              <span>Pivoter</span>
            </button>
            <button
              onClick={props.onRandom}
              className="neon-btn rounded-xl py-3 text-xs font-mono font-bold transition-all flex items-center justify-center gap-1.5"
            >
              <span>🎲</span>
              <span>Aléatoire</span>
            </button>
          </div>
          <button
            onClick={props.onReset}
            className="rounded-xl bg-[#081f38] hover:bg-rose-950/50 border border-slate-700 hover:border-rose-500/50 text-slate-300 hover:text-rose-300 py-3 text-xs font-mono font-bold transition-all"
          >
            ✕ Réinitialiser la grille
          </button>
          <button
            onClick={props.onStart}
            disabled={!allPlaced}
            className={cn(
              "rounded-2xl py-4 text-sm font-mono font-bold uppercase tracking-widest transition-all duration-300 mt-2",
              allPlaced
                ? "bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 text-white shadow-[0_0_25px_rgba(0,240,255,0.6)] hover:brightness-125 hover:scale-[1.02] cursor-pointer"
                : "cursor-not-allowed bg-[#051324] border border-slate-800 text-slate-600",
            )}
          >
            {allPlaced ? "⚔ LANCER LA BATAILLE" : `PLACEZ ${SHIP_DEFS.length - props.placedIds.size} NAVIRE(S)`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =================== Battle View =================== */
interface FleetItem {
  id: string;
  name: string;
  size: number;
  sunk: boolean;
  hits: number;
}

function BattleView(props: {
  enemyBoard: Board;
  playerBoard: Board;
  sonarScans: Set<string>;
  turn: "player" | "enemy";
  phase: Phase;
  onAttack: (r: number, c: number) => void;
  activeWeapon: SpecialWeapon;
  setActiveWeapon: (w: SpecialWeapon) => void;
  inventory: { salve: number; torpille: number; sonar: number };
  lastPlayerShot: string | null;
  lastEnemyShot: string | null;
  enemyFleet: FleetItem[];
  playerFleet: FleetItem[];
  log: LogEntry[];
  winner: "player" | "enemy" | null;
  onReset: () => void;
}) {
  const isOver = props.phase === "over";
  const playerTurn = props.turn === "player" && !isOver;

  return (
    <div className="space-y-6">
      {/* Turn Banner & Special Weapons Tactical Bar */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-4 glass-panel p-4 rounded-3xl border border-cyan-500/40">
        <div
          className={cn(
            "flex items-center justify-center gap-3 rounded-2xl px-6 py-3 font-mono text-sm font-bold tracking-widest uppercase transition-all w-full lg:w-auto",
            playerTurn
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.3)] animate-float-up"
              : "bg-amber-500/20 text-amber-300 border border-amber-500/40",
          )}
        >
          {playerTurn ? (
            <>
              <span className="text-lg animate-spin">🎯</span>
              <span>À VOTRE TOUR : CIBLEZ LES EAUX ENNEMIES</span>
            </>
          ) : (
            <>
              <span className="inline-block h-3 w-3 animate-ping rounded-full bg-amber-400" />
              <span>CALCUL DE TIR ENNEMI EN COURS...</span>
            </>
          )}
        </div>

        {/* Special Tactical Weapons Selection */}
        <div className="flex flex-wrap items-center justify-center gap-2 w-full lg:w-auto">
          <span className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider mr-2 hidden sm:inline">
            Armement :
          </span>

          <button
            onClick={() => {
              sound.playClick();
              props.setActiveWeapon("canon");
            }}
            className={cn(
              "px-3 py-2 rounded-xl font-mono text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer",
              props.activeWeapon === "canon"
                ? "bg-cyan-500 text-slate-900 border-cyan-300 shadow-[0_0_15px_#00f0ff]"
                : "bg-[#05162a] text-cyan-300 border-cyan-500/30 hover:border-cyan-400",
            )}
          >
            <span>🎯</span>
            <span>Canon standard</span>
            <span className="px-1.5 py-0.2 bg-cyan-950 text-cyan-200 rounded text-[10px]">
              ∞
            </span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              if (props.inventory.sonar > 0) props.setActiveWeapon("sonar");
            }}
            disabled={props.inventory.sonar <= 0}
            className={cn(
              "px-3 py-2 rounded-xl font-mono text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer",
              props.inventory.sonar <= 0
                ? "opacity-40 cursor-not-allowed bg-[#030d1a] border-slate-800 text-slate-500"
                : props.activeWeapon === "sonar"
                  ? "bg-cyan-400 text-slate-950 border-white shadow-[0_0_20px_#00f0ff] animate-pulse"
                  : "bg-[#05162a] text-cyan-300 border-cyan-500/30 hover:border-cyan-400",
            )}
          >
            <span>📡</span>
            <span>Scan Sonar (3x3)</span>
            <span className="px-1.5 py-0.2 bg-cyan-950 text-cyan-200 rounded text-[10px]">
              {props.inventory.sonar}
            </span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              if (props.inventory.salve > 0) props.setActiveWeapon("salve");
            }}
            disabled={props.inventory.salve <= 0}
            className={cn(
              "px-3 py-2 rounded-xl font-mono text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer",
              props.inventory.salve <= 0
                ? "opacity-40 cursor-not-allowed bg-[#030d1a] border-slate-800 text-slate-500"
                : props.activeWeapon === "salve"
                  ? "bg-amber-400 text-slate-950 border-white shadow-[0_0_20px_#f59e0b] animate-pulse"
                  : "bg-[#05162a] text-amber-300 border-amber-500/30 hover:border-amber-400",
            )}
          >
            <span>✈️</span>
            <span>Salve Aérienne (+)</span>
            <span className="px-1.5 py-0.2 bg-amber-950 text-amber-200 rounded text-[10px]">
              {props.inventory.salve}
            </span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              if (props.inventory.torpille > 0) props.setActiveWeapon("torpille");
            }}
            disabled={props.inventory.torpille <= 0}
            className={cn(
              "px-3 py-2 rounded-xl font-mono text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer",
              props.inventory.torpille <= 0
                ? "opacity-40 cursor-not-allowed bg-[#030d1a] border-slate-800 text-slate-500"
                : props.activeWeapon === "torpille"
                  ? "bg-indigo-400 text-white border-white shadow-[0_0_20px_#6366f1] animate-pulse"
                  : "bg-[#05162a] text-indigo-300 border-indigo-500/30 hover:border-indigo-400",
            )}
          >
            <span>🚀</span>
            <span>Torpille Ligne</span>
            <span className="px-1.5 py-0.2 bg-indigo-950 text-indigo-200 rounded text-[10px]">
              {props.inventory.torpille}
            </span>
          </button>
        </div>
      </div>

      {/* Battle Combat Grids */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Enemy Attack Waters */}
        <div
          className={cn(
            "glass-panel p-5 rounded-3xl transition-all duration-300 relative overflow-hidden",
            playerTurn
              ? "border-2 border-cyan-400/80 shadow-[0_0_35px_rgba(0,240,255,0.2)]"
              : "border-cyan-500/20 opacity-90",
          )}
        >
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-cyan-500/20 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping shadow-[0_0_8px_#f43f5e]" />
              <h2 className="text-sm font-mono font-bold uppercase tracking-widest text-rose-300">
                RADAR CIBLE : EAUX ENNEMIES
              </h2>
            </div>
            <FleetBadges fleet={props.enemyFleet} />
          </div>

          <Grid
            ships={props.enemyBoard.ships}
            shots={props.enemyBoard.shots}
            sonarScans={props.sonarScans}
            revealShips={isOver}
            interactive={playerTurn}
            disabled={!playerTurn}
            weapon={props.activeWeapon}
            onCellClick={props.onAttack}
            lastShot={props.lastPlayerShot}
            isRadar={true}
          />
        </div>

        {/* Player Home Fleet Waters */}
        <div className="glass-panel p-5 rounded-3xl relative overflow-hidden border border-cyan-500/20">
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-cyan-500/20 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f0ff]" />
              <h2 className="text-sm font-mono font-bold uppercase tracking-widest text-cyan-300">
                VOTRE FLOTTE DE GOUVERNEMENT
              </h2>
            </div>
            <FleetBadges fleet={props.playerFleet} />
          </div>

          <Grid
            ships={props.playerBoard.ships}
            shots={props.playerBoard.shots}
            revealShips
            lastShot={props.lastEnemyShot}
          />
        </div>
      </div>

      {/* Live Battle Log & Surrender / Reset */}
      <div className="grid gap-6 lg:grid-cols-[1fr_240px]">
        <div className="h-44 overflow-y-auto glass-panel p-4 rounded-3xl font-mono">
          <div className="mb-2 flex items-center justify-between border-b border-cyan-500/20 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-cyan-400 flex items-center gap-2">
              <span>📜</span>
              <span>RAPPORT DE TRANSMISSION EN DIRECT</span>
            </h3>
            <span className="text-[10px] text-cyan-300/60 font-mono">
              SECURE FREQUENCY 440.8 MHz
            </span>
          </div>
          <ul className="space-y-1.5 text-xs">
            {props.log.map((e) => (
              <li
                key={e.id}
                className={cn(
                  "flex items-start gap-2 animate-float-up leading-relaxed py-0.5 px-2 rounded-lg transition-all",
                  e.who === "player"
                    ? "bg-cyan-950/30 text-cyan-200 border-l-2 border-cyan-400"
                    : "bg-amber-950/30 text-amber-200 border-l-2 border-amber-500",
                  e.kind === "sunk" &&
                    "font-bold bg-rose-950/40 border-l-4 border-rose-500 text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.3)]",
                  e.kind === "special" &&
                    "bg-indigo-950/40 border-l-2 border-indigo-400 text-indigo-200",
                )}
              >
                <span className="opacity-60 shrink-0 font-bold">
                  {e.who === "player" ? "[VOUS]" : "[FOE] "} :
                </span>
                <span
                  className={cn(
                    e.kind === "hit" && "text-amber-300 font-semibold",
                    e.kind === "miss" && "opacity-75",
                  )}
                >
                  {e.text}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-3 justify-center">
          <button
            onClick={props.onReset}
            className="neon-btn-red w-full rounded-2xl p-4 text-xs font-mono font-bold uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(255,0,85,0.3)] cursor-pointer"
          >
            🏳️ Abandonner / Relancer
          </button>
        </div>
      </div>
    </div>
  );
}

/* =================== Fleet Roster Badges =================== */
function FleetBadges({ fleet }: { fleet: FleetItem[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {fleet.map((s) => (
        <div
          key={s.id}
          title={`${s.name}${s.sunk ? " (DÉTRUIT)" : ` : ${s.size - s.hits} intact(s)`}`}
          className={cn(
            "flex items-center gap-1 rounded-xl px-2 py-1 border transition-all",
            s.sunk
              ? "bg-rose-950/60 border-rose-500/50 shadow-[0_0_8px_rgba(244,63,94,0.4)] scale-95 opacity-80"
              : "bg-[#05172e] border-cyan-500/30",
          )}
        >
          <span className={cn("text-[10px] font-mono font-bold hidden xl:inline", s.sunk ? "text-rose-400" : "text-cyan-300")}>
            {s.name.slice(0, 3).toUpperCase()}
          </span>
          <div className="flex gap-0.5">
            {Array.from({ length: s.size }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-2 w-2 rounded-sm transition-all",
                  s.sunk
                    ? "bg-rose-500 shadow-[0_0_5px_#f43f5e]"
                    : i < s.hits
                      ? "bg-amber-400 shadow-[0_0_5px_#f59e0b]"
                      : "bg-cyan-400/40",
                )}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* =================== Game Over & Premium Statistics =================== */
function GameOverView(props: {
  winner: "player" | "enemy" | null;
  stats: { playerShots: number; playerHits: number; turns: number };
  enemyFleet: FleetItem[];
  playerFleet: FleetItem[];
  onReset: () => void;
}) {
  const isWin = props.winner === "player";
  const precision =
    props.stats.playerShots > 0
      ? Math.round((props.stats.playerHits / props.stats.playerShots) * 100)
      : 0;

  const enemySunkCount = props.enemyFleet.filter((s) => s.sunk).length;
  const playerSunkCount = props.playerFleet.filter((s) => s.sunk).length;

  return (
    <div className="max-w-3xl mx-auto glass-panel p-8 sm:p-12 rounded-3xl border-2 text-center animate-splash shadow-[0_0_50px_rgba(0,180,255,0.2)]">
      <div className="mb-6 inline-block">
        <span className="text-6xl sm:text-7xl filter drop-shadow-[0_0_20px_rgba(0,240,255,0.6)] select-none">
          {isWin ? "🏆" : "☠️"}
        </span>
      </div>

      <h1
        className={cn(
          "text-3xl sm:text-5xl font-black font-mono tracking-wider mb-2",
          isWin
            ? "bg-gradient-to-r from-cyan-300 via-emerald-300 to-green-400 bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]"
            : "bg-gradient-to-r from-rose-400 via-red-400 to-amber-400 bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(244,63,94,0.5)]",
        )}
      >
        {isWin ? "VICTOIRE TOTALE EN MER !" : "FLOTTE ANÉANTIE"}
      </h1>

      <p className="text-sm font-mono text-cyan-200/80 mb-8 max-w-md mx-auto">
        {isWin
          ? "Félicitations, Amiral ! Votre stratégie sans faille et votre maîtrise des systèmes d'armement ont triomphé de la flotte hostile."
          : "Le haut commandement a perdu le signal de votre dernier navire. L'ennemi contrôle désormais ce secteur stratégique."}
      </p>

      {/* Holographic Tactical Statistics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10 text-left">
        <div className="bg-[#041224]/80 p-4 rounded-2xl border border-cyan-500/30 flex flex-col justify-between">
          <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-wider">
            Tours engagés
          </span>
          <span className="text-2xl font-mono font-black text-white mt-1">
            {props.stats.turns}
          </span>
        </div>

        <div className="bg-[#041224]/80 p-4 rounded-2xl border border-cyan-500/30 flex flex-col justify-between">
          <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-wider">
            Précision de tir
          </span>
          <span className="text-2xl font-mono font-black text-emerald-400 mt-1">
            {precision}%
          </span>
        </div>

        <div className="bg-[#041224]/80 p-4 rounded-2xl border border-cyan-500/30 flex flex-col justify-between">
          <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-wider">
            Navires détruits
          </span>
          <span className="text-2xl font-mono font-black text-cyan-300 mt-1">
            {enemySunkCount} / {SHIP_DEFS.length}
          </span>
        </div>

        <div className="bg-[#041224]/80 p-4 rounded-2xl border border-cyan-500/30 flex flex-col justify-between">
          <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-wider">
            Pertes subies
          </span>
          <span className="text-2xl font-mono font-black text-rose-400 mt-1">
            {playerSunkCount} / {SHIP_DEFS.length}
          </span>
        </div>
      </div>

      <button
        onClick={props.onReset}
        className="neon-btn rounded-2xl px-10 py-5 text-base font-mono font-black uppercase tracking-widest shadow-[0_0_25px_rgba(0,240,255,0.5)] hover:scale-105 cursor-pointer"
      >
        ⚓ Relancer une nouvelle mission
      </button>
    </div>
  );
}
