"use client"

import { useInterwovenKit } from "@initia/interwovenkit-react"
import { Button } from "@workspace/ui/components/button"
import { Wallet } from "lucide-react"
import { useAccount } from "wagmi"

export function WalletButton() {
  const { address } = useAccount()
  const { openConnect, openWallet , } = useInterwovenKit()

  if (address) {
    return (
      <Button
        variant="outline"
        size="icon"
        onClick={openWallet}
        title="Open wallet"
        className="h-9 w-9 rounded-full border-primary/20 bg-primary/10 backdrop-blur-xl hover:bg-primary/20 hover:border-primary/40 transition-all duration-300 group shadow-[0_0_20px_rgba(var(--primary),0.1)] relative"
      >
        <div className="relative flex items-center justify-center">
          <Wallet className="w-4 h-4 text-primary" />
          {/* connected dot */}
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.7)]">
            <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-60" />
          </span>
        </div>
      </Button>
    )
  }

  return (
    <Button
      size="sm"
      onClick={openConnect}
      className="h-8  cursor-pointer px-3 gap-1.5 text-xs font-semibold shadow-[0_0_16px_rgba(var(--primary),0.25)] transition-all duration-300 bg-linear-to-br from-primary to-primary/70 border-0"
    >
      <Wallet className="w-3.5 h-3.5" />
      Connect Wallet
    </Button>
  )
}
