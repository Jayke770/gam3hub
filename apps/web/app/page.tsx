"use client";

import { useState, useEffect } from "react";
import { ChatAndBets } from "@/components/chat-and-bets";
import { CoinArena } from "@/components/coin-arena";
import { Button } from "@workspace/ui/components/button";
import { Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerTitle } from "@workspace/ui/components/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import { Wallet } from "lucide-react";
import { HowlerMusic } from "@/components/howler-music";
import { useChainId, useSendTransaction, useSwitchChain } from "wagmi";


export default function Page() { 
  const isMobile = useIsMobile();
  const { openWallet, isConnected } = useInterwovenKit()
  const chainId = useChainId()
  const { mutate: switchChain } = useSwitchChain()
  const { mutate: sendTransaction, error } = useSendTransaction()
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
        return getComputedStyle(div).color;
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
  const flipCoin = () => {
    if (isFlipping) return;
    setIsFlipping(true);

    const isHeads = Math.random() > 0.5;
    setTargetFace(isHeads ? "Heads" : "Tails");
  };

  const handleLanded = () => {
    if (!isFlipping) return;
    setIsFlipping(false);
  };
  console.log(error)
  return (
    <div className="flex h-svh w-full bg-background text-foreground overflow-hidden relative">
      <HowlerMusic src="/assets/sounds/coinflip.mp3" className="absolute left-2 bottom-2 z-50 pointer-events-auto" />

      {/* GAME ARENA */}
      <CoinArena
        isFlipping={isFlipping}
        targetFace={targetFace}
        onLanded={handleLanded}
        onFlip={flipCoin}
        themeColors={themeColors}
      />

      {isMobile ? (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 pointer-events-auto">
          <Drawer>
            <DrawerTrigger asChild>
              <Button size="lg" className="rounded-full shadow-2xl px-8 uppercase tracking-widest font-bold">
                Bet Now
              </Button>
            </DrawerTrigger>
            <DrawerContent className="h-[80svh] px-0 border-t-0">
              <DrawerHeader className="py-2!">
                <div className=" flex justify-between items-center">
                  <DrawerTitle className="text-xl font-black bg-clip-text text-transparent bg-linear-to-r from-primary to-primary/60 drop-shadow-sm">Coinflip</DrawerTitle>
                  {isConnected && (
                    <Button onClick={openWallet} size={"icon"} variant={"ghost"} className=" cursor-pointer rounded-full">
                      <Wallet />
                    </Button>
                  )}
                </div>
              </DrawerHeader>
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
