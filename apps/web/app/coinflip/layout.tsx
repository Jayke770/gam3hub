import { CoinFlipRoomProvider } from "@/components/providers/colyseus/coinflip";

export default function CoinFlipLayout({ children }: { children: React.ReactNode }) {
    return (
        <CoinFlipRoomProvider>
            {children}
        </CoinFlipRoomProvider>
    )
}