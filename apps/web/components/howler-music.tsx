"use client";

import { useEffect, useRef, useState } from "react";
import { Howl } from "howler";
import { Music, Music2 } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";

interface HowlerMusicProps {
  src: string;
  autoPlay?: boolean;
  loop?: boolean;
  volume?: number;
  className?: string;
}

/**
 * A standalone React component for playing background music using Howler.js.
 * Handles loading, playback, and basic UI controls in a single package.
 */
export function HowlerMusic({
  src,
  autoPlay = false,
  loop = true,
  volume = 0.2,
  className,
}: HowlerMusicProps) {
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const soundRef = useRef<Howl | null>(null);

  const initialProps = useRef({ autoPlay, loop, volume });

  useEffect(() => {
    soundRef.current = new Howl({
      src: [src],
      autoplay: initialProps.current.autoPlay,
      loop: initialProps.current.loop,
      volume: initialProps.current.volume,
      preload: true,
      html5: false,
    });

    return () => {
      soundRef.current?.unload();
    };
  }, [src]);

  // Handle Dynamic property updates without re-creating the Howl instance
  useEffect(() => {
    if (soundRef.current) {
      soundRef.current.loop(loop);
      soundRef.current.volume(volume);
    }
  }, [loop, volume]);

  // Handle Play/Pause
  useEffect(() => {
    if (!soundRef.current) return;

    if (isPlaying) {
      if (!soundRef.current.playing()) {
        soundRef.current.play();
      }
    } else {
      soundRef.current.pause();
    }
  }, [isPlaying]);

  const togglePlay = () => setIsPlaying(!isPlaying);


  return (
    <div className={cn(
      "flex items-center p-1 bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-full shadow-lg pointer-events-auto",
      className
    )}>
      <Button
        variant="ghost"
        size="icon"
        onClick={togglePlay}
        className={cn(
          "rounded-full size-8 transition-all shrink-0 cursor-pointer",
          isPlaying ? "bg-primary/20 text-primary shadow-[0_0_10px_-2px_var(--color-primary)]" : "text-zinc-500 hover:text-zinc-400"
        )}
      >
        {isPlaying ? (
          <Music2 className="size-4 animate-spin-slow" />
        ) : (
          <Music className="size-4" />
        )}
      </Button>
    </div>
  );
}



