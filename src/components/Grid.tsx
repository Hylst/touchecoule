import { useState } from "react";
import {
  GRID,
  key,
  shipCells,
  isSunk,
  type PlacedShip,
} from "../game";
import { cn } from "../utils/cn";

const LETTERS = "ABCDEFGHIJ".split("");

interface PreviewInfo {
  cells: Set<string>;
  valid: boolean;
}

export type SpecialWeapon = "canon" | "salve" | "torpille" | "sonar";

interface GridProps {
  ships: PlacedShip[];
  shots: Map<string, "hit" | "miss">;
  sonarScans?: Set<string>;
  revealShips: boolean; // own board => show all ships; enemy => fog of war
  interactive?: boolean;
  disabled?: boolean;
  weapon?: SpecialWeapon;
  onCellClick?: (r: number, c: number) => void;
  onCellHover?: (r: number, c: number) => void;
  onLeave?: () => void;
  preview?: PreviewInfo | null;
  lastShot?: string | null;
  label?: string;
  isRadar?: boolean;
}

export default function Grid({
  ships,
  shots,
  sonarScans = new Set(),
  revealShips,
  interactive = false,
  disabled = false,
  weapon = "canon",
  onCellClick,
  onCellHover,
  onLeave,
  preview,
  lastShot,
  isRadar = false,
}: GridProps) {
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);

  // build maps for quick lookup
  const shipCellMap = new Map<string, PlacedShip>();
  for (const ship of ships) {
    for (const cell of shipCells(ship)) {
      shipCellMap.set(key(cell.r, cell.c), ship);
    }
  }

  // Calculate special weapon attack preview cells
  const weaponPreviewCells = (() => {
    if (!interactive || disabled || !hover || preview) return new Set<string>();
    const { r, c } = hover;
    const res = new Set<string>();
    if (weapon === "salve") {
      res.add(key(r, c));
      if (r > 0) res.add(key(r - 1, c));
      if (r < GRID - 1) res.add(key(r + 1, c));
      if (c > 0) res.add(key(r, c - 1));
      if (c < GRID - 1) res.add(key(r, c + 1));
    } else if (weapon === "torpille") {
      for (let col = 0; col < GRID; col++) res.add(key(r, col));
    } else if (weapon === "sonar") {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nc >= 0 && nr < GRID && nc < GRID) {
            res.add(key(nr, nc));
          }
        }
      }
    } else {
      res.add(key(r, c));
    }
    return res;
  })();

  const cells = [];
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const k = key(r, c);
      const shot = shots.get(k);
      const isScanned = sonarScans.has(k);
      const ship = shipCellMap.get(k);
      const sunk = ship ? isSunk(ship) : false;
      const showShip = ship && (revealShips || sunk);

      const inPlacementPreview = preview?.cells.has(k);
      const inWeaponPreview = weaponPreviewCells.has(k);
      const isLast = lastShot === k;

      let content: React.ReactNode = null;
      let cellStyle = "";

      if (shot === "miss") {
        cellStyle = "bg-[#04284d]/90 shadow-inner";
        content = (
          <div className="relative flex items-center justify-center">
            <span
              className={cn(
                "block h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#00f0ff]",
                isLast && "animate-splash",
              )}
            />
          </div>
        );
      } else if (shot === "hit") {
        if (sunk) {
          cellStyle = "bg-rose-950/90 border-rose-500/40 shadow-[inset_0_0_15px_rgba(244,63,94,0.4)]";
          content = (
            <span
              title={ship?.name}
              className={cn(
                "text-lg sm:text-xl filter drop-shadow-[0_0_8px_#f43f5e] select-none",
                isLast && "animate-big-explode",
              )}
            >
              💥
            </span>
          );
        } else {
          cellStyle = "bg-amber-950/80 border-amber-500/50 shadow-[inset_0_0_12px_rgba(245,158,11,0.5)]";
          content = (
            <span
              className={cn(
                "text-base sm:text-lg filter drop-shadow-[0_0_6px_#f59e0b] select-none",
                isLast && "animate-big-explode",
              )}
            >
              🔥
            </span>
          );
        }
      } else if (showShip) {
        // Render sleek tactical naval silhouette segment
        const shipCellsList = ship ? shipCells(ship) : [];
        const segmentIdx = shipCellsList.findIndex(sc => sc.r === r && sc.c === c);
        const isBow = segmentIdx === 0;
        const isStern = segmentIdx === shipCellsList.length - 1;
        const orient = ship?.orientation;

        let roundedClass = "rounded-none";
        if (orient === "h") {
          if (isBow) roundedClass = "rounded-l-full";
          if (isStern) roundedClass = "rounded-r-full";
        } else {
          if (isBow) roundedClass = "rounded-t-full";
          if (isStern) roundedClass = "rounded-b-full";
        }

        cellStyle = sunk
          ? "bg-rose-900/40"
          : "bg-[#0a2e5c]/60";

        content = (
          <div
            title={ship.name}
            className={cn(
              "absolute inset-[3px] sm:inset-[4px] shadow-[0_0_10px_rgba(0,180,255,0.6)] flex items-center justify-center transition-all",
              sunk
                ? "bg-gradient-to-br from-rose-600 to-red-800 border border-rose-400 opacity-80"
                : "bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 border border-cyan-300",
              roundedClass,
              sunk && isLast && "animate-premium-sink",
            )}
          >
            {!sunk && (
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-100 shadow-[0_0_4px_#fff]" />
            )}
            {sunk && <span className="text-[10px] sm:text-xs">☠️</span>}
          </div>
        );
      } else {
        cellStyle = "tactical-water";
        if (isScanned) {
          content = (
            <span className="absolute text-[10px] text-cyan-300 font-mono tracking-tighter bg-cyan-950/80 px-1 py-0.5 rounded border border-cyan-500/50 shadow-[0_0_8px_#00f0ff]">
              SCAN
            </span>
          );
        }
      }

      // overlay highlights
      let highlightClass = "";
      if (inPlacementPreview) {
        highlightClass = preview?.valid
          ? "bg-emerald-500/50 border-2 border-emerald-300 shadow-[0_0_15px_#10b981] z-20"
          : "bg-rose-600/60 border-2 border-rose-300 shadow-[0_0_15px_#f43f5e] z-20";
      } else if (inWeaponPreview && shot === undefined) {
        if (weapon === "sonar") {
          highlightClass = "bg-cyan-500/40 border-2 border-cyan-300 shadow-[0_0_20px_#00f0ff] z-20 animate-pulse";
        } else if (weapon === "salve") {
          highlightClass = "bg-amber-500/40 border-2 border-amber-300 shadow-[0_0_20px_#f59e0b] z-20";
        } else if (weapon === "torpille") {
          highlightClass = "bg-indigo-500/40 border-2 border-indigo-300 shadow-[0_0_20px_#6366f1] z-20";
        } else {
          highlightClass = "bg-rose-500/30 border border-rose-400 shadow-[0_0_15px_#f43f5e] z-20";
        }
      }

      cells.push(
        <button
          key={k}
          type="button"
          disabled={disabled || !interactive}
          onClick={() => interactive && !disabled && onCellClick?.(r, c)}
          onMouseEnter={() => {
            setHover({ r, c });
            onCellHover?.(r, c);
          }}
          onMouseLeave={() => setHover(null)}
          className={cn(
            "relative flex aspect-square items-center justify-center text-xs transition-all duration-150 rounded-sm",
            "border border-cyan-500/20",
            cellStyle,
            highlightClass,
            interactive && !disabled && "cursor-crosshair hover:scale-105 z-10",
          )}
        >
          {content}
          {isLast && (
            <span className="pointer-events-none absolute inset-0 rounded-sm animate-ring z-30" />
          )}
        </button>,
      );
    }
  }

  return (
    <div onMouseLeave={onLeave} className="select-none select-none">
      {/* column letters */}
      <div
        className="grid pl-6"
        style={{ gridTemplateColumns: `repeat(${GRID}, minmax(0,1fr))` }}
      >
        {LETTERS.map((l) => (
          <div
            key={l}
            className="pb-1 text-center text-xs font-mono font-bold uppercase tracking-wider text-cyan-300/80"
          >
            {l}
          </div>
        ))}
      </div>
      <div className="flex">
        {/* row numbers */}
        <div className="flex flex-col justify-around pr-2">
          {Array.from({ length: GRID }).map((_, i) => (
            <div
              key={i}
              className="flex flex-1 items-center justify-center text-xs font-mono font-bold text-cyan-300/80"
            >
              {i + 1}
            </div>
          ))}
        </div>
        <div
          className={cn(
            "grid flex-1 overflow-hidden rounded-xl border-2 border-cyan-500/40 shadow-[0_0_30px_rgba(0,160,255,0.15)]",
            isRadar ? "radar-grid" : "bg-[#020d1a]",
          )}
          style={{ gridTemplateColumns: `repeat(${GRID}, minmax(0,1fr))` }}
        >
          {isRadar && <div className="radar-sweep-blade" />}
          {cells}
        </div>
      </div>
    </div>
  );
}
