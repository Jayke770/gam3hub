"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Heart } from "lucide-react";
import { Howl } from "howler";
import Image from "next/image";
import { toast } from "sonner";

const GRID_SIZE = 5;
const TOTAL_TILES = GRID_SIZE * GRID_SIZE;

interface Tile {
  id: number;
  isMine: boolean;
  isRevealed: boolean;
}

// Sound effects
const tileSound = new Howl({ src: ["/assets/sounds/tile.mp3"], volume: 0.5 });
const bombSound = new Howl({ src: ["/assets/sounds/bomb.mp3"], volume: 0.5 });

export function MinesGame() {
  const [mineCount, setMineCount] = useState(3);
  const betAmount = 10;
  const [gameState, setGameState] = useState<"idle" | "playing" | "won" | "lost">("idle");
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [revealedCount, setRevealedCount] = useState(0);
  const [p1Lives, setP1Lives] = useState(3);
  const [p2Lives, setP2Lives] = useState(3);

  const startNewGame = useCallback(() => {
    const newTiles: Tile[] = Array.from({ length: TOTAL_TILES }, (_, i) => ({
      id: i,
      isMine: false,
      isRevealed: false,
    }));

    // Randomly select number of mines between 1 and 5
    const randomMineCount = Math.floor(Math.random() * 5) + 1;
    setMineCount(randomMineCount);

    // Place mines randomly
    let placedMines = 0;
    while (placedMines < randomMineCount) {
      const randomIndex = Math.floor(Math.random() * TOTAL_TILES);
      const targetTile = newTiles[randomIndex];
      if (targetTile && !targetTile.isMine) {
        targetTile.isMine = true;
        placedMines++;
      }
    }

    setTiles(newTiles);
    setGameState("playing");
    setRevealedCount(0);
    toast.success("Game started! Good luck.");
  }, []);

  const handleTileClick = useCallback((id: number) => {
    if (gameState !== "playing") return;

    const tile = tiles[id];
    if (!tile || tile.isRevealed) return;

    const newTiles = [...tiles];
    const targetTile = newTiles[id];
    if (!targetTile) return;

    targetTile.isRevealed = true;
    setTiles(newTiles);

    if (targetTile.isMine) {
      bombSound.play();
      setGameState("lost");
      toast.error("BOOM! You hit a mine.");
      // Reveal all mines
      setTiles(prev => prev.map(t => t.isMine ? { ...t, isRevealed: true } : t));
    } else {
      tileSound.play();
      const newRevealedCount = revealedCount + 1;
      setRevealedCount(newRevealedCount);

      // Check for win
      if (newRevealedCount === TOTAL_TILES - mineCount) {
        setGameState("won");
        toast.success("Congratulations! You found all the stars!");
      }
    }
  }, [tiles, gameState, revealedCount, mineCount]);

  const currentMultiplier = useMemo(() => {
    if (revealedCount === 0) return 1;
    // Simplified multiplier formula: (TOTAL / (TOTAL - revealed)) * factor
    return (TOTAL_TILES / (TOTAL_TILES - revealedCount)) * (1 + mineCount * 0.1);
  }, [revealedCount, mineCount]);

  // Auto-start on mount
  useEffect(() => {
    startNewGame();
  }, [startNewGame]);

  return (
    <div className="w-full flex-1 flex flex-col items-center justify-center overflow-hidden p-2 gap-8">
      {/* PVP Status Bar (Top) */}
      <div className="relative z-10 w-full max-w-[450px] flex justify-between items-center px-4 mb-2">
        {/* Player 1 */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-sm font-black text-blue-400 uppercase tracking-[0.15em] italic flex items-center gap-2 drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]">
            <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.6)] animate-pulse" />
            YOU
          </span>
          <div className="flex gap-1.5 px-3 py-1 bg-card/60 rounded-full border border-border shadow-lg">
            {[...Array(3)].map((_, i) => (
              <Heart
                key={i}
                className={`w-4 h-4 transition-all duration-300 ${i < p1Lives ? "text-rose-500 fill-rose-500 scale-110" : "text-muted-foreground/30 scale-90"}`}
              />
            ))}
          </div>
        </div>

        {/* Minimalist VS */}
        <div className="relative flex flex-col items-center justify-center">
          <span className="text-xl font-black text-primary uppercase tracking-[0.25em] italic drop-shadow-[0_0_12px_rgba(var(--primary),0.5)]">
            VS
          </span>
          <div className="w-8 h-px bg-linear-to-r from-transparent via-border to-transparent mt-1" />
        </div>

        {/* Player 2 */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-sm font-black text-primary/80 uppercase tracking-[0.15em] italic flex items-center gap-2 drop-shadow-[0_0_8px_rgba(var(--primary),0.3)]">
            OPPONENT
            <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.6)] animate-pulse" />
          </span>
          <div className="flex gap-1.5 px-3 py-1 bg-card/60 rounded-full border border-border shadow-lg">
            {[...Array(3)].map((_, i) => (
              <Heart
                key={i}
                className={`w-4 h-4 transition-all duration-300 ${i < p2Lives ? "text-rose-500 fill-rose-500 scale-110" : "text-muted-foreground/30 scale-90"}`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex w-full h-full justify-center items-center">
        {/* Grid only */}
        <div
          className="grid gap-2 p-3 bg-background/50 rounded-2xl border border-border shadow-2xl"
          style={{
            gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
            width: "min(95%, 55vh)", // Strictly scale with height
            maxWidth: "500px"
          }}
        >
          {tiles.length === 0 ? (
            Array.from({ length: TOTAL_TILES }).map((_, i) => (
              <div
                key={i}
                className="aspect-square bg-card/20 rounded-lg border border-border flex items-center justify-center"
              >
                <div className="w-1.5 h-1.5 bg-muted/20 rounded-full" />
              </div>
            ))
          ) : (
            tiles.map((tile) => (
              <TileComponent
                key={tile.id}
                tile={tile}
                onClick={() => handleTileClick(tile.id)}
              />
            ))
          )}
        </div>
      </div>

      <AnimatePresence>
        {(gameState === "won" || gameState === "lost") && (
          <motion.div
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(4px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 pointer-events-none"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-card border border-border p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-6 pointer-events-auto max-w-xs w-full text-center"
            >
              <div className={`w-20 h-20 rounded-full flex items-center justify-center ${gameState === "won" ? "bg-green-500/20" : "bg-red-500/20"}`}>
                <Image
                  src={gameState === "won" ? "/assets/images/tile.png" : "/assets/images/bomb.png"}
                  alt="Result"
                  width={60}
                  height={60}
                  className="object-contain"
                />
              </div>

              <div className="space-y-1">
                <h2 className={`text-3xl font-black uppercase italic ${gameState === "won" ? "text-green-500" : "text-red-500"}`}>
                  {gameState === "won" ? "Victory!" : "Wasted"}
                </h2>
                <p className="text-slate-400 font-medium">
                  {gameState === "won" ? `Profit: +${(betAmount * currentMultiplier - betAmount).toFixed(2)}` : "Next time for sure!"}
                </p>
              </div>

              <button
                onClick={startNewGame}
                className="w-full bg-slate-100 text-slate-950 py-4 rounded-xl font-black uppercase italic hover:bg-white transition-all active:scale-95 shadow-xl"
              >
                Try Again
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TileComponent({ tile, onClick }: { tile: Tile; onClick: () => void }) {
  return (
    <motion.button
      whileHover={!tile.isRevealed ? { scale: 1.05 } : {}}
      whileTap={!tile.isRevealed ? { scale: 0.95 } : {}}
      onClick={onClick}
      disabled={tile.isRevealed}
      className={`relative aspect-square cursor-pointer rounded-xl transition-all duration-300 border flex items-center justify-center group overflow-hidden ${tile.isRevealed
        ? tile.isMine
          ? "bg-rose-500/20 border-rose-500/50"
          : "bg-primary/20 border-primary/50 ring-2 ring-primary/20 shadow-[0_0_20px_rgba(var(--primary),0.2)]"
        : "bg-card hover:bg-muted border-border"
        }`}
    >
      <AnimatePresence mode="wait">
        {tile.isRevealed ? (
          <motion.div
            key={tile.isMine ? "bomb" : "star"}
            initial={{ scale: 0, rotate: -45, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", damping: 10, stiffness: 200 }}
            className="w-full h-full flex items-center justify-center"
          >
            {tile.isMine ? (
              <Image
                src="/assets/images/bomb.png"
                alt="Bomb"
                width={80}
                height={80}
                className="w-3/4 h-3/4 object-contain drop-shadow-xl"
              />
            ) : (
              <Image
                src="/assets/images/tile.png"
                alt="Star"
                width={80}
                height={80}
                className="w-3/4 h-3/4 object-contain drop-shadow-xl"
              />
            )}
          </motion.div>
        ) : (
          <div className="w-2 h-2 bg-slate-700 rounded-full group-hover:scale-150 transition-transform" />
        )}
      </AnimatePresence>

      {/* Glossy Overlay */}
      {!tile.isRevealed && (
        <div className="absolute inset-0 bg-linear-to-tr from-white/5 to-transparent pointer-events-none" />
      )}
    </motion.button>
  );
}
