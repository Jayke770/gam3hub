"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment } from "@react-three/drei";
import { FallingStars } from "@/components/falling-stars";
import { Coin3D } from "@/components/coin3d";

interface CoinArenaProps {
  isFlipping: boolean;
  targetFace: "Heads" | "Tails" | null;
  onLanded: () => void;
  themeColors: {
    primary: string;
    primaryFg: string;
    secondary: string;
    secondaryFg: string;
  };
}

export function CoinArena({
  isFlipping,
  targetFace,
  onLanded,
  themeColors,
}: CoinArenaProps) {
  return (
    <div className="flex-1 h-full relative flex items-center justify-center overflow-hidden z-10 transition-colors duration-500">
      {/* Giant ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-radial from-primary/15 via-background to-background blur-[150px] -z-10 animate-in fade-in duration-1000" />

      <div className="absolute inset-0 w-full h-full z-20">
        <Canvas camera={{ position: [0, 2.5, 9.5], fov: 45 }}>
          <Environment preset="city" />
          <directionalLight position={[5, 12, 6]} intensity={1.8} castShadow />
          <ambientLight intensity={0.6} />

          <FallingStars color={themeColors.primary} />

          <Suspense fallback={null}>
            <Coin3D
              isFlipping={isFlipping}
              targetFace={targetFace}
              onLanded={onLanded}
              colors={themeColors}
            />
          </Suspense>

          <ContactShadows
            position={[0, -2.5, 0]}
            opacity={0.8}
            scale={3}
            blur={2.5}
            far={12}
          />
        </Canvas>
      </div>


    </div>
  );
}
