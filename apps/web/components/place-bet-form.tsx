"use client";

import { toast } from "sonner";
import { Button } from "@workspace/ui/components/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
  FieldTitle,
} from "@workspace/ui/components/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/ui/components/toggle-group";
import { useInterwovenKit, usePortfolio } from "@initia/interwovenkit-react";
import { useSwitchChain, usePublicClient } from "wagmi";
import { parseEther, Hex, encodeFunctionData } from "viem";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { GAM3HUB_ABI } from "@/lib/abis/Gam3Hub";
import { COINFLIP_CONTRACT_ADDRESS, gameClient, TARGET_CHAIN_ID, BECH32_CHAIN_ID } from "@/lib/constants";
import { useRoom } from "@/components/providers/colyseus";
import { useUserBalance } from "@/hooks/use-user-balance";
import { ArrowLeft, Coins } from "lucide-react";
import { motion } from "motion/react";
import { JoinGameSchema } from "@workspace/shared/colysues/rooms";

const formSchema = z.object({
  amount: z.string().min(1, "Amount is required"),
  side: z.enum(["Heads", "Tails"]).default("Heads"),
});

type FormValues = z.infer<typeof formSchema>;

interface PlaceBetFormProps {
  onBetPlaced: (data: z.infer<typeof JoinGameSchema>) => void;
  onCancel: () => void;
}

export function PlaceBetForm({ onBetPlaced, onCancel }: PlaceBetFormProps) {
  const { room } = useRoom();
  const isDemoMode = room?.state?.isDemoMode;
  const { isConnected, hexAddress: userWalletAddress, initiaAddress, requestTxBlock } = useInterwovenKit();
  const { balance: demoBalance, mutate: refreshDemoBalance } = useUserBalance(userWalletAddress);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: "",
    },
  });

  const publicClient = usePublicClient();
  const { mutateAsync: switchChainAsync } = useSwitchChain();
  const { assetGroups, isLoading } = usePortfolio();
  const initAssetGroup = assetGroups?.find((group) => group.symbol === "INIT");
  const evmInitAsset = initAssetGroup?.assets?.find((a) => a.denom.startsWith("evm"));

  const handleMaxAmount = () => {
    if (isDemoMode) {
      form.setValue("amount", demoBalance.toString(), { shouldValidate: true });
      return;
    }
    if (evmInitAsset) {
      const roundedAmount = Math.floor(Number(evmInitAsset.quantity) * 100) / 100;
      form.setValue("amount", roundedAmount.toString(), { shouldValidate: true });
    }
  };

  const onSubmit = async (data: FormValues) => {
    if (!userWalletAddress || !publicClient || (!initiaAddress && !isDemoMode)) return;

    const toastId = toast.loading(isDemoMode ? "Placing demo bet..." : "Processing transaction...", {
      description: `Betting ${data.amount} INIT on ${data.side}`,
    });

    try {
      const sideInt = data.side === "Heads" ? 1 : 0;

      if (!isDemoMode) {
        if (typeof window !== "undefined") {
          await switchChainAsync({ chainId: TARGET_CHAIN_ID });
        }

        const response = await gameClient.http.get("/api/get-signature", {
          query: {
            user: userWalletAddress,
            side: sideInt.toString()
          }
        });

        const signatureData = response.data as {
          signature: Hex,
          currentGameId: Hex
        };

        const dataEncoded = encodeFunctionData({
          abi: GAM3HUB_ABI,
          functionName: 'joinGame',
          args: [sideInt, signatureData.signature],
        });

        const txResponse = await requestTxBlock({
          chainId: BECH32_CHAIN_ID,
          messages: [
            {
              typeUrl: "/minievm.evm.v1.MsgCall",
              value: {
                sender: initiaAddress!.toLowerCase(),
                contractAddr: COINFLIP_CONTRACT_ADDRESS,
                input: dataEncoded,
                value: parseEther(data.amount).toString(),
                accessList: [],
                authList: [],
              }
            }
          ]
        });

        const hash = txResponse.transactionHash as Hex;

        toast.success("Transaction Submitted!", {
          id: toastId,
          description: (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground font-sans">Tx Hash:</span>
              <pre className="w-full overflow-x-auto rounded bg-muted/40 p-2 text-[10px] font-mono">
                <code>{hash}</code>
              </pre>
            </div>
          ),
        });
      } else {
        // Simulate delay for demo
        await new Promise(r => setTimeout(r, 1000));
        await refreshDemoBalance();
        toast.success("Demo Bet Placed!", {
          id: toastId,
          description: "No blockchain transaction required in Demo Mode.",
        });
      }

      onBetPlaced({ playerAddress: userWalletAddress, amount: Number(data.amount), side: sideInt as 0 | 1 });
      form.reset();
      onCancel();
    } catch (err: unknown) {
      const error = err as Error;
      console.error("Error placing bet:", error);
      toast.error(isDemoMode ? "Demo Bet Failed" : "Transaction Failed", {
        id: toastId,
        description: error.message || "An unexpected error occurred",
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-card/10 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="p-4 border-b border-border/50 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onCancel}
          className="size-8 rounded-full cursor-pointer hover:bg-muted/50"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black flex items-center gap-2 tracking-tight">
              <Coins className="size-4 text-primary" />
              Place Bet
            </h2>
            {isDemoMode && (
              <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-black tracking-widest uppercase border border-primary/30">
                Demo Mode
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 p-5 overflow-y-auto custom-scrollbar">
        <form id="place-bet-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FieldGroup>
            <Controller
              name="amount"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <div className="flex items-center justify-between w-full mb-1 px-1">
                    <FieldLabel htmlFor="amount" className="font-black uppercase tracking-widest text-[9px] opacity-70">Bet Amount</FieldLabel>
                    {isConnected && (
                      <button
                        type="button"
                        onClick={handleMaxAmount}
                        disabled={isLoading}
                        className="text-[9px] font-bold text-primary hover:underline cursor-pointer uppercase opacity-70 hover:opacity-100 disabled:opacity-30"
                      >
                        {isLoading ? "..." : `Max: ${isDemoMode ? demoBalance : parseFloat(evmInitAsset?.quantity || "0").toFixed(2)}`}
                      </button>
                    )}
                  </div>
                  <InputGroup className="bg-background/40 border-2 border-border/50 rounded-xl overflow-hidden focus-within:border-primary/50 transition-colors">
                    <InputGroupAddon align="inline-end" className="pl-3">
                      <span className="font-black text-[10px] text-primary/50">INIT</span>
                    </InputGroupAddon>
                    <InputGroupInput
                      {...field}
                      id="amount"
                      type="number"
                      placeholder="0.00"
                      className="text-base h-14 font-black border-none focus-visible:ring-0"
                      aria-invalid={fieldState.invalid}
                    />
                  </InputGroup>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Controller
              name="side"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldTitle className="font-black uppercase tracking-widest text-[9px] opacity-70 mb-2 px-1">Side</FieldTitle>
                  <ToggleGroup
                    type="single"
                    value={field.value}
                    onValueChange={(val) => {
                      if (val) field.onChange(val);
                    }}
                    className="grid grid-cols-2 w-full"
                    spacing={3}
                  >
                    <ToggleGroupItem
                      value="Heads"
                      variant="outline"
                      className="font-black cursor-pointer h-24 rounded-2xl flex flex-col items-center justify-center gap-2 data-[state=on]:bg-primary/20 data-[state=on]:border-primary border-2 border-border/50 hover:border-primary/30 transition-all bg-background/20 group"
                    >
                      <motion.div 
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", damping: 15 }}
                        className="size-10 rounded-full bg-yellow-500/10 border-2 border-yellow-500/30 flex items-center justify-center group-data-[state=on]:scale-110 transition-transform"
                      >
                        <div className="size-6 rounded-full bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.6)]" />
                      </motion.div>
                      <span className="text-[10px] uppercase tracking-[0.2em] group-data-[state=on]:text-primary">Heads</span>
                    </ToggleGroupItem>

                    <ToggleGroupItem
                      value="Tails"
                      variant="outline"
                      className="font-black cursor-pointer h-24 rounded-2xl flex flex-col items-center justify-center gap-2 data-[state=on]:bg-primary/20 data-[state=on]:border-primary border-2 border-border/50 hover:border-primary/30 transition-all bg-background/20 group"
                    >
                      <motion.div 
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", damping: 15, delay: 0.1 }}
                        className="size-10 rounded-full bg-zinc-500/10 border-2 border-zinc-500/30 flex items-center justify-center group-data-[state=on]:scale-110 transition-transform"
                      >
                        <div className="size-6 rounded-full bg-zinc-400 shadow-[0_0_10px_rgba(161,161,170,0.6)]" />
                      </motion.div>
                      <span className="text-[10px] uppercase tracking-[0.2em] group-data-[state=on]:text-primary">Tails</span>
                    </ToggleGroupItem>
                  </ToggleGroup>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          </FieldGroup>
        </form>
      </div>

      <div className="p-4 border-t border-border/50 bg-card/50">
        <Button
          type="submit"
          form="place-bet-form"
          size="lg"
          disabled={!form.formState.isValid || form.formState.isSubmitting}
          className="w-full font-black rounded-xl text-sm shadow-lg shadow-primary/10 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
        >
          {form.formState.isSubmitting ? "Placing Bet..." : "Confirm Bet"} </Button>
      </div>
    </div>
  );
}
