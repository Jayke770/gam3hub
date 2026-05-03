"use client";
import Image from "next/image";

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
  const [username, setUsername] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("tanks_username") || "";
    }
    return "";
  });
  const [autoJoin, setAutoJoin] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("tanks_autojoin");
      return saved === null ? true : saved === "true";
    }
    return true;
  });

  const [isJoined, setIsJoined] = useState(() => {
    if (typeof window !== "undefined") {
      const name = localStorage.getItem("tanks_username");
      const savedAutoJoin = localStorage.getItem("tanks_autojoin");
      const autoJoinEnabled = savedAutoJoin === null ? true : savedAutoJoin === "true";
      return !!name && autoJoinEnabled;
    }
    return false;
  });
  const [inputName, setInputName] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("tanks_username") || "";
    }
    return "";
  });

  const [showJoystick, setShowJoystick] = useState(() => {
    if (typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches) {
      return false;
    }
    return true;
  });
  useEffect(() => {
    if (gameRef.current) return;
    const game = new Game();
    gameRef.current = game;

    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (gameRef.current && isJoined && username && autoJoin) {
      gameRef.current.start(username);
    }
  }, [isJoined, username, autoJoin]);

  const handleJoin = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputName.trim()) return;

    // Trigger fullscreen via hook
    toggleFullscreen(true);

    localStorage.setItem("tanks_username", inputName.trim());
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
      <Dialog open={!isJoined} onOpenChange={() => { }}>
        <DialogContent
          className="bg-black/60 border-white/10 backdrop-blur-xl sm:max-w-md p-8"
          showCloseButton={false}
        >
          <DialogHeader className="text-center flex flex-col items-center">
            <div className="w-32 h-32 relative mb-2">
              <Image
                src="/assets/images/tanks_logo.png"
                alt="Battle of Tanks Logo"
                fill
                className="object-contain"
              />
            </div>
            <DialogTitle className="text-4xl font-black italic tracking-tighter text-transparent bg-clip-text bg-linear-to-br from-white to-white/40">
              BATTLE OF TANKS
            </DialogTitle>
            <DialogDescription className="text-white/40 tracking-[3px] uppercase text-[10px]">
              Select your callsign
            </DialogDescription>
          </DialogHeader>

          {inputName && localStorage.getItem("tanks_username") === inputName ? (
            <div className="flex flex-col items-center gap-6 mt-4">
              <div className="text-center">
                <span className="text-white/40 text-[10px] uppercase tracking-[3px]">Welcome back, Commander</span>
                <div className="text-2xl font-mono text-white mt-1 tracking-widest uppercase">{inputName}</div>
              </div>

              <Button
                onClick={() => handleJoin()}
                className="w-full h-14 bg-white text-black font-black uppercase tracking-widest rounded-xl hover:bg-white/90 transition-all text-base shadow-[0_0_20px_rgba(255,255,255,0.2)]"
              >
                START GAME
              </Button>

              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem("tanks_username");
                  setInputName("");
                }}
                className="text-white/20 hover:text-white/40 text-[10px] uppercase tracking-[2px] transition-colors"
              >
                Change Name
              </button>
            </div>
          ) : (
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
          )}
        </DialogContent>
      </Dialog>

      {/* HUD Elements */}
      <div id="hud" className={`absolute top-0 left-0 w-full h-full pointer-events-none text-white ${!isJoined ? 'opacity-0' : 'opacity-100'} transition-opacity duration-500`}>
        <div id="connect-status" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[18px] text-[#aaa]">Connecting...</div>

        <div id="ammo-display" className="absolute bottom-[115px] left-1/2 -translate-x-1/2 text-[12px] text-[#f84]"></div>

        {/* Game Timer */}
        <div className="absolute top-[20px] left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none">
          <div className="text-[10px] uppercase tracking-[3px] text-white/40 font-bold">Match Time</div>
          <div id="game-timer" className="text-2xl font-black italic tracking-tighter text-white tabular-nums drop-shadow-lg [text-shadow:0_0_10px_rgba(255,255,255,0.2)]">
            --:--
          </div>
        </div>

        {/* Kill Feed */}
        <div id="kill-feed" className="absolute bottom-[20px] left-1/2 -translate-x-1/2 flex flex-col-reverse items-center gap-1.5 w-full max-w-[500px] pb-4">
        </div>

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
                <div className="flex items-center justify-between">
                  <span className="text-white/70 text-sm uppercase tracking-widest">Auto-Join</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`h-8 px-4 text-xs transition-colors ${autoJoin ? 'bg-white text-black hover:bg-white/90' : 'bg-transparent text-white hover:bg-white/10'}`}
                    onClick={() => {
                      const newValue = !autoJoin;
                      setAutoJoin(newValue);
                      localStorage.setItem("tanks_autojoin", String(newValue));
                    }}
                  >
                    {autoJoin ? 'ON' : 'OFF'}
                  </Button>
                </div>
                <div className="pt-4 border-t border-white/10 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-white/40 text-[10px] uppercase tracking-widest">Logged in as</span>
                      <span className="text-white text-xs font-mono uppercase tracking-widest">{username}</span>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-8 px-4 text-xs bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all uppercase tracking-widest font-bold"
                      onClick={() => {
                        localStorage.removeItem("tanks_username");
                        window.location.reload();
                      }}
                    >
                      Logout
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div id="scores" className="absolute top-[20px] right-[20px] text-[13px] leading-none bg-black/50 border border-white/10 rounded-md py-[8px] px-[4px] min-w-[140px] backdrop-blur-xs pointer-events-auto">
          <div id="scores-title" className="text-[10px] uppercase tracking-[2px] text-white/40 text-center pt-[2px] px-0 pb-[6px] border-b border-white/8 mb-[4px]">Leaderboard</div>
          <div id="scores-list" className="relative"></div>
          <div id="ping-display" className="text-[9px] font-mono text-white/20 uppercase tracking-widest text-center mt-2 pt-2 border-t border-white/5">Ping: --ms</div>
        </div>

        {/* Death Screen */}
        <div id="death-screen" className="group absolute inset-0 hidden items-center justify-center z-30 overflow-hidden [&.ready]:flex [&.exit]:flex pointer-events-none">
          <div className="absolute inset-0 bg-red-900/20 backdrop-blur-[2px] opacity-0 transition-opacity duration-300 group-[.active]:opacity-100"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)] opacity-0 transition-opacity duration-300 group-[.active]:opacity-100"></div>

          <div className="relative flex flex-col items-center">
            <div className="h-[2px] w-[300px] bg-red-600 scale-x-0 transition-transform duration-500 ease-out group-[.active]:scale-x-100 mb-4"></div>
            <h2 className="text-6xl font-black italic tracking-tighter text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.5)] translate-y-4 opacity-0 transition-all duration-500 group-[.active]:translate-y-0 group-[.active]:opacity-100">
              TANK DESTROYED
            </h2>
            <div className="h-[2px] w-[300px] bg-red-600 scale-x-0 transition-transform duration-500 ease-out delay-100 group-[.active]:scale-x-100 mt-4"></div>

            <div className="mt-8 flex flex-col items-center gap-2 opacity-0 transition-opacity duration-500 delay-300 group-[.active]:opacity-100">
              <span className="text-[10px] uppercase tracking-[4px] text-white/40">Initiating Respawn</span>
              <div className="text-xl font-mono text-white/80">
                <span id="respawn-timer">3.0</span>s
              </div>
            </div>
          </div>
        </div>

        <div id="winner-screen" className="group absolute inset-0 hidden items-center justify-center z-10 overflow-hidden [&.ready]:flex [&.exit]:flex">
          <div id="winner-tint" className="absolute inset-0 opacity-0 transition-opacity duration-300 ease-out group-[.active]:opacity-100 group-[.exit]:opacity-0 group-[.exit]:duration-500 group-[.exit]:delay-200"></div>
          <div id="winner-stripe" className="absolute -left-[10%] w-[120%] h-[110px] -rotate-3 scale-x-0 origin-left transition-transform duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] group-[.active]:scale-x-100 group-[.exit]:scale-x-0 group-[.exit]:origin-right group-[.exit]:duration-350 group-[.exit]:ease-[cubic-bezier(0.55,0,1,0.45)] group-[.exit]:delay-150"></div>
          <div id="winner-line-top" className="absolute -left-[10%] w-[120%] h-[3px] -rotate-3 scale-x-0 origin-right transition-transform duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] delay-100 -mt-[62px] group-[.active]:scale-x-100 group-[.exit]:scale-x-0 group-[.exit]:origin-left group-[.exit]:duration-300 group-[.exit]:ease-[cubic-bezier(0.55,0,1,0.45)] group-[.exit]:delay-50"></div>
          <div id="winner-line-bot" className="absolute -left-[10%] w-[120%] h-[3px] -rotate-3 scale-x-0 origin-right transition-transform duration-350 ease-[cubic-bezier(0.22,1,0.36,1)] delay-100 mt-[62px] group-[.active]:scale-x-100 group-[.exit]:scale-x-0 group-[.exit]:origin-left group-[.exit]:duration-300 group-[.exit]:ease-[cubic-bezier(0.55,0,1,0.45)] group-[.exit]:delay-50"></div>
          <div id="winner-banner" className="relative z-10 text-center">
            <div id="winner-label" className="text-[80px] font-bold uppercase tracking-[10px] drop-shadow-[0_2px_30px_rgba(0,0,0,0.7)] opacity-0 -translate-x-[80px] scale-110 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] delay-120 group-[.active]:opacity-100 group-[.active]:translate-x-0 group-[.active]:scale-100 group-[.exit]:opacity-0 group-[.exit]:translate-x-[80px] group-[.exit]:scale-95 group-[.exit]:duration-300 group-[.exit]:ease-[cubic-bezier(0.55,0,1,0.45)] group-[.exit]:delay-0"></div>
            <div id="winner-team" className="text-[18px] tracking-[6px] uppercase mt-[6px] [text-shadow:0_1px_10px_rgba(0,0,0,0.5)] opacity-0 translate-x-[60px] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] delay-220 group-[.active]:opacity-90 group-[.active]:translate-x-0 group-[.exit]:opacity-0 group-[.exit]:-translate-x-[60px] group-[.exit]:duration-300 group-[.exit]:ease-[cubic-bezier(0.55,0,1,0.45)] group-[.exit]:delay-50"></div>

            <div className="mt-8 flex flex-col items-center gap-1 opacity-0 translate-y-4 transition-all duration-500 delay-500 group-[.active]:opacity-100 group-[.active]:translate-y-0 group-[.exit]:opacity-0 group-[.exit]:duration-300">
              <span className="text-[10px] uppercase tracking-[4px] text-white/40 font-bold">Next round in</span>
              <div className="text-2xl font-black italic tracking-tighter text-white/90">
                <span id="next-round-timer">30</span>s
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
