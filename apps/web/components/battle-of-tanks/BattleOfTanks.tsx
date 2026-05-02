"use client";

import React, { useEffect, useRef, useState } from "react";
import { Game } from "./Game";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@workspace/ui/components/dialog";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Settings } from "lucide-react";

import { useFullscreen, useToggle } from "react-use";

export function App() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [showFullscreen, toggleFullscreen] = useToggle(false);
  const [containerElement, setContainerElement] = useState<HTMLElement | null>(null);
  
  useFullscreen(rootRef as React.RefObject<HTMLDivElement>, showFullscreen, {
    onClose: () => toggleFullscreen(false),
  });

  useEffect(() => {
    setContainerElement(rootRef.current);
  }, []);

  const gameRef = useRef<Game | null>(null);
  const [username, setUsername] = useState("");
  const [isJoined, setIsJoined] = useState(false);
  const [inputName, setInputName] = useState("");
  
  const [showJoystick, setShowJoystick] = useState(() => {
    if (typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches) {
      return false;
    }
    return true;
  });

  useEffect(() => {
    if (!gameRef.current) {
      const game = new Game();
      gameRef.current = game;
    } else {
      const container = document.getElementById("game-container");
      if (container && gameRef.current.renderer.domElement) {
        container.appendChild(gameRef.current.renderer.domElement);
      }
    }
    return () => {};
  }, []);

  const handleJoin = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputName.trim()) return;

    // Trigger fullscreen via hook
    toggleFullscreen(true);
    
    setUsername(inputName.trim());
    setIsJoined(true);
    
    if (gameRef.current) {
      gameRef.current.start(inputName.trim());
    }
  };

  return (
    <div ref={rootRef} className="fixed inset-0 w-dvw h-dvh overflow-hidden bg-black font-sans touch-none overscroll-none select-none">
      <div id="game-container" className="absolute inset-0"></div>
      
      {/* Shadcn Dialog Login */}
      <Dialog open={!isJoined} onOpenChange={() => {}}>
        <DialogContent 
          className="bg-black/60 border-white/10 backdrop-blur-xl sm:max-w-md p-8"
          showCloseButton={false}
        >
          <DialogHeader className="text-center">
            <DialogTitle className="text-4xl font-black italic tracking-tighter text-transparent bg-clip-text bg-linear-to-br from-white to-white/40">
              BATTLE OF TANKS
            </DialogTitle>
            <DialogDescription className="text-white/40 tracking-[3px] uppercase text-[10px]">
              Select your callsign
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleJoin} className="space-y-6 mt-4">
            <div className="relative group">
              <Input
                autoFocus
                placeholder="USERNAME"
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                maxLength={16}
                className="h-14 bg-white/5 border-white/10 rounded-xl px-6 text-white placeholder:text-white/20 focus-visible:ring-white/10 focus-visible:border-white/40 font-mono tracking-widest uppercase transition-all"
              />
            </div>
            
            <Button
              type="submit"
              disabled={!inputName.trim()}
              className="w-full h-14 bg-white text-black font-black uppercase tracking-widest rounded-xl hover:bg-white/90 transition-all text-base"
            >
              JOIN BATTLE
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* HUD Elements */}
      <div id="hud" className={`absolute top-0 left-0 w-full h-full pointer-events-none text-white ${!isJoined ? 'opacity-0' : 'opacity-100'} transition-opacity duration-500`}>
        <div id="connect-status" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[18px] text-[#aaa]">Connecting...</div>

        <div id="health-bar" className="absolute bottom-[80px] left-1/2 -translate-x-1/2 w-[200px] h-[12px] bg-[#333] border border-[#666]">
          <div id="health-fill" className="h-full w-full bg-[#4f4] transition-[width] duration-150"></div>
        </div>
        <div id="shield-bar" className="absolute bottom-[98px] left-1/2 -translate-x-1/2 w-[200px] h-[6px] bg-[#333] border border-[#444]">
          <div id="shield-fill" className="h-full w-0 bg-[#48f] transition-[width] duration-150"></div>
        </div>
        <div id="ammo-display" className="absolute bottom-[115px] left-1/2 -translate-x-1/2 text-[12px] text-[#f84]"></div>
        
        <div id="joystick-left" className={`absolute bottom-[20px] left-[20px] w-[150px] h-[150px] z-50 transition-opacity duration-300 ${!showJoystick ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'}`}></div>
        <div id="joystick-right" className={`absolute bottom-[20px] right-[20px] w-[150px] h-[150px] z-50 transition-opacity duration-300 ${!showJoystick ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'}`}></div>
        
        {/* Settings */}
        <div className="absolute top-[20px] left-[20px] z-50 pointer-events-auto">
          <Dialog>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                size="icon" 
                className="bg-black/50 border-white/10 backdrop-blur-xs text-white hover:bg-white/10 hover:text-white"
              >
                <Settings className="w-5 h-5" />
              </Button>
            </DialogTrigger>
            <DialogContent 
              container={containerElement}
              className="bg-black/80 border-white/10 backdrop-blur-md p-6 max-w-sm flex flex-col gap-6 text-white"
            >
              <DialogHeader>
                <DialogTitle className="text-xl font-bold tracking-widest uppercase">Settings</DialogTitle>
                <DialogDescription className="text-white/40">Adjust your game preferences</DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-white/70 text-sm uppercase tracking-widest">Joystick</span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className={`h-8 px-4 text-xs transition-colors ${showJoystick ? 'bg-white text-black hover:bg-white/90' : 'bg-transparent text-white hover:bg-white/10'}`}
                    onClick={() => setShowJoystick(!showJoystick)}
                  >
                    {showJoystick ? 'ON' : 'OFF'}
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/70 text-sm uppercase tracking-widest">Fullscreen</span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className={`h-8 px-4 text-xs transition-colors ${showFullscreen ? 'bg-white text-black hover:bg-white/90' : 'bg-transparent text-white hover:bg-white/10'}`}
                    onClick={() => toggleFullscreen()}
                  >
                    {showFullscreen ? 'ON' : 'OFF'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        
        <div id="scores" className="absolute top-[20px] right-[20px] text-[13px] leading-none bg-black/50 border border-white/10 rounded-md py-[8px] px-[4px] min-w-[140px] backdrop-blur-xs pointer-events-auto">
          <div id="scores-title" className="text-[10px] uppercase tracking-[2px] text-white/40 text-center pt-[2px] px-0 pb-[6px] border-b border-white/8 mb-[4px]">Leaderboard</div>
          <div id="scores-list" className="relative"></div>
        </div>
        
        <div id="death-screen" className="hidden absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[24px] text-[#f44] text-center">
          DESTROYED<br />
          <span className="text-[14px] text-[#aaa]">Respawning...</span>
        </div>
        
        <div id="winner-screen" className="group absolute inset-0 hidden items-center justify-center z-10 overflow-hidden [&.ready]:flex [&.exit]:flex">
          <div id="winner-tint" className="absolute inset-0 opacity-0 transition-opacity duration-300 ease-out group-[.active]:opacity-100 group-[.exit]:opacity-0 group-[.exit]:duration-500 group-[.exit]:delay-200"></div>
          <div id="winner-stripe" className="absolute -left-[10%] w-[120%] h-[110px] -rotate-3 scale-x-0 origin-left transition-transform duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] group-[.active]:scale-x-100 group-[.exit]:scale-x-0 group-[.exit]:origin-right group-[.exit]:duration-350 group-[.exit]:ease-[cubic-bezier(0.55,0,1,0.45)] group-[.exit]:delay-150"></div>
          <div id="winner-line-top" className="absolute -left-[10%] w-[120%] h-[3px] -rotate-3 scale-x-0 origin-right transition-transform duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] delay-100 -mt-[62px] group-[.active]:scale-x-100 group-[.exit]:scale-x-0 group-[.exit]:origin-left group-[.exit]:duration-300 group-[.exit]:ease-[cubic-bezier(0.55,0,1,0.45)] group-[.exit]:delay-50"></div>
          <div id="winner-line-bot" className="absolute -left-[10%] w-[120%] h-[3px] -rotate-3 scale-x-0 origin-right transition-transform duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] delay-100 mt-[62px] group-[.active]:scale-x-100 group-[.exit]:scale-x-0 group-[.exit]:origin-left group-[.exit]:duration-300 group-[.exit]:ease-[cubic-bezier(0.55,0,1,0.45)] group-[.exit]:delay-50"></div>
          <div id="winner-banner" className="relative z-10 text-center">
            <div id="winner-label" className="text-[80px] font-bold uppercase tracking-[10px] drop-shadow-[0_2px_30px_rgba(0,0,0,0.7)] opacity-0 -translate-x-[80px] scale-110 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] delay-120 group-[.active]:opacity-100 group-[.active]:translate-x-0 group-[.active]:scale-100 group-[.exit]:opacity-0 group-[.exit]:translate-x-[80px] group-[.exit]:scale-95 group-[.exit]:duration-300 group-[.exit]:ease-[cubic-bezier(0.55,0,1,0.45)] group-[.exit]:delay-0"></div>
            <div id="winner-team" className="text-[18px] tracking-[6px] uppercase mt-[6px] [text-shadow:0_1px_10px_rgba(0,0,0,0.5)] opacity-0 translate-x-[60px] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] delay-220 group-[.active]:opacity-90 group-[.active]:translate-x-0 group-[.exit]:opacity-0 group-[.exit]:-translate-x-[60px] group-[.exit]:duration-300 group-[.exit]:ease-[cubic-bezier(0.55,0,1,0.45)] group-[.exit]:delay-50"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
