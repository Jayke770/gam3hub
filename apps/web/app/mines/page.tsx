"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { Mines3DBackground } from "../../components/mines/Mines3DBackground";
import { MinesGame } from "../../components/mines/MinesGame";

export default function MinesPage() {
  return (
    <main className="relative h-screen w-full flex flex-col items-center bg-slate-950 overflow-hidden pt-12 pb-8">
      {/* 3D Background Layer */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-40">
        <Canvas camera={{ position: [0, 0, 15], fov: 60 }}>
          <Suspense fallback={null}>
            <Mines3DBackground />
          </Suspense>
        </Canvas>
      </div>

      {/* Decorative Blur Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />


      {/* Main Game Interface */}
      <MinesGame />

    </main>
  );
}
