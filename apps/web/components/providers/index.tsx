"use client"
import { useEffect } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { InterwovenKitProvider, TESTNET, injectStyles, initiaPrivyWalletConnector, } from "@initia/interwovenkit-react"
import { WagmiProvider, createConfig, http } from "wagmi"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { ColyseusProvider } from "@/components/providers/colyseus"
import interwovenKitStyles from "@initia/interwovenkit-react/styles.js"
import { Toaster } from "@workspace/ui/components/sonner"
const queryClient = new QueryClient()

const minievm = {
  id: 4303131403034904,
  name: 'Minievm',
  nativeCurrency: { name: 'INIT', symbol: 'INIT', decimals: 18 },
  rpcUrls: {
    default: {
      http: ['https://jsonrpc-evm-1.anvil.asia-southeast.initia.xyz'],
    },
  },
}
const wagmiConfig = createConfig({
  connectors: [initiaPrivyWalletConnector],
  chains: [minievm],
  transports: { [minievm.id]: http() },
})


export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    injectStyles(interwovenKitStyles)
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        <InterwovenKitProvider  {...TESTNET} >
          <ThemeProvider>
            <ColyseusProvider>
              {children}
              <Toaster position="bottom-center" richColors />
            </ColyseusProvider>
          </ThemeProvider>
        </InterwovenKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  )
}
