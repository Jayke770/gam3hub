"use client";

import { motion } from "motion/react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Wallet, Star } from "lucide-react";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { 
  Carousel, 
  CarouselContent, 
  CarouselItem, 
  CarouselNext, 
  CarouselPrevious 
} from "@workspace/ui/components/carousel";
import { Mines3DBackground } from "../components/mines/Mines3DBackground";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import { useAccount } from "wagmi";

export default function DashboardPage() {
  const { address } = useAccount();
  const { openConnect, openWallet } = useInterwovenKit();

  const formattedAddress = address 
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : null;

  return (
    <main className="relative min-h-screen w-full bg-background overflow-hidden font-sans">
      {/* Dynamic 3D Background Layer */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-30">
        <Canvas camera={{ position: [0, 0, 15], fov: 60 }}>
          <Suspense fallback={null}>
            <Mines3DBackground />
          </Suspense>
        </Canvas>
      </div>

      {/* Decorative Orbs */}
      <div className="absolute top-[-10%] right-[-10%] w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-amber-600/10 rounded-full blur-[80px] md:blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-blue-600/10 rounded-full blur-[80px] md:blur-[120px] pointer-events-none animate-pulse delay-700" />

      {/* Top Navigation */}
      <header className="relative z-50 flex items-center justify-between px-4 md:px-8 py-4 md:py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2 md:gap-3 group cursor-pointer">
          <div className="relative w-8 h-8 md:w-10 md:h-10 group-hover:scale-110 transition-transform duration-300">
            <Image 
              src="/logo.png" 
              alt="GAM3HUB Logo" 
              fill 
              className="object-contain drop-shadow-[0_0_10px_rgba(var(--primary),0.3)]" 
            />
          </div>
          <span className="text-xl md:text-2xl font-black text-foreground italic tracking-tighter uppercase font-heading">
            GAM3<span className="text-primary">HUB</span>
          </span>
        </div>

        {address ? (
          <button 
            onClick={() => openWallet()}
            className="flex items-center gap-3 px-4 md:px-6 py-2 md:py-2.5 rounded-2xl bg-primary/10 border border-primary/30 text-foreground font-black text-xs md:text-sm uppercase italic tracking-wider backdrop-blur-md shadow-xl border-dashed"
          >
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            {formattedAddress}
          </button>
        ) : (
          <button 
            onClick={() => openConnect()}
            className="flex items-center gap-2 md:gap-3 px-4 md:px-6 py-2 md:py-2.5 rounded-2xl bg-primary/5 hover:bg-primary/10 border border-primary/20 text-foreground font-black text-xs md:text-sm uppercase italic tracking-wider transition-all duration-300 backdrop-blur-md shadow-xl group"
          >
            <Wallet className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
            Connect Wallet
          </button>
        )}
      </header>

      {/* Hero Section (Simplified) */}
      <div className="relative z-10 max-w-7xl mx-auto px-2 pt-8 pb-14">
        {/* Hero content removed for a cleaner dashboard look */}

      {/* Game Browse Section */}
        <div className="relative z-10 max-w-6xl mx-auto px-2 md:px-6 pb-24">
        {/* Featured Label */}
        <div className="flex items-center gap-4 mb-6 md:mb-10 overflow-hidden">
          <div className="h-px flex-1 bg-linear-to-r from-transparent via-border to-transparent" />
          <div className="flex items-center gap-2 px-4 md:px-6 py-1.5 md:py-2 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-md">
             <Star className="w-3 md:w-4 h-3 md:h-4 text-primary fill-primary animate-pulse" />
             <span className="text-[10px] md:text-xs font-black text-primary uppercase tracking-[0.3em] italic">Featured</span>
          </div>
          <div className="h-px flex-1 bg-linear-to-r from-transparent via-border to-transparent" />
        </div>

        {/* Game Carousel */}
        <Carousel 
          opts={{ align: "start", loop: true }}
          className="w-full relative"
        >
          <CarouselContent className="-ml-3 md:-ml-4">
            {/* Mines Card */}
            <CarouselItem className="pl-3 md:pl-4 basis-[80%] md:basis-1/2 lg:basis-1/3">
              <GameCard 
                title="Mines PVP"
                description="Dodge bombs, find stars. High-stakes strategy."
                href="/mines"
                image="/assets/images/mines_logo.png"
                accent="amber"
              />
            </CarouselItem>

            {/* CoinFlip Card */}
            <CarouselItem className="pl-3 md:pl-4 basis-[80%] md:basis-1/2 lg:basis-1/3">
              <GameCard 
                title="Coin Flip"
                description="50/50 chance. Instant win. double your stakes."
                href="/coinflip"
                image="/assets/images/coinflip_logo.png"
                accent="blue"
              />
            </CarouselItem>

            {/* Tanks Card */}
            <CarouselItem className="pl-3 md:pl-4 basis-[80%] md:basis-1/2 lg:basis-1/3">
              <GameCard 
                title="Battle Of Tanks"
                description="Tactical tank combat. Destroy opponents, dominate the field."
                href="/tanks"
                image="/assets/images/tanks_logo.png"
                accent="amber"
              />
            </CarouselItem>

            {/* Placeholder Card 1 */}
            <CarouselItem className="pl-3 md:pl-4 basis-[80%] md:basis-1/2 lg:basis-1/3">
               <div className="h-40 md:h-60 rounded-[24px] md:rounded-[28px] border border-border/50 bg-card/10 flex flex-col items-center justify-center gap-4 glass-morphism grayscale opacity-40">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">More Games Coming Soon</span>
               </div>
            </CarouselItem>
          </CarouselContent>

          <div className="absolute top-1/2 -left-4 md:-left-12 -translate-y-1/2 transition-opacity duration-300 pointer-events-auto h-0 md:h-10">
            <CarouselPrevious className="bg-background/80 border-border hover:bg-primary hover:text-background hidden md:flex" />
          </div>
          <div className="absolute top-1/2 -right-4 md:-right-12 -translate-y-1/2 transition-opacity duration-300 pointer-events-auto h-0 md:h-10">
            <CarouselNext className="bg-background/80 border-border hover:bg-primary hover:text-background hidden md:flex" />
          </div>
        </Carousel>
      </div>

      </div>
    </main>
  );
}

interface GameCardProps {
  title: string;
  description: string;
  href: string;
  image: string;
  accent: "amber" | "blue";
}

function GameCard({ title, description, href, image, accent }: GameCardProps) {
  const accentColors: Record<string, string> = {
    amber: "from-primary/10 via-primary/5 to-transparent hover:border-primary/50 shadow-primary/5",
    blue: "from-blue-500/10 via-blue-500/5 to-transparent hover:border-blue-500/50 shadow-blue-500/5",
  };

  return (
    <Link href={href}>
      <motion.div 
        whileHover={{ y: -8 }}
        whileTap={{ scale: 0.98 }}
        className={`group relative h-40 md:h-60 p-4 md:p-7 rounded-[24px] md:rounded-[32px] bg-linear-to-br ${accentColors[accent]} border border-border overflow-hidden shadow-2xl backdrop-blur-md`}
      >
        {/* Animated Background Graphic */}
        <div className="absolute top-[-5%] right-[-5%] opacity-5 group-hover:opacity-10 transition-opacity rotate-12">
           <Image src={image} alt="" width={140} height={140} className="object-contain" />
        </div>

        <div className="h-full flex flex-col justify-between">
          <div>
            <div className={`w-9 md:w-14 h-9 md:h-14 rounded-lg md:rounded-2xl bg-card border border-border flex items-center justify-center mb-2.5 md:mb-4 shadow-lg overflow-hidden`}>
              <Image src={image} alt={title} width={50} height={50} className="object-cover scale-75 md:scale-100" />
            </div>
            <h2 className="text-lg md:text-2xl font-black text-card-foreground uppercase italic tracking-tighter mb-1 md:mb-2 font-heading drop-shadow-md leading-none">
              {title}
            </h2>
            <p className="text-muted-foreground text-[8px] md:text-[10px] font-medium max-w-[120px] md:max-w-[160px] leading-tight uppercase tracking-wider">
              {description}
            </p>
          </div>

          <div className="flex items-end justify-end">
            <div className="w-8 md:w-11 h-8 md:h-11 flex items-center justify-center bg-card border border-border rounded-full group-hover:bg-primary group-hover:text-background group-hover:scale-110 transition-all duration-300 shadow-lg">
               <ArrowRight className="w-3.5 md:w-5 h-3.5 md:h-5" />
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
