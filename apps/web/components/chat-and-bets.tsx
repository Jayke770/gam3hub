"use client";

import { useState } from "react";
import { Button } from "@workspace/ui/components/button";
import { motion, AnimatePresence } from "motion/react";

import { PlaceBetForm } from "./place-bet-form";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@workspace/ui/components/tabs";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import { Wallet, ChevronRight, Coins } from "lucide-react";
import { ChatArea } from "./chat-area";
import { DrawerHeader, DrawerTitle } from "@workspace/ui/components/drawer";
import { useRoom, useRoomState } from "./providers/colyseus";
import { useUserBalance } from "../hooks/use-user-balance";
import { JoinGameSchema } from "@workspace/shared/colysues/rooms";
import z from "zod";
import { formatDistanceToNow } from "date-fns";
import { Bet as RoomBet } from "@workspace/shared/colysues/schema";
interface Bet {
  id: string;
  user: string;
  amount: string;
  face: "Heads" | "Tails";
  time: string;
}

export function ChatAndBets(props: { isMobile: boolean }) {
  const { room } = useRoom()
  const roomState = useRoomState(state => state)
  const isDemoMode = roomState?.isDemoMode;
  const { openWallet, isConnected, hexAddress } = useInterwovenKit();
  const { balance: demoBalance } = useUserBalance(hexAddress);
  const [isBetting, setIsBetting] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "bets">("bets");

  const betsMap = roomState?.bets as unknown as Record<string, RoomBet> | Map<string, RoomBet> | undefined;

  const betsArray: RoomBet[] = betsMap
    ? typeof (betsMap as Map<string, RoomBet>).values === "function"
      ? Array.from((betsMap as Map<string, RoomBet>).values())
      : Object.values(betsMap as Record<string, RoomBet>)
    : [];

  const bets: Bet[] = betsArray
    .sort((a, b) => new Date(b.dt).getTime() - new Date(a.dt).getTime())
    .map((b) => ({
      id: b.address,
      user: `${b.address.slice(0, 6)}...${b.address.slice(-4)}`,
      amount: Number(b.amount).toFixed(2),
      face: b.side === 1 ? "Heads" : "Tails",
      time: b.dt ? formatDistanceToNow(new Date(b.dt), { addSuffix: true }) : "Just now"
    }));


  const handleBetSuccess = (data: z.infer<typeof JoinGameSchema>) => {
    room?.send("joinGame", data)
    setIsBetting(false);
  };

  return (
    <div className="flex flex-col h-full w-full relative shrink-0 bg-transparent lg:bg-card/60 lg:backdrop-blur-2xl rounded-none lg:rounded-2xl p-0 gap-0 overflow-hidden">
      <AnimatePresence mode="wait">
        {isBetting ? (
          <motion.div
            key="bet-form"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            transition={{ duration: 0.17 }}
            className="flex-1 overflow-hidden"
          >
            <PlaceBetForm
              onBetPlaced={handleBetSuccess}
              onCancel={() => setIsBetting(false)}
            />
          </motion.div>
        ) : (
          <motion.div
            key="tabs-view"
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 20, opacity: 0 }}
            transition={{ duration: 0.17 }}
            className="flex flex-col flex-1 overflow-hidden"
          >
            {/* Header */}
              {props.isMobile ? (
                <DrawerHeader className="py-2!">
                  <DrawerTitle>Coinflip</DrawerTitle>
                  <div className="flex justify-end items-center gap-2">
                    {isConnected && isDemoMode && (
                      <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-primary/20 border border-primary/30">
                        <Coins className="size-3 text-primary" />
                        <span className="text-[10px] font-black text-primary">{demoBalance}</span>
                      </div>
                    )}
                    {isConnected && (
                      <Button onClick={openWallet} size={"icon"} variant={"ghost"} className=" cursor-pointer rounded-full">
                        <Wallet />
                      </Button>
                    )}
                  </div>
                </DrawerHeader>
              ) : (
              <div className="flex flex-row items-center justify-between p-4 border-b border-border/50 shrink-0 space-y-0">
                <h1 className="text-xl font-black bg-clip-text text-transparent bg-linear-to-r from-primary to-primary/60 drop-shadow-sm">
                  Coinflip
                </h1>
                <div className="flex items-center gap-2">
                {isConnected && isDemoMode && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 shrink-0">
                    <Coins className="size-3.5 text-primary" />
                    <span className="text-xs font-black text-primary uppercase tracking-tight">{demoBalance} INIT</span>
                  </div>
                )}
                {isConnected && (
                  <Button onClick={openWallet} size={"icon"} variant={"ghost"} className="cursor-pointer rounded-full">
                    <Wallet className="size-5" />
                  </Button>
                )}
                </div>
              </div>
            )}

            <Tabs
              value={activeTab}
              onValueChange={(val) => setActiveTab(val as "chat" | "bets")}
              className="flex flex-col flex-1 overflow-hidden"
            >
              <div className="p-4 shrink-0 pb-2">
                <TabsList className="w-full grid grid-cols-2">
                  <TabsTrigger value="bets" className="cursor-pointer">
                    Bets
                  </TabsTrigger>
                  <TabsTrigger value="chat" className="cursor-pointer">
                    Chat
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 overflow-hidden px-0 pb-0 p-0">
                <TabsContent value="bets" className="m-0 h-full flex flex-col outline-hidden bg-transparent">
                  <div className="flex-1 overflow-y-auto px-4 py-2 custom-scrollbar space-y-1">
                    {bets.length > 0 ? (
                      bets.map((bet, idx) => (
                        <motion.div
                          role="button"
                          key={bet.id}
                          initial={{ y: 10, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ delay: idx * 0.05 }}
                          className="p-3 cursor-pointer rounded-xl border border-border/50 bg-background/50 hover:bg-muted/30 transition-colors flex items-center justify-between group"
                        >
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-bold">{bet.user}</span>
                            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{bet.time}</span>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-sm font-mono font-black text-primary">{bet.amount} INIT</span>
                            <span className={`text-[10px] uppercase font-black tracking-widest ${bet.face === "Heads" ? "text-amber-500" : "text-slate-400"}`}>
                              {bet.face}
                            </span>
                          </div>
                        </motion.div>
                      ))
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center opacity-50 space-y-2 py-10">
                        <span className="text-sm font-bold tracking-widest uppercase">No bets</span>
                        <span className="text-[10px] font-medium">Be the first to place a bet!</span>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="chat" className="m-0 h-full outline-hidden bg-transparent">
                  <ChatArea />
                </TabsContent>
              </div>
            </Tabs>

            {/* Place Bet Button / Footer - Only show on Bets tab */}
            {activeTab === "bets" && (
              <div className="p-4 border-t border-border/50 bg-card/80 backdrop-blur-md shrink-0">
                {isConnected ? (
                  (() => {
                    const hasJoined = hexAddress ? betsArray.some(b => b.address.toLowerCase() === hexAddress.toLowerCase()) : false;
                    return (
                      <Button
                        type="button"
                        disabled={hasJoined}
                        onClick={() => setIsBetting(true)}
                        size="lg"
                        className="w-full group transition-all rounded-xl font-black text-sm cursor-pointer shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed"
                      >
                        {hasJoined ? "Already Joined" : "Bet now!"} <ChevronRight className={`size-4 ml-1 transition-all ${!hasJoined && "group-hover:ml-2"}`} />
                      </Button>
                    );
                  })()
                ) : (
                      <Button
                        type="button"
                    onClick={openWallet}
                    size="lg"
                    className="w-full h-12 rounded-xl font-black text-sm uppercase tracking-widest cursor-pointer shadow-lg shadow-primary/20"
                  >
                    Connect Wallet
                  </Button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
