import { MinesRoomProvider } from "@/components/providers/colyseus/mines";

export default function MinesLayout({ children }: { children: React.ReactNode }) {
    return (
        <MinesRoomProvider>
            {children}
        </MinesRoomProvider>
    )
}   