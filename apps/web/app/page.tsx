"use client";

import { useState, useEffect } from "react";
import { ChatAndBets } from "@/components/chat-and-bets";
import { CoinArena } from "@/components/coin-arena";
import { Button } from "@workspace/ui/components/button";
import { Drawer, DrawerTrigger, DrawerContent } from "@workspace/ui/components/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import { HowlerMusic } from "@/components/howler-music";
import { useRoomMessage } from "@/components/providers/colyseus";
import { toast } from "sonner";


export default function Page() { 
  const isMobile = useIsMobile();
  const { isConnected } = useInterwovenKit()
  const [isFlipping, setIsFlipping] = useState(false);
  const [targetFace, setTargetFace] = useState<"Heads" | "Tails" | null>(null);
  const [themeColors, setThemeColors] = useState({
    primary: "rgb(139, 92, 246)",
    primaryFg: "rgb(255, 255, 255)",
    secondary: "rgb(100, 116, 139)",
    secondaryFg: "rgb(248, 250, 252)",
  });

  useEffect(() => {
    const updateColors = () => {
      const div = document.createElement("div");
      div.style.display = "none";
      document.body.appendChild(div);

      const getRgb = (cssVar: string) => {
        div.style.color = `oklch(var(${cssVar}))`;
        const computed = getComputedStyle(div).color;
        
        // Convert to absolute color (hex or rgb) via standard browser behavior
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = computed;
            return ctx.fillStyle; 
          }
        } catch { /* Silent fail */ }
        return computed;
      };

      setThemeColors({
        primary: getRgb("--primary"),
        primaryFg: getRgb("--primary-foreground"),
        secondary: getRgb("--secondary"),
        secondaryFg: getRgb("--secondary-foreground"),
      });

      document.body.removeChild(div);
    };

    updateColors();
    const observer = new MutationObserver(updateColors);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  useRoomMessage("settleStart", () => {
    toast("The coin is flipping! ⏳", {
      description: "Waiting for the secure outcome from the blockchain...",
    });
  // Start continuous spinning!
    setIsFlipping(true);
    setTargetFace(null);
  });

  useRoomMessage("settleOutcome", (message: { outcome: number; gameId: string }) => {
    // Trigger the 3D coin jump arc and reveal
    const isHeads = message.outcome === 1;
    setTargetFace(isHeads ? "Heads" : "Tails");
    setIsFlipping(true);

    toast.success(`Coin landed on ${isHeads ? "Heads" : "Tails"}! 🪙`, {
      description: "Winners are being credited...",
    });
  });

  // flipCoin manual debug function removed since we now rely exclusively on server broadcasts

  const handleLanded = () => {
    if (!isFlipping) return;
    setIsFlipping(false);
  };
  return (
    <div className="flex h-svh w-full bg-background text-foreground overflow-hidden relative">
      <HowlerMusic src="/assets/sounds/coinflip.mp3" className="absolute left-3 bottom-8 z-50 pointer-events-auto" />

      {/* GAME ARENA */}
      <CoinArena
        isFlipping={isFlipping}
        targetFace={targetFace}
        onLanded={handleLanded}
        themeColors={themeColors}
      />

      {isMobile ? (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 pointer-events-auto">
          <Drawer modal={false}>
            <DrawerTrigger asChild>
              <Button size="lg" className="rounded-full shadow-2xl px-8 uppercase tracking-widest font-bold">
                Bet Now
              </Button>
            </DrawerTrigger>
            <DrawerContent className="h-[80svh] px-0 border-t-0">
              <div className="flex-1 overflow-hidden w-full h-full flex flex-col mt-2">
                <ChatAndBets isMobile={isMobile} />
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      ) : (
        <div className="flex w-[400px] h-full p-4 pl-0 shrink-0 relative z-30 pointer-events-auto">
          <ChatAndBets isMobile={isMobile} />
          </div>
      )}
    </div>
  );
}
