"use client"
import { type ReactNode } from "react";
import { createRoomContext, type UseRoomResult, type Snapshot } from "@colyseus/react";
import type { SeatReservation } from "@colyseus/sdk";
import { useMessageStore } from "@/hooks/useMessageStore"
import { CoinFlipState } from '@workspace/shared/colysues/schema'
import useSWR from 'swr'
import { Badge } from "@workspace/ui/components/badge"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from '@workspace/ui/lib/utils'
import { useInterwovenKit } from "@initia/interwovenkit-react";
import { toast } from "sonner";
import { gameClient } from "@/lib/constants";

const context = createRoomContext<CoinFlipState>();
const RoomProvider = context.RoomProvider;
const useRoom: () => UseRoomResult<unknown, CoinFlipState> = context.useRoom;
const useRoomState: <U = unknown>(selector?: (state: CoinFlipState) => U) => Snapshot<U> | undefined = context.useRoomState;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const useRoomMessage: any = context.useRoomMessage;

import { useEffect } from "react";

function MessageHandler() {
    const setMessages = useMessageStore((state) => state.setMessages);
    const messagesInState = useRoomState((state) => state.messages);
    
    useEffect(() => {
        if (messagesInState) {
            // Map the ArraySchema messages into our local store format
            const history = messagesInState.map(m => ({
                id: Math.random().toString(36).substring(7),
                user: m.user,
                message: m.message,
                dateTime: m.dateTime
            }));
            setMessages(history);
        }
    }, [messagesInState, setMessages]);
    
    useRoomMessage("error", (msg: string) => {
        toast.error(msg);
    });

    return null;
}

function RoomStatus() {
    const room = useRoom();
    const isDemoMode = room?.room?.state?.isDemoMode;

    return (
        <div className="fixed top-2 left-2 z-50 flex items-center gap-2">
            <Badge
                className={cn(
                    !room.room?.state || room.isConnecting
                        ? "bg-red-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 animate-pulse"
                        : "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                )}
            >
                {!room?.room?.state || room?.isConnecting ? <Spinner data-icon="inline-start" /> : null}
                {!room?.room?.state || room?.isConnecting ? "Connecting..." : " Live"}
            </Badge>
            {isDemoMode && (
                <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30 font-black tracking-widest text-[9px] uppercase">
                    Demo
                </Badge>
            )}
        </div>
    )
}

export function ColyseusProvider({ children }: { children: ReactNode }) {
    const { hexAddress: userWalletAddress } = useInterwovenKit()
    const { data } = useSWR<SeatReservation>('/api/user', () => gameClient.http.post("/api/join-room", { body: { user: userWalletAddress ?? "Anonymous" } }).then(e => e.data).catch(() => null))
    return (
        <RoomProvider connect={data ? () => gameClient.consumeSeatReservation(data) : false} >
            <RoomStatus />
            <MessageHandler />
            {children}
        </RoomProvider>
    )
}

export { useRoom, useRoomState, useRoomMessage }