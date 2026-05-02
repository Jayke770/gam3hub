"use client";

import React, { useEffect, useRef } from "react";
import { Game } from "./Game";

export function App() {
  const gameRef = useRef<Game | null>(null);

  useEffect(() => {
    if (!gameRef.current) {
      const game = new Game();
      game.start();
      gameRef.current = game;
    } else {
      // In React Strict Mode, the component is unmounted and remounted.
      // Since the game instance persists via useRef, we just need to re-append the canvas.
      const container = document.getElementById("game-container");
      if (container && gameRef.current.renderer.domElement) {
        container.appendChild(gameRef.current.renderer.domElement);
      }
    }
    
    return () => {
      if (gameRef.current && gameRef.current.renderer.domElement) {
        const canvas = gameRef.current.renderer.domElement;
        if (canvas.parentNode) {
          canvas.parentNode.removeChild(canvas);
        }
      }
    };
  }, []);

  return (
    <>
      <div id="game-container" className="absolute inset-0"></div>
      <div id="hud" className="absolute top-0 left-0 w-full h-full pointer-events-none text-white">
        <div id="connect-status" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[18px] text-[#aaa]">Connecting...</div>

      <div id="health-bar" className="absolute bottom-[30px] left-1/2 -translate-x-1/2 w-[200px] h-[12px] bg-[#333] border border-[#666]">
        <div id="health-fill" className="h-full w-full bg-[#4f4] transition-[width] duration-150"></div>
      </div>
      <div id="shield-bar" className="absolute bottom-[48px] left-1/2 -translate-x-1/2 w-[200px] h-[6px] bg-[#333] border border-[#444]">
        <div id="shield-fill" className="h-full w-0 bg-[#48f] transition-[width] duration-150"></div>
      </div>
      <div id="ammo-display" className="absolute bottom-[65px] left-1/2 -translate-x-1/2 text-[12px] text-[#f84]"></div>
      
      <div id="joystick-left" className="absolute bottom-[20px] left-[10px] w-[150px] h-[150px] z-50 block md:hidden pointer-events-auto"></div>
      <div id="joystick-right" className="absolute bottom-[20px] right-[10px] w-[150px] h-[150px] z-50 block md:hidden pointer-events-auto"></div>
      
      <div id="scores" className="absolute top-[10px] right-[10px] text-[13px] leading-none bg-black/50 border border-white/10 rounded-md py-[8px] px-[4px] min-w-[140px] backdrop-blur-xs pointer-events-auto">
        <div id="scores-title" className="text-[10px] uppercase tracking-[2px] text-white/40 text-center pt-[2px] px-0 pb-[6px] border-b border-white/8 mb-[4px]">Leaderboard</div>
        <div id="scores-list" className="relative"></div>
      </div>
      
      <div id="death-screen" className="hidden absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[24px] text-[#f44] text-center">
        DESTROYED<br />
        <span className="text-[14px] text-[#aaa]">Respawning...</span>
      </div>
      
      <div id="winner-screen" className="group absolute inset-0 hidden items-center justify-center z-10 overflow-hidden [&.ready]:flex [&.exit]:flex">
        <div id="winner-tint" className="absolute inset-0 opacity-0 transition-opacity duration-300 ease-out group-[.active]:opacity-100 group-[.exit]:opacity-0 group-[.exit]:duration-500 group-[.exit]:delay-200"></div>
        <div id="winner-stripe" className="absolute -left-[10%] w-[120%] h-[110px] -rotate-3 scale-x-0 origin-left transition-transform duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] group-[.active]:scale-x-100 group-[.exit]:scale-x-0 group-[.exit]:origin-right group-[.exit]:duration-[350ms] group-[.exit]:ease-[cubic-bezier(0.55,0,1,0.45)] group-[.exit]:delay-[150ms]"></div>
        <div id="winner-line-top" className="absolute -left-[10%] w-[120%] h-[3px] -rotate-3 scale-x-0 origin-right transition-transform duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] delay-[100ms] -mt-[62px] group-[.active]:scale-x-100 group-[.exit]:scale-x-0 group-[.exit]:origin-left group-[.exit]:duration-[300ms] group-[.exit]:ease-[cubic-bezier(0.55,0,1,0.45)] group-[.exit]:delay-[50ms]"></div>
        <div id="winner-line-bot" className="absolute -left-[10%] w-[120%] h-[3px] -rotate-3 scale-x-0 origin-right transition-transform duration-[350ms] ease-[cubic-bezier(0.22,1,0.36,1)] delay-[100ms] mt-[62px] group-[.active]:scale-x-100 group-[.exit]:scale-x-0 group-[.exit]:origin-left group-[.exit]:duration-[300ms] group-[.exit]:ease-[cubic-bezier(0.55,0,1,0.45)] group-[.exit]:delay-[50ms]"></div>
        <div id="winner-banner" className="relative z-10 text-center">
          <div id="winner-label" className="text-[80px] font-bold uppercase tracking-[10px] drop-shadow-[0_2px_30px_rgba(0,0,0,0.7)] opacity-0 -translate-x-[80px] scale-110 transition-all duration-[500ms] ease-[cubic-bezier(0.22,1,0.36,1)] delay-[120ms] group-[.active]:opacity-100 group-[.active]:translate-x-0 group-[.active]:scale-100 group-[.exit]:opacity-0 group-[.exit]:translate-x-[80px] group-[.exit]:scale-95 group-[.exit]:duration-[300ms] group-[.exit]:ease-[cubic-bezier(0.55,0,1,0.45)] group-[.exit]:delay-0"></div>
          <div id="winner-team" className="text-[18px] tracking-[6px] uppercase mt-[6px] [text-shadow:0_1px_10px_rgba(0,0,0,0.5)] opacity-0 translate-x-[60px] transition-all duration-[500ms] ease-[cubic-bezier(0.22,1,0.36,1)] delay-[220ms] group-[.active]:opacity-90 group-[.active]:translate-x-0 group-[.exit]:opacity-0 group-[.exit]:-translate-x-[60px] group-[.exit]:duration-[300ms] group-[.exit]:ease-[cubic-bezier(0.55,0,1,0.45)] group-[.exit]:delay-[50ms]"></div>
        </div>
      </div>
      </div>
    </>
  );
}
