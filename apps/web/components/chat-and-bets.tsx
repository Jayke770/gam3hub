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
import { Wallet, ChevronRight } from "lucide-react";
import { ChatArea } from "./chat-area";

interface Bet {
  id: string;
  user: string;
  amount: string;
  face: "Heads" | "Tails";
  time: string;
}

export function ChatAndBets(props: { isMobile: boolean }) {
  const { openWallet, isConnected } = useInterwovenKit();
  const [isBetting, setIsBetting] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "bets">("bets");
  const [bets, setBets] = useState<Bet[]>([
    { id: "1", user: "0x8F2e...A93b", amount: "500.00", face: "Heads", time: "Just now" },
    { id: "2", user: "0x3C1d...D2e1", amount: "150.50", face: "Tails", time: "2s ago" },
    { id: "3", user: "0x1A2b...F5c7", amount: "1000.00", face: "Tails", time: "10s ago" },
    { id: "4", user: "0x7D4e...B1a2", amount: "5000.00", face: "Heads", time: "12s ago" },
    { id: "5", user: "0x9F3c...E4d1", amount: "25.00", face: "Heads", time: "20s ago" },
  ]);

  const handleBetSuccess = (amount: string, side: "Heads" | "Tails") => {
    const newBet: Bet = {
      id: Math.random().toString(),
      user: "You",
      amount: parseFloat(amount).toFixed(2),
      face: side,
      time: "Just now",
    };

    setBets([newBet, ...bets]);
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
            {!props.isMobile && (
              <div className="flex flex-row items-center justify-between p-4 border-b border-border/50 shrink-0 space-y-0">
                <h1 className="text-xl font-black bg-clip-text text-transparent bg-linear-to-r from-primary to-primary/60 drop-shadow-sm">
                  Coinflip
                </h1>
                {isConnected && (
                  <Button onClick={openWallet} size={"icon"} variant={"ghost"} className="cursor-pointer rounded-full">
                    <Wallet className="size-5" />
                  </Button>
                )}
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
                    Recent Bets
                  </TabsTrigger>
                  <TabsTrigger value="chat" className="cursor-pointer">
                    Chat
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 overflow-hidden px-0 pb-0 p-0">
                <TabsContent value="bets" className="m-0 h-full flex flex-col outline-hidden bg-transparent">
                  <div className="flex-1 overflow-y-auto px-4 py-2 custom-scrollbar space-y-1">
                    {bets.map((bet, idx) => (
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
                    ))}
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
                  <Button
                    onClick={() => setIsBetting(true)}
                    size="lg"
                    className="w-full group transition-all rounded-xl font-black text-sm cursor-pointer shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-[0.99]"
                  >
                    Place Bet <ChevronRight className="size-4 ml-1 group-hover:ml-2 transition-all" />
                  </Button>
                ) : (
                  <Button
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
