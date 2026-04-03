"use client"
import { type ReactNode } from "react";
import { createRoomContext, type UseRoomResult, type Snapshot } from "@colyseus/react";
import { Client, type SeatReservation } from "@colyseus/sdk";
import { useMessageStore } from "@/hooks/useMessageStore"
import { CoinFlipState } from '@workspace/shared/colysues/schema'
import useSWR from 'swr'
import { Badge } from "@workspace/ui/components/badge"
import { Spinner } from "@workspace/ui/components/spinner"
import { cn } from '@workspace/ui/lib/utils'
import { useInterwovenKit } from "@initia/interwovenkit-react";

const context = createRoomContext<CoinFlipState>();
const RoomProvider = context.RoomProvider;
const useRoom: () => UseRoomResult<unknown, CoinFlipState> = context.useRoom;
const useRoomState: <U = unknown>(selector?: (state: CoinFlipState) => U) => Snapshot<U> | undefined = context.useRoomState;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const useRoomMessage: any = context.useRoomMessage;

const gameClient = new Client("ws://localhost:2567")


function MessageHandler() {
    const addMessage = useMessageStore((state) => state.addMessage);

    useRoomMessage("chat", (msg: { user: string; message: string; dateTime?: string }) => {
        console.log(msg)
        addMessage({ user: msg.user, message: msg.message, dateTime: msg.dateTime });
    });

    return null;
}

function RoomStatus() {
    const room = useRoom();
    return (
        <Badge
            className={cn("fixed top-2 left-2 z-50", room.isConnecting ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 animate-pulse" : "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300")}>
            {!room || room?.isConnecting && <Spinner data-icon="inline-start" />}
            {!room || room?.isConnecting ? "Connecting..." : " Live"}
        </Badge>
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